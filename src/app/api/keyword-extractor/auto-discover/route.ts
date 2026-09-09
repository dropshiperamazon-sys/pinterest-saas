import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { discoverSiteContent } from "@/lib/keyword-extractor/category-crawler";
import { isArticleUrl } from "@/lib/keyword-extractor/relevance-engine";
import { fetchPageMeta } from "@/lib/keyword-extractor/page-crawler";
import { classifyPage } from "@/lib/keyword-extractor/article-classifier";
import {
  extractArticleKeyword,
  aggregateKeywords,
  buildClusters,
} from "@/lib/keyword-extractor/article-keyword-extractor";
import type { SitemapURL } from "@/lib/keyword-extractor/sitemap-service";
import type { PageMeta } from "@/lib/keyword-extractor/page-crawler";
import type { KeywordAggregate, TopicCluster } from "@/lib/keyword-extractor/article-keyword-extractor";
import type { ProgressEvent } from "@/app/api/keyword-extractor/extract/route";

// Phase 1: slug-based keywords for ALL candidates (instant, no network)
// Phase 2: page-fetch enrichment for top ENRICH_MAX articles (fills in title/H1/headings)
//
// This ensures articlesAnalyzed == articleCandidates regardless of count,
// while the enrichment pass gives higher-confidence keywords to the most recent articles.

const ENRICH_MAX = 100;   // max page fetches per request (Vercel 60s budget)
const CONCURRENCY = 20;   // concurrent page fetches in enrichment pass

export interface ArticleResult {
  url: string;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  confidence: number;
  cluster: string;
  datePublished?: string;
  dateModified?: string;
}

export type DiscoveryConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface AutoDiscoverResponse {
  articles: ArticleResult[];
  keywords: KeywordAggregate[];
  clusters: TopicCluster[];
  // Discovery stats
  totalUrlsFound: number;
  totalArticleCandidates: number;
  articlesAnalyzed: number;
  urlsFromSitemaps: number;
  homepageLinks: number;
  hubsDiscovered: number;
  hubsCrawled: number;
  paginationPagesCrawled: number;
  sitemapsFound: string[];
  sitemapsProcessed: number;
  uniquePrimaryKeywords: number;
  totalClusters: number;
  discoveryConfidence: DiscoveryConfidence;
  // Exclusion breakdown
  excludedLegal: number;
  excludedUtility: number;
  excludedLowConfidence: number;
  excludedProduct: number;
}

function calculateDiscoveryConfidence(
  sitemapUrls: number,
  internalArticleLinks: number,
  hubsCrawled: number,
): DiscoveryConfidence {
  // HIGH: sitemap provided substantial inventory, or hubs + sitemap together found plenty
  if (sitemapUrls >= 100) return "HIGH";
  if (sitemapUrls >= 20 && hubsCrawled >= 3) return "HIGH";
  // MEDIUM: some sitemap data, or meaningful hub crawl found content
  if (sitemapUrls >= 10 || internalArticleLinks >= 50) return "MEDIUM";
  if (hubsCrawled >= 5) return "MEDIUM";
  // LOW: only homepage links, no sitemap, no hub traversal
  return "LOW";
}

function normalizeForDedup(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) path = path.slice(0, -1);
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function extractRootDomain(input: string): string {
  const withProtocol = input.startsWith("http") ? input : `https://${input}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.hostname}`;
}

