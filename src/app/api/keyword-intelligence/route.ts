import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import { analyzeKeywords, type PinterestKeywordData, type KeywordIntelligenceResult } from "@/lib/openai-keyword-analyzer";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PINTEREST_CACHE_TTL = 60 * 60 * 24; // 24h
const AI_CACHE_TTL = parseInt(process.env.OPENAI_CACHE_TTL ?? "86400"); // 24h

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
    // Get ad account id
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
  const aiCacheKey = `ki-ai:${normalizedKey}:${country}:${language}`;

  // ── Stage 1: Pinterest data (cache or live) ───────────────────────────────
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

  // ── Stage 2: AI analysis (cache or generate) ──────────────────────────────
  let aiAnalysis: KeywordIntelligenceResult | null = null;
  const cachedAI = await redis.get<string>(aiCacheKey).catch(() => null);
  if (cachedAI && !regenerate) {
    aiAnalysis = typeof cachedAI === "string" ? JSON.parse(cachedAI) : cachedAI as KeywordIntelligenceResult;
  }

  if (!aiAnalysis) {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI analysis not configured — OPENAI_API_KEY is missing", pinterestData },
        { status: 503 }
      );
    }
    try {
      aiAnalysis = await analyzeKeywords(pinterestData);
      await redis.set(aiCacheKey, JSON.stringify(aiAnalysis), { ex: AI_CACHE_TTL }).catch(() => {});
    } catch (err) {
      console.error("OpenAI keyword analysis failed:", err);
      return NextResponse.json(
        { error: "AI analysis temporarily unavailable. Pinterest data is still available.", pinterestData },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    pinterestData,
    aiAnalysis,
    fromCache: !regenerate && !!cachedAI,
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
  const aiCacheKey = `ki-ai:${normalizedKey}:${country}:${language}`;
  const cachedAI = await redis.get<string>(aiCacheKey).catch(() => null);

  if (!cachedAI) return NextResponse.json({ cached: false });
  const aiAnalysis = typeof cachedAI === "string" ? JSON.parse(cachedAI) : cachedAI as KeywordIntelligenceResult;
  return NextResponse.json({ cached: true, aiAnalysis });
}
