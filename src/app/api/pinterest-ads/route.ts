import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function pinterestGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Pinterest API ${path} → ${res.status}:`, text);
    return null;
  }
  return res.json();
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  // 1. Get ad accounts
  const accountsData = await pinterestGet("/ad_accounts?page_size=10", accessToken);
  if (!accountsData?.items?.length) {
    return NextResponse.json({ error: "No ad accounts found" }, { status: 404 });
  }

  const adAccountId: string = accountsData.items[0].id;
  const adAccountName: string = accountsData.items[0].name;

  const startDate = dateStr(30);
  const endDate = dateStr(1);

  // 2. Fetch campaigns + analytics in parallel
  const [campaignsData, analyticsData] = await Promise.all([
    pinterestGet(`/ad_accounts/${adAccountId}/campaigns?page_size=25`, accessToken),
    pinterestGet(
      `/ad_accounts/${adAccountId}/analytics?start_date=${startDate}&end_date=${endDate}&columns=SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_1,TOTAL_CLICKTHROUGH,TOTAL_ENGAGEMENT,TOTAL_SAVE&granularity=TOTAL`,
      accessToken
    ),
  ]);

  const campaigns = (campaignsData?.items ?? []).map((c: Record<string, unknown>) => ({
    id: c.id,
    name: c.name,
    status: (c.status as string)?.toLowerCase() ?? "unknown",
    objective: c.objective_type,
    dailyBudget: c.daily_spend_cap ? Number(c.daily_spend_cap) / 1_000_000 : null,
    lifetimeBudget: c.lifetime_spend_cap ? Number(c.lifetime_spend_cap) / 1_000_000 : null,
    startTime: c.start_time,
    endTime: c.end_time,
    createdTime: c.created_time,
  }));

  // 3. Fetch per-campaign analytics
  if (campaigns.length > 0) {
    const ids = campaigns.map((c: { id: unknown }) => c.id).join(",");
    const camAnalytics = await pinterestGet(
      `/ad_accounts/${adAccountId}/campaigns/analytics?start_date=${startDate}&end_date=${endDate}&campaign_ids=${ids}&columns=SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_1,TOTAL_SAVE,TOTAL_ENGAGEMENT&granularity=TOTAL`,
      accessToken
    );

    if (Array.isArray(camAnalytics)) {
      const byId: Record<string, Record<string, number>> = {};
      for (const row of camAnalytics) {
        byId[row.CAMPAIGN_ID] = row;
      }
      for (const c of campaigns) {
        const row = byId[c.id as string] ?? {};
        (c as Record<string, unknown>).spend = row.SPEND_IN_DOLLAR ?? 0;
        (c as Record<string, unknown>).impressions = row.IMPRESSION_1 ?? 0;
        (c as Record<string, unknown>).clicks = row.CLICK_1 ?? 0;
        (c as Record<string, unknown>).saves = row.TOTAL_SAVE ?? 0;
        (c as Record<string, unknown>).engagements = row.TOTAL_ENGAGEMENT ?? 0;
        const imps = row.IMPRESSION_1 || 1;
        const clicks = row.CLICK_1 || 0;
        (c as Record<string, unknown>).ctr = Math.round((clicks / imps) * 10000) / 100;
      }
    }
  }

  // 4. Summarise account-level totals from analytics
  const totals = analyticsData?.[0] ?? {};

  return NextResponse.json({
    adAccountId,
    adAccountName,
    period: { startDate, endDate },
    totals: {
      spend: totals.SPEND_IN_DOLLAR ?? 0,
      impressions: totals.IMPRESSION_1 ?? 0,
      clicks: totals.CLICK_1 ?? 0,
      saves: totals.TOTAL_SAVE ?? 0,
      engagements: totals.TOTAL_ENGAGEMENT ?? 0,
    },
    campaigns,
  });
}
