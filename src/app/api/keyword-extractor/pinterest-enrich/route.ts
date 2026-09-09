// Pinterest Keyword Enrichment for Keyword Extractor
// Correct endpoint discovered from pinterest-autocomplete/route.ts:
//   GET /v5/ad_accounts/{id}/targeting/keywords/suggestions?query=...
// NOT the non-existent POST /keywords/suggestions endpoint.
//
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
const CACHE_VERSION = "v3";      // bump to invalidate stale entries
const CONCURRENCY = 3;           // concurrent Pinterest API calls
const BATCH_DELAY_MS = 400;      // ms between batches

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
  // Diagnostic fields (only populated in GET /debug requests)
  _debug?: {
    suggestStatus?: number | "error" | "null";
    suggestCount?: number;
    suggestRawKeys?: string[];
    targetStatus?: number | "error" | "null";
    targetCount?: number;
    targetRawKeys?: string[];
  };
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
  // Diagnostic only
  _debug?: {
    adAccountId: string | null;
    trendsCount: number;
    trendsFetchStatus: string;
    endpointsUsed: string[];
  };
}

// ── Pinterest API helpers ──────────────────────────────────────────────────────

interface PinterestResponse {
  status: number;
  data: unknown;
  error?: string;
}

async function pinterestGetRaw(path: string, token: string): Promise<PinterestResponse> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) throw new RateLimitError(res.headers.get("Retry-After"));
    const text = await res.text();
    if (!res.ok) {
      console.error(`[pinterest-enrich] GET ${path.split("?")[0]} → ${res.status}: ${text.slice(0, 300)}`);
      return { status: res.status, data: null, error: text.slice(0, 200) };
    }
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: null, error: "JSON parse failed" };
    }
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    return { status: 0, data: null, error: String(e) };
  }
}

async function pinterestGet(path: string, token: string): Promise<unknown> {
  const r = await pinterestGetRaw(path, token);
  return r.data;
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
  if (total <= 0) return "Medium";
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
  return `kex_pinterest_${CACHE_VERSION}:${country}:${normalizeKeyword(seed)}`;
}

async function getCached(seed: string, country: string): Promise<CachedSeedResult | null> {
  try {
    const raw = await redis.get(cacheKey(seed, country));
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as CachedSeedResult);
    // Don't return a cached result that has only SEED keywords (means the API returned empty last time)
    const hasApiResults = (parsed as CachedSeedResult).keywords.some((k) => k.source === "PINTEREST_API");
    if (!hasApiResults) {
      console.log(`[pinterest-enrich] Cache hit for "${seed}" but only SEED keywords — will re-fetch from API`);
      return null;
    }
    return parsed as CachedSeedResult;
  } catch { return null; }
}

async function setCached(seed: string, country: string, data: CachedSeedResult): Promise<void> {
  try {
    await redis.setex(cacheKey(seed, country), CACHE_TTL, JSON.stringify(data));
  } catch { /* non-fatal */ }
}

// ── Response shape helpers ─────────────────────────────────────────────────────

