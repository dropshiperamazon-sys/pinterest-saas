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
      console.error(`Pinterest analytics [${metrics}] ${res.status}:`, await res.text());
      return null;
    }
    return res.json();
  }

  // Fetch each group separately to avoid one bad metric name killing all results
  const [
    coreCurrent, corePrev,
    outboundCurrent, outboundPrev,
    engageCurrent, engagePrev,
  ] = await Promise.all([
    fetchMetrics(startDate, endDate, "IMPRESSION,PIN_CLICK,SAVE"),
    fetchMetrics(prevStartStr, prevEndStr, "IMPRESSION,PIN_CLICK,SAVE"),
    fetchMetrics(startDate, endDate, "OUTBOUND_CLICK"),
    fetchMetrics(prevStartStr, prevEndStr, "OUTBOUND_CLICK"),
    fetchMetrics(startDate, endDate, "ENGAGEMENT"),
    fetchMetrics(prevStartStr, prevEndStr, "ENGAGEMENT"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extract(data: any, metric: string): number {
    if (!data) return 0;
    if (data?.all?.summary_metrics?.[metric] !== undefined)
      return Number(data.all.summary_metrics[metric]) || 0;
    const daily = data?.all?.daily_metrics;
    if (Array.isArray(daily)) {
      return daily.reduce((sum: number, day: { metrics?: Record<string, number> }) =>
        sum + (Number(day.metrics?.[metric]) || 0), 0);
    }
    return 0;
  }

  function rate(num: number, denom: number): number {
    if (!denom) return 0;
    return Math.round((num / denom) * 10000) / 100;
  }

  function pct(curr: number, prev: number): number | null {
    if (!prev) return null;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  // Build unified daily data by date key
  const dailyMap: Record<string, {
    impressions: number; pinClicks: number; outboundClicks: number;
    saves: number; engagements: number;
  }> = {};

  function mergeDaily(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    keys: { metric: string; field: string }[]
  ) {
    const daily = data?.all?.daily_metrics;
    if (!Array.isArray(daily)) return;
    for (const day of daily) {
      if (day.data_status === "PROCESSING") continue;
      if (!dailyMap[day.date]) {
        dailyMap[day.date] = { impressions: 0, pinClicks: 0, outboundClicks: 0, saves: 0, engagements: 0 };
      }
      for (const { metric, field } of keys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (dailyMap[day.date] as any)[field] = Number(day.metrics?.[metric] || 0);
      }
    }
  }

  mergeDaily(coreCurrent, [
    { metric: "IMPRESSION", field: "impressions" },
    { metric: "PIN_CLICK", field: "pinClicks" },
    { metric: "SAVE", field: "saves" },
  ]);
  mergeDaily(outboundCurrent, [{ metric: "OUTBOUND_CLICK", field: "outboundClicks" }]);
  mergeDaily(engageCurrent, [{ metric: "ENGAGEMENT", field: "engagements" }]);

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      ...v,
      ctr: rate(v.outboundClicks, v.impressions),
      saveRate: rate(v.saves, v.impressions),
    }));

  const impressions = extract(coreCurrent, "IMPRESSION");
  const pinClicks = extract(coreCurrent, "PIN_CLICK");
  const saves = extract(coreCurrent, "SAVE");
  const outboundClicks = extract(outboundCurrent, "OUTBOUND_CLICK");
  const engagements = extract(engageCurrent, "ENGAGEMENT");

  const prevImpressions = extract(corePrev, "IMPRESSION");
  const prevPinClicks = extract(corePrev, "PIN_CLICK");
  const prevSaves = extract(corePrev, "SAVE");
  const prevOutboundClicks = extract(outboundPrev, "OUTBOUND_CLICK");
  const prevEngagements = extract(engagePrev, "ENGAGEMENT");

  const ctr = rate(outboundClicks, impressions);
  const prevCtr = rate(prevOutboundClicks, prevImpressions);
  const saveRate = rate(saves, impressions);
  const prevSaveRate = rate(prevSaves, prevImpressions);

  return NextResponse.json({
    impressions,
    pinClicks,
    outboundClicks,
    saves,
    engagements,
    ctr,
    saveRate,
    impressionsChange: pct(impressions, prevImpressions),
    pinClicksChange: pct(pinClicks, prevPinClicks),
    outboundClicksChange: pct(outboundClicks, prevOutboundClicks),
    savesChange: pct(saves, prevSaves),
    engagementsChange: pct(engagements, prevEngagements),
    ctrChange: pct(ctr, prevCtr),
    saveRateChange: pct(saveRate, prevSaveRate),
    daily,
    period: { startDate, endDate },
  });
}
