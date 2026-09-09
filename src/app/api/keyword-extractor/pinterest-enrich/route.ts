// Pinterest Keyword Enrichment — Keyword Extractor
//
// Strategy (v5):
//   1. Autocomplete Level-1: fetch Pinterest autocomplete suggestions for the seed (up to 12).
//   2. Autocomplete Level-2: for each top L1 suggestion (up to 5), fetch another autocomplete
//      round to get deeper completions (up to 5 × 12 = 60 more).
//   3. Trends: call /v5/trends/keywords/{region}/top/growing for the seed's primary interest
//      AND up to 2 secondary interests — each returns up to 25 terms.
//   4. Combine, deduplicate (case-insensitive), tag sources.
//
// Confirmed working endpoints (2026-09-09):
//   ✓ GET /v5/trends/keywords/{region}/top/growing?limit=25[&interests={slug}]
//   ✗ GET /v5/ad_accounts/{id}/targeting/keywords/suggestions → 404 ("API method not found")
//   ✗ GET /v5/ad_accounts/{id}/targeting_options?targeting_type=KEYWORD → 404
//
// ALL Pinterest API calls are server-side only — tokens never reach the browser.

import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";
const CACHE_TTL = 60 * 60 * 24; // 24 hours
const CACHE_VERSION = "v5";      // bumped from v4 — adds autocomplete layer

// ── Types ──────────────────────────────────────────────────────────────────────

