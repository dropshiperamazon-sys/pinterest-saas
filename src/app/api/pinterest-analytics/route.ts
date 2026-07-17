import { NextResponse } from "next/server";
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

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = typeof raw === "string" ? JSON.parse(raw) : raw as { accessToken: string };

  const endDate = dateStr(1);
  const startDate = dateStr(30);
  const prevStart = dateStr(60);
  const prevEnd = dateStr(31);

  async function fetchAnalytics(start: string, end: string) {
    const params = new URLSearchParams({
      start_date: start,
      end_date: end,
      metric_types: "IMPRESSION,PIN_CLICK,SAVE",
    });
    const res = await fetch(`https://api.pinterest.com/v5/user_account/analytics?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("Pinterest analytics error:", res.status, await res.text());
      return null;
    }
    return res.json();
  }

  const [current, previous] = await Promise.all([
    fetchAnalytics(startDate, endDate),
    fetchAnalytics(prevStart, prevEnd),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractMetric(data: any, metric: string): number {
    if (!data) return 0;
    if (data?.all?.summary_metrics?.[metric] !== undefined) {
      return Number(data.all.summary_metrics[metric]) || 0;
    }
    const daily = data?.all?.daily_metrics;
    if (Array.isArray(daily)) {
      return daily.reduce((sum: number, day: { metrics?: Record<string, number>; metric_type?: string; value?: number }) => {
        if (day.metrics?.[metric] !== undefined) return sum + (Number(day.metrics[metric]) || 0);
        if (day.metric_type === metric) return sum + (Number(day.value) || 0);
        return sum;
      }, 0);
    }
    return 0;
  }

  // Build daily chart data from current period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const daily: { date: string; impressions: number; clicks: number; saves: number }[] = [];
  const dailyMetrics = current?.all?.daily_metrics;
  if (Array.isArray(dailyMetrics)) {
    for (const day of dailyMetrics) {
      if (day.data_status === "PROCESSING") continue;
      daily.push({
        date: day.date,
        impressions: Number(day.metrics?.IMPRESSION || 0),
        clicks: Number(day.metrics?.PIN_CLICK || 0),
        saves: Number(day.metrics?.SAVE || 0),
      });
    }
  }

  const impressions = extractMetric(current, "IMPRESSION");
  const pinClicks = extractMetric(current, "PIN_CLICK");
  const saves = extractMetric(current, "SAVE");
  const prevImpressions = extractMetric(previous, "IMPRESSION");
  const prevPinClicks = extractMetric(previous, "PIN_CLICK");
  const prevSaves = extractMetric(previous, "SAVE");

  function pctChange(curr: number, prev: number) {
    if (!prev) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  return NextResponse.json({
    impressions,
    pinClicks,
    saves,
    impressionsChange: pctChange(impressions, prevImpressions),
    pinClicksChange: pctChange(pinClicks, prevPinClicks),
    savesChange: pctChange(saves, prevSaves),
    daily,
    period: { startDate, endDate },
  });
}
