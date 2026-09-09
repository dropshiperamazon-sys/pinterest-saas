// Pinterest Keyword Enrichment for Keyword Extractor
//
// Confirmed working endpoints (from diagnostic run 2026-09-09):
//   ✓ GET /v5/trends/keywords/{region}/top/growing?limit=25[&interests={interest}]
//   ✗ GET /v5/ad_accounts/{id}/targeting/keywords/suggestions  → 404 "API method not found"
//   ✗ GET /v5/ad_accounts/{id}/targeting_options?targeting_type=KEYWORD → 404
//   ✓ GET /v5/ad_accounts/{id}/keywords (returns saved campaign keywords only, usually empty)
//
// Strategy: map each seed to a Pinterest interest category, fetch interest-filtered
// trending keywords once per unique interest, return matching trends per seed.
//
// ALL Pinterest API calls happen on the server — tokens never reach the browser.

import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";
const CACHE_TTL = 60 * 60 * 24; // 24 hours
const CACHE_VERSION = "v4";      // bump to invalidate stale entries

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
  _debug?: {
    adAccountId: string | null;
    trendsCount: number;
    interestsFetched: string[];
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

// ── Seed → Pinterest interest mapping ─────────────────────────────────────────
// Maps keywords to Pinterest interest slugs used by the Trends API.

const INTEREST_PATTERNS: { pattern: RegExp; interest: string }[] = [
  // Home & Decor — broad catch for any room or home-related seed
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
  // Fashion
  {
    pattern: /outfit|fashion|dress|clothing|jeans|jacket|coat|blouse|skirt|shoes|boots|sneakers|accessories|handbag|purse|style|wardrobe|capsule wardrobe/i,
    interest: "womens_fashion",
  },
  // Beauty
  {
    pattern: /makeup|beauty|skincare|lipstick|foundation|eyeshadow|blush|mascara|nail|hair color|hair style|haircut|braid|curly hair|straight hair|eyelash|serum|moisturizer/i,
    interest: "beauty",
  },
  // Food
  {
    pattern: /recipe|food|meal|dinner|lunch|breakfast|dessert|cake|cookie|bread|smoothie|salad|soup|pasta|healthy eating|meal prep|baking|cooking|snack|appetizer/i,
    interest: "food_and_drinks",
  },
  // Travel
  {
    pattern: /travel|vacation|trip|destination|hotel|flight|backpack|adventure|itinerary|road trip|beach|mountain|europe|asia|bucket list/i,
    interest: "travel",
  },
  // Fitness
  {
    pattern: /workout|fitness|gym|exercise|yoga|pilates|running|weight loss|muscle|abs|glutes|cardio|strength training|home workout/i,
    interest: "sport",
  },
  // DIY & Crafts
  {
    pattern: /craft|diy|handmade|sewing|knitting|crochet|embroidery|macrame|scrapbook|drawing|painting|watercolor|resin|upcycle/i,
    interest: "diy_and_crafts",
  },
  // Wedding
  {
    pattern: /wedding|bride|bridal|engagement|ceremony|reception|bridesmaid|wedding dress|wedding cake|wedding decor|wedding flowers/i,
    interest: "wedding",
  },
  // Parenting
  {
    pattern: /baby|toddler|parenting|kids|children|nursery|pregnancy|newborn|postpartum|homeschool|school lunch|back to school/i,
    interest: "parenting",
  },
  // Pets
  {
    pattern: /dog|cat|pet|puppy|kitten|animal|bunny|hamster|fish tank|bird|reptile/i,
    interest: "animals",
  },
  // Tech
  {
    pattern: /tech|phone|laptop|gadget|app|software|computer|iphone|android|tablet|smart home|gaming setup/i,
    interest: "electronics",
  },
  // Business
  {
    pattern: /business|marketing|finance|money|invest|entrepreneur|startup|freelance|passive income|side hustle|social media marketing/i,
    interest: "business_strategy",
  },
  // Education
  {
    pattern: /study|education|school|college|learn|course|book|reading|study tips|productivity|journal|planner|note taking/i,
    interest: "education",
  },
  // Entertainment
  {
    pattern: /movie|music|game|anime|netflix|celebrity|tv show|series|concert|festival/i,
    interest: "entertainment",
  },
];

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
    const hasApiResults = (parsed as CachedSeedResult).keywords.some((k) => k.source === "PINTEREST_API");
    if (!hasApiResults) return null;
    return parsed as CachedSeedResult;
  } catch { return null; }
}

async function setCached(seed: string, country: string, data: CachedSeedResult): Promise<void> {
  try {
    await redis.setex(cacheKey(seed, country), CACHE_TTL, JSON.stringify(data));
  } catch { /* non-fatal */ }
}

// ── Build keyword results for one seed ────────────────────────────────────────

// Words that indicate a trending keyword is a pop-culture/viral topic unrelated to home/lifestyle niches.
// Used to filter out clearly off-topic global trends when interest-specific fetch also returns noise.
const POP_CULTURE_SIGNALS = new Set([
  "la place", "willow tsp", "lesbian space princess", "asmr", "mukbang",
  "fnaf", "stranger things", "taylor swift", "beyonce", "drake", "skibidi",
  "rizz", "gyatt", "sigma", "ohio", "sussy", "among us", "minecraft",
]);

