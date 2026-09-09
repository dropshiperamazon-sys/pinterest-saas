import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { crawlCategoryPage } from "@/lib/keyword-extractor/category-crawler";
import { extractKeywordFromUrl } from "@/lib/keyword-extractor/slug-extractor";
import { isArticleUrl, scoreUrlOnly, scoreRelevanceFull } from "@/lib/keyword-extractor/relevance-engine";
import { buildTopicProfile } from "@/lib/keyword-extractor/topic-profiler";
import { fetchPageMetaBatch } from "@/lib/keyword-extractor/page-crawler";
import type { SitemapURL } from "@/lib/keyword-extractor/sitemap-service";

const STAGE1_THRESHOLD = 5;   // very low — full-page scoring decides relevance
const STAGE2_CONCURRENCY = 5;
const MAX_STAGE2_URLS = 300;  // max page fetches per request

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
  stage1Candidates: number;
  stage2Fetched: number;
  relevant: ExtractedKeyword[];
  sitemapsFound: string[];
  homepageLinks: number;
  error?: string;
}

// Normalize a URL for deduplication
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

// Strip a URL (or domain string) down to just https://hostname
function extractRootDomain(input: string): string {
  const withProtocol = input.startsWith("http") ? input : `https://${input}`;
  const parsed = new URL(withProtocol);
  return `${parsed.protocol}//${parsed.hostname}`;
}

// Convert a DateFilter to a cutoff Date
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
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as {
    domain?: string;
    topic?: string;
    // backward compat
    url?: string;
    category?: string;
    dateFilter?: DateFilter;
  };

  const rawInput = body.domain || body.url || "";
  const topic = (body.topic || body.category || "").trim();

  if (!rawInput) {
    return NextResponse.json({ error: "Website domain is required" }, { status: 400 });
  }
  if (!topic) {
    return NextResponse.json({ error: "Keyword / Topic is required" }, { status: 400 });
  }

  let rootDomain: string;
  try {
    rootDomain = extractRootDomain(rawInput);
  } catch {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const dateFilter: DateFilter = body.dateFilter ?? "all";
  const cutoff = dateCutoff(dateFilter);

  console.log(`[keyword-extractor] Domain: ${rootDomain} | Topic: ${topic} | Date filter: ${dateFilter}`);

  // ── Build topic profile ──────────────────────────────────────────────────────
  const profile = await buildTopicProfile(topic);
  console.log(`[keyword-extractor] Profile primaryTerms: ${profile.primaryTerms.join(", ")}`);

  // ── Source A: Sitemap crawl (always from root domain) ────────────────────────
  const sitemapPromise = crawlSitemap(rootDomain);

  // ── Source B: Homepage crawl to pick up links not in sitemaps ───────────────
  const homepagePromise = crawlCategoryPage(rootDomain);

  const [sitemapResult, homepageResult] = await Promise.all([sitemapPromise, homepagePromise]);

  console.log(`[keyword-extractor] Sitemaps found: ${sitemapResult.sitemapsFound.length} — ${sitemapResult.sitemapsFound.join(", ")}`);
  console.log(`[keyword-extractor] Sitemap URLs: ${sitemapResult.urls.length}`);
  console.log(`[keyword-extractor] Homepage article links: ${homepageResult.articleLinks.length} (total links: ${homepageResult.totalLinksFound})`);

  // ── Merge + deduplicate ──────────────────────────────────────────────────────
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

  // ── Filter: article-like only ────────────────────────────────────────────────
  const articleUrls = allUrls.filter((u) => isArticleUrl(u.loc));
  console.log(`[keyword-extractor] Article candidates: ${articleUrls.length}`);

  // ── Date pre-filter (sitemap lastmod, if filter is set) ──────────────────────
  const dateFiltered = cutoff
    ? articleUrls.filter((u) => {
        if (!u.lastmod) return true; // no date = include by default
        const d = parseDate(u.lastmod);
        return d ? d >= cutoff : true;
      })
    : articleUrls;
  console.log(`[keyword-extractor] After date filter: ${dateFiltered.length}`);

  // ── Stage 1: URL slug score ──────────────────────────────────────────────────
  const stage1Passed = dateFiltered.filter((u) => scoreUrlOnly(u.loc, profile) >= STAGE1_THRESHOLD);
  console.log(`[keyword-extractor] Stage 1 passed: ${stage1Passed.length} | Rejected: ${dateFiltered.length - stage1Passed.length}`);

  // ── Stage 2: Fetch page meta ─────────────────────────────────────────────────
  const candidateUrls = stage1Passed.slice(0, MAX_STAGE2_URLS).map((u) => u.loc);
  console.log(`[keyword-extractor] Stage 2 fetching: ${candidateUrls.length}`);

  const pageMetas = await fetchPageMetaBatch(candidateUrls, STAGE2_CONCURRENCY);

  // ── Date filter pass 2: use page-level dates if more accurate ────────────────
  const seenKeywords = new Set<string>();
  const scored: ExtractedKeyword[] = [];

  for (const meta of pageMetas) {
    // Date gate using page-level date (more accurate than lastmod)
    if (cutoff) {
      const articleDate = parseDate(meta.datePublished) ?? parseDate(meta.dateModified);
      const sitemapEntry = stage1Passed.find((u) => normalizeForDedup(u.loc) === normalizeForDedup(meta.url));
      const lastmodDate = parseDate(sitemapEntry?.lastmod);
      const bestDate = articleDate ?? lastmodDate;
      if (bestDate && bestDate < cutoff) continue;
    }

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

  console.log(`[keyword-extractor] Scored: ${scored.length} | >=65: ${scored.filter(s => s.relevance >= 65).length} | >=50: ${scored.filter(s => s.relevance >= 50).length}`);

  const response: ExtractResponse = {
    totalUrlsFound: allUrls.length,
    totalArticles: articleUrls.length,
    stage1Candidates: stage1Passed.length,
    stage2Fetched: candidateUrls.length,
    relevant: scored.slice(0, 1000),
    sitemapsFound: sitemapResult.sitemapsFound,
    homepageLinks: homepageResult.articleLinks.length,
  };

  return NextResponse.json(response);
}