export type KeywordSource =
  | "PINTEREST_API"        // Trends API (backward-compatible label for trending keywords)
  | "PINTEREST_SUGGESTED"  // Autocomplete / suggested-terms (seed-based completions)
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
  pinterestSuggestions: number;
  uniquePinterestKeywords: number;
  metricsAvailable: number;
  // New metadata fields (non-breaking additions)
  suggestedTermsCount: number;
  trendingTermsCount: number;
  totalUniqueKeywords: number;
  results: SeedEnrichmentResult[];
  failedSeeds: string[];
  noAccountWarning?: string;
  _debug?: {
    adAccountId: string | null;
    trendsCount: number;
    interestsFetched: string[];
    autocompleteWorking: boolean;
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

// ── Autocomplete (server-side) ─────────────────────────────────────────────────
// Calls Pinterest's autocomplete JSON endpoints without touching Pinterest tokens —
// these are the same public JSON endpoints the existing /api/pinterest-autocomplete
// route uses, called server-side so credentials stay on the server.

async function fetchAutocomplete(query: string): Promise<string[]> {
  const endpoints = [
    `https://www.pinterest.com/resource/SearchAutocompletesResource/get/?source_url=/&data=${encodeURIComponent(JSON.stringify({ options: { query }, context: {} }))}&_=${Date.now()}`,
    `https://www.pinterest.com/search/autocomplete/?q=${encodeURIComponent(query)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.pinterest.com/",
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const data = await res.json();

      const items: unknown[] =
        data?.resource_response?.data ??
        data?.resource_response?.data?.items ??
        (Array.isArray(data) ? data : []) ??
        data?.items ?? [];

      const suggestions = (items as unknown[])
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          const o = item as Record<string, unknown>;
          return (o.display ?? o.query ?? o.term ?? o.name ?? "") as string;
        })
        .filter(Boolean)
        .map(normalizeKeyword)
        .filter((s) => s.length >= 3);

      if (suggestions.length > 0) {
        console.log(`[pinterest-enrich] autocomplete "${query}" → ${suggestions.length} suggestions`);
        return suggestions.slice(0, 12);
      }
    } catch { /* try next endpoint */ }
  }
  return [];
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

// Secondary interests to call Trends for when the primary interest matches.
// Each unique secondary adds 25 more trending keywords to the pool.
const SECONDARY_INTERESTS: Partial<Record<string, string[]>> = {
  home_decor:        ["diy_and_crafts", "art"],
  womens_fashion:    ["beauty"],
  beauty:            ["womens_fashion"],
  food_and_drinks:   ["parenting"],
  diy_and_crafts:    ["home_decor"],
  wedding:           ["beauty", "womens_fashion"],
  sport:             [],
  travel:            [],
  parenting:         [],
  animals:           [],
  electronics:       [],
  business_strategy: ["education"],
  education:         [],
  entertainment:     [],
};

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
      (k) => k.source === "PINTEREST_API" || k.source === "PINTEREST_SUGGESTED",
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
  autocompleteL1: string[],
  autocompleteL2: string[],
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

  // ── Autocomplete Level-1 (PINTEREST_SUGGESTED, highest priority) ──────────
  for (let i = 0; i < autocompleteL1.length; i++) {
    const kw = normalizeKeyword(autocompleteL1[i]);
    if (!kw || seen.has(kw) || POP_CULTURE_SIGNALS.has(kw)) continue;
    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_SUGGESTED",
      keywordType: "SUGGESTED",
      country,
      monthlySearches: null,
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, autocompleteL1.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── Autocomplete Level-2 (PINTEREST_SUGGESTED, second-level completions) ──
  for (let i = 0; i < autocompleteL2.length; i++) {
    const kw = normalizeKeyword(autocompleteL2[i]);
    if (!kw || seen.has(kw) || POP_CULTURE_SIGNALS.has(kw)) continue;
    seen.add(kw);
    results.push({
      seedKeyword: seed,
      keyword: kw,
      source: "PINTEREST_SUGGESTED",
      keywordType: "RELATED",
      country,
      monthlySearches: null,
      weeklyChange: null,
      monthlyChange: null,
      relevance: relevanceFromPosition(i, autocompleteL2.length),
      articleCount: articleCountBySeed.get(kw) ?? 0,
    });
  }

  // ── Trends (PINTEREST_API) ─────────────────────────────────────────────────
  for (let i = 0; i < trendItems.length; i++) {
    const item = trendItems[i];
    const kw = normalizeKeyword(item.keyword);
    if (!kw || seen.has(kw)) continue;
    if (POP_CULTURE_SIGNALS.has(kw)) continue;

    // For global trends (no interest match), require topical relevance to the seed
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
  const secondaryInterests = (interest ? SECONDARY_INTERESTS[interest] : undefined) ?? [];

  const accountsRaw = await pinterestGetRaw("/ad_accounts?page_size=5", accessToken);
  const adAccountsData = accountsRaw.data as Record<string, unknown> | null;
  const adAccounts = Array.isArray(adAccountsData?.items) ? adAccountsData!.items as Record<string, unknown>[] : [];
  const adAccountId = adAccounts[0]?.id as string ?? null;

  const globalTrends = await fetchTrendsByInterest(country, null, accessToken);
  const interestTrends = interest ? await fetchTrendsByInterest(country, interest, accessToken) : [];
  const autocompleteL1 = await fetchAutocomplete(seed);
  const autocompleteL2: string[] = [];
  for (const s of autocompleteL1.slice(0, 3)) {
    await sleep(150);
    const sub = await fetchAutocomplete(s);
    autocompleteL2.push(...sub);
  }

  const diag = {
    seed,
    country,
    detectedInterest: interest,
    secondaryInterests,
    adAccountId,
    globalTrendsCount: globalTrends.length,
    interestTrendsCount: interestTrends.length,
    autocompleteL1Count: autocompleteL1.length,
    autocompleteL1Sample: autocompleteL1.slice(0, 8),
    autocompleteL2Count: [...new Set(autocompleteL2)].length,
    autocompleteL2Sample: [...new Set(autocompleteL2)].slice(0, 8),
    note: "Keyword suggestion endpoints (/targeting/keywords/suggestions) return 404 for this API tier. Using autocomplete + interest-filtered Trends API.",
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

  // ── Determine all interests to fetch trends for ────────────────────────────
  const seedInterest = new Map<string, string | null>();
  const allInterestsToFetch = new Set<string>();

  for (const seed of seeds) {
    const primary = seedToInterest(seed);
    seedInterest.set(seed, primary);
    if (primary) {
      allInterestsToFetch.add(primary);
      // Add secondary interests for richer keyword pools
      const secondaries = SECONDARY_INTERESTS[primary] ?? [];
      for (const sec of secondaries) allInterestsToFetch.add(sec);
    }
  }

  // ── Fetch trends: global + all unique interests ────────────────────────────
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

  // Merge ALL interest trends into a single pool per primary interest
  // (so each seed gets keywords from primary + secondary interests combined)
  function getTrendsForSeed(seed: string): TrendItem[] {
    const primary = seedInterest.get(seed) ?? null;
    const seen = new Set<string>();
    const merged: TrendItem[] = [];

    const addItems = (items: TrendItem[]) => {
      for (const item of items) {
        const kw = normalizeKeyword(item.keyword);
        if (kw && !seen.has(kw)) { seen.add(kw); merged.push(item); }
      }
    };

    if (primary) {
      addItems(trendsByInterest.get(primary) ?? []);
      for (const sec of SECONDARY_INTERESTS[primary] ?? []) {
        addItems(trendsByInterest.get(sec) ?? []);
      }
    } else {
      addItems(trendsByInterest.get(null) ?? []);
    }

    return merged;
  }

  // ── Process seeds in batches — cache, autocomplete, trends ────────────────
  const allResults: SeedEnrichmentResult[] = [];
  const failedSeeds: string[] = [];
  const BATCH = 3; // smaller batch to avoid rate-limit on autocomplete

  let autocompleteWorked = false;

  for (let i = 0; i < seeds.length; i += BATCH) {
    const batch = seeds.slice(i, i + BATCH);

    // Process sequentially within each batch (autocomplete calls need gaps)
    for (const seed of batch) {
      const cached = await getCached(seed, country);
      if (cached) {
        allResults.push({ seed, keywords: cached.keywords, status: "cached" });
        continue;
      }

      try {
        // Autocomplete Level-1 for this seed
        const l1 = await fetchAutocomplete(seed);
        if (l1.length > 0) autocompleteWorked = true;

        // Autocomplete Level-2: expand top 5 L1 suggestions
        const l2Raw: string[] = [];
        for (const suggestion of l1.slice(0, 5)) {
          await sleep(150);
          const sub = await fetchAutocomplete(suggestion);
          l2Raw.push(...sub);
        }
        const l2 = [...new Set(l2Raw.map(normalizeKeyword))];

        if (l2.length > 0) autocompleteWorked = true;

        const trendItems = getTrendsForSeed(seed);
        const primary = seedInterest.get(seed) ?? null;
        const hasInterest = primary !== null && (trendsByInterest.get(primary)?.length ?? 0) > 0;

        const keywords = buildKeywordsForSeed(
          seed,
          country,
          l1,
          l2,
          trendItems,
          articleCountBySeed,
          hasInterest,
        );

        const hasRealData = keywords.some(
          (k) => k.source === "PINTEREST_API" || k.source === "PINTEREST_SUGGESTED",
        );
        if (hasRealData) {
          await setCached(seed, country, { keywords, cachedAt: Date.now() });
        }

        allResults.push({ seed, keywords, status: "ok" });
      } catch (e) {
        failedSeeds.push(seed);
        allResults.push({ seed, keywords: [], status: "error", error: String(e) });
      }

      // Small gap between seeds to be respectful to autocomplete endpoints
      if (batch.indexOf(seed) < batch.length - 1) await sleep(200);
    }
  }

  // ── Build response metrics ─────────────────────────────────────────────────
  const allPinterestKws = allResults.flatMap((r) => r.keywords).filter(
    (k) => k.source === "PINTEREST_API" || k.source === "PINTEREST_SUGGESTED",
  );
  const uniqueKwSet = new Set(allPinterestKws.map((k) => normalizeKeyword(k.keyword)));
  const suggestedCount = allPinterestKws.filter((k) => k.source === "PINTEREST_SUGGESTED").length;
  const trendingCount = allPinterestKws.filter((k) => k.source === "PINTEREST_API").length;
  const withMetrics = allPinterestKws.filter(
    (k) => k.weeklyChange !== null || k.monthlyChange !== null,
  );

  const response: PinterestEnrichResponse = {
    country,
    websiteKeywords: seeds.length,
    pinterestEnriched: allResults.filter((r) => r.status === "ok" || r.status === "cached").length,
    pinterestSuggestions: allPinterestKws.length,
    uniquePinterestKeywords: uniqueKwSet.size,
    metricsAvailable: withMetrics.length,
    suggestedTermsCount: suggestedCount,
    trendingTermsCount: trendingCount,
    totalUniqueKeywords: uniqueKwSet.size,
    results: allResults,
    failedSeeds,
    _debug: {
      adAccountId: null,
      trendsCount: globalTrends.length,
      interestsFetched: interestList,
      autocompleteWorking: autocompleteWorked,
    },
  };

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
}
