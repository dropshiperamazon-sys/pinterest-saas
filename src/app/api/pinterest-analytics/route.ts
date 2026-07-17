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

  // Support custom date range via query params
  const { searchParams } = req.nextUrl;
  const endDate = searchParams.get("end") || dateStr(1);
  const startDate = searchParams.get("start") || dateStr(30);

  // Previous period of same length for % change
  const span = daysBetween(startDate, endDate);
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);
  const prevStartDate = new Date(prevEnd);
  prevStartDate.setDate(prevStartDate.getDate() - span);
  const prevStartStr = prevStartDate.toISOString().slice(0, 10);

  const METRICS = "IMPRESSION,ENGAGEMENT,OUTBOUND_CLICK,SAVE,TOTAL_AUDIENCE,ENGAGED_AUDIENCE";

  async function fetchAnalytics(start: string, end: string) {
    const params = new URLSearchParams({ start_date: start, end_date: end, metric_types: METRICS });
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
    fetchAnalytics(prevStartStr, prevEndStr),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extract(data: any, metric: string): number {
    if (!data) return 0;
    if (data?.all?.summary_metrics?.[metric] !== undefined)
      return Number(data.all.summary_metrics[metric]) || 0;
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

  function pct(curr: number, prev: number): number | null {
    if (!prev) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  // Build daily data for charts
  const daily: { date: string; impressions: number; engagements: number; clicks: number; saves: number; totalAudience: number; engagedAudience: number }[] = [];
  const dailyMetrics = current?.all?.daily_metrics;
  if (Array.isArray(dailyMetrics)) {
    for (const day of dailyMetrics) {
      if (day.data_status === "PROCESSING") continue;
      daily.push({
        date: day.date,
        impressions: Number(day.metrics?.IMPRESSION || 0),
        engagements: Number(day.metrics?.ENGAGEMENT || 0),
        clicks: Number(day.metrics?.OUTBOUND_CLICK || 0),
        saves: Number(day.metrics?.SAVE || 0),
        totalAudience: Number(day.metrics?.TOTAL_AUDIENCE || 0),
        engagedAudience: Number(day.metrics?.ENGAGED_AUDIENCE || 0),
      });
    }
  }

  const impressions = extract(current, "IMPRESSION");
  const engagements = extract(current, "ENGAGEMENT");
  const outboundClicks = extract(current, "OUTBOUND_CLICK");
  const saves = extract(current, "SAVE");
  const totalAudience = extract(current, "TOTAL_AUDIENCE");
  const engagedAudience = extract(current, "ENGAGED_AUDIENCE");

  return NextResponse.json({
    impressions,
    engagements,
    outboundClicks,
    saves,
    totalAudience,
    engagedAudience,
    impressionsChange: pct(impressions, extract(previous, "IMPRESSION")),
    engagementsChange: pct(engagements, extract(previous, "ENGAGEMENT")),
    outboundClicksChange: pct(outboundClicks, extract(previous, "OUTBOUND_CLICK")),
    savesChange: pct(saves, extract(previous, "SAVE")),
    totalAudienceChange: pct(totalAudience, extract(previous, "TOTAL_AUDIENCE")),
    engagedAudienceChange: pct(engagedAudience, extract(previous, "ENGAGED_AUDIENCE")),
    daily,
    period: { startDate, endDate },
  });
}
