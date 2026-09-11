// Keyword Knowledge Store — search endpoint
// Used by the Keyword Agent to query the internal knowledge store before
// calling Pinterest API. Returns null metrics when data is genuinely unknown.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  searchKeywords,
  getRelationships,
  recordDataGap,
  logSearchSignal,
  normalizeKeyword,
} from "@/lib/keyword-db";

// In-memory cache: key = "{norm}:{country}", value = { data, expiresAt }
const searchCache = new Map<string, { data: Awaited<ReturnType<typeof searchKeywords>>; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(norm: string, country: string) {
  const key = `${norm}:${country}`;
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { searchCache.delete(key); return null; }
  return entry.data;
}

function setCache(norm: string, country: string, data: Awaited<ReturnType<typeof searchKeywords>>) {
  // Evict entries older than TTL (keep cache small)
  if (searchCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of searchCache) { if (now > v.expiresAt) searchCache.delete(k); }
  }
  searchCache.set(`${norm}:${country}`, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const country = (searchParams.get("country") ?? "US").toUpperCase();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  // Log the search signal (non-blocking, always fires even on cache hit)
  logSearchSignal(query, country).catch(() => {});

  const norm = normalizeKeyword(query);

  // Return cached result if available — skip all Redis reads
  const cached = getCached(norm, country);
  if (cached) {
    const withRels = cached.slice(0, 10).map(kw => ({ ...kw, relationships: [] }));
    return NextResponse.json({ query, country, count: cached.length, keywords: [...withRels, ...cached.slice(10)], cached: true });
  }

  // Query knowledge store
  const keywords = await searchKeywords({ query, country, limit });

  // Cache the result
  if (keywords.length > 0) setCache(norm, country, keywords);

  // For each result, also pull its stored relationships
  const withRelationships = await Promise.all(
    keywords.slice(0, 10).map(async (kw) => {
      const rels = await getRelationships(kw.id);
      return { ...kw, relationships: rels };
    })
  );
  const rest = keywords.slice(10);

  // Detect missing data and record gaps
  for (const kw of keywords.slice(0, 5)) {
    const missing: string[] = [];
    if (kw.monthlySearches === null) missing.push("monthly_searches");
    if (kw.competition === null) missing.push("competition");
    if (kw.avgCpc === null) missing.push("avg_cpc");
    if (missing.length > 0) {
      recordDataGap({ keyword: kw.keyword, country, missingFields: missing }).catch(() => {});
    }
  }

  // If exact keyword has no entry at all, create a gap request
  if (keywords.length === 0) {
    recordDataGap({
      keyword: query,
      country,
      missingFields: ["monthly_searches", "competition", "avg_cpc", "trend", "related_keywords"],
    }).catch(() => {});
  }

  return NextResponse.json({
    query,
    country,
    count: keywords.length,
    keywords: [...withRelationships, ...rest],
  });
}

// POST — upsert a single keyword (admin/internal use)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check admin — only allow admin email for write operations
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { upsertKeyword } = await import("@/lib/keyword-db");
  const body = await req.json();

  if (!body.keyword || !body.country) {
    return NextResponse.json({ error: "keyword and country are required" }, { status: 400 });
  }

  const result = await upsertKeyword({
    keyword: body.keyword,
    country: body.country,
    language: body.language ?? "en",
    monthlySearches: body.monthlySearches ?? null,
    competition: body.competition ?? null,
    avgCpc: body.avgCpc ?? null,
    trend: body.trend ?? null,
    category: body.category ?? null,
    subcategory: body.subcategory ?? null,
    source: body.source ?? "ADMIN_IMPORTED",
    sourceReference: body.sourceReference ?? null,
    confidence: body.confidence ?? "VERIFIED",
    lastVerifiedAt: Date.now(),
  });

  return NextResponse.json(result);
}
