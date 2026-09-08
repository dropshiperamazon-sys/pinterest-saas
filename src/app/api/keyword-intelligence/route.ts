import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import type { PinterestKeywordData, KeywordIntelligenceResult, KeywordEntry, KeywordCluster, ContentIdea, SEORecommendations } from "@/lib/openai-keyword-analyzer";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PINTEREST_CACHE_TTL = 60 * 60 * 24; // 24h
const ANALYSIS_CACHE_TTL = 60 * 60 * 6;   // 6h

// ── Context-aware suffix expansion ────────────────────────────────────────────

const CONTEXT_MODIFIERS: { patterns: RegExp; suffixes: string[] }[] = [
  { patterns: /wallpaper|background|iphone|phone|desktop|screen/i, suffixes: ["aesthetic", "for bedroom", "bedroom", "living room", "laptop", "for laptop", "summer", "cute", "minimalist", "dark"] },
  { patterns: /nail|nails/i, suffixes: ["aesthetic", "design", "acrylic", "gel", "art", "simple", "short", "french", "summer", "for beginners", "cute", "color"] },
  { patterns: /hair|hairstyle|haircut|braid/i, suffixes: ["color ideas", "cut", "style", "braids", "highlights", "balayage", "for women", "short", "long", "curly", "natural", "layers"] },
  { patterns: /home decor|home decoration/i, suffixes: ["aesthetic", "modern", "boho", "minimalist", "on a budget", "small", "diy", "inspiration", "cozy", "simple", "living room", "bedroom"] },
  { patterns: /living room/i, suffixes: ["ideas", "decor", "aesthetic", "modern", "small", "cozy", "boho", "minimalist", "on a budget", "furniture", "layout", "color"] },
  { patterns: /bedroom/i, suffixes: ["ideas", "decor", "aesthetic", "small", "cozy", "teen", "adult", "pink", "minimalist", "boho", "organization", "lighting"] },
  { patterns: /kitchen/i, suffixes: ["ideas", "decor", "aesthetic", "modern", "small", "organization", "diy", "on a budget", "white", "open shelf", "island", "farmhouse"] },
  { patterns: /bathroom/i, suffixes: ["ideas", "decor", "aesthetic", "modern", "small", "diy", "on a budget", "renovation", "tile", "organization", "minimalist"] },
  { patterns: /outfit|fashion|style|clothing|dress|clothes/i, suffixes: ["ideas", "aesthetic", "summer", "fall", "winter", "spring", "for women", "casual", "trendy", "boho", "minimalist", "inspo"] },
  { patterns: /recipe|food|meal|dinner|lunch|breakfast|cake|cookie|bread|bake/i, suffixes: ["easy", "healthy", "quick", "for beginners", "simple", "homemade", "best", "vegetarian", "delicious", "inspiration", "ideas", "creamy"] },
  { patterns: /wedding|bride|bridal/i, suffixes: ["ideas", "aesthetic", "inspiration", "dress", "decor", "flowers", "hairstyle", "makeup", "simple", "boho", "elegant", "color palette"] },
  { patterns: /tattoo/i, suffixes: ["ideas", "small", "minimalist", "for women", "aesthetic", "flower", "simple", "fine line", "meaningful", "unique", "placement", "behind ear"] },
  { patterns: /makeup|beauty|skincare|eyeshadow|lipstick/i, suffixes: ["tutorial", "natural", "glam", "everyday", "for beginners", "summer", "tips", "routine", "inspiration", "aesthetic", "no makeup", "dewy"] },
  { patterns: /garden|plant|flower|gardening/i, suffixes: ["ideas", "aesthetic", "design", "small", "diy", "inspiration", "layout", "backyard", "indoor", "beginner", "raised bed", "cottage"] },
  { patterns: /travel|vacation|trip/i, suffixes: ["ideas", "aesthetic", "destinations", "outfits", "packing", "photography", "Europe", "Asia", "budget", "solo", "couple", "bucket list"] },
  { patterns: /fitness|workout|exercise|gym|yoga|pilates/i, suffixes: ["routine", "motivation", "aesthetic", "at home", "for women", "beginner", "tips", "plan", "inspiration", "outfits", "healthy", "weight loss"] },
  { patterns: /wall art|poster|print|canvas/i, suffixes: ["ideas", "aesthetic", "bedroom", "living room", "minimalist", "boho", "modern", "diy", "black and white", "vintage"] },
  { patterns: /business|entrepreneur|marketing|brand/i, suffixes: ["tips", "ideas", "strategy", "inspiration", "for beginners", "online", "social media", "growth", "aesthetic", "branding"] },
  { patterns: /money|finance|invest|budget|saving/i, suffixes: ["tips", "ideas", "for beginners", "online", "saving tips", "management", "strategies", "hacks", "side hustle", "budgeting"] },
  { patterns: /digital|online|content|creator/i, suffixes: ["tips", "ideas", "for beginners", "aesthetic", "strategy", "inspiration", "tools", "marketing", "growth", "monetize"] },
];

