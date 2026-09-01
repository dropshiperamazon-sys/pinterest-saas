import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

// Map our goal types to Pinterest campaign objective types
const GOAL_MAP: Record<string, string> = {
  sales: "CATALOG_SALES",
  traffic: "TRAFFIC",
  leads: "LEAD_GEN",
  awareness: "AWARENESS",
};

// Map country names to ISO codes
const COUNTRY_MAP: Record<string, string> = {
  "United States": "US", "United Kingdom": "GB", "Canada": "CA",
  "Australia": "AU", "Germany": "DE", "France": "FR", "Brazil": "BR",
  "India": "IN", "Mexico": "MX", "Argentina": "AR", "Italy": "IT",
  "Spain": "ES", "Netherlands": "NL", "Japan": "JP", "South Korea": "KR",
};

// Map niche labels to Pinterest interest IDs
const INTEREST_MAP: Record<string, string[]> = {
  "Fashion & Clothing": ["womens_fashion", "menswear"],
  "Home Decor & Interior": ["home_decor", "interior_design"],
  "Beauty & Makeup": ["beauty", "skin_care_beauty"],
  "Food & Recipes": ["food_and_drinks"],
  "Fitness & Wellness": ["sport", "health_and_wellness"],
  "Travel & Adventure": ["travel"],
  "Wedding & Events": ["wedding"],
  "Parenting & Kids": ["parenting", "children_and_baby"],
  "DIY & Crafts": ["diy_and_crafts"],
  "Pets & Animals": ["animals"],
  "Technology & Gadgets": ["electronics"],
  "Business & Finance": ["business_strategy", "small_business"],
  "Education & Learning": ["education"],
};

async function getAdAccountId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/ad_accounts?page_size=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function getDeliveryEstimate(
  accessToken: string,
  adAccountId: string,
  params: {
    dailyBudgetCents: number;
    objective: string;
    country: string;
    interests: string[];
    gender: string;
  }
): Promise<{ impressions: number; clicks: number; cpc: number } | null> {
  try {
    const targetingSpec: Record<string, unknown> = {
      country: params.country,
    };
    if (params.interests.length > 0) {
      targetingSpec.interest = params.interests.slice(0, 5);
    }
    if (params.gender === "female") targetingSpec.gender = ["female"];
    if (params.gender === "male") targetingSpec.gender = ["male"];

    const body = {
      ad_account_id: adAccountId,
      targeting_spec: targetingSpec,
      campaign_objective_type: params.objective,
      bid_in_micro_currency: 1000000, // $1.00 bid in microcurrency
      optimization_goal_metadata: {
        frequency_goal_metadata: { goal: "1", timeframe: "DAY" },
      },
    };

    const res = await fetch(
      `${BASE}/ad_accounts/${adAccountId}/delivery_metrics/estimate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    );

    const text = await res.text();
    console.log(`[Estimate] delivery_metrics status=${res.status} body=${text.slice(0, 400)}`);

    if (!res.ok) return null;
    const data = JSON.parse(text);

    // Pinterest returns daily estimates — scale to monthly
    const dailyImpressions = data?.daily_impressions ?? data?.impressions ?? null;
    const dailyClicks = data?.daily_clicks ?? data?.clicks ?? null;
    const estimatedCpc = data?.cpc ?? data?.cpc_in_micro_currency ? (data.cpc_in_micro_currency / 1000000) : null;

    if (dailyImpressions === null) return null;

    return {
      impressions: Math.round(dailyImpressions),
      clicks: Math.round(dailyClicks ?? dailyImpressions * 0.024),
      cpc: estimatedCpc ?? (params.dailyBudgetCents / 100) / Math.max(1, dailyClicks ?? 1),
    };
  } catch (e) {
    console.log("[Estimate] delivery_metrics error:", e);
    return null;
  }
}

async function getAudienceSize(
  accessToken: string,
  adAccountId: string,
  country: string,
  interests: string[]
): Promise<{ audienceSize: number } | null> {
  try {
    const body = {
      type: "AUDIENCE",
      targeting_spec: {
        country: [country],
        ...(interests.length > 0 ? { interest_id: interests.slice(0, 5) } : {}),
      },
    };

    const res = await fetch(
      `${BASE}/ad_accounts/${adAccountId}/audience_insights`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    );

    const text = await res.text();
    console.log(`[Estimate] audience_insights status=${res.status} body=${text.slice(0, 300)}`);

    if (!res.ok) return null;
    const data = JSON.parse(text);

    const size =
      data?.audience_size ??
      data?.items?.[0]?.audience_size ??
      data?.reach ??
      null;

    return size !== null ? { audienceSize: size } : null;
  } catch (e) {
    console.log("[Estimate] audience_insights error:", e);
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected", live: false }, { status: 200 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const body = await req.json();
  const { goal, market, monthlyBudget, niche, gender } = body as {
    goal: string;
    market: string;
    monthlyBudget: number;
    niche: string;
    gender: string;
  };

  const country = COUNTRY_MAP[market] ?? "US";
  const objective = GOAL_MAP[goal] ?? "TRAFFIC";
  const interests = INTEREST_MAP[niche] ?? [];
  const dailyBudget = Math.round(monthlyBudget / 30);
  const dailyBudgetCents = dailyBudget * 100;

  const adAccountId = await getAdAccountId(accessToken);
  if (!adAccountId) {
    return NextResponse.json({ error: "No ad account found", live: false }, { status: 200 });
  }

  // Run both requests in parallel
  const [delivery, audience] = await Promise.all([
    getDeliveryEstimate(accessToken, adAccountId, {
      dailyBudgetCents,
      objective,
      country,
      interests,
      gender: gender ?? "all",
    }),
    getAudienceSize(accessToken, adAccountId, country, interests),
  ]);

  if (!delivery && !audience) {
    return NextResponse.json({ live: false, reason: "API returned no estimate data" });
  }

  // Scale daily → weekly/monthly
  const dailyImpressions = delivery?.impressions ?? 0;
  const dailyClicks = delivery?.clicks ?? 0;
  const cpc = delivery?.cpc ?? 0;

  const result = {
    live: true,
    adAccountId,
    reachEstimate: audience?.audienceSize
      ? audience.audienceSize >= 1_000_000
        ? `${(audience.audienceSize / 1_000_000).toFixed(1)}M`
        : `${(audience.audienceSize / 1_000).toFixed(0)}K`
      : null,
    weeklyImpressions: dailyImpressions > 0
      ? dailyImpressions * 7 >= 1_000_000
        ? `${((dailyImpressions * 7) / 1_000_000).toFixed(1)}M`
        : `${Math.round((dailyImpressions * 7) / 1000).toLocaleString()}K`
      : null,
    monthlyClicks: dailyClicks > 0
      ? dailyClicks * 30 >= 1_000_000
        ? `${((dailyClicks * 30) / 1_000_000).toFixed(1)}M`
        : `${Math.round((dailyClicks * 30) / 1000).toLocaleString()}K`
      : null,
    estimatedCpa: cpc > 0 ? `$${cpc.toFixed(2)}` : null,
    dailyImpressions,
    dailyClicks,
  };

  return NextResponse.json(result);
}
