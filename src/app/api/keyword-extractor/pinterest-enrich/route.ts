// Pinterest Keyword Enrichment — Keyword Extractor
//
// Confirmed working endpoints (tested 2026-09-09):
//
//   ✓ GET /v5/terms/related?terms={seed}
//       → { id, related_term_count, related_terms_list: [{ term, related_terms: string[] }] }
//       → Returns up to 10 related terms per call
//
//   ✓ GET /v5/trends/keywords/{region}/top/growing?limit=25[&interests={slug}]
//       → Returns up to 25 trending terms per interest
//
//   ~ GET /v5/terms/suggested?term={seed}&limit=10
//       → 200 OK but returns only the seed itself — not useful for expansion
//
//   ✗ GET /v5/ad_accounts/{id}/targeting/keywords/suggestions → 404
//
// Strategy:
//   1. L1 related: GET /v5/terms/related for seed → up to 10 terms
//   2. L2 related: GET /v5/terms/related for each top-5 L1 term → up to 50 more
//   3. Trends: /top/growing for primary interest + up to 2 secondary interests → up to 75
//   4. Combine, deduplicate, tag sources, return up to 200 unique keywords
//
// ALL Pinterest API calls happen server-side — tokens never reach the browser.

import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import {
  searchKeywords,
  logSearchSignal,
  normalizeKeyword as dbNorm,
} from "@/lib/keyword-db";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";
const CACHE_TTL = 60 * 60 * 24; // 24 hours
const CACHE_VERSION = "v7";      // bumped: removed secondary interests (cross-interest trending)

// ── Types ──────────────────────────────────────────────────────────────────────

export type KeywordSource =
  | "PINTEREST_RELATED"    // /v5/terms/related — confirmed working
  | "PINTEREST_API"        // /v5/trends — trending keywords (backward-compatible label)
  | "PINTEREST_SUGGESTED"  // reserved / future
  | "WEBSITE_EXTRACTION"
  | "AI_GENERATED";

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
  pinterestSuggestions: number;     // total PINTEREST_RELATED + PINTEREST_API keywords
  uniquePinterestKeywords: number;
  metricsAvailable: number;
  relatedTermsCount: number;        // keywords from /v5/terms/related
  trendingTermsCount: number;       // keywords from /v5/trends
  totalUniqueKeywords: number;
  results: SeedEnrichmentResult[];
  failedSeeds: string[];
  noAccountWarning?: string;
  // Separated datasets — PINTEREST_RELATED/PINTEREST_SUGGESTED vs PINTEREST_API
  relatedKeywords: PinterestKeywordResult[];
  trendingKeywords: PinterestKeywordResult[];
  _debug?: {
    interestsFetched: string[];
    relatedApiWorking: boolean;
    trendsCount: number;
  };
}