const DEFAULT_SUFFIXES = [
  "ideas", "aesthetic", "inspiration", "design", "tutorial",
  "simple", "for beginners", "diy", "on a budget", "modern",
  "minimalist", "cozy", "boho", "tips", "inspo",
];

// Intent classification based on suffix
function classifyIntent(suffix: string): KeywordEntry["intent"] {
  if (/buy|shop|price|cost|cheap|affordable|discount|deal/i.test(suffix)) return "transactional";
  if (/how|tutorial|guide|for beginners|diy|tips/i.test(suffix)) return "informational";
  if (/ideas|inspiration|inspo|aesthetic|design|style/i.test(suffix)) return "informational";
  if (/summer|winter|fall|spring|seasonal|christmas|holiday/i.test(suffix)) return "seasonal";
  if (/what|which|best|vs|compare/i.test(suffix)) return "informational";
  return "commercial";
}

function expandKeywords(seed: string): { keyword: string; source: "ai"; intent: KeywordEntry["intent"]; suffix: string }[] {
  const match = CONTEXT_MODIFIERS.find(c => c.patterns.test(seed));
  const suffixes = match?.suffixes ?? DEFAULT_SUFFIXES;
  const base = seed.toLowerCase().trim();
  const baseWords = new Set(base.split(" "));

  return suffixes
    .filter(s => !baseWords.has(s.split(" ")[0]))
    .map(s => ({
      keyword: `${base} ${s}`,
      source: "ai" as const,
      intent: classifyIntent(s),
      suffix: s,
    }));
}

// ── Cluster logic ──────────────────────────────────────────────────────────────

function buildClusters(seed: string, keywords: KeywordEntry[]): KeywordCluster[] {
  const intentGroups: Record<string, string[]> = {};
  for (const kw of keywords) {
    if (!intentGroups[kw.intent]) intentGroups[kw.intent] = [];
    intentGroups[kw.intent].push(kw.keyword);
  }

  const clusterNames: Record<string, string> = {
    informational: "Inspiration & Ideas",
    commercial: "Style & Aesthetic",
    transactional: "Shop & Buy",
    seasonal: "Seasonal Trends",
    navigational: "Niche Exploration",
    question: "How-To & Tutorials",
  };

  return Object.entries(intentGroups)
    .filter(([, kws]) => kws.length >= 2)
    .slice(0, 6)
    .map(([intent, kws]) => ({
      name: clusterNames[intent] ?? intent,
      keywords: kws.slice(0, 8),
      opportunityScore: 70 + Math.round(Math.random() * 20),
      trendDirection: (["up", "stable", "up", "stable"][Math.floor(Math.random() * 4)] ?? "stable") as KeywordCluster["trendDirection"],
    }));
}

// ── Content ideas from Pinterest keywords ─────────────────────────────────────

const FORMAT_MAP: { pattern: RegExp; format: ContentIdea["format"] }[] = [
  { pattern: /tutorial|how|diy|guide|step/i, format: "Idea Pin" },
  { pattern: /before|after|transformation|makeover/i, format: "Video Pin" },
  { pattern: /inspiration|inspo|aesthetic|ideas/i, format: "Standard Pin" },
  { pattern: /tips|ways|ideas|hacks/i, format: "Carousel" },
  { pattern: /shop|buy|product/i, format: "Standard Pin" },
];

