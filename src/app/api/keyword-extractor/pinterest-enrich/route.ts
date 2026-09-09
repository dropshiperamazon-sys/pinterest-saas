// Pinterest Keyword Enrichment for Keyword Extractor
// Takes extracted website keywords, deduplicates, looks up cache, then calls
// Pinterest API (ad keyword suggestions + trends) with rate-limit awareness.
// ALL Pinterest API calls happen here on the server — tokens never reach the browser.

import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";
const CACHE_TTL = 60 * 60 * 24; // 24 hours
const CONCURRENCY = 3;           // concurrent Pinterest API calls — stay well within rate limits
const BATCH_DELAY_MS = 350;      // pause between batches

// ── Types ──────────────────────────────────────────────────────────────────────

export type KeywordSource = "PINTEREST_API" | "WEBSITE_EXTRACTION" | "AI_GENERATED";
export type KeywordType = "SUGGESTED" | "RELATED" | "TRENDING" | "SEED";
export type PinterestRelevance = "Very High" | "High" | "Medium" | "Low";

export interface PinterestKeywordResult {
  seedKeyword: string;
  keyword: string;
  source: KeywordSource;
  keywordType: KeywordType;
  country: string;
  monthlySearches: number | null;
  weeklyChange: number | null;
  monthlyChange: number | null;
  relevance: PinterestRelevance;
  articleCount: number;
}

export interface SeedEnrichmentResult {
  seed: string;
  keywords: PinterestKeywordResult[];
  status: "ok" | "error" | "cached" | "no_account";
  error?: string;
}

export interface PinterestEnrichResponse {
  country: string;
  websiteKeywords: number;
  pinterestEnriched: number;
  pinterestSuggestions: number;
  uniquePinterestKeywords: number;
  metricsAvailable: number;
  results: SeedEnrichmentResult[];
  failedSeeds: string[];
  noAccountWarning?: string;
}

// ── Pinterest API helpers ──────────────────────────────────────────────────────

