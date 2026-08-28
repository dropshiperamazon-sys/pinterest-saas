import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

async function pinterestGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Pinterest API ${path} → ${res.status}:`, text);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

async function pinterestPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Pinterest API POST ${path} → ${res.status}:`, text);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ error: "Missing q param" }, { status: 400 });

  // Get ad account id
  const accountsData = await pinterestGet("/ad_accounts?page_size=10", accessToken);
  if (!accountsData?.items?.length) {
    return NextResponse.json({ error: "No ad accounts found" }, { status: 404 });
  }
  const adAccountId: string = accountsData.items[0].id;

  const encoded = encodeURIComponent(query);

  // Try 1: keyword targeting suggestions (used during ad creation)
  let data = await pinterestGet(
    `/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encoded}`,
    accessToken
  );

  // Try 2: general keyword search endpoint
  if (!data || (Array.isArray(data) && data.length === 0) || (data.items?.length === 0)) {
    data = await pinterestGet(
      `/ad_accounts/${adAccountId}/keywords?page_size=100&query=${encoded}`,
      accessToken
    );
  }

  // Try 3: POST keyword suggestions
  if (!data || (Array.isArray(data) && data.length === 0)) {
    data = await pinterestPost(
      `/ad_accounts/${adAccountId}/keywords/suggestions`,
      accessToken,
      { keyword: query, country_code: "US" }
    );
  }

  console.log("Pinterest keyword API raw response:", JSON.stringify(data)?.slice(0, 500));

  if (!data) {
    return NextResponse.json({ error: "Keyword API unavailable", adAccountId, keywords: [] }, { status: 200 });
  }

  // Normalise — handle multiple response shapes
  let items: Record<string, unknown>[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (Array.isArray(data.items)) {
    items = data.items;
  } else if (Array.isArray(data.keywords)) {
    items = data.keywords;
  } else if (Array.isArray(data.value)) {
    items = data.value;
  }

  const keywords = items
    .filter(item => item.keyword || item.term || item.name)
    .map((item) => {
      const kw = (item.keyword ?? item.term ?? item.name ?? "") as string;
      const monthlySearches = (item.monthly_searches ?? item.impressions_organic ?? item.search_volume ?? item.volume ?? null) as number | null;
      const rawComp = (item.competition ?? item.competition_score ?? null) as string | number | null;
      let competition: string | null = null;
      if (typeof rawComp === "string") competition = rawComp.toLowerCase();
      else if (typeof rawComp === "number") {
        competition = rawComp < 0.34 ? "low" : rawComp < 0.67 ? "medium" : "high";
      }
      const bid = (item.bid ?? item.cpc ?? item.suggested_bid ?? null) as number | null;
      const isInMicro = bid !== null && bid > 100; // micro-currency if > $100 means it's in micros

      return {
        keyword: kw,
        monthlySearches,
        competition,
        suggestedBid: bid !== null ? (isInMicro ? bid / 1_000_000 : bid) : null,
      };
    });

  return NextResponse.json({ adAccountId, query, keywords });
}
