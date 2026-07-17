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

  async function fetchMetrics(start: string, end: string, metrics: string) {
    const params = new URLSearchParams({ start_date: start, end_date: end, metric_types: metrics });
    const res = await fetch(`https://api.pinterest.com/v5/user_account/analytics?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Pinterest analytics [${metrics}] error ${res.status}:`, err);
      return null;
    }
    return res.json();
  }

  // Fetch core metrics and audience metrics separately — some accounts only support a subset
  const [coreCurrent, corePrev, audCurrent, audPrev] = await Promise.all([
    fetchMetrics(startDate, endDate, "IMPRESSION,PIN_CLICK,SAVE"),
    fetchMetrics(prevStartStr, prevEndStr, "IMPRESSION,PIN_CLICK,SAVE"),
    fetchMetrics(startDate, endDate, "TOTAL_AUDIENCE,ENGAGED_AUDIENCE,ENGAGEMENT"),
    fetchMetrics(prevStartStr, prevEndStr, "TOTAL_AUDIENCE,ENGAGED_AUDIENCE,ENGAGEMENT"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extract(data: any, metric: string): number {
    if (!data) return 0;
    // Try summary_metrics first
    if (data?.all?.summary_metrics?.[metric] !== undefined)
      return Number(data.all.summary_metrics[metric]) || 0;
    // Fall back to summing daily_metrics
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

  // Build daily chart data from core metrics
  const dailyMap: Record<string, { impressions: number; clicks: number; saves: number; engagements: number; totalAudience: number; engagedAudience: number }> = {};

  const coreDaily = coreCurrent?.all?.daily_metrics;
  if (Array.isArray(coreDaily)) {
    for (const day of coreDaily) {
      if (day.data_status === "PROCESSING") continue;
      dailyMap[day.date] = {
        impressions: Number(day.metrics?.IMPRESSION || 0),
        clicks: Number(day.metrics?.PIN_CLICK || 0),
        saves: Number(day.metrics?.SAVE || 0),
        engagements: 0,
        totalAudience: 0,
        engagedAudience: 0,
      };
    }
  }

  const audDaily = audCurrent?.all?.daily_metrics;
  if (Array.isArray(audDaily)) {
    for (const day of audDaily) {
      if (day.data_status === "PROCESSING") continue;
      if (!dailyMap[day.date]) {
        dailyMap[day.date] = { impressions: 0, clicks: 0, saves: 0, engagements: 0, totalAudience: 0, engagedAudience: 0 };
      }
      dailyMap[day.date].engagements = Number(day.metrics?.ENGAGEMENT || 0);
      dailyMap[day.date].totalAudience = Number(day.metrics?.TOTAL_AUDIENCE || 0);
      dailyMap[day.date].engagedAudience = Number(day.metrics?.ENGAGED_AUDIENCE || 0);
    }
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const impressions = extract(coreCurrent, "IMPRESSION");
  const pinClicks = extract(coreCurrent, "PIN_CLICK");
  const saves = extract(coreCurrent, "SAVE");
  const engagements = extract(audCurrent, "ENGAGEMENT");
  const totalAudience = extract(audCurrent, "TOTAL_AUDIENCE");
  const engagedAudience = extract(audCurrent, "ENGAGED_AUDIENCE");

  return NextResponse.json({
    impressions,
    pinClicks,
    saves,
    engagements,
    totalAudience,
    engagedAudience,
    impressionsChange: pct(impressions, extract(corePrev, "IMPRESSION")),
    pinClicksChange: pct(pinClicks, extract(corePrev, "PIN_CLICK")),
    savesChange: pct(saves, extract(corePrev, "SAVE")),
    engagementsChange: pct(engagements, extract(audPrev, "ENGAGEMENT")),
    totalAudienceChange: pct(totalAudience, extract(audPrev, "TOTAL_AUDIENCE")),
    engagedAudienceChange: pct(engagedAudience, extract(audPrev, "ENGAGED_AUDIENCE")),
    daily,
    period: { startDate, endDate },
  });
}
