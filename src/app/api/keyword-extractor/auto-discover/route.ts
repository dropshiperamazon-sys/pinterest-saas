import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { crawlCategoryPage } from "@/lib/keyword-extractor/category-crawler";
import { isArticleUrl } from "@/lib/keyword-extractor/relevance-engine";
import { fetchPageMeta } from "@/lib/keyword-extractor/page-crawler";
import {
  extractArticleKeyword,
  aggregateKeywords,
  buildClusters,
} from "@/lib/keyword-extractor/article-keyword-extractor";
import type { SitemapURL } from "@/lib/keyword-extractor/sitemap-service";
import type { KeywordAggregate, TopicCluster } from "@/lib/keyword-extractor/article-keyword-extractor";
import type { ProgressEvent } from "@/app/api/keyword-extractor/extract/route";

// Practical analysis cap: fetch at most this many article pages in one request
// (Vercel function timeout). Full discovery remains uncapped.
const MAX_ARTICLES_TO_ANALYZE = 500;
const CONCURRENCY = 8;

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
  sitemapsFound: string[];
  sitemapsProcessed: number;
  uniquePrimaryKeywords: number;
  totalClusters: number;
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

async function fetchBatch(urls: string[], concurrency: number) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((u) => fetchPageMeta(u)));
    results.push(...batchResults);
  }
  return results;
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

        // ── Step 2: Homepage supplemental discovery ──────────────────────
        send({ type: "progress", stage: "homepage", message: "Crawling homepage for supplemental links…" });
        const homepageResult = await crawlCategoryPage(rootDomain);

        // ── Step 3: Merge + dedup ────────────────────────────────────────
        const dedupMap = new Map<string, SitemapURL>();
        for (const u of sitemapResult.urls) {
          const key = normalizeForDedup(u.loc);
          if (!dedupMap.has(key)) dedupMap.set(key, u);
        }
        for (const link of homepageResult.articleLinks) {
          const key = normalizeForDedup(link);
          if (!dedupMap.has(key)) dedupMap.set(key, { loc: link });
        }

        const allUrls = Array.from(dedupMap.values());

        send({
          type: "progress",
          stage: "discovery",
          message: `Discovered ${allUrls.length.toLocaleString()} unique URLs`,
          counts: {
            totalUrls: allUrls.length,
            urlsFromSitemaps: sitemapResult.urls.length,
            homepageLinks: homepageResult.articleLinks.length,
          },
        });

        // ── Step 4: Classify article URLs ────────────────────────────────
        const articleCandidates = allUrls.filter((u) => isArticleUrl(u.loc));

        send({
          type: "progress",
          stage: "classify",
          message: `${articleCandidates.length.toLocaleString()} article candidates identified`,
          counts: { totalUrls: allUrls.length, articleCandidates: articleCandidates.length },
        });

        // ── Step 5: Sort by recency, cap at MAX_ARTICLES_TO_ANALYZE ─────
        // Sort by lastmod descending (most recent first), then take cap
        const sorted = [...articleCandidates].sort((a, b) => {
          if (a.lastmod && b.lastmod) return b.lastmod.localeCompare(a.lastmod);
          if (a.lastmod) return -1;
          if (b.lastmod) return 1;
          return 0;
        });
        const toAnalyze = sorted.slice(0, MAX_ARTICLES_TO_ANALYZE).map((u) => u.loc);

        send({
          type: "progress",
          stage: "analysis",
          message: `Analyzing ${toAnalyze.length.toLocaleString()} articles…`,
          counts: { analyzing: 0, total: toAnalyze.length },
        });

        // ── Step 6: Fetch pages + extract keywords ───────────────────────
        const articleResults: ArticleResult[] = [];
        const REPORT_EVERY = 25;

        for (let i = 0; i < toAnalyze.length; i += CONCURRENCY) {
          const batch = toAnalyze.slice(i, i + CONCURRENCY);
          const metas = await Promise.all(batch.map((u) => fetchPageMeta(u)));

          for (const meta of metas) {
            if (!meta.title && !meta.h1) continue; // page fetch failed
            const kw = extractArticleKeyword(meta);
            if (!kw.primary || kw.primary.length < 3) continue;
            articleResults.push({
              url: meta.url,
              title: meta.title || meta.ogTitle || meta.url,
              primaryKeyword: kw.primary,
              secondaryKeywords: kw.secondary,
              confidence: kw.confidence,
              cluster: kw.cluster,
              datePublished: meta.datePublished,
              dateModified: meta.dateModified,
            });
          }

          const done = Math.min(i + CONCURRENCY, toAnalyze.length);
          if (done % REPORT_EVERY === 0 || done >= toAnalyze.length) {
            send({
              type: "progress",
              stage: "analysis",
              message: `Extracting keywords… ${done} / ${toAnalyze.length}`,
              counts: { analyzing: done, total: toAnalyze.length },
            });
          }
        }

        // ── Step 7: Aggregate + cluster ──────────────────────────────────
        send({ type: "progress", stage: "aggregating", message: "Aggregating and clustering keywords…" });

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

        const response: AutoDiscoverResponse = {
          articles: articleResults,
          keywords: aggregated,
          clusters,
          totalUrlsFound: allUrls.length,
          totalArticleCandidates: articleCandidates.length,
          articlesAnalyzed: articleResults.length,
          urlsFromSitemaps: sitemapResult.urls.length,
          homepageLinks: homepageResult.articleLinks.length,
          sitemapsFound: sitemapResult.sitemapsFound,
          sitemapsProcessed: sitemapResult.sitemapsProcessed,
          uniquePrimaryKeywords: aggregated.length,
          totalClusters: clusters.length,
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
