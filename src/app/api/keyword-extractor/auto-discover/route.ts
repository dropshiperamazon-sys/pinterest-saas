import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { crawlCategoryPage } from "@/lib/keyword-extractor/category-crawler";
import { isArticleUrl } from "@/lib/keyword-extractor/relevance-engine";
import { analyzeSlugKeywords } from "@/lib/keyword-extractor/slug-keyword-analyzer";
import type { SitemapURL } from "@/lib/keyword-extractor/sitemap-service";
import type { DiscoveredKeyword } from "@/lib/keyword-extractor/slug-keyword-analyzer";
import type { ProgressEvent } from "@/app/api/keyword-extractor/extract/route";

export interface AutoDiscoverResponse {
  keywords: DiscoveredKeyword[];
  totalUrlsFound: number;
  totalArticles: number;
  urlsFromSitemaps: number;
  homepageLinks: number;
  sitemapsFound: string[];
  sitemapsProcessed: number;
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
        // ── Sitemap crawl ────────────────────────────────────────────────
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

        // ── Homepage crawl (supplemental) ────────────────────────────────
        send({ type: "progress", stage: "homepage", message: "Crawling homepage for supplemental links…" });
        const homepageResult = await crawlCategoryPage(rootDomain);

        // ── Merge + dedup ────────────────────────────────────────────────
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
          counts: { totalUrls: allUrls.length, urlsFromSitemaps: sitemapResult.urls.length },
        });

        // ── Filter article-like URLs ─────────────────────────────────────
        const articleUrls = allUrls.filter((u) => isArticleUrl(u.loc));

        send({
          type: "progress",
          stage: "analysis",
          message: `Analyzing ${articleUrls.length.toLocaleString()} article URLs for keyword frequency…`,
        });

        // ── Slug keyword frequency analysis ──────────────────────────────
        const keywords = analyzeSlugKeywords(articleUrls.map((u) => u.loc), 200);

        const response: AutoDiscoverResponse = {
          keywords,
          totalUrlsFound: allUrls.length,
          totalArticles: articleUrls.length,
          urlsFromSitemaps: sitemapResult.urls.length,
          homepageLinks: homepageResult.articleLinks.length,
          sitemapsFound: sitemapResult.sitemapsFound,
          sitemapsProcessed: sitemapResult.sitemapsProcessed,
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