function buildSeedKeywords(
  seed: string,
  country: string,
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

  for (let i = 0; i < trendItems.length; i++) {
    const item = trendItems[i];
    const kw = normalizeKeyword(item.keyword);
    if (!kw || seen.has(kw)) continue;

    // When using global trends (no interest match), skip obvious pop-culture/viral noise
    if (!hasInterest) {
      if (POP_CULTURE_SIGNALS.has(kw)) continue;
      // Require at least one shared word with the seed (min 4 chars)
      const kwWords = kw.split(/\s+/);
      const sharesWord = kwWords.some((w) => w.length >= 4 && seedWords.has(w));
      const isSubstring = kw.includes(normSeed) || normSeed.includes(kw);
      if (!sharesWord && !isSubstring) continue;
    } else {
      // For interest-specific trends, still skip obvious viral non-topic keywords
      if (POP_CULTURE_SIGNALS.has(kw)) continue;
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

  const interest = seedToInterest(seed);

  // Ad account lookup
  const accountsRaw = await pinterestGetRaw("/ad_accounts?page_size=5", accessToken);
  const adAccountsData = accountsRaw.data as Record<string, unknown> | null;
  const adAccounts = Array.isArray(adAccountsData?.items) ? adAccountsData!.items as Record<string, unknown>[] : [];
  const adAccountId = adAccounts[0]?.id as string ?? null;

  // Fetch global trends + interest-specific trends
  const globalTrends = await fetchTrendsByInterest(country, null, accessToken);
  const interestTrends = interest ? await fetchTrendsByInterest(country, interest, accessToken) : [];

  const diag = {
    seed,
    country,
    detectedInterest: interest,
    adAccountId,
    adAccountsHttpStatus: accountsRaw.status,
    globalTrendsCount: globalTrends.length,
    globalTrendsSample: globalTrends.slice(0, 5).map((t) => t.keyword),
    interestTrendsCount: interestTrends.length,
    interestTrendsSample: interestTrends.slice(0, 10).map((t) => t.keyword),
    note: "Keyword suggestion endpoints (/targeting/keywords/suggestions, /targeting_options) return 404 for this account. Using interest-filtered Trends API instead.",
    keywordsExpected: interestTrends.length > 0 ? interestTrends.length : globalTrends.length,
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

  // Map each seed to its interest, collect unique interests
  const seedInterest = new Map<string, string | null>();
  const uniqueInterests = new Set<string>();
  for (const seed of seeds) {
    const interest = seedToInterest(seed);
    seedInterest.set(seed, interest);
    if (interest) uniqueInterests.add(interest);
  }

  // Fetch trends per unique interest (+ global fallback once)
  const trendsByInterest = new Map<string | null, TrendItem[]>();

  // Global trends (used as fallback for seeds with no matched interest)
  const globalTrends = await fetchTrendsByInterest(country, null, accessToken);
  trendsByInterest.set(null, globalTrends);

  // Interest-specific trends (one API call per unique interest, with 400ms gap)
  const interestList = Array.from(uniqueInterests);
  for (let i = 0; i < interestList.length; i++) {
    const interest = interestList[i];
    const items = await fetchTrendsByInterest(country, interest, accessToken);
    trendsByInterest.set(interest, items);
    if (i < interestList.length - 1) await sleep(400);
  }

  // Process seeds — check cache first, then build from trend data
  const allResults: SeedEnrichmentResult[] = [];
  const failedSeeds: string[] = [];
  const BATCH = 5;

  for (let i = 0; i < seeds.length; i += BATCH) {
    const batch = seeds.slice(i, i + BATCH);

    const batchResults = await Promise.all(
      batch.map(async (seed): Promise<SeedEnrichmentResult> => {
        const cached = await getCached(seed, country);
        if (cached) return { seed, keywords: cached.keywords, status: "cached" };

        try {
          const interest = seedInterest.get(seed) ?? null;
          // Prefer interest-specific trends; fall back to global
          const trends = (interest && (trendsByInterest.get(interest)?.length ?? 0) > 0)
            ? trendsByInterest.get(interest)!
            : trendsByInterest.get(null)!;

          const keywords = buildSeedKeywords(seed, country, trends, articleCountBySeed, !!interest && trends === trendsByInterest.get(interest));

          if (keywords.some((k) => k.source === "PINTEREST_API")) {
            await setCached(seed, country, { keywords, cachedAt: Date.now() });
          }
          return { seed, keywords, status: "ok" };
        } catch (e) {
          failedSeeds.push(seed);
          return { seed, keywords: [], status: "error", error: String(e) };
        }
      }),
    );

    for (const r of batchResults) {
      if (r.keywords.length > 0 || r.status === "error") allResults.push(r);
    }
  }

  const pinterestApiResults = allResults
    .flatMap((r) => r.keywords)
    .filter((k) => k.source === "PINTEREST_API");

  const uniquePinterestKws = new Set(pinterestApiResults.map((k) => normalizeKeyword(k.keyword)));
  const withMetrics = pinterestApiResults.filter(
    (k) => k.weeklyChange !== null || k.monthlyChange !== null,
  );

  const response: PinterestEnrichResponse = {
    country,
    websiteKeywords: seeds.length,
    pinterestEnriched: allResults.filter((r) => r.status === "ok" || r.status === "cached").length,
    pinterestSuggestions: pinterestApiResults.length,
    uniquePinterestKeywords: uniquePinterestKws.size,
    metricsAvailable: withMetrics.length,
    results: allResults,
    failedSeeds,
    _debug: {
      adAccountId: null,
      trendsCount: globalTrends.length,
      interestsFetched: interestList,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
}
