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
      const err = await res.text();
      console.error("Pinterest analytics error:", res.status, err);
      return null;
    }
    return res.json();
  }

  const [current, previous] = await Promise.all([
    fetchAnalytics(startDate, endDate),
    fetchAnalytics(prevStart, prevEnd),
  ]);

  // Pinterest v5 analytics response shape:
  // { all: { daily_metrics: [{ date, data_status, metrics: { IMPRESSION: n, PIN_CLICK: n } }], summary_metrics: { IMPRESSION: n, PIN_CLICK: n } } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractMetric(data: any, metric: string): number {
    if (!data) return 0;
    // Try summary_metrics first (most reliable)
    if (data?.all?.summary_metrics?.[metric] !== undefined) {
      return Number(data.all.summary_metrics[metric]) || 0;
    }
    // Fall back to summing daily_metrics
    const daily = data?.all?.daily_metrics;
    if (Array.isArray(daily)) {
      return daily.reduce((sum: number, day: { metrics?: Record<string, number>; metric_type?: string; value?: number }) => {
        // shape A: { metrics: { IMPRESSION: n } }
        if (day.metrics?.[metric] !== undefined) return sum + (Number(day.metrics[metric]) || 0);
        // shape B: { metric_type: "IMPRESSION", value: n }
        if (day.metric_type === metric) return sum + (Number(day.value) || 0);
        return sum;
      }, 0);
    }
    return 0;
  }

  const impressions = extractMetric(current, "IMPRESSION");
  const pinClicks = extractMetric(current, "PIN_CLICK");
  const saves = extractMetric(current, "SAVE");
  const prevImpressions = extractMetric(previous, "IMPRESSION");
  const prevPinClicks = extractMetric(previous, "PIN_CLICK");

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
    period: { startDate, endDate },
    // Include raw for debugging (remove later)
    _raw: current,
  });
}
