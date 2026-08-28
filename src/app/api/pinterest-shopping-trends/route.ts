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
    console.error(`Pinterest Shopping Trends ${path} → ${res.status}:`, text);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

// Map UI ranked-by label → Pinterest trend_type or metric
const METRIC_TO_TREND_TYPE: Record<string, string> = {
  "Outbound clicks": "monthly",
  "Pin saves":       "growing",
  "Impressions":     "yearly",
  "Engagement":      "seasonal",
};

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const region    = searchParams.get("region")    ?? "US";
  const rankedBy  = searchParams.get("rankedBy")  ?? "Outbound clicks";
  const vertical  = searchParams.get("vertical")  ?? "";
  const age       = searchParams.get("age")        ?? "";
  const gender    = searchParams.get("gender")    ?? "";

  const trendType = METRIC_TO_TREND_TYPE[rankedBy] ?? "monthly";

  // Try 1: dedicated shopping trends endpoint (v5 beta)
  let data = await pinterestGet(
    `/trends/keywords/${region}/top/${trendType}?limit=25&interests=shopping`,
    accessToken
  );

  // Try 2: broader product interest trends
  if (!data || !(data.trends ?? data.items ?? data.keywords)?.length) {
    data = await pinterestGet(
      `/trends/keywords/${region}/top/${trendType}?limit=25`,
      accessToken
    );
  }

  console.log("Pinterest shopping trends raw:", JSON.stringify(data)?.slice(0, 400));

  if (!data) {
    return NextResponse.json({ live: false, items: [] });
  }

  const raw2: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : (data.trends ?? data.keywords ?? data.items ?? []);

  const items = raw2.map((item, i) => {
    const pct = (item.pct_change_from_last_year ?? item.trend ?? item.change ?? null) as number | null;
    return {
      rank: i + 1,
      category: (item.keyword ?? item.term ?? item.name ?? "") as string,
      growth: pct !== null ? `↑${Math.abs(pct)}% MoM` : "—",
      trend: pct !== null ? (pct >= 5 ? "up" : pct <= -5 ? "down" : "flat") : "flat",
      volume: Math.max(5, 95 - i * 7),
    };
  }).filter(i => i.category);

  return NextResponse.json({ live: items.length > 0, region, rankedBy, items });
}
