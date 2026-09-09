import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { crawlCategoryPage } from "@/lib/keyword-extractor/category-crawler";
import { extractKeywordFromUrl } from "@/lib/keyword-extractor/slug-extractor";
import { isArticleUrl, scoreUrlOnly, scoreRelevanceFull } from "@/lib/keyword-extractor/relevance-engine";
import { buildTopicProfile } from "@/lib/keyword-extractor/topic-profiler";
import { fetchPageMetaBatch } from "@/lib/keyword-extractor/page-crawler";
import type { SitemapURL } from "@/lib/keyword-extractor/sitemap-service";

const STAGE1_THRESHOLD = 10;   // URL slug score to proceed to Stage 2 (low — lets sematic matching decide)
const STAGE2_CONCURRENCY = 5;
const MAX_STAGE2_URLS = 300;   // max page fetches per request

export interface ExtractedKeyword {
  url: string;
  keyword: string;
  category: string;
  relevance: number;
  matchReason: string;
  pageTitle?: string;
  lastmod?: string;
}

export interface ExtractResponse {
  totalUrlsFound: number;
  totalArticles: number;
  stage1Candidates: number;
  stage2Fetched: number;
  relevant: ExtractedKeyword[];
  sitemapsFound: string[];
  categoryPageLinks: number;
  paginationPagesVisited: number;
  error?: string;
}

// Normalize a URL for deduplication: remove trailing slash, query, fragment
function normalizeForDedup(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    // Strip UTM and tracking params (they're already removed above, but belt+suspenders)
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) path = path.slice(0, -1);
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// Detect whether a submitted URL looks like a category/listing page
// (not just the root domain)
function isCategoryPage(url: string): boolean {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    return segments.length >= 1; // any path beyond root is potentially a category
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as { url?: string; category?: string; topic?: string };
  const { url: inputUrl, category, topic } = body;

  if (!inputUrl || !category) {
    return NextResponse.json({ error: "url and category are required" }, { status: 400 });
  }

  const effectiveTopic = (topic && topic.trim()) ? topic.trim() : category;

  let normalizedUrl: string;
  try {
    const parsed = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    normalizedUrl = parsed.toString();
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  console.log(`[keyword-extractor] Submitted URL: ${normalizedUrl}`);
  console.log(`[keyword-extractor] Topic: ${effectiveTopic}`);

  // ── Build topic profile ──────────────────────────────────────────────────────
  const profile = await buildTopicProfile(effectiveTopic);
  console.log(`[keyword-extractor] Profile: primaryTerms=${profile.primaryTerms.join(",")}`);

  // ── Source A: Sitemap crawl ──────────────────────────────────────────────────
  const sitemapPromise = crawlSitemap(normalizedUrl);

  // ── Source B: Category page HTML crawl (if URL has a path) ──────────────────
  const categoryPromise = isCategoryPage(normalizedUrl)
    ? crawlCategoryPage(normalizedUrl)
    : Promise.resolve({ articleLinks: [], paginationPagesVisited: 0, totalLinksFound: 0 });

  const [sitemapResult, categoryResult] = await Promise.all([sitemapPromise, categoryPromise]);

  console.log(`[keyword-extractor] Sitemaps discovered: ${sitemapResult.sitemapsFound.length} → ${sitemapResult.sitemapsFound.join(", ")}`);
  console.log(`[keyword-extractor] Sitemap URLs: ${sitemapResult.urls.length}`);
  console.log(`[keyword-extractor] Category page links: ${categoryResult.totalLinksFound} (article links: ${categoryResult.articleLinks.length})`);
  console.log(`[keyword-extractor] Pagination pages visited: ${categoryResult.paginationPagesVisited}`);

  // ── Merge + deduplicate all URLs ─────────────────────────────────────────────
  const dedupMap = new Map<string, SitemapURL>();  // key = normalized, value = SitemapURL

  // Add sitemap URLs first (they carry lastmod data)
  for (const u of sitemapResult.urls) {
    const key = normalizeForDedup(u.loc);
    if (!dedupMap.has(key)) dedupMap.set(key, u);
  }

  // Add category page article links
  for (const link of categoryResult.articleLinks) {
    const key = normalizeForDedup(link);
    if (!dedupMap.has(key)) dedupMap.set(key, { loc: link });
  }

  const allUrls = Array.from(dedupMap.values());
  console.log(`[keyword-extractor] Unique URLs after deduplication: ${allUrls.length}`);

  // ── Filter to article-like URLs ──────────────────────────────────────────────
  const articleUrls = allUrls.filter((u) => isArticleUrl(u.loc));
  console.log(`[keyword-extractor] Article candidates: ${articleUrls.length}`);

  // ── Stage 1: URL slug pre-filter ────────────────────────────────────────────
  const stage1Passed = articleUrls.filter((u) => {
    const slugScore = scoreUrlOnly(u.loc, profile);
    return slugScore >= STAGE1_THRESHOLD;
  });
  console.log(`[keyword-extractor] Stage 1 passed (slug score >= ${STAGE1_THRESHOLD}): ${stage1Passed.length}`);
  console.log(`[keyword-extractor] Rejected by Stage 1: ${articleUrls.length - stage1Passed.length}`);

  // ── Stage 2: Fetch page meta for candidates ──────────────────────────────────
  const candidateUrls = stage1Passed.slice(0, MAX_STAGE2_URLS).map((u) => u.loc);
  console.log(`[keyword-extractor] Stage 2 fetching: ${candidateUrls.length} URLs`);

  const pageMetas = await fetchPageMetaBatch(candidateUrls, STAGE2_CONCURRENCY);

  const seenKeywords = new Set<string>();
  const scored: ExtractedKeyword[] = [];

  for (const meta of pageMetas) {
    const keyword = extractKeywordFromUrl(meta.url);
    if (!keyword || keyword.length < 3) continue;

    const normalized = keyword.toLowerCase();
    if (seenKeywords.has(normalized)) continue;
    seenKeywords.add(normalized);

    const sitemapEntry = stage1Passed.find((u) => normalizeForDedup(u.loc) === normalizeForDedup(meta.url));

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
      category,
      relevance: result.score,
      matchReason: result.matchReason,
      pageTitle: meta.title || undefined,
      lastmod: sitemapEntry?.lastmod,
    });
  }

  scored.sort((a, b) => b.relevance - a.relevance);

  console.log(`[keyword-extractor] Scored articles: ${scored.length}`);
  console.log(`[keyword-extractor] Score distribution: >=65=${scored.filter(s => s.relevance >= 65).length}, >=50=${scored.filter(s => s.relevance >= 50).length}, <50=${scored.filter(s => s.relevance < 50).length}`);

  const response: ExtractResponse = {
    totalUrlsFound: allUrls.length,
    totalArticles: articleUrls.length,
    stage1Candidates: stage1Passed.length,
    stage2Fetched: candidateUrls.length,
    relevant: scored.slice(0, 1000),   // return up to 1000; UI paginates
    sitemapsFound: sitemapResult.sitemapsFound,
    categoryPageLinks: categoryResult.articleLinks.length,
    paginationPagesVisited: categoryResult.paginationPagesVisited,
  };

  return NextResponse.json(response);
}
