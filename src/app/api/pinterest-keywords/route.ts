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
  if (!res.ok) {
    const text = await res.text();
    console.error(`Pinterest API ${path} → ${res.status}:`, text);
    return null;
  }
  return res.json();
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

  // Get ad account id first
  const accountsData = await pinterestGet("/ad_accounts?page_size=10", accessToken);
  if (!accountsData?.items?.length) {
    return NextResponse.json({ error: "No ad accounts found" }, { status: 404 });
  }
  const adAccountId: string = accountsData.items[0].id;

  // Pinterest keyword suggestions endpoint
  const encoded = encodeURIComponent(query);
  const data = await pinterestGet(
    `/ad_accounts/${adAccountId}/targeting_options?targeting_type=KEYWORD&query=${encoded}`,
    accessToken
  );

  if (!data) {
    return NextResponse.json({ error: "Keyword API unavailable", adAccountId }, { status: 502 });
  }

  // Normalise the response — Pinterest returns items with keyword text + metrics
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data.items ?? data.value ?? []);

  const keywords = items.map((item) => {
    const kw = (item.keyword ?? item.term ?? item.name ?? "") as string;
    const monthlySearches = (item.monthly_searches ?? item.impressions_organic ?? item.search_volume ?? null) as number | null;
    const competition = (item.competition ?? null) as string | null;
    const bid = (item.bid ?? item.cpc ?? null) as number | null;

    return {
      keyword: kw,
      monthlySearches,
      competition: competition?.toLowerCase() ?? null,
      suggestedBid: bid ? bid / 1_000_000 : null, // micro-currency → dollars
    };
  }).filter(k => k.keyword);

  return NextResponse.json({ adAccountId, query, keywords });
}
