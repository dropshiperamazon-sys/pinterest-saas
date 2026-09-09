import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { crawlCategoryPage } from "@/lib/keyword-extractor/category-crawler";
import { extractKeywordFromUrl } from "@/lib/keyword-extractor/slug-extractor";
import { isArticleUrl, scoreUrlOnly, scoreRelevanceFull } from "@/lib/keyword-extractor/relevance-engine";
import { buildTopicProfile } from "@/lib/keyword-extractor/topic-profiler";
import { fetchPageMetaBatch } from "@/lib/keyword-extractor/page-crawler";
import type { SitemapURL } from "@/lib/keyword-extractor/sitemap-service";

const STAGE2_CONCURRENCY = 5;
const MAX_STAGE2_URLS = 500;

export type DateFilter = "all" | "7d" | "30d" | "90d" | "6m" | "1y";

export interface ExtractedKeyword {
  url: string;
  keyword: string;
  category: string;
  relevance: number;
  matchReason: string;
  pageTitle?: string;
  lastmod?: string;
  datePublished?: string;
  dateModified?: string;
}

export interface ExtractResponse {
  totalUrlsFound: number;
  totalArticles: number;
  candidateArticles: number;
  stage2Fetched: number;
  relevant: ExtractedKeyword[];
  sitemapsFound: string[];
  sitemapsProcessed: number;
  urlsFromSitemaps: number;
  homepageLinks: number;
  error?: string;
}

// SSE progress event types (sent during streaming)
export type ProgressEvent =
  | { type: "progress"; stage: string; message: string; counts?: Record<string, number> }
  | { type: "complete"; data: ExtractResponse }
  | { type: "error"; message: string };

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

export type DateFilterType = DateFilter;

function dateCutoff(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  const days: Record<DateFilter, number> = { all: 0, "7d": 7, "30d": 30, "90d": 90, "6m": 183, "1y": 365 };
  const d = new Date(now);
  d.setDate(d.getDate() - days[filter]);
  return d;
}

