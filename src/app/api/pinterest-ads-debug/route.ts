import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";

const BASE = "https://api.pinterest.com/v5";

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const token = await getActivePinterestToken(email);
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

  const startDate = dateStr(30);
  const endDate = dateStr(1);

  // Get ad account
  const acctRes = await fetch(`${BASE}/ad_accounts?page_size=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const acctData = await acctRes.json();
  if (!acctRes.ok || !acctData.items?.length) {
    return NextResponse.json({ error: "No ad accounts", raw: acctData });
  }

  const adAccountId = acctData.items[0].id;

  // Try campaign analytics with common column sets
  const columnSets = [
    "SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,SAVE_1,ENGAGEMENT_1",
    "SPEND_IN_DOLLAR,TOTAL_IMPRESSION_1,TOTAL_CLICKTHROUGH,TOTAL_SAVE_1,TOTAL_ENGAGEMENT",
    "SPEND_IN_DOLLAR,IMPRESSION_1,CLICK_1,SAVE_1,ENGAGEMENT_1",
  ];

  // Get first campaign id
  const camRes = await fetch(`${BASE}/ad_accounts/${adAccountId}/campaigns?page_size=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const camData = await camRes.json();
  const firstCamId = camData.items?.[0]?.id;

  const results: Record<string, unknown> = {
    adAccountId,
    firstCampaign: camData.items?.[0],
    startDate,
    endDate,
  };

  if (firstCamId) {
    for (const cols of columnSets) {
      const url = `${BASE}/ad_accounts/${adAccountId}/campaigns/analytics?start_date=${startDate}&end_date=${endDate}&campaign_ids=${firstCamId}&columns=${cols}&granularity=TOTAL`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      results[`cols_${cols.split(",")[1]}`] = { status: r.status, data: d };
    }
  }

  return NextResponse.json(results);
}
