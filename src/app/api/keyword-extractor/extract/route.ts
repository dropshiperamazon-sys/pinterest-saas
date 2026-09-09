import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { extractKeywordFromUrl } from "@/lib/keyword-extractor/slug-extractor";
import { isArticleUrl, scoreUrlOnly, scoreRelevanceFull } from "@/lib/keyword-extractor/relevance-engine";
import { buildTopicProfile } from "@/lib/keyword-extractor/topic-profiler";
import { fetchPageMetaBatch } from "@/lib/keyword-extractor/page-crawler";

const STAGE1_THRESHOLD = 15;  // URL slug score needed to proceed to Stage 2
const STAGE2_CONCURRENCY = 5;
const MAX_STAGE2_URLS = 150;  // cap page fetches per request

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
  relevant: ExtractedKeyword[];
  sitemapsFound: string[];
  error?: string;
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

  // The user's actual topic: use custom topic if provided, else use category name
  const effectiveTopic = (topic && topic.trim()) ? topic.trim() : category;

  let normalizedUrl: string;
  try {
    const parsed = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    normalizedUrl = parsed.toString();
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { urls, sitemapsFound, error } = await crawlSitemap(normalizedUrl);

  if (error) {
    return NextResponse.json({ error, totalUrlsFound: 0, totalArticles: 0, stage1Candidates: 0, relevant: [], sitemapsFound: [] });
  }

  if (urls.length === 0) {
    return NextResponse.json({
      error: "No sitemap found or sitemap is empty.",
      totalUrlsFound: 0,
      totalArticles: 0,
      stage1Candidates: 0,
      relevant: [],
      sitemapsFound,
    });
  }

  // Build topic profile (OpenAI-powered or text-fallback)
  const profile = await buildTopicProfile(effectiveTopic);

  // Filter to article-like URLs
  const articleUrls = urls.filter((u) => isArticleUrl(u.loc));

  // ── Stage 1: URL slug pre-filter ────────────────────────────────────────────
  const stage1Passed = articleUrls.filter((u) => {
    const slugScore = scoreUrlOnly(u.loc, profile);
    return slugScore >= STAGE1_THRESHOLD;
  });

  // ── Stage 2: Fetch page meta for candidates only ─────────────────────────────
  const candidateUrls = stage1Passed.slice(0, MAX_STAGE2_URLS).map((u) => u.loc);
  const pageMetas = await fetchPageMetaBatch(candidateUrls, STAGE2_CONCURRENCY);

  const seenKeywords = new Set<string>();
  const scored: ExtractedKeyword[] = [];

  for (const meta of pageMetas) {
    const keyword = extractKeywordFromUrl(meta.url);
    if (!keyword || keyword.length < 3) continue;

    const normalized = keyword.toLowerCase();
    if (seenKeywords.has(normalized)) continue;
    seenKeywords.add(normalized);

    const sitemapEntry = stage1Passed.find((u) => u.loc === meta.url);

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

  const response: ExtractResponse = {
    totalUrlsFound: urls.length,
    totalArticles: articleUrls.length,
    stage1Candidates: stage1Passed.length,
    relevant: scored.slice(0, 500),
    sitemapsFound,
  };

  return NextResponse.json(response);
}
