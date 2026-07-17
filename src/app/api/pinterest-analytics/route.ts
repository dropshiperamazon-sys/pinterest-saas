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

  const endDate = dateStr(1);       // yesterday (Pinterest requires completed days)
  const startDate = dateStr(30);    // last 30 days
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
    if (!res.ok) return null;
    return res.json();
  }

  const [current, previous] = await Promise.all([
    fetchAnalytics(startDate, endDate),
    fetchAnalytics(prevStart, prevEnd),
  ]);

  function sumMetric(data: Record<string, { daily_metrics: { metric_type: string; value: number }[] }> | null, metric: string) {
    if (!data?.all?.daily_metrics) return 0;
    return data.all.daily_metrics
      .filter((m: { metric_type: string; value: number }) => m.metric_type === metric)
      .reduce((sum: number, m: { metric_type: string; value: number }) => sum + (m.value || 0), 0);
  }

  const impressions = sumMetric(current, "IMPRESSION");
  const pinClicks = sumMetric(current, "PIN_CLICK");
  const prevImpressions = sumMetric(previous, "IMPRESSION");
  const prevPinClicks = sumMetric(previous, "PIN_CLICK");

  function pctChange(curr: number, prev: number) {
    if (!prev) return 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  return NextResponse.json({
    impressions,
    pinClicks,
    impressionsChange: pctChange(impressions, prevImpressions),
    pinClicksChange: pctChange(pinClicks, prevPinClicks),
    period: { startDate, endDate },
  });
}
