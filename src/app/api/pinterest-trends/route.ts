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

// Compute % change between two values safely
function pct(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Derive weekly / monthly / yearly % changes from timeseries
function deriveChanges(timeseries: { date: string; value: number }[], yearlyFallback: number | null) {
  if (!timeseries || timeseries.length < 2) {
    return { weeklyChange: null, monthlyChange: null, yearlyChange: yearlyFallback };
  }

  // Sort ascending by date
  const sorted = [...timeseries].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];

  // Weekly: compare last point vs point ~1 week (7 data points) back
  const weeklyIdx = Math.max(0, sorted.length - 8);
  const weeklyBase = sorted[weeklyIdx];

  // Monthly: compare last point vs point ~4 weeks (4 data points) back
  const monthlyIdx = Math.max(0, sorted.length - 5);
  const monthlyBase = sorted[monthlyIdx];

  // Yearly: compare last point vs first point (or use API-provided value)
  const yearlyBase = sorted[0];

  return {
    weeklyChange:  pct(last.value, weeklyBase.value),
    monthlyChange: pct(last.value, monthlyBase.value),
    yearlyChange:  yearlyFallback ?? pct(last.value, yearlyBase.value),
  };
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

  // Request timeseries data alongside keyword trends
  let path = `/trends/keywords/${region}/top/${trendType}?limit=25&include_timeseries=true`;
  if (interest) path += `&interests=${encodeURIComponent(interest)}`;

  const data = await pinterestGet(path, accessToken);

  if (!data) {
    return NextResponse.json({ error: "Trends API unavailable", trends: [] }, { status: 200 });
  }

  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : (data.trends ?? data.keywords ?? data.items ?? []);

  const trends = items.map((item) => {
    const timeseries = (item.timeseries ?? []) as { date: string; value: number }[];
    const yearlyFallback = (item.pct_change_from_last_year ?? item.trend ?? item.change ?? null) as number | null;
    const { weeklyChange, monthlyChange, yearlyChange } = deriveChanges(timeseries, yearlyFallback);

    return {
      keyword: (item.keyword ?? item.term ?? item.name ?? "") as string,
      weeklyChange,
      monthlyChange,
      yearlyChange,
      pctChangeFromLastYear: yearlyChange,
      trendType: (item.trend_type ?? trendType) as string,
      timeseries,
    };
  }).filter(t => t.keyword);

  return NextResponse.json({ region, trendType, trends, live: true });
}