// ── Pinterest API helper ───────────────────────────────────────────────────────

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
    const text = await res.text();
    if (!res.ok) {
      console.error(`[pinterest-enrich] GET ${path.split("?")[0]} → ${res.status}: ${text.slice(0, 200)}`);
      return { status: res.status, data: null, error: text.slice(0, 200) };
    }
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: null, error: "JSON parse failed" };
    }
  } catch (e) {
    return { status: 0, data: null, error: String(e) };
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

// ── Official: GET /v5/terms/related ───────────────────────────────────────────
// Confirmed response shape (tested 2026-09-09):
//   { id, related_term_count, related_terms_list: [{ term, related_terms: string[] }] }
// Does NOT accept a country parameter — returns global related terms.

async function fetchTermsRelated(term: string, token: string): Promise<string[]> {
  const raw = await pinterestGetRaw(
    `/terms/related?terms=${encodeURIComponent(term)}`,
    token,
  );
  if (!raw.data) return [];

  const data = raw.data as Record<string, unknown>;
  const list = Array.isArray(data.related_terms_list)
    ? (data.related_terms_list as Record<string, unknown>[])
    : [];

  const terms: string[] = Array.isArray(list[0]?.related_terms)
    ? (list[0].related_terms as string[])
    : [];

  const result = terms
    .map(normalizeKeyword)
    .filter((t) => t.length >= 3);

  console.log(`[pinterest-enrich] /terms/related "${term}" → ${result.length} terms`);
  return result;
}

// ── Seed → Pinterest interest mapping ─────────────────────────────────────────

const INTEREST_PATTERNS: { pattern: RegExp; interest: string }[] = [
  {
    pattern: /living room|dining room|bedroom|bathroom|kitchen|laundry|garage|basement|attic|hallway|entryway|mudroom|nursery room|home office|study room|playroom|sunroom|porch|balcony|terrace/i,
    interest: "home_decor",
  },
  {
    pattern: /sofa|couch|lounge|tv stand|coffee table|bed frame|nightstand|mattress|pillow|duvet|comforter|vanity|tile|faucet|cabinet|countertop|backsplash|sink|fridge|appliance/i,
    interest: "home_decor",
  },
  {
    pattern: /home decor|interior design|room decor|furniture|rug|curtain|drape|lamp|shelf|mirror|wall art|wallpaper|paint color|accent wall|open shelving|floating shelf/i,
    interest: "home_decor",
  },
  {
    pattern: /garden|plant|flower|outdoor|backyard|patio|landscape|lawn|deck|pergola|raised bed|planter|succulent|houseplant/i,
    interest: "home_decor",
  },
  {
    pattern: /outfit|fashion|dress|clothing|jeans|jacket|coat|blouse|skirt|shoes|boots|sneakers|accessories|handbag|purse|style|wardrobe|capsule wardrobe/i,
    interest: "womens_fashion",
  },
  {
    pattern: /makeup|beauty|skincare|lipstick|foundation|eyeshadow|blush|mascara|nail|hair color|hair style|haircut|braid|curly hair|straight hair|eyelash|serum|moisturizer/i,
    interest: "beauty",
  },
  {
    pattern: /recipe|food|meal|dinner|lunch|breakfast|dessert|cake|cookie|bread|smoothie|salad|soup|pasta|healthy eating|meal prep|baking|cooking|snack|appetizer/i,
    interest: "food_and_drinks",
  },
  {
    pattern: /travel|vacation|trip|destination|hotel|flight|backpack|adventure|itinerary|road trip|beach|mountain|europe|asia|bucket list/i,
    interest: "travel",
  },
  {
    pattern: /workout|fitness|gym|exercise|yoga|pilates|running|weight loss|muscle|abs|glutes|cardio|strength training|home workout/i,
    interest: "sport",
  },
  {
    pattern: /craft|diy|handmade|sewing|knitting|crochet|embroidery|macrame|scrapbook|drawing|painting|watercolor|resin|upcycle/i,
    interest: "diy_and_crafts",
  },
  {
    pattern: /wedding|bride|bridal|engagement|ceremony|reception|bridesmaid|wedding dress|wedding cake|wedding decor|wedding flowers/i,
    interest: "wedding",
  },
  {
    pattern: /baby|toddler|parenting|kids|children|nursery|pregnancy|newborn|postpartum|homeschool|school lunch|back to school/i,
    interest: "parenting",
  },
  {
    pattern: /dog|cat|pet|puppy|kitten|animal|bunny|hamster|fish tank|bird|reptile/i,
    interest: "animals",
  },
  {
    pattern: /tech|phone|laptop|gadget|app|software|computer|iphone|android|tablet|smart home|gaming setup/i,
    interest: "electronics",
  },
  {
    pattern: /business|marketing|finance|money|invest|entrepreneur|startup|freelance|passive income|side hustle|social media marketing/i,
    interest: "business_strategy",
  },
  {
    pattern: /study|education|school|college|learn|course|book|reading|study tips|productivity|journal|planner|note taking/i,
    interest: "education",
  },
  {
    pattern: /movie|music|game|anime|netflix|celebrity|tv show|series|concert|festival/i,
    interest: "entertainment",
  },
];

// Secondary interests removed — cross-interest trend fetching caused off-topic
// keywords (e.g. "diy_and_crafts" added "grandparents day crafts" and "art"
// added "dolly parton drawing" to a "room decor" seed). Using only the primary
// matched interest keeps trending results topically relevant.

function seedToInterest(seed: string): string | null {
  const lower = seed.toLowerCase();
  for (const { pattern, interest } of INTEREST_PATTERNS) {
    if (pattern.test(lower)) return interest;
  }
  return null;
}

// ── Trending keyword fetch per interest ────────────────────────────────────────

interface TrendItem {
  keyword: string;
  pct_growth_wow: number | null;
  pct_growth_mom: number | null;
}

async function fetchTrendsByInterest(
  country: string,
  interest: string | null,
  token: string,
): Promise<TrendItem[]> {
  let path = `/trends/keywords/${country}/top/growing?limit=25`;
  if (interest) path += `&interests=${encodeURIComponent(interest)}`;

  const raw = await pinterestGetRaw(path, token);
  if (!raw.data) return [];

  const data = raw.data as Record<string, unknown>;
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray(data.trends) ? data.trends as Record<string, unknown>[]
    : Array.isArray(data.keywords) ? data.keywords as Record<string, unknown>[]
    : Array.isArray(data.items) ? data.items as Record<string, unknown>[]
    : [];

  console.log(`[pinterest-enrich] trends interest=${interest ?? "none"} → HTTP ${raw.status}, items=${items.length}`);

  return items
    .map((item) => ({
      keyword: String(item.keyword ?? item.term ?? item.name ?? ""),
      pct_growth_wow: typeof item.pct_growth_wow === "number" ? item.pct_growth_wow : null,
      pct_growth_mom: typeof item.pct_growth_mom === "number" ? item.pct_growth_mom : null,
    }))
    .filter((t) => t.keyword.length >= 3);
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
    const hasRealResults = (parsed as CachedSeedResult).keywords.some(
      (k) => k.source === "PINTEREST_RELATED" || k.source === "PINTEREST_API",
    );
    if (!hasRealResults) return null;
    return parsed as CachedSeedResult;
  } catch { return null; }
}