// Minimal PageMeta using only URL slug — no network required.
// extractArticleKeyword falls back to Strategy 4 (slug) when title/H1 are absent.
function slugOnlyMeta(sitemapEntry: SitemapURL): PageMeta {
  return {
    url: sitemapEntry.loc,
    title: "",
    ogTitle: "",
    canonical: "",
    h1: "",
    headings: "",
    metaDescription: "",
    breadcrumbs: "",
    bodySnippet: "",
    datePublished: sitemapEntry.lastmod,
    dateModified: sitemapEntry.lastmod,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const body = await req.json() as { domain?: string };
  const rawInput = body.domain ?? "";

  if (!rawInput) {
    return new Response(JSON.stringify({ error: "Website domain is required" }), { status: 400 });
  }

  let rootDomain: string;
  try {
    rootDomain = extractRootDomain(rawInput);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid domain" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        // ── Step 1: Sitemap discovery ────────────────────────────────────
        send({ type: "progress", stage: "sitemap", message: "Reading robots.txt and discovering sitemaps…" });

        const sitemapResult = await crawlSitemap(rootDomain, (p) => {
          send({
            type: "progress",
            stage: "sitemap",
            message: p.message,
            counts: {
              sitemapsDiscovered: p.sitemapsDiscovered,
              sitemapsProcessed: p.sitemapsProcessed,
              urlsFromSitemaps: p.urlsFromSitemaps,
            },
          });
        });

        // ── Step 2: Internal content discovery (homepage + hub pages) ──────
        // Discovers content even when sitemap is absent or incomplete.
        // Crawls hub/category pages one level deep to find article links.
        send({ type: "progress", stage: "homepage", message: "Crawling homepage and content hubs for supplemental links…" });

        const siteDiscovery = await discoverSiteContent(rootDomain, (msg) => {
          send({ type: "progress", stage: "homepage", message: msg });
        });

        // ── Step 3: Merge + dedup ────────────────────────────────────────
        const dedupMap = new Map<string, SitemapURL>();
        for (const u of sitemapResult.urls) {
          const key = normalizeForDedup(u.loc);
          if (!dedupMap.has(key)) dedupMap.set(key, u);
        }
        for (const link of siteDiscovery.articleLinks) {
          const key = normalizeForDedup(link);
          if (!dedupMap.has(key)) dedupMap.set(key, { loc: link });
        }

        const allUrls = Array.from(dedupMap.values());

        send({
          type: "progress",
          stage: "discovery",
          message: `Discovered ${allUrls.length.toLocaleString()} unique URLs (sitemap: ${sitemapResult.urls.length.toLocaleString()}, hubs crawled: ${siteDiscovery.hubsCrawled})`,
          counts: {
            totalUrls: allUrls.length,
            urlsFromSitemaps: sitemapResult.urls.length,
            homepageLinks: siteDiscovery.homepageLinksFound,
          },
        });

        // ── Step 4: Classify article URLs ────────────────────────────────
        const articleCandidates = allUrls.filter((u) => isArticleUrl(u.loc));

        // Sort by recency (most recent first) — used for enrichment priority
        const sorted = [...articleCandidates].sort((a, b) => {
          if (a.lastmod && b.lastmod) return b.lastmod.localeCompare(a.lastmod);
          if (a.lastmod) return -1;
          if (b.lastmod) return 1;
          return 0;
        });

        send({
          type: "progress",
          stage: "classify",
          message: `${articleCandidates.length.toLocaleString()} article candidates — extracting keywords…`,
          counts: { totalUrls: allUrls.length, articleCandidates: articleCandidates.length },
        });

        // ── Step 5 (Phase 1): Slug-based keyword extraction for ALL candidates ──
        // Instant — no network — gives every article at least a keyword from its URL.
        // extractArticleKeyword Strategy 4 fires when title/H1 are empty.

        const articleMap = new Map<string, ArticleResult>();

        for (const candidate of sorted) {
          const meta = slugOnlyMeta(candidate);
          const kw = extractArticleKeyword(meta);
          if (!kw.primary || kw.primary.length < 3) continue;
          const key = normalizeForDedup(candidate.loc);
          articleMap.set(key, {
            url: candidate.loc,
            title: candidate.loc, // placeholder — overwritten in Phase 2 if fetched
            primaryKeyword: kw.primary,
            secondaryKeywords: kw.secondary,
            confidence: kw.confidence,
            cluster: kw.cluster,
            datePublished: candidate.lastmod,
            dateModified: candidate.lastmod,
          });
        }

        send({
          type: "progress",
          stage: "analysis",
          message: `${articleMap.size} articles covered by slug extraction — enriching top ${Math.min(ENRICH_MAX, articleMap.size)} with page data…`,
          counts: { analyzing: 0, total: Math.min(ENRICH_MAX, sorted.length) },
        });

        // ── Step 6 (Phase 2): Page-fetch enrichment for top ENRICH_MAX articles ─
        // Higher-quality keywords (title, H1, headings) override slug-only results.
        // classifyPage() removes false positives (legal/utility pages).
        // CONCURRENCY=20 and 5s timeout → ~100 articles in ~25s, well within 60s.

        const toEnrich = sorted.slice(0, ENRICH_MAX).map((u) => u.loc);
        let excludedLegal = 0;
        let excludedUtility = 0;
        let excludedLowConfidence = 0;
        let excludedProduct = 0;

        for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
          const batch = toEnrich.slice(i, i + CONCURRENCY);
          const metas = await Promise.all(batch.map((u) => fetchPageMeta(u)));

          for (const meta of metas) {
            if (!meta.title && !meta.h1) continue; // page fetch failed or blocked

            // Content-based classification — removes legal/utility/product pages
            const pageClass = classifyPage(meta);
            if (!pageClass.isArticle) {
              const key = normalizeForDedup(meta.url);
              articleMap.delete(key); // remove slug-only entry if it exists
              if (pageClass.contentType === "LEGAL_PAGE") excludedLegal++;
              else if (pageClass.contentType === "PRODUCT") excludedProduct++;
              else if (pageClass.articleConfidence < 20) excludedLowConfidence++;
              else excludedUtility++;
              continue;
            }

            const kw = extractArticleKeyword(meta);
            if (!kw.primary || kw.primary.length < 3) continue;

            const key = normalizeForDedup(meta.url);
            articleMap.set(key, {
              url: meta.url,
              title: meta.title || meta.ogTitle || meta.url,
              primaryKeyword: kw.primary,
              secondaryKeywords: kw.secondary,
              confidence: kw.confidence,
              cluster: kw.cluster,
              datePublished: meta.datePublished || articleMap.get(key)?.datePublished,
              dateModified: meta.dateModified || articleMap.get(key)?.dateModified,
            });
          }

          const done = Math.min(i + CONCURRENCY, toEnrich.length);
          send({
            type: "progress",
            stage: "analysis",
            message: `Page enrichment: ${done} / ${toEnrich.length} fetched, ${articleMap.size} articles (excluded: ${excludedLegal + excludedUtility + excludedProduct + excludedLowConfidence} non-articles)`,
            counts: { analyzing: done, total: toEnrich.length },
          });
        }

        // ── Step 7: Aggregate + cluster ──────────────────────────────────
        send({ type: "progress", stage: "aggregating", message: "Aggregating and clustering keywords…" });

        const articleResults = Array.from(articleMap.values());

        const aggregated = aggregateKeywords(
          articleResults.map((a) => ({
            url: a.url,
            title: a.title,
            primary: a.primaryKeyword,
            confidence: a.confidence,
            cluster: a.cluster,
          }))
        );
        const clusters = buildClusters(aggregated);

        const discoveryConfidence = calculateDiscoveryConfidence(
          sitemapResult.urls.length,
          siteDiscovery.articleLinks.length,
          siteDiscovery.hubsCrawled,
        );

        const response: AutoDiscoverResponse = {
          articles: articleResults,
          keywords: aggregated,
          clusters,
          totalUrlsFound: allUrls.length,
          totalArticleCandidates: articleCandidates.length,
          articlesAnalyzed: articleResults.length,
          urlsFromSitemaps: sitemapResult.urls.length,
          homepageLinks: siteDiscovery.homepageLinksFound,
          hubsDiscovered: siteDiscovery.hubsFound,
          hubsCrawled: siteDiscovery.hubsCrawled,
          paginationPagesCrawled: siteDiscovery.paginationPagesCrawled,
          sitemapsFound: sitemapResult.sitemapsFound,
          sitemapsProcessed: sitemapResult.sitemapsProcessed,
          uniquePrimaryKeywords: aggregated.length,
          totalClusters: clusters.length,
          discoveryConfidence,
          excludedLegal,
          excludedUtility,
          excludedLowConfidence,
          excludedProduct,
        };

        send({ type: "complete", data: response as never });
      } catch (err) {
        console.error("[auto-discover] Error:", err);
        send({ type: "error", message: String(err) });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
