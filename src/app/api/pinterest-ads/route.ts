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

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") ?? "30")));

  // 1. Get ad accounts
  const accountsData = await pinterestGet("/ad_accounts?page_size=10", accessToken);
  if (!accountsData?.items?.length) {
    return NextResponse.json({ error: "No ad accounts found" }, { status: 404 });
  }

  const adAccountId: string = accountsData.items[0].id;
  const adAccountName: string = accountsData.items[0].name;

  const startDate = dateStr(days);
  const endDate = dateStr(1);

  // 2. Fetch campaigns + account analytics in parallel
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

  // 3. Fetch per-campaign analytics + ad groups in parallel
  if (campaigns.length > 0) {
    const ids = campaigns.map((c: { id: unknown }) => c.id).join(",");

    const [camAnalytics, adGroupsData] = await Promise.all([
      pinterestGet(
        `/ad_accounts/${adAccountId}/campaigns/analytics?start_date=${startDate}&end_date=${endDate}&campaign_ids=${ids}&columns=SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_1,TOTAL_SAVE,TOTAL_ENGAGEMENT&granularity=TOTAL`,
        accessToken
      ),
      pinterestGet(`/ad_accounts/${adAccountId}/ad_groups?page_size=50`, accessToken),
    ]);

    // Attach analytics to each campaign
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
        const spend = row.SPEND_IN_DOLLAR || 0;
        (c as Record<string, unknown>).ctr = Math.round((clicks / imps) * 10000) / 100;
        (c as Record<string, unknown>).cpc = clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0;
        (c as Record<string, unknown>).cpm = imps > 0 ? Math.round((spend / imps) * 1000 * 100) / 100 : 0;
        (c as Record<string, unknown>).saveRate = clicks > 0 ? Math.round((row.TOTAL_SAVE ?? 0) / clicks * 10000) / 100 : 0;
      }
    }

    // Attach ad groups to each campaign
    if (Array.isArray(adGroupsData?.items)) {
      const groupsByCampaign: Record<string, unknown[]> = {};
      for (const ag of adGroupsData.items as Record<string, unknown>[]) {
        const cid = ag.campaign_id as string;
        if (!groupsByCampaign[cid]) groupsByCampaign[cid] = [];
        groupsByCampaign[cid].push({
          id: ag.id,
          name: ag.name,
          status: (ag.status as string)?.toLowerCase(),
          targetingType: ag.targeting_type,
          bidInMicroCurrency: ag.bid_in_micro_currency ? Number(ag.bid_in_micro_currency) / 1_000_000 : null,
          optimizationGoalMetadata: ag.optimization_goal_metadata,
          placementGroup: ag.placement_group,
          budgetInMicroCurrency: ag.budget_in_micro_currency ? Number(ag.budget_in_micro_currency) / 1_000_000 : null,
        });
      }
      for (const c of campaigns) {
        (c as Record<string, unknown>).adGroups = groupsByCampaign[c.id as string] ?? [];
      }
    }
  }

  // 4. Account-level totals
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
