import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = typeof raw === "string" ? JSON.parse(raw) : raw as { accessToken: string };

  const { searchParams } = req.nextUrl;
  const endDate = searchParams.get("end") || dateStr(1);
  const startDate = searchParams.get("start") || dateStr(30);

  const span = daysBetween(startDate, endDate);
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - span);
  const prevStartStr = prevStart.toISOString().slice(0, 10);

  async function fetchMetrics(start: string, end: string) {
    const params = new URLSearchParams({
      start_date: start,
      end_date: end,
      metric_types: "IMPRESSION,PIN_CLICK,SAVE",
    });
    const res = await fetch(`https://api.pinterest.com/v5/user_account/analytics?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error(`Pinterest analytics error ${res.status}:`, await res.text());
      return null;
    }
    return res.json();
  }

  const [current, previous] = await Promise.all([
    fetchMetrics(startDate, endDate),
    fetchMetrics(prevStartStr, prevEndStr),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extract(data: any, metric: string): number {
    if (!data) return 0;
    if (data?.all?.summary_metrics?.[metric] !== undefined)
      return Number(data.all.summary_metrics[metric]) || 0;
    const daily = data?.all?.daily_metrics;
    if (Array.isArray(daily)) {
      return daily.reduce((sum: number, day: { metrics?: Record<string, number> }) => {
        return sum + (Number(day.metrics?.[metric]) || 0);
      }, 0);
    }
    return 0;
  }

  function rate(num: number, denom: number): number {
    if (!denom) return 0;
    return Math.round((num / denom) * 10000) / 100; // percentage, 2dp
  }

  function pct(curr: number, prev: number): number | null {
    if (!prev) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  // Build daily data for charts
  const daily: { date: string; impressions: number; clicks: number; saves: number; ctr: number; saveRate: number }[] = [];
  const dailyMetrics = current?.all?.daily_metrics;
  if (Array.isArray(dailyMetrics)) {
    for (const day of dailyMetrics) {
      if (day.data_status === "PROCESSING") continue;
      const imp = Number(day.metrics?.IMPRESSION || 0);
      const clk = Number(day.metrics?.PIN_CLICK || 0);
      const sav = Number(day.metrics?.SAVE || 0);
      daily.push({
        date: day.date,
        impressions: imp,
        clicks: clk,
        saves: sav,
        ctr: rate(clk, imp),
        saveRate: rate(sav, imp),
      });
    }
    daily.sort((a, b) => a.date.localeCompare(b.date));
  }

  const impressions = extract(current, "IMPRESSION");
  const pinClicks = extract(current, "PIN_CLICK");
  const saves = extract(current, "SAVE");
  const prevImpressions = extract(previous, "IMPRESSION");
  const prevPinClicks = extract(previous, "PIN_CLICK");
  const prevSaves = extract(previous, "SAVE");

  // Computed metrics from the data we have
  const ctr = rate(pinClicks, impressions);
  const saveRate = rate(saves, impressions);
  const engagementRate = rate(pinClicks + saves, impressions);

  const prevCtr = rate(prevPinClicks, prevImpressions);
  const prevSaveRate = rate(prevSaves, prevImpressions);
  const prevEngagementRate = rate(prevPinClicks + prevSaves, prevImpressions);

  return NextResponse.json({
    impressions,
    pinClicks,
    saves,
    ctr,
    saveRate,
    engagementRate,
    impressionsChange: pct(impressions, prevImpressions),
    pinClicksChange: pct(pinClicks, prevPinClicks),
    savesChange: pct(saves, prevSaves),
    ctrChange: pct(ctr, prevCtr),
    saveRateChange: pct(saveRate, prevSaveRate),
    engagementRateChange: pct(engagementRate, prevEngagementRate),
    daily,
    period: { startDate, endDate },
  });
}