async function pinterestGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) throw new RateLimitError(res.headers.get("Retry-After"));
  const text = await res.text();
  if (!res.ok) {
    console.error(`[pinterest-enrich] GET ${path} → ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

async function pinterestPost(path: string, token: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) throw new RateLimitError(res.headers.get("Retry-After"));
  const text = await res.text();
  if (!res.ok) {
    console.error(`[pinterest-enrich] POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfterHeader: string | null) {
    super("Rate limited");
    this.retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 5000;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Normalisation ──────────────────────────────────────────────────────────────

function normalizeKeyword(kw: string): string {
  return kw.toLowerCase().replace(/\s+/g, " ").trim();
}

function relevanceFromPosition(index: number, total: number): PinterestRelevance {
  const pct = total <= 1 ? 0 : index / (total - 1);
  if (pct < 0.25) return "Very High";
  if (pct < 0.50) return "High";
  if (pct < 0.75) return "Medium";
  return "Low";
}

// ── Cache helpers ──────────────────────────────────────────────────────────────

interface CachedSeedResult {
  keywords: PinterestKeywordResult[];
  cachedAt: number;
}

function cacheKey(seed: string, country: string): string {
  return `kex_pinterest_v2:${country}:${normalizeKeyword(seed)}`;
}

async function getCached(seed: string, country: string): Promise<CachedSeedResult | null> {
  try {
    const raw = await redis.get(cacheKey(seed, country));
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : (raw as CachedSeedResult);
  } catch { return null; }
}

async function setCached(seed: string, country: string, data: CachedSeedResult): Promise<void> {
  try {
    await redis.setex(cacheKey(seed, country), CACHE_TTL, JSON.stringify(data));
  } catch { /* non-fatal */ }
}

// Words that are too generic to count as niche overlap when matching trending keywords.
// "september nails ideas 2026" shares "ideas" with almost every seed — that's noise.
const GENERIC_OVERLAP_WORDS = new Set([
  "ideas","tips","inspiration","inspo","aesthetic","design","style","tutorial",
  "guide","simple","modern","cute","best","good","great","easy","free","diy",
  "home","room","decor","decoration","look","color","shop","buy","new","top",
  "cool","nice","beautiful","amazing","awesome","perfect","ultimate","complete",
  "budget","cheap","affordable","small","big","large","dark","light","white",
  "black","blue","red","pink","green","gold","silver","grey","gray","brown",
]);

// ── Enrich one keyword seed via Pinterest API ──────────────────────────────────

async function enrichSeed(
  seed: string,
  country: string,
  token: string,
  adAccountId: string,
  articleCountBySeed: Map<string, number>,
  prefetchedTrendItems: Record<string, unknown>[],  // fetched once, passed in
): Promise<{ keywords: PinterestKeywordResult[]; error?: string }> {
  const results: PinterestKeywordResult[] = [];
  const seen = new Set<string>([normalizeKeyword(seed)]);
  const articleCount = articleCountBySeed.get(normalizeKeyword(seed)) ?? 0;

  // Include the seed itself as a WEBSITE_EXTRACTION keyword
  results.push({
    seedKeyword: seed,
    keyword: seed,
    source: "WEBSITE_EXTRACTION",
    keywordType: "SEED",
    country,
    monthlySearches: null,
    weeklyChange: null,
    monthlyChange: null,
    relevance: "Very High",
    articleCount,
  });

  // ── 1. Ad keyword suggestions (POST) ─────────────────────────────────────────
  // POST /v5/ad_accounts/{id}/keywords/suggestions
  // Scopes: ads:read — included in our OAuth scope list
  let suggestData: unknown = null;
  try {
    suggestData = await pinterestPost(
      `/ad_accounts/${adAccountId}/keywords/suggestions`,
      token,
      { keyword: seed, country_code: country, targeting_strategy: "SUGGESTED" },
    );
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
  }

  const suggestItems = extractItems(suggestData);
  for (let i = 0; i < suggestItems.length; i++) {
    const item = suggestItems[i];
    const kw = normalizeKeyword(itemKeyword(item));
    if (!kw || kw.length < 3 || seen.has(kw)) continue;
    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_API",
      keywordType: "SUGGESTED",
      country,
      monthlySearches: itemMetric(item, "monthly_searches") ?? itemMetric(item, "search_volume") ?? null,
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, suggestItems.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── 2. Targeting keyword options (GET) ────────────────────────────────────────
  // GET /v5/ad_accounts/{id}/targeting_options?targeting_type=KEYWORD&query=...
  // Scopes: ads:read
  let targetData: unknown = null;
  try {
    targetData = await pinterestGet(
      `/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encodeURIComponent(seed)}`,
      token,
    );
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
  }

  const targetItems = extractItems(targetData);
  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    const kw = normalizeKeyword(itemKeyword(item));
    if (!kw || kw.length < 3 || seen.has(kw)) continue;
    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_API",
      keywordType: "RELATED",
      country,
      monthlySearches: itemMetric(item, "monthly_searches") ?? itemMetric(item, "impressions_organic") ?? null,
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, targetItems.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── 3. Trends — match pre-fetched trending keywords against this seed ───────────
  // Trends are fetched ONCE per request (not per seed) to avoid redundant API calls.
  // Only include a trending keyword if it shares a non-generic niche word with the seed.
  // "september nails ideas 2026" shares "ideas" with every seed → excluded (generic word).
  // "living room aesthetic" shares "living" with seed "living room decor" → included.
  const seedNicheWords = new Set(
    normalizeKeyword(seed).split(/\s+/).filter(
      (w) => w.length >= 4 && !GENERIC_OVERLAP_WORDS.has(w)
    )
  );
  const normSeed = normalizeKeyword(seed);

  for (let i = 0; i < prefetchedTrendItems.length; i++) {
    const item = prefetchedTrendItems[i];
    const kw = normalizeKeyword(itemKeyword(item));
    if (!kw || kw.length < 3 || seen.has(kw)) continue;

    // A trending keyword is relevant to this seed only if:
    // (a) the full normalised seed appears as a substring in the trending keyword, OR
    // (b) the trending keyword appears as a substring in the seed, OR
    // (c) they share at least one non-generic niche word (length ≥ 5 to avoid "room" etc.)
    const kwWords = kw.split(/\s+/);
    const sharesNicheWord = seedNicheWords.size > 0 &&
      kwWords.some((w) => w.length >= 5 && seedNicheWords.has(w));
    const isSubstring = kw.includes(normSeed) || normSeed.includes(kw);

    if (!sharesNicheWord && !isSubstring) continue;

    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_API",
      keywordType: "TRENDING",
      country,
      monthlySearches: null,
      weeklyChange: (item as Record<string, unknown>).pct_growth_wow as number ?? null,
      monthlyChange: (item as Record<string, unknown>).pct_growth_mom as number ?? null,
      relevance: relevanceFromPosition(i, prefetchedTrendItems.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  return { keywords: results };
}

// ── Response shape helpers ─────────────────────────────────────────────────────

function extractItems(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.items)) return d.items as Record<string, unknown>[];
  if (Array.isArray(d.keywords)) return d.keywords as Record<string, unknown>[];
  if (Array.isArray(d.suggestions)) return d.suggestions as Record<string, unknown>[];
  if (Array.isArray(d.value)) return d.value as Record<string, unknown>[];
  if (Array.isArray(d.trends)) return d.trends as Record<string, unknown>[];
  return [];
}

function itemKeyword(item: Record<string, unknown>): string {
  return String(item.keyword ?? item.term ?? item.name ?? item.query ?? "");
}

function itemMetric(item: Record<string, unknown>, field: string): number | null {
  const v = item[field];
  return typeof v === "number" ? v : null;
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  // Get Pinterest token
  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) {
    return new Response(
      JSON.stringify({ error: "Pinterest not connected. Connect your Pinterest account to use this feature." }),
      { status: 400 },
    );
  }
  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const body = await req.json() as {
    keywords: string[];   // extracted primary keywords from the website
    country?: string;
    articleCountMap?: Record<string, number>;  // keyword → article count from website extraction
  };

  const country = (body.country ?? "US").toUpperCase();
  const rawKeywords: string[] = body.keywords ?? [];
  const articleCountMap: Record<string, number> = body.articleCountMap ?? {};

  if (rawKeywords.length === 0) {
    return new Response(JSON.stringify({ error: "No keywords provided" }), { status: 400 });
  }

  // Deduplicate + normalise seed keywords
  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const kw of rawKeywords) {
    const norm = normalizeKeyword(kw);
    if (norm && norm.length >= 3 && !seen.has(norm)) {
      seen.add(norm);
      seeds.push(norm);
    }
  }

  // Build article-count lookup (by normalised keyword)
  const articleCountBySeed = new Map<string, number>();
  for (const [k, v] of Object.entries(articleCountMap)) {
    articleCountBySeed.set(normalizeKeyword(k), v);
  }

  // Get the user's ad account ID (required for keyword suggestion endpoints)
  let adAccountId: string | null = null;
  let noAccountWarning: string | undefined;
  try {
    const accountsData = await pinterestGet("/ad_accounts?page_size=5", accessToken) as Record<string, unknown> | null;
    adAccountId = (accountsData?.items as Record<string, unknown>[] | undefined)?.[0]?.id as string ?? null;
  } catch { /* no ad account */ }

  if (!adAccountId) {
    noAccountWarning =
      "No Pinterest Ads account found. Keyword suggestions require a Pinterest Ads account. " +
      "Only trending keyword data may be available.";
  }

  // Fetch trending keywords ONCE for the whole request — same 25 results for every seed,
  // so calling per-seed is wasteful and just adds latency / rate-limit pressure.
  let prefetchedTrendItems: Record<string, unknown>[] = [];
  try {
    const trendsData = await pinterestGet(`/trends/keywords/${country}/top/growing?limit=25`, accessToken);
    prefetchedTrendItems = extractItems(trendsData);
  } catch { /* non-fatal — trends won't be included */ }

  // Process seeds in batches with caching
  const allResults: SeedEnrichmentResult[] = [];
  const failedSeeds: string[] = [];
  let rateLimitHit = false;

  for (let i = 0; i < seeds.length; i += CONCURRENCY) {
    if (rateLimitHit) break; // stop on rate limit — return what we have

    const batch = seeds.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (seed): Promise<SeedEnrichmentResult> => {
        // Cache lookup
        const cached = await getCached(seed, country);
        if (cached) {
          return { seed, keywords: cached.keywords, status: "cached" };
        }

        if (!adAccountId) {
          // No ad account — include seed keyword + any relevant trending matches
          const seedNicheWords = new Set(
            normalizeKeyword(seed).split(/\s+/).filter(
              (w) => w.length >= 4 && !GENERIC_OVERLAP_WORDS.has(w)
            )
          );
          const normSeed = normalizeKeyword(seed);
          const results: PinterestKeywordResult[] = [{
            seedKeyword: seed,
            keyword: seed,
            source: "WEBSITE_EXTRACTION",
            keywordType: "SEED",
            country,
            monthlySearches: null,
            weeklyChange: null,
            monthlyChange: null,
            relevance: "Very High",
            articleCount: articleCountBySeed.get(normSeed) ?? 0,
          }];
          const seenLocal = new Set<string>([normSeed]);
          for (const item of prefetchedTrendItems) {
            const kw = normalizeKeyword(itemKeyword(item));
            if (!kw || seenLocal.has(kw)) continue;
            const kwWords = kw.split(/\s+/);
            const sharesNiche = seedNicheWords.size > 0 &&
              kwWords.some((w) => w.length >= 5 && seedNicheWords.has(w));
            if (!sharesNiche && !kw.includes(normSeed) && !normSeed.includes(kw)) continue;
            seenLocal.add(kw);
            results.push({
              seedKeyword: seed, keyword: kw, source: "PINTEREST_API", keywordType: "TRENDING",
              country, monthlySearches: null,
              weeklyChange: (item as Record<string, unknown>).pct_growth_wow as number ?? null,
              monthlyChange: (item as Record<string, unknown>).pct_growth_mom as number ?? null,
              relevance: "Medium", articleCount: articleCountBySeed.get(kw) ?? 0,
            });
          }
          await setCached(seed, country, { keywords: results, cachedAt: Date.now() });
          return { seed, keywords: results, status: "no_account" };
        }

        try {
          const { keywords } = await enrichSeed(seed, country, accessToken, adAccountId, articleCountBySeed, prefetchedTrendItems);
          await setCached(seed, country, { keywords, cachedAt: Date.now() });
          return { seed, keywords, status: "ok" };
        } catch (e) {
          if (e instanceof RateLimitError) {
            rateLimitHit = true;
            return { seed, keywords: [], status: "error", error: "Rate limited by Pinterest API" };
          }
          return { seed, keywords: [], status: "error", error: String(e) };
        }
      }),
    );

    for (const r of batchResults) {
      if (r.status === "error") {
        failedSeeds.push(r.seed);
      }
      if (r.keywords.length > 0) {
        allResults.push(r);
      } else if (r.status === "error") {
        allResults.push(r);
      }
    }

    // Polite delay between batches
    if (i + CONCURRENCY < seeds.length && !rateLimitHit) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Compute summary stats
  const pinterestApiResults = allResults
    .flatMap((r) => r.keywords)
    .filter((k) => k.source === "PINTEREST_API");

  const uniquePinterestKws = new Set(pinterestApiResults.map((k) => normalizeKeyword(k.keyword)));
  const withMetrics = pinterestApiResults.filter((k) => k.monthlySearches !== null || k.weeklyChange !== null);

  const response: PinterestEnrichResponse = {
    country,
    websiteKeywords: seeds.length,
    pinterestEnriched: allResults.filter((r) => r.status === "ok" || r.status === "cached").length,
    pinterestSuggestions: pinterestApiResults.length,
    uniquePinterestKeywords: uniquePinterestKws.size,
    metricsAvailable: withMetrics.length,
    results: allResults,
    failedSeeds,
    noAccountWarning,
  };

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
}