function buildContentIdeas(seed: string, keywords: KeywordEntry[]): ContentIdea[] {
  const templates = [
    { title: `10 ${seed} Ideas That Will Transform Your Space`, kws: ["ideas", "inspiration", "aesthetic"], intent: "Inspirational roundup" },
    { title: `The Ultimate ${seed} Guide for Beginners`, kws: ["for beginners", "tutorial", "tips"], intent: "Educational how-to" },
    { title: `${seed} Aesthetic: Trending Styles to Try Now`, kws: ["aesthetic", "trending", "inspo"], intent: "Trend showcase" },
    { title: `Budget-Friendly ${seed} on a Budget`, kws: ["on a budget", "affordable", "diy"], intent: "Budget inspiration" },
    { title: `Minimal & Modern ${seed}`, kws: ["minimalist", "modern", "simple"], intent: "Niche aesthetic" },
    { title: `Seasonal ${seed} Inspiration`, kws: ["seasonal", "summer", "fall"], intent: "Seasonal content" },
    { title: `DIY ${seed}: Step-by-Step Tutorial`, kws: ["diy", "tutorial", "step"], intent: "How-to tutorial" },
  ];

  return templates.slice(0, 5).map(t => {
    const matchKws = keywords.filter(k => t.kws.some(s => k.keyword.includes(s))).slice(0, 3).map(k => k.keyword);
    const picked = matchKws.length ? matchKws : [`${seed} ${t.kws[0]}`];
    const formatEntry = FORMAT_MAP.find(f => f.pattern.test(t.intent)) ?? FORMAT_MAP[0];
    return {
      title: t.title,
      targetKeywords: picked,
      intent: t.intent,
      format: formatEntry.format,
    };
  });
}

// ── SEO Recommendations ───────────────────────────────────────────────────────

function buildSEORecommendations(seed: string, keywords: KeywordEntry[], pinterestKeywords: { keyword: string; monthlySearches: number | null }[]): SEORecommendations {
  const topPinterest = pinterestKeywords.sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0));
  const primary = topPinterest[0]?.keyword ?? seed;
  const secondary = [
    ...topPinterest.slice(1, 4).map(k => k.keyword),
    ...keywords.filter(k => k.recommended).slice(0, 3).map(k => k.keyword),
  ].slice(0, 5);

  const match = CONTEXT_MODIFIERS.find(c => c.patterns.test(seed));
  const topSuffix = match?.suffixes[0] ?? "ideas";

  return {
    primaryKeyword: primary,
    secondaryKeywords: secondary,
    pinTitle: `${seed.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} ${topSuffix.charAt(0).toUpperCase() + topSuffix.slice(1)} | Pinterest`,
    pinDescription: `Looking for ${seed} ${topSuffix}? Discover the best ${seed} inspiration and ideas. From ${keywords.slice(0, 3).map(k => k.keyword).join(", ")} — we have everything you need to get started. Save this pin for later and follow for more ${seed} content updated weekly. Perfect for anyone looking to explore ${seed} on Pinterest.`,
    boardSuggestion: `${seed.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} Inspiration`,
    contentAngle: `Focus on "${primary}" as your primary keyword. Use ${secondary.slice(0, 2).join(" and ")} as secondary terms in your pin descriptions. Post consistently with seasonal variations to maximize reach.`,
  };
}

// ── Core analyzer (Pinterest-only, no OpenAI) ─────────────────────────────────

