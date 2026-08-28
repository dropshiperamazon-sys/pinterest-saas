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

function pct(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function deriveFromTimeseries(ts: { date: string; value: number }[]) {
  if (!ts || ts.length < 2) return { weekly: null, monthly: null };
  const sorted = [...ts].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1].value;
  // weekly: compare to ~1 week back (index -2 in weekly data, or -7 in daily)
  const weekBase = sorted[Math.max(0, sorted.length - 2)].value;
  // monthly: compare to ~4 weeks back
  const monthBase = sorted[Math.max(0, sorted.length - 5)].value;
  return { weekly: pct(last, weekBase), monthly: pct(last, monthBase) };
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

  // Try with timeseries first, then without (some API versions don't support the param)
  let data: Record<string, unknown> | null = null;
  for (const tsParam of ["&include_timeseries=true", ""]) {
    let path = `/trends/keywords/${region}/top/${trendType}?limit=25${tsParam}`;
    if (interest) path += `&interests=${encodeURIComponent(interest)}`;
    data = await pinterestGet(path, accessToken);
    if (data) break;
  }

  if (!data) {
    return NextResponse.json({ error: "Trends API unavailable", trends: [] }, { status: 200 });
  }

  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : (data.trends ?? data.keywords ?? data.items ?? []) as Record<string, unknown>[];

  // Log the first item so we can see ALL fields Pinterest returns
  if (items.length > 0) {
    console.log("Pinterest trends first item fields:", JSON.stringify(items[0], null, 2));
  }

  const trends = items.map((item) => {
    const ts = (item.timeseries ?? item.trend_data ?? []) as { date: string; value: number }[];
    const derived = deriveFromTimeseries(ts);

    // Try every field name variant Pinterest might use for each metric
    const weekly = (
      item.weekly_change ??
      item.week_over_week ??
      item.wow_change ??
      item.weekly_trend ??
      (item.trend_data as Record<string,unknown>)?.weekly_change ??
      derived.weekly ??
      null
    ) as number | null;

    const monthly = (
      item.monthly_change ??
      item.mom_change ??
      item.month_over_month ??
      item.monthly_trend ??
      (item.trend_data as Record<string,unknown>)?.monthly_change ??
      derived.monthly ??
      null
    ) as number | null;

    const yearly = (
      item.pct_change_from_last_year ??
      item.yearly_change ??
      item.yoy_change ??
      item.year_over_year ??
      item.trend ??
      item.change ??
      null
    ) as number | null;

    return {
      keyword: (item.keyword ?? item.term ?? item.name ?? "") as string,
      weeklyChange:  weekly,
      monthlyChange: monthly,
      yearlyChange:  yearly,
      pctChangeFromLastYear: yearly,
      trendType: (item.trend_type ?? trendType) as string,
      timeseries: ts,
    };
  }).filter(t => t.keyword);

  return NextResponse.json({ region, trendType, trends, live: true });
}