function parseDate(str?: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const body = await req.json() as {
    domain?: string;
    topic?: string;
    url?: string;
    category?: string;
    dateFilter?: DateFilter;
  };

  const rawInput = body.domain || body.url || "";
  const topic = (body.topic || body.category || "").trim();

  if (!rawInput) {
    return new Response(JSON.stringify({ error: "Website domain is required" }), { status: 400 });
  }
  if (!topic) {
    return new Response(JSON.stringify({ error: "Keyword / Topic is required" }), { status: 400 });
  }

  let rootDomain: string;
  try {
    rootDomain = extractRootDomain(rawInput);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid domain" }), { status: 400 });
  }

  const dateFilter: DateFilter = body.dateFilter ?? "all";
  const cutoff = dateCutoff(dateFilter);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        // ── Build topic profile ──────────────────────────────────────────
        send({ type: "progress", stage: "init", message: `Building topic profile for "${topic}"…` });
        const profile = await buildTopicProfile(topic);

        // ── Source A: Full sitemap crawl ─────────────────────────────────
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

        console.log(`[keyword-extractor] Sitemaps found: ${sitemapResult.sitemapsFound.length} — URLs: ${sitemapResult.urls.length}`);

        // ── Source B: Homepage crawl (supplemental) ──────────────────────
        send({
          type: "progress",
          stage: "homepage",
          message: "Crawling homepage for supplemental links…",
          counts: { sitemapUrls: sitemapResult.urls.length, sitemapsFound: sitemapResult.sitemapsFound.length },
        });

        const homepageResult = await crawlCategoryPage(rootDomain);
        console.log(`[keyword-extractor] Homepage article links: ${homepageResult.articleLinks.length}`);

        // ── Merge + deduplicate ──────────────────────────────────────────
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
        console.log(`[keyword-extractor] Unique URLs after dedup: ${allUrls.length}`);

        send({
          type: "progress",
          stage: "discovery",
          message: `Discovered ${allUrls.length.toLocaleString()} unique URLs (${sitemapResult.sitemapsFound.length} sitemaps + ${homepageResult.articleLinks.length} homepage links)`,
          counts: { totalUrls: allUrls.length, sitemapUrls: sitemapResult.urls.length, homepageLinks: homepageResult.articleLinks.length },
        });

        // ── Filter: article-like only ────────────────────────────────────
        const articleUrls = allUrls.filter((u) => isArticleUrl(u.loc));
        console.log(`[keyword-extractor] Article candidates: ${articleUrls.length}`);

        // ── Date pre-filter ──────────────────────────────────────────────
        const dateFiltered = cutoff
          ? articleUrls.filter((u) => {
              if (!u.lastmod) return true;
              const d = parseDate(u.lastmod);
              return d ? d >= cutoff : true;
            })
          : articleUrls;

        send({
          type: "progress",
          stage: "filter",
          message: `${articleUrls.length.toLocaleString()} article URLs identified${cutoff ? `, ${dateFiltered.length.toLocaleString()} within date range` : ""}`,
          counts: { totalUrls: allUrls.length, articleUrls: articleUrls.length, dateFiltered: dateFiltered.length },
        });

        // ── Candidate selection: sort by slug score, cap at MAX_STAGE2_URLS ─
        const withScore = dateFiltered.map((u) => ({ u, s: scoreUrlOnly(u.loc, profile) }));
        withScore.sort((a, b) => b.s - a.s);
        const candidates = withScore.map((x) => x.u);
        const candidateUrls = candidates.slice(0, MAX_STAGE2_URLS).map((u) => u.loc);

        console.log(`[keyword-extractor] Stage 2 candidates: ${candidateUrls.length} (cap: ${MAX_STAGE2_URLS})`);

        send({
          type: "progress",
          stage: "analysis",
          message: `Analyzing ${candidateUrls.length.toLocaleString()} pages for relevance…`,
          counts: { totalUrls: allUrls.length, articleUrls: articleUrls.length, candidateArticles: candidateUrls.length, analyzed: 0 },
        });

        // ── Stage 2: Fetch page meta in batches with progress ────────────
        const pageMetas = [];
        for (let i = 0; i < candidateUrls.length; i += STAGE2_CONCURRENCY) {
          const batch = candidateUrls.slice(i, i + STAGE2_CONCURRENCY);
          const batchResults = await fetchPageMetaBatch(batch, batch.length);
          pageMetas.push(...batchResults);

          if ((i + STAGE2_CONCURRENCY) % 25 === 0 || i + STAGE2_CONCURRENCY >= candidateUrls.length) {
            send({
              type: "progress",
              stage: "analysis",
              message: `Analyzing pages… ${Math.min(i + STAGE2_CONCURRENCY, candidateUrls.length)} / ${candidateUrls.length}`,
              counts: { analyzed: Math.min(i + STAGE2_CONCURRENCY, candidateUrls.length), total: candidateUrls.length },
            });
          }
        }

        // ── Score results ────────────────────────────────────────────────
        const seenKeywords = new Set<string>();
        const scored: ExtractedKeyword[] = [];

        for (const meta of pageMetas) {
          if (cutoff) {
            const articleDate = parseDate(meta.datePublished) ?? parseDate(meta.dateModified);
            const sitemapEntry = candidates.find((u) => normalizeForDedup(u.loc) === normalizeForDedup(meta.url));
            const lastmodDate = parseDate(sitemapEntry?.lastmod);
            const bestDate = articleDate ?? lastmodDate;
            if (bestDate && bestDate < cutoff) continue;
          }

          const keyword = extractKeywordFromUrl(meta.url);
          if (!keyword || keyword.length < 3) continue;

          const normalized = keyword.toLowerCase();
          if (seenKeywords.has(normalized)) continue;
          seenKeywords.add(normalized);

          const sitemapEntry = candidates.find((u) => normalizeForDedup(u.loc) === normalizeForDedup(meta.url));

          const result = scoreRelevanceFull(
            {
              url: meta.url,
              title: meta.title,
              h1: meta.h1,
              headings: meta.headings,
              metaDescription: meta.metaDescription,
              bodySnippet: meta.bodySnippet,
            },
            profile
          );

          scored.push({
            url: meta.url,
            keyword,
            category: topic,
            relevance: result.score,
            matchReason: result.matchReason,
            pageTitle: meta.title || undefined,
            lastmod: sitemapEntry?.lastmod,
            datePublished: meta.datePublished,
            dateModified: meta.dateModified,
          });
        }

        scored.sort((a, b) => b.relevance - a.relevance);

        console.log(`[keyword-extractor] Scored: ${scored.length} | >=65: ${scored.filter((s) => s.relevance >= 65).length}`);

        const response: ExtractResponse = {
          totalUrlsFound: allUrls.length,
          totalArticles: articleUrls.length,
          candidateArticles: candidateUrls.length,
          stage2Fetched: pageMetas.length,
          relevant: scored.slice(0, 1000),
          sitemapsFound: sitemapResult.sitemapsFound,
          sitemapsProcessed: sitemapResult.sitemapsProcessed,
          urlsFromSitemaps: sitemapResult.urls.length,
          homepageLinks: homepageResult.articleLinks.length,
        };

        send({ type: "complete", data: response });
      } catch (err) {
        console.error("[keyword-extractor] Error:", err);
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