// Extract items from ANY Pinterest API response shape.
// Checks for non-empty arrays in priority order matching observed API responses.
function extractItems(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data) && data.length > 0) return data as Record<string, unknown>[];

  const d = data as Record<string, unknown>;

  // Check each candidate field — skip empty arrays (don't stop on [])
  const candidates = ["suggestions", "keywords", "items", "value", "trends", "data"] as const;
  for (const key of candidates) {
    if (Array.isArray(d[key]) && (d[key] as unknown[]).length > 0) {
      return d[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function itemKeyword(item: Record<string, unknown>): string {
  // Try all known Pinterest API keyword field names
  return String(item.keyword ?? item.term ?? item.name ?? item.query ?? item.display ?? "");
}

function itemMetric(item: Record<string, unknown>, ...fields: string[]): number | null {
  for (const f of fields) {
    const v = item[f];
    if (typeof v === "number" && v > 0) return v;
    // Sometimes metrics are nested: { metrics: { monthly_searches: 1200 } }
    if (item.metrics && typeof item.metrics === "object") {
      const mv = (item.metrics as Record<string, unknown>)[f];
      if (typeof mv === "number" && mv > 0) return mv;
    }
  }
  return null;
}

// ── Generic overlap words — excluded from niche-word trend matching ─────────────

const GENERIC_OVERLAP_WORDS = new Set([
  "ideas","tips","inspiration","inspo","aesthetic","design","style","tutorial",
  "guide","simple","modern","cute","best","good","great","easy","free","diy",
  "home","room","decor","decoration","look","color","shop","buy","new","top",
  "cool","nice","beautiful","amazing","awesome","perfect","ultimate","complete",
  "budget","cheap","affordable","small","big","large","dark","light","white",
  "black","blue","red","pink","green","gold","silver","grey","gray","brown",
]);

// ── Pinterest Trends search (no Ads account required) ──────────────────────────
// Same approach as pinterest-autocomplete/route.ts — server-side fetch from
// trends.pinterest.com which works with just the OAuth token, no Ads account needed.
async function trendsSuggest(seed: string, country: string, token: string): Promise<string[]> {
  const cc = country.toLowerCase();
  const endpoints = [
    `https://trends.pinterest.com/api/v1/keywords/search?query=${encodeURIComponent(seed)}&country_code=${cc}`,
    `https://trends.pinterest.com/api/v1/search?query=${encodeURIComponent(seed)}&country_code=${cc}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "Mozilla/5.0 (compatible)",
          Accept: "application/json",
          Referer: "https://trends.pinterest.com/",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const d = data as Record<string, unknown>;
      const items: unknown[] = (
        Array.isArray(d?.keywords) ? d.keywords :
        Array.isArray(d?.results) ? d.results :
        Array.isArray(d?.suggestions) ? d.suggestions :
        Array.isArray(d?.data) ? d.data :
        Array.isArray(data) ? data as unknown[] : []
      );
      const kws = items
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          const o = item as Record<string, unknown>;
          return String(o.keyword ?? o.term ?? o.query ?? o.display ?? o.name ?? "");
        })
        .filter(Boolean);
      if (kws.length > 0) {
        console.log(`[pinterest-enrich] trends-suggest "${seed}" → ${kws.length} items from ${url.split("?")[0]}`);
        return kws.slice(0, 20);
      }
    } catch { /* try next */ }
  }
  return [];
}

// ── Enrich one keyword seed via Pinterest API ──────────────────────────────────

async function enrichSeed(
  seed: string,
  country: string,
  token: string,
  adAccountId: string | null,
  articleCountBySeed: Map<string, number>,
  prefetchedTrendItems: Record<string, unknown>[],
  debug = false,
): Promise<{ keywords: PinterestKeywordResult[]; _debug?: SeedEnrichmentResult["_debug"] }> {
  const results: PinterestKeywordResult[] = [];
  const seen = new Set<string>([normalizeKeyword(seed)]);
  const articleCount = articleCountBySeed.get(normalizeKeyword(seed)) ?? 0;
  const dbg: SeedEnrichmentResult["_debug"] = {};

  // Always include the seed itself as WEBSITE_EXTRACTION
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

  // ── 1. Keyword suggestions ───────────────────────────────────────────────────
  // Primary: official Ads API (requires Ads account)
  // Fallback: trends.pinterest.com search (works without Ads account)

  let suggestItems: Record<string, unknown>[] = [];
  let suggestStatus: number | "error" | "null" = "null";
  let suggestRawKeys: string[] = [];

  if (adAccountId) {
    const suggestRaw = await pinterestGetRaw(
      `/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=${encodeURIComponent(seed)}&limit=20`,
      token,
    );
    suggestStatus = suggestRaw.status || "null";
    suggestRawKeys = suggestRaw.data && typeof suggestRaw.data === "object"
      ? Object.keys(suggestRaw.data as object).slice(0, 10) : [];
    suggestItems = extractItems(suggestRaw.data);
    console.log(`[pinterest-enrich] seed="${seed}" suggest(ads) → HTTP ${suggestRaw.status}, items=${suggestItems.length}`);
  }

  // If Ads API returned nothing (or no Ads account), try trends.pinterest.com search
  if (suggestItems.length === 0) {
    const trendKws = await trendsSuggest(seed, country, token);
    suggestItems = trendKws.map((kw) => ({ keyword: kw }));
    if (suggestItems.length > 0) suggestStatus = 200;
    console.log(`[pinterest-enrich] seed="${seed}" suggest(trends-search) → ${suggestItems.length} items`);
  }

  if (debug) {
    dbg.suggestStatus = suggestStatus;
    dbg.suggestRawKeys = suggestRawKeys;
    dbg.suggestCount = suggestItems.length;
  }

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
      monthlySearches: itemMetric(item, "monthly_searches", "search_volume", "volume"),
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, suggestItems.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── 2. Related / targeting options (Ads account only) ──────────────────────
  // GET /v5/ad_accounts/{id}/targeting_options?targeting_type=KEYWORD&query=...
  let targetItems: Record<string, unknown>[] = [];
  let targetStatus: number | "error" | "null" = "null";
  let targetRawKeys: string[] = [];

  if (adAccountId) {
    const targetRaw = await pinterestGetRaw(
      `/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encodeURIComponent(seed)}`,
      token,
    );
    targetStatus = targetRaw.status || "null";
    targetRawKeys = targetRaw.data && typeof targetRaw.data === "object"
      ? Object.keys(targetRaw.data as object).slice(0, 10) : [];
    targetItems = extractItems(targetRaw.data);
    console.log(`[pinterest-enrich] seed="${seed}" target → HTTP ${targetRaw.status}, items=${targetItems.length}`);
  }

  if (debug) {
    dbg.targetStatus = targetStatus;
    dbg.targetRawKeys = targetRawKeys;
    dbg.targetCount = targetItems.length;
  }

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
      monthlySearches: itemMetric(item, "monthly_searches", "impressions_organic", "search_volume"),
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, targetItems.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── 3. Trending — match pre-fetched list against this seed ──────────────────
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

  return { keywords: results, _debug: debug ? dbg : undefined };
}

// ── GET /debug — single-keyword diagnostic (no tokens in response) ─────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return new Response(JSON.stringify({ error: "Pinterest not connected" }), { status: 400 });
  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const url = new URL(req.url);
  const seed = (url.searchParams.get("q") ?? "living room").trim();
  const country = (url.searchParams.get("country") ?? "US").toUpperCase();

  // ── Ad account lookup ──
  const accountsRaw = await pinterestGetRaw("/ad_accounts?page_size=5", accessToken);
  const adAccountsData = accountsRaw.data as Record<string, unknown> | null;
  const adAccounts = Array.isArray(adAccountsData?.items) ? (adAccountsData!.items as Record<string, unknown>[]) : [];
  const adAccountId: string | null = adAccounts[0]?.id as string ?? null;

  // ── Trending keywords (once) ──
  const trendsRaw = await pinterestGetRaw(`/trends/keywords/${country}/top/growing?limit=25`, accessToken);
  const trendItems = extractItems(trendsRaw.data);

  // ── Suggest endpoint ──
  const suggestRaw = adAccountId
    ? await pinterestGetRaw(
        `/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=${encodeURIComponent(seed)}&limit=20`,
        accessToken,
      )
    : { status: 0, data: null, error: "no_ad_account" };

  let suggestItems = extractItems(suggestRaw.data);
  // Fallback: trends.pinterest.com search (no Ads account required)
  if (suggestItems.length === 0) {
    const fallbackKws = await trendsSuggest(seed, country, accessToken);
    suggestItems = fallbackKws.map((kw) => ({ keyword: kw }));
  }

  // ── Targeting options endpoint ──
  const targetRaw = adAccountId
    ? await pinterestGetRaw(
        `/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encodeURIComponent(seed)}`,
        accessToken,
      )
    : { status: 0, data: null, error: "no_ad_account" };

  const targetItems = extractItems(targetRaw.data);

  // ── Diagnose ──
  const diag = {
    seed,
    country,
    adAccountId,
    adAccountsHttpStatus: accountsRaw.status,
    adAccountCount: adAccounts.length,
    // Suggestions endpoint
    suggestEndpoint: adAccountId
      ? `/v5/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=${encodeURIComponent(seed)}&limit=20`
      : "skipped (no ad account)",
    suggestHttpStatus: suggestRaw.status,
    suggestError: suggestRaw.error,
    suggestResponseTopLevelKeys: suggestRaw.data && typeof suggestRaw.data === "object"
      ? Object.keys(suggestRaw.data as object)
      : null,
    suggestItemsFound: suggestItems.length,
    suggestFirstItem: suggestItems[0] ?? null,
    // Targeting options endpoint
    targetEndpoint: adAccountId
      ? `/v5/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encodeURIComponent(seed)}`
      : "skipped (no ad account)",
    targetHttpStatus: targetRaw.status,
    targetError: targetRaw.error,
    targetResponseTopLevelKeys: targetRaw.data && typeof targetRaw.data === "object"
      ? Object.keys(targetRaw.data as object)
      : null,
    targetItemsFound: targetItems.length,
    targetFirstItem: targetItems[0] ?? null,
    // Trends
    trendsEndpoint: `/v5/trends/keywords/${country}/top/growing?limit=25`,
    trendsHttpStatus: trendsRaw.status,
    trendsError: trendsRaw.error,
    trendsItemsFound: trendItems.length,
    trendsFirstItem: trendItems[0] ?? null,
    // Summary
    totalApiKeywordsExpected: suggestItems.length + targetItems.length + trendItems.length,
    diagnosis: (() => {
      const issues: string[] = [];
      if (!adAccountId) issues.push("No Pinterest Ads account — targeting/keywords endpoints require ads:read scope AND an active Ads account");
      if (suggestRaw.status === 404) issues.push("Suggest endpoint returned 404 — endpoint path may be wrong for this account");
      if (suggestRaw.status === 403 || suggestRaw.status === 401) issues.push("Suggest endpoint: authentication/scope error");
      if (targetRaw.status === 404) issues.push("Targeting options endpoint returned 404");
      if (suggestItems.length === 0 && targetItems.length === 0) {
        issues.push("Both keyword endpoints returned 0 items — either no Ads account or API access not available at this tier");
      }
      if (trendsRaw.status === 403) issues.push("Trends endpoint requires elevated access or scope");
      return issues.length === 0 ? ["No issues detected — API should return results"] : issues;
    })(),
  };

  return new Response(JSON.stringify(diag, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) {
    return new Response(
      JSON.stringify({ error: "Pinterest not connected. Connect your Pinterest account to use this feature." }),
      { status: 400 },
    );
  }
  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const body = await req.json() as {
    keywords: string[];
    country?: string;
    articleCountMap?: Record<string, number>;
  };

  const country = (body.country ?? "US").toUpperCase();
  const rawKeywords: string[] = body.keywords ?? [];
  const articleCountMap: Record<string, number> = body.articleCountMap ?? {};

  if (rawKeywords.length === 0) {
    return new Response(JSON.stringify({ error: "No keywords provided" }), { status: 400 });
  }

  // Deduplicate + normalise seed keywords
  const seenNorm = new Set<string>();
  const seeds: string[] = [];
  for (const kw of rawKeywords) {
    const norm = normalizeKeyword(kw);
    if (norm && norm.length >= 3 && !seenNorm.has(norm)) {
      seenNorm.add(norm);
      seeds.push(norm);
    }
  }

  // Build article-count lookup
  const articleCountBySeed = new Map<string, number>();
  for (const [k, v] of Object.entries(articleCountMap)) {
    articleCountBySeed.set(normalizeKeyword(k), v);
  }

  // Get the user's ad account ID
  let adAccountId: string | null = null;
  let noAccountWarning: string | undefined;
  let adAccountsFetchStatus = 0;
  try {
    const accountsRaw = await pinterestGetRaw("/ad_accounts?page_size=5", accessToken);
    adAccountsFetchStatus = accountsRaw.status;
    const accountsData = accountsRaw.data as Record<string, unknown> | null;
    adAccountId = (accountsData?.items as Record<string, unknown>[] | undefined)?.[0]?.id as string ?? null;
    console.log(`[pinterest-enrich] ad_accounts → HTTP ${accountsRaw.status}, adAccountId=${adAccountId ?? "none"}`);
  } catch { /* no ad account */ }

  if (!adAccountId) {
    noAccountWarning = adAccountsFetchStatus === 403 || adAccountsFetchStatus === 401
      ? "Pinterest Ads access denied (scope or permissions issue). Keyword suggestions require the ads:read scope and an active Pinterest Ads account."
      : "No Pinterest Ads account found. Keyword suggestions (Suggested / Related) require an active Pinterest Ads account. Reconnect Pinterest if you have one.";
  }

  // Fetch trending keywords ONCE (same 25 results for every seed, no need to call per-seed)
  let prefetchedTrendItems: Record<string, unknown>[] = [];
  let trendsFetchStatus = 0;
  try {
    const trendsRaw = await pinterestGetRaw(`/trends/keywords/${country}/top/growing?limit=25`, accessToken);
    trendsFetchStatus = trendsRaw.status;
    prefetchedTrendItems = extractItems(trendsRaw.data);
    console.log(`[pinterest-enrich] trends → HTTP ${trendsRaw.status}, items=${prefetchedTrendItems.length}`);
  } catch { /* non-fatal */ }

  // Process seeds in batches with caching
  const allResults: SeedEnrichmentResult[] = [];
  const failedSeeds: string[] = [];
  let rateLimitHit = false;

  for (let i = 0; i < seeds.length; i += CONCURRENCY) {
    if (rateLimitHit) break;

    const batch = seeds.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (seed): Promise<SeedEnrichmentResult> => {
        // Cache lookup — only returns cached results that have actual Pinterest API keywords
        const cached = await getCached(seed, country);
        if (cached) {
          return { seed, keywords: cached.keywords, status: "cached" };
        }

        try {
          const { keywords, _debug } = await enrichSeed(
            seed, country, accessToken, adAccountId, articleCountBySeed, prefetchedTrendItems,
          );
          // Only cache if we got some Pinterest API results
          if (keywords.some((k) => k.source === "PINTEREST_API")) {
            await setCached(seed, country, { keywords, cachedAt: Date.now() });
          }
          const status = adAccountId ? "ok" : "no_account";
          return { seed, keywords, status, _debug };
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
      if (r.status === "error") failedSeeds.push(r.seed);
      if (r.keywords.length > 0 || r.status === "error") {
        allResults.push(r);
      }
    }

    if (i + CONCURRENCY < seeds.length && !rateLimitHit) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Compute summary stats
  const pinterestApiResults = allResults
    .flatMap((r) => r.keywords)
    .filter((k) => k.source === "PINTEREST_API");

  const uniquePinterestKws = new Set(pinterestApiResults.map((k) => normalizeKeyword(k.keyword)));
  const withMetrics = pinterestApiResults.filter(
    (k) => k.monthlySearches !== null || k.weeklyChange !== null || k.monthlyChange !== null
  );

  const response: PinterestEnrichResponse = {
    country,
    websiteKeywords: seeds.length,
    pinterestEnriched: allResults.filter((r) => r.status === "ok" || r.status === "cached" || r.status === "no_account").length,
    pinterestSuggestions: pinterestApiResults.length,
    uniquePinterestKeywords: uniquePinterestKws.size,
    metricsAvailable: withMetrics.length,
    results: allResults,
    failedSeeds,
    noAccountWarning,
    _debug: {
      adAccountId,
      trendsCount: prefetchedTrendItems.length,
      trendsFetchStatus: String(trendsFetchStatus),
      endpointsUsed: adAccountId
        ? [
            `/v5/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=...`,
            `/v5/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=...`,
            `/v5/trends/keywords/${country}/top/growing?limit=25`,
          ]
        : [`/v5/trends/keywords/${country}/top/growing?limit=25`],
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
}