async function setCached(seed: string, country: string, data: CachedSeedResult): Promise<void> {
  try {
    await redis.setex(cacheKey(seed, country), CACHE_TTL, JSON.stringify(data));
  } catch { /* non-fatal */ }
}

// ── Pop-culture noise filter ────────────────────────────────────────────────────

const POP_CULTURE_SIGNALS = new Set([
  "la place", "willow tsp", "lesbian space princess", "asmr", "mukbang",
  "fnaf", "stranger things", "taylor swift", "beyonce", "drake", "skibidi",
  "rizz", "gyatt", "sigma", "ohio", "sussy", "among us", "minecraft",
]);

// ── Build keyword results for one seed ────────────────────────────────────────

function buildKeywordsForSeed(
  seed: string,
  country: string,
  relatedL1: string[],       // from /v5/terms/related on the seed
  relatedL2: string[],       // from /v5/terms/related on top L1 terms
  trendItems: TrendItem[],
  articleCountBySeed: Map<string, number>,
  hasInterest: boolean,
): PinterestKeywordResult[] {
  const normSeed = normalizeKeyword(seed);
  const seedWords = new Set(normSeed.split(/\s+/).filter((w) => w.length >= 4));
  const results: PinterestKeywordResult[] = [];
  const seen = new Set<string>([normSeed]);

  // Always include the seed itself
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
    articleCount: articleCountBySeed.get(normSeed) ?? 0,
  });

  // ── Related terms Level-1 (official /v5/terms/related on seed) ────────────
  for (let i = 0; i < relatedL1.length; i++) {
    const kw = relatedL1[i];
    if (!kw || seen.has(kw) || POP_CULTURE_SIGNALS.has(kw)) continue;
    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_RELATED",
      keywordType: "RELATED",
      country,
      monthlySearches: null,
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, relatedL1.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── Related terms Level-2 (official /v5/terms/related on each L1 term) ───
  for (let i = 0; i < relatedL2.length; i++) {
    const kw = relatedL2[i];
    if (!kw || seen.has(kw) || POP_CULTURE_SIGNALS.has(kw)) continue;
    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_RELATED",
      keywordType: "RELATED",
      country,
      monthlySearches: null,
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, relatedL2.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── Trending terms (country-specific, /v5/trends) ─────────────────────────
  for (let i = 0; i < trendItems.length; i++) {
    const item = trendItems[i];
    const kw = normalizeKeyword(item.keyword);
    if (!kw || seen.has(kw) || POP_CULTURE_SIGNALS.has(kw)) continue;

    // Global trends (no matched interest): require at least one shared word with seed
    if (!hasInterest) {
      const kwWords = kw.split(/\s+/);
      const sharesWord = kwWords.some((w) => w.length >= 4 && seedWords.has(w));
      const isSubstring = kw.includes(normSeed) || normSeed.includes(kw);
      if (!sharesWord && !isSubstring) continue;
    }

    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_API",
      keywordType: "TRENDING",
      country,
      monthlySearches: null,
      weeklyChange: item.pct_growth_wow,
      monthlyChange: item.pct_growth_mom,
      relevance: relevanceFromPosition(i, trendItems.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  return results;
}

// ── GET — diagnostic endpoint ─────────────────────────────────────────────────
// Visit: GET /api/keyword-extractor/pinterest-enrich?q=room+decor+aesthetic
// Tests all confirmed endpoints with real token, returns sanitised JSON.
// Token is NEVER included in the response.

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return new Response(JSON.stringify({ error: "Pinterest not connected" }), { status: 400 });
  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const url = new URL(req.url);
  const seed = (url.searchParams.get("q") ?? "room decor").trim();
  const country = (url.searchParams.get("country") ?? "US").toUpperCase();

  // ── Look up the real ad account ID first ─────────────────────────────────
  const accountsRaw = await pinterestGetRaw("/ad_accounts?page_size=5", accessToken);
  const adAccountsData = accountsRaw.data as Record<string, unknown> | null;
  const adAccounts = Array.isArray(adAccountsData?.items)
    ? (adAccountsData!.items as Record<string, unknown>[])
    : [];
  const adAccountId = (adAccounts[0]?.id as string) ?? null;

  // ── Test the Ads keyword suggestion endpoints with a real query ────────────
  const adsEndpoints: Record<string, PinterestResponse> = {};

  if (adAccountId) {
    const q = encodeURIComponent(seed);

    // Variation 1 — the endpoint we previously tested (returned 404)
    adsEndpoints["targeting_keywords_suggestions_GET"] = await pinterestGetRaw(
      `/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=${q}&limit=20`,
      accessToken,
    );
    await sleep(300);

    // Variation 2 — keywords list with query filter (previously returned empty)
    adsEndpoints["keywords_with_query_GET"] = await pinterestGetRaw(
      `/ad_accounts/${adAccountId}/keywords?query=${q}&page_size=20`,
      accessToken,
    );
    await sleep(300);

    // Variation 3 — targeting options scoped to KEYWORD type
    adsEndpoints["targeting_options_keyword_GET"] = await pinterestGetRaw(
      `/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${q}`,
      accessToken,
    );
    await sleep(300);

    // Variation 4 — keyword metrics / volume lookup (batch endpoint)
    adsEndpoints["keyword_metrics_POST_stub"] = {
      status: 0,
      data: null,
      error: "POST endpoints require body — add ?test_post=1 to trigger",
    };
  }

  // ── Also test the confirmed-working endpoints ─────────────────────────────
  const interest = seedToInterest(seed);
  const relatedL1 = await fetchTermsRelated(seed, accessToken);
  await sleep(300);
  const trendsRaw = await fetchTrendsByInterest(country, interest, accessToken);

  const diag = {
    seed,
    country,
    adAccountId,
    adAccountsHttpStatus: accountsRaw.status,

    ads_keyword_endpoints: Object.fromEntries(
      Object.entries(adsEndpoints).map(([key, res]) => [
        key,
        {
          httpStatus: res.status,
          error: res.error ?? null,
          responseKeys: res.data ? Object.keys(res.data as object) : null,
          // Full response so we can see the exact shape (no tokens in API responses)
          rawData: res.data,
        },
      ]),
    ),

    confirmed_working: {
      terms_related: {
        endpoint: `/v5/terms/related?terms=${encodeURIComponent(seed)}`,
        count: relatedL1.length,
        terms: relatedL1,
      },
      trends_growing: {
        interest: interest ?? "none",
        count: trendsRaw.length,
        sample: trendsRaw.slice(0, 5).map((t) => t.keyword),
      },
    },

    note: "Token is never returned. This diagnostic is for identifying which ads keyword endpoint is accessible at this API tier.",
  };

  return new Response(JSON.stringify(diag, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) {
    return new Response(
      JSON.stringify({ error: "Pinterest not connected. Connect your Pinterest account in Settings." }),
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

  // Deduplicate + normalise seeds
  const seenNorm = new Set<string>();
  const seeds: string[] = [];
  for (const kw of rawKeywords) {
    const norm = normalizeKeyword(kw);
    if (norm && norm.length >= 3 && !seenNorm.has(norm)) {
      seenNorm.add(norm);
      seeds.push(norm);
    }
  }

  const articleCountBySeed = new Map<string, number>();
  for (const [k, v] of Object.entries(articleCountMap)) {
    articleCountBySeed.set(normalizeKeyword(k), v);
  }

  // ── Log search signals (non-blocking) ────────────────────────────────────
  for (const seed of seeds) {
    logSearchSignal(seed, country).catch(() => {});
  }

  // ── Query internal knowledge store for each seed ──────────────────────────
  // Knowledge store results enrich the Related Keywords tab with verified
  // metrics (monthly_searches, competition, avg_cpc) that Pinterest API alone
  // does not provide. We collect them now so they can be merged later.
  const knowledgeStoreResults = new Map<string, Awaited<ReturnType<typeof searchKeywords>>>();
  for (const seed of seeds) {
    try {
      const kbResults = await searchKeywords({ query: seed, country, limit: 60 });
      if (kbResults.length > 0) {
        knowledgeStoreResults.set(seed, kbResults);
        // Store relationships from knowledge base into the Pinterest keywords
        for (let i = 0; i < Math.min(kbResults.length, 10); i++) {
          const kb = kbResults[i];
          if (dbNorm(kb.keyword) !== seed) {
            // Will be used when building keywords below
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  // ── Determine all interests for trend calls ───────────────────────────────
  const seedInterest = new Map<string, string | null>();
  const allInterestsToFetch = new Set<string>();

  for (const seed of seeds) {
    const primary = seedToInterest(seed);
    seedInterest.set(seed, primary);
    if (primary) {
      allInterestsToFetch.add(primary);
    }
  }

  // ── Fetch trends upfront: global + all unique interests ───────────────────
  const trendsByInterest = new Map<string | null, TrendItem[]>();
  const globalTrends = await fetchTrendsByInterest(country, null, accessToken);
  trendsByInterest.set(null, globalTrends);

  const interestList = Array.from(allInterestsToFetch);
  for (let i = 0; i < interestList.length; i++) {
    const interest = interestList[i];
    const items = await fetchTrendsByInterest(country, interest, accessToken);
    trendsByInterest.set(interest, items);
    if (i < interestList.length - 1) await sleep(300);
  }

  function getTrendsForSeed(seed: string): TrendItem[] {
    const primary = seedInterest.get(seed) ?? null;
    const seen = new Set<string>();
    const merged: TrendItem[] = [];
    const add = (items: TrendItem[]) => {
      for (const item of items) {
        const kw = normalizeKeyword(item.keyword);
        if (kw && !seen.has(kw)) { seen.add(kw); merged.push(item); }
      }
    };
    if (primary) {
      add(trendsByInterest.get(primary) ?? []);
    } else {
      add(trendsByInterest.get(null) ?? []);
    }
    return merged;
  }

  // ── Process each seed ─────────────────────────────────────────────────────
  const allResults: SeedEnrichmentResult[] = [];
  const failedSeeds: string[] = [];
  let relatedApiWorked = false;

  for (const seed of seeds) {
    const cached = await getCached(seed, country);
    if (cached) {
      allResults.push({ seed, keywords: cached.keywords, status: "cached" });
      continue;
    }

    try {
      // ── Step 1: L1 related terms from /v5/terms/related ─────────────────
      const relatedL1 = await fetchTermsRelated(seed, accessToken);
      if (relatedL1.length > 0) relatedApiWorked = true;

      // ── Step 2: L2 expansion — /v5/terms/related for each top-5 L1 term ─
      const relatedL2Raw: string[] = [];
      for (const l1Term of relatedL1.slice(0, 5)) {
        await sleep(300);
        const sub = await fetchTermsRelated(l1Term, accessToken);
        relatedL2Raw.push(...sub);
        if (sub.length > 0) relatedApiWorked = true;
      }
      // Deduplicate L2, removing anything already in L1 (done in buildKeywords via seen-set)
      const relatedL2 = [...new Set(relatedL2Raw.map(normalizeKeyword))];

      // ── Step 3: Trend items (country-specific) ───────────────────────────
      const trendItems = getTrendsForSeed(seed);
      const primary = seedInterest.get(seed) ?? null;
      const hasInterest = primary !== null && (trendsByInterest.get(primary)?.length ?? 0) > 0;

      // ── Step 4: Build combined keyword list ──────────────────────────────
      const keywords = buildKeywordsForSeed(
        seed,
        country,
        relatedL1,
        relatedL2,
        trendItems,
        articleCountBySeed,
        hasInterest,
      );

      // ── Step 5: Merge knowledge store metrics into related keywords ────────
      const kbForSeed = knowledgeStoreResults.get(seed) ?? [];
      const kbByNorm = new Map(kbForSeed.map(k => [dbNorm(k.keyword), k]));
      const kbSeen = new Set(keywords.map(k => dbNorm(k.keyword)));

      for (const kb of kbForSeed) {
        const norm = dbNorm(kb.keyword);
        if (!kbSeen.has(norm)) {
          kbSeen.add(norm);
          keywords.push({
            seedKeyword: seed,
            keyword: kb.keyword,
            source: "PINTEREST_RELATED",
            keywordType: "RELATED",
            country,
            monthlySearches: kb.monthlySearches,
            weeklyChange: null,
            monthlyChange: null,
            relevance: "Medium",
            articleCount: articleCountBySeed.get(norm) ?? 0,
          });
        } else {
          const existing = keywords.find(k => dbNorm(k.keyword) === norm);
          if (existing && kb.monthlySearches !== null && existing.monthlySearches === null) {
            existing.monthlySearches = kb.monthlySearches;
          }
        }
      }

      // Step 6: Pinterest-sourced terms are NOT stored in the shared knowledge
      // base to comply with Pinterest API ToS (no persistent cross-user storage
      // of API data). They remain in the short-term per-keyword cache only.

      const hasRealData = keywords.some(
        (k) => k.source === "PINTEREST_RELATED" || k.source === "PINTEREST_API",
      );
      if (hasRealData) {
        await setCached(seed, country, { keywords, cachedAt: Date.now() });
      }

      allResults.push({ seed, keywords, status: "ok" });
    } catch (e) {
      failedSeeds.push(seed);
      allResults.push({ seed, keywords: [], status: "error", error: String(e) });
    }

    // Rate-limit gap between seeds
    if (seeds.indexOf(seed) < seeds.length - 1) await sleep(300);
  }

  // ── Build response metrics ─────────────────────────────────────────────────
  const allRealKws = allResults.flatMap((r) => r.keywords).filter(
    (k) => k.source === "PINTEREST_RELATED" || k.source === "PINTEREST_API",
  );
  const uniqueKwSet = new Set(allRealKws.map((k) => normalizeKeyword(k.keyword)));
  const relatedCount = allRealKws.filter((k) => k.source === "PINTEREST_RELATED").length;
  const trendingCount = allRealKws.filter((k) => k.source === "PINTEREST_API").length;
  const withMetrics = allRealKws.filter(
    (k) => k.weeklyChange !== null || k.monthlyChange !== null,
  );

  const relatedKeywords = allRealKws.filter(
    (k) => k.source === "PINTEREST_RELATED" || k.source === "PINTEREST_SUGGESTED",
  );
  const trendingKeywords = allRealKws.filter((k) => k.source === "PINTEREST_API");

  const response: PinterestEnrichResponse = {
    country,
    websiteKeywords: seeds.length,
    pinterestEnriched: allResults.filter((r) => r.status === "ok" || r.status === "cached").length,
    pinterestSuggestions: allRealKws.length,
    uniquePinterestKeywords: uniqueKwSet.size,
    metricsAvailable: withMetrics.length,
    relatedTermsCount: relatedCount,
    trendingTermsCount: trendingCount,
    totalUniqueKeywords: uniqueKwSet.size,
    results: allResults,
    failedSeeds,
    relatedKeywords,
    trendingKeywords,
    _debug: {
      interestsFetched: interestList,
      relatedApiWorking: relatedApiWorked,
      trendsCount: globalTrends.length,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
}
