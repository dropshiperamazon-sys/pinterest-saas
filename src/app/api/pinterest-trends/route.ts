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

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region") ?? "US";
  const trendType = searchParams.get("type") ?? "growing"; // growing | monthly | yearly | seasonal
  const interest = searchParams.get("interest") ?? "";

  let path = `/trends/keywords/${region}/top/${trendType}?limit=50`;
  if (interest) path += `&interests=${encodeURIComponent(interest)}`;

  const data = await pinterestGet(path, accessToken);

  if (!data) {
    return NextResponse.json({ error: "Trends API unavailable", trends: [] }, { status: 200 });
  }

  // Normalise response
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : (data.trends ?? data.keywords ?? data.items ?? []);

  const trends = items.map((item) => ({
    keyword: (item.keyword ?? item.term ?? item.name ?? "") as string,
    pctChangeFromLastYear: (item.pct_change_from_last_year ?? item.trend ?? item.change ?? null) as number | null,
    trendType: (item.trend_type ?? trendType) as string,
    timeseries: (item.timeseries ?? []) as { date: string; value: number }[],
  })).filter(t => t.keyword);

  return NextResponse.json({ region, trendType, trends, live: true });
}