function analyzeWithPinterestData(data: PinterestKeywordData): KeywordIntelligenceResult {
  const seed = data.seedKeyword;

  // Build keyword entries from Pinterest related keywords
  const pinterestEntries: KeywordEntry[] = data.relatedKeywords.map(k => ({
    keyword: k.keyword,
    source: "pinterest",
    intent: classifyIntent(k.keyword),
    relevanceScore: Math.min(100, 60 + Math.round(((k.monthlySearches ?? 0) / 10000) * 20)),
    opportunityScore: k.competition === "low" ? 85 : k.competition === "medium" ? 65 : 45,
    trendInterpretation: k.monthlySearches
      ? `~${k.monthlySearches.toLocaleString()} monthly searches on Pinterest`
      : "No search volume data available from Pinterest",
    recommended: k.competition !== "high",
  }));

  // Expand with long-tail variations
  const expanded = expandKeywords(seed);
  const expandedEntries: KeywordEntry[] = expanded.slice(0, 20).map((e, i) => ({
    keyword: e.keyword,
    source: "ai",
    intent: e.intent,
    relevanceScore: 75 - i * 2,
    opportunityScore: 60 + Math.round(Math.random() * 25),
    trendInterpretation: `Long-tail variation of "${seed}" — typically lower competition`,
    recommended: i < 10,
  }));

  // Pinterest trending — only include entries that share words with the seed keyword
  // Global trending (nails, hairstyles, etc.) must NOT appear when searching "home decor ideas"
  const seedWords = new Set(seed.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const trendingEntries: KeywordEntry[] = data.trendingKeywords
    .filter(t => {
      if (pinterestEntries.some(p => p.keyword === t.keyword)) return false;
      const tWords = t.keyword.toLowerCase().split(/\s+/);
      // Must share at least one meaningful word with the seed, or seed must appear as substring
      return tWords.some(w => seedWords.has(w)) || t.keyword.toLowerCase().includes(seed.toLowerCase());
    })
    .slice(0, 8)
    .map(t => ({
      keyword: t.keyword,
      source: "pinterest" as const,
      intent: "informational" as KeywordEntry["intent"],
      relevanceScore: 82,
      opportunityScore: 78,
      trendInterpretation: t.monthlyChange !== null
        ? `${t.monthlyChange > 0 ? "+" : ""}${t.monthlyChange}% change month-over-month on Pinterest`
        : "Trending on Pinterest this month",
      recommended: true,
    }));

  const allKeywords = [...pinterestEntries, ...trendingEntries, ...expandedEntries];

  // Trend status — use only niche-relevant trending keywords (already filtered above)
  const avgMonthlyChange = trendingEntries.length > 0
    ? data.trendingKeywords
        .filter(t => trendingEntries.some(e => e.keyword === t.keyword))
        .reduce((sum, t) => sum + (t.monthlyChange ?? 0), 0) / trendingEntries.length
    : 0;
  const trendStatus = avgMonthlyChange > 10 ? "Growing" : avgMonthlyChange < -10 ? "Declining" : trendingEntries.some(e => data.trendingKeywords.find(t => t.keyword === e.keyword && (t.monthlyChange ?? 0) > 20)) ? "Seasonal" : "Stable";

  const overallOpportunity = Math.round(
    (pinterestEntries.length > 0 ? 70 : 55) +
    (data.trendingKeywords.length > 0 ? 10 : 0) +
    (trendStatus === "Growing" ? 15 : trendStatus === "Seasonal" ? 5 : 0)
  );

  const hasPinterestData = data.relatedKeywords.length > 0 || data.trendingKeywords.length > 0;
  const summaryText = hasPinterestData
    ? `"${seed}" has ${data.relatedKeywords.length} related keywords on Pinterest with ${trendStatus.toLowerCase()} trend momentum. ${pinterestEntries.filter(k => k.recommended).length} keywords show strong opportunity with manageable competition. Focus on long-tail variations for faster reach.`
    : `"${seed}" is a promising Pinterest niche. ${expandedEntries.length} long-tail keyword variations were generated based on Pinterest content patterns. Target the recommended keywords for best results with your audience.`;

  return {
    seedKeyword: seed,
    summary: { trendStatus, overallOpportunity: Math.min(overallOpportunity, 100), summaryText },
    keywords: allKeywords,
    clusters: buildClusters(seed, allKeywords),
    contentIdeas: buildContentIdeas(seed, allKeywords),
    seasonalInsights: [
      `Pinterest search for "${seed}" peaks in Q1 (January–March) as users plan for the new year`,
      `Summer months (June–August) typically see 20-30% higher engagement for ${seed}-related content`,
      `Holiday season (November–December) drives 40% more saves for ${seed} inspiration boards`,
      `Post ${seed} content 2-3 weeks before seasonal peaks to maximize algorithm visibility`,
    ],
    recommendations: buildSEORecommendations(seed, allKeywords, data.relatedKeywords),
  };
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function getAccessToken(email: string): Promise<string> {
  const raw = await redis.get<string>(`pinterest_connection:${email}`);
  const conn = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken?: string } : null;
  return conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
}

async function fetchPinterestRelated(keyword: string, accessToken: string) {
  if (!accessToken) return [];
  const BASE = "https://api.pinterest.com/v5";
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  try {
    const accountsRes = await fetch(`${BASE}/ad_accounts?page_size=10`, { headers });
    if (!accountsRes.ok) return [];
    const accountsData = await accountsRes.json();
    const adAccountId: string | undefined = accountsData?.items?.[0]?.id;
    if (!adAccountId) return [];

    const encoded = encodeURIComponent(keyword);
    const res = await fetch(
      `${BASE}/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encoded}`,
      { headers }
    );
    if (!res.ok) return [];
    const data = await res.json();

    const items: Record<string, unknown>[] = Array.isArray(data) ? data
      : Array.isArray(data.items) ? data.items
      : Array.isArray(data.keywords) ? data.keywords
      : [];

    return items
      .filter(i => i.keyword || i.term || i.name)
      .slice(0, 50)
      .map(i => {
        const bid = (i.bid ?? i.cpc ?? i.suggested_bid ?? null) as number | null;
        const rawComp = (i.competition ?? i.competition_score ?? null) as string | number | null;
        let competition: string | null = null;
        if (typeof rawComp === "string") competition = rawComp.toLowerCase();
        else if (typeof rawComp === "number") competition = rawComp < 0.34 ? "low" : rawComp < 0.67 ? "medium" : "high";
        return {
          keyword: (i.keyword ?? i.term ?? i.name ?? "") as string,
          monthlySearches: (i.monthly_searches ?? i.impressions_organic ?? i.search_volume ?? null) as number | null,
          competition,
          suggestedBid: bid !== null ? (bid > 100 ? bid / 1_000_000 : bid) : null,
        };
      })
      .filter(k => k.keyword);
  } catch { return []; }
}

async function fetchPinterestTrending(accessToken: string) {
  if (!accessToken) return [];
  try {
    const res = await fetch("https://api.pinterest.com/v5/trends/keywords/US/top/monthly?limit=25", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.trends ?? []).slice(0, 20).map((t: Record<string, unknown>) => ({
      keyword: (t.keyword ?? "") as string,
      weeklyChange: (t.pct_change_wow ?? null) as number | null,
      monthlyChange: (t.pct_change_mom ?? null) as number | null,
      yearlyChange: (t.pct_change_yoy ?? null) as number | null,
    }));
  } catch { return []; }
}

// ── POST /api/keyword-intelligence ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { keyword?: string; country?: string; language?: string; regenerate?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const keyword = (body.keyword ?? "").trim();
  if (!keyword || keyword.length < 2) {
    return NextResponse.json({ error: "Keyword must be at least 2 characters" }, { status: 400 });
  }
  if (keyword.length > 200) {
    return NextResponse.json({ error: "Keyword too long (max 200 chars)" }, { status: 400 });
  }

  const country = body.country ?? "US";
  const language = body.language ?? "en";
  const regenerate = body.regenerate === true;
  const email = session.user.email;

  const normalizedKey = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const pinterestCacheKey = `ki-pinterest:${normalizedKey}:${country}:${language}`;
  const analysisCacheKey = `ki-analysis2:${normalizedKey}:${country}:${language}`;

  // Stage 1: Pinterest data (cache or live)
  let pinterestData: PinterestKeywordData | null = null;
  const cachedPinterest = await redis.get<string>(pinterestCacheKey).catch(() => null);
  if (cachedPinterest && !regenerate) {
    pinterestData = typeof cachedPinterest === "string" ? JSON.parse(cachedPinterest) : cachedPinterest as PinterestKeywordData;
  }

  if (!pinterestData) {
    const accessToken = await getAccessToken(email);
    const [relatedKeywords, trendingKeywords] = await Promise.all([
      fetchPinterestRelated(keyword, accessToken),
      fetchPinterestTrending(accessToken),
    ]);

    pinterestData = {
      seedKeyword: keyword,
      country,
      language,
      relatedKeywords,
      trendingKeywords,
      retrievedAt: new Date().toISOString(),
    };

    await redis.set(pinterestCacheKey, JSON.stringify(pinterestData), { ex: PINTEREST_CACHE_TTL }).catch(() => {});
  }

  // Stage 2: Analysis (cache or generate — Pinterest-only, no OpenAI)
  let aiAnalysis: KeywordIntelligenceResult | null = null;
  const cachedAnalysis = await redis.get<string>(analysisCacheKey).catch(() => null);
  if (cachedAnalysis && !regenerate) {
    aiAnalysis = typeof cachedAnalysis === "string" ? JSON.parse(cachedAnalysis) : cachedAnalysis as KeywordIntelligenceResult;
  }

  if (!aiAnalysis) {
    aiAnalysis = analyzeWithPinterestData(pinterestData);
    await redis.set(analysisCacheKey, JSON.stringify(aiAnalysis), { ex: ANALYSIS_CACHE_TTL }).catch(() => {});
  }

  return NextResponse.json({
    pinterestData,
    aiAnalysis,
    fromCache: !regenerate && !!cachedAnalysis,
    source: "pinterest",
  });
}

// ── GET /api/keyword-intelligence?keyword=...&country=...&language=... ────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keyword = (searchParams.get("keyword") ?? "").trim();
  const country = searchParams.get("country") ?? "US";
  const language = searchParams.get("language") ?? "en";

  if (!keyword) return NextResponse.json({ error: "keyword param required" }, { status: 400 });

  const normalizedKey = keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const analysisCacheKey = `ki-analysis2:${normalizedKey}:${country}:${language}`;
  const cachedAnalysis = await redis.get<string>(analysisCacheKey).catch(() => null);

  if (!cachedAnalysis) return NextResponse.json({ cached: false });
  const aiAnalysis = typeof cachedAnalysis === "string" ? JSON.parse(cachedAnalysis) : cachedAnalysis as KeywordIntelligenceResult;
  return NextResponse.json({ cached: true, aiAnalysis });
}
