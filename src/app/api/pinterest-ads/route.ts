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
    // Pre-initialize analytics fields so they're always numbers even if analytics fetch fails
    spend: 0, impressions: 0, clicks: 0, saves: 0, engagements: 0,
    ctr: 0, cpc: 0, cpm: 0, saveRate: 0,
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
      const byId: Record<string, Record<string, unknown>> = {};
      for (const row of camAnalytics) {
        if (row.CAMPAIGN_ID != null) byId[String(row.CAMPAIGN_ID)] = row;
      }
      for (const c of campaigns) {
        const row = byId[String(c.id)] ?? {};
        const rawSpend = Number(row.SPEND_IN_DOLLAR) || 0;
        const rawImps  = Number(row.IMPRESSION_1)   || 0;
        const rawClicks = Number(row.CLICK_1)        || 0;
        const rawSaves  = Number(row.TOTAL_SAVE)     || 0;
        const rawEngage = Number(row.TOTAL_ENGAGEMENT) || 0;
        const imps  = rawImps  || 1; // avoid division by zero
        (c as Record<string, unknown>).spend       = rawSpend;
        (c as Record<string, unknown>).impressions = rawImps;
        (c as Record<string, unknown>).clicks      = rawClicks;
        (c as Record<string, unknown>).saves       = rawSaves;
        (c as Record<string, unknown>).engagements = rawEngage;
        (c as Record<string, unknown>).ctr      = Math.round((rawClicks / imps) * 10000) / 100;
        (c as Record<string, unknown>).cpc      = rawClicks > 0 ? Math.round((rawSpend / rawClicks) * 100) / 100 : 0;
        (c as Record<string, unknown>).cpm      = Math.round((rawSpend / imps) * 1000 * 100) / 100;
        (c as Record<string, unknown>).saveRate = rawClicks > 0 ? Math.round(rawSaves / rawClicks * 10000) / 100 : 0;
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
      spend:       Number(totals.SPEND_IN_DOLLAR)   || 0,
      impressions: Number(totals.IMPRESSION_1)       || 0,
      clicks:      Number(totals.CLICK_1)            || 0,
      saves:       Number(totals.TOTAL_SAVE)         || 0,
      engagements: Number(totals.TOTAL_ENGAGEMENT)   || 0,
    },
    campaigns,
  });
}
