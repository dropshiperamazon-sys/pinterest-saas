import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { crawlSitemap } from "@/lib/keyword-extractor/sitemap-service";
import { extractKeywordFromUrl } from "@/lib/keyword-extractor/slug-extractor";
import { scoreRelevance, isArticleUrl } from "@/lib/keyword-extractor/relevance-engine";

const MIN_RELEVANCE_SCORE = 10; // include if at least one signal matches

export interface ExtractedKeyword {
  url: string;
  keyword: string;
  category: string;
  relevance: number;
  lastmod?: string;
}

export interface ExtractResponse {
  totalUrlsFound: number;
  totalArticles: number;
  relevant: ExtractedKeyword[];
  sitemapsFound: string[];
  error?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json() as { url?: string; category?: string };
  const { url: inputUrl, category } = body;

  if (!inputUrl || !category) {
    return NextResponse.json({ error: "url and category are required" }, { status: 400 });
  }

  // Validate URL
  let normalizedUrl: string;
  try {
    const parsed = new URL(inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`);
    normalizedUrl = parsed.toString();
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { urls, sitemapsFound, error } = await crawlSitemap(normalizedUrl);

  if (error) {
    return NextResponse.json({ error, totalUrlsFound: 0, totalArticles: 0, relevant: [], sitemapsFound: [] });
  }

  if (urls.length === 0) {
    return NextResponse.json({
      error: "No sitemap found or sitemap is empty. The website may not have a public sitemap.",
      totalUrlsFound: 0,
      totalArticles: 0,
      relevant: [],
      sitemapsFound,
    });
  }

  // Filter to article-like URLs
  const articleUrls = urls.filter((u) => isArticleUrl(u.loc));

  // Score each against the selected category
  const scored: ExtractedKeyword[] = [];
  const seenKeywords = new Set<string>();

  for (const u of articleUrls) {
    const keyword = extractKeywordFromUrl(u.loc);
    if (!keyword || keyword.length < 3) continue;

    const normalized = keyword.toLowerCase();
    if (seenKeywords.has(normalized)) continue;
    seenKeywords.add(normalized);

    const relevance = scoreRelevance(u.loc, keyword, category);
    if (relevance >= MIN_RELEVANCE_SCORE || category === "Other") {
      scored.push({
        url: u.loc,
        keyword,
        category,
        relevance,
        lastmod: u.lastmod,
      });
    }
  }

  // Sort by relevance descending
  scored.sort((a, b) => b.relevance - a.relevance);

  const result: ExtractResponse = {
    totalUrlsFound: urls.length,
    totalArticles: articleUrls.length,
    relevant: scored.slice(0, 500),
    sitemapsFound,
  };

  return NextResponse.json(result);
}
