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
    console.error(`Pinterest Trends ${path} → ${res.status}:`, text);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

// time_series comes as { "2026-08-23": 100, ... } — convert to sorted array
function parseTimeSeries(ts: Record<string, number> | null): { date: string; value: number }[] {
  if (!ts || typeof ts !== "object") return [];
  return Object.entries(ts)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const region    = searchParams.get("region")   ?? "US";
  const trendType = searchParams.get("type")     ?? "growing";
  const interest  = searchParams.get("interest") ?? "";

  // Pinterest API only accepts "growing" and "seasonal" as valid trend types.
  // "monthly" and "yearly" are UI labels — map them to the closest valid API value.
  const apiTrendType = trendType === "seasonal" ? "seasonal" : "growing";
  let path = `/trends/keywords/${region}/top/${apiTrendType}?limit=25`;
  if (interest) path += `&interests=${encodeURIComponent(interest)}`;

  const data = await pinterestGet(path, accessToken);

  console.log(`[Trends] path=${path} data keys=${data ? Object.keys(data).join(",") : "null"} raw=${JSON.stringify(data)?.slice(0, 400)}`);

  if (!data) {
    return NextResponse.json({ error: "Trends API unavailable", trends: [] }, { status: 200 });
  }

  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : (data.trends ?? data.keywords ?? data.items ?? []) as Record<string, unknown>[];

  console.log(`[Trends] items count=${items.length} first=${JSON.stringify(items[0])?.slice(0, 200)}`);

  const trends = items.map((item) => {
    // Pinterest API returns pct_growth_wow / pct_growth_mom / pct_growth_yoy
    const weekly  = (item.pct_growth_wow ?? null) as number | null;
    const monthly = (item.pct_growth_mom ?? null) as number | null;
    const yearly  = (item.pct_growth_yoy ?? item.pct_change_from_last_year ?? null) as number | null;

    const timeseries = parseTimeSeries(item.time_series as Record<string, number> | null);

    return {
      keyword: (item.keyword ?? item.term ?? item.name ?? "") as string,
      weeklyChange:  weekly,
      monthlyChange: monthly,
      yearlyChange:  yearly,
      pctChangeFromLastYear: yearly,
      trendType: (item.trend_type ?? trendType) as string,
      timeseries,
    };
  }).filter(t => t.keyword);

  return NextResponse.json({ region, trendType, trends, live: true });
}
