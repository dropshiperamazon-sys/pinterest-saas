import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getActivePinterestToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  // Fetch ad accounts
  const adAccountsRes = await fetch("https://api.pinterest.com/v5/ad_accounts?page_size=25", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!adAccountsRes.ok) {
    return NextResponse.json({ adSpend: null, noAdAccount: true });
  }

  const adAccountsData = await adAccountsRes.json();
  const adAccounts: Array<{ id: string }> = adAccountsData.items ?? [];

  if (!adAccounts.length) {
    return NextResponse.json({ adSpend: null, noAdAccount: true });
  }

  const endDate = dateStr(1);
  const startDate = dateStr(30);

  // Sum spend across all ad accounts
  let totalSpend = 0;
  let hasData = false;

  await Promise.all(
    adAccounts.map(async (account) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        columns: "SPEND_IN_DOLLAR",
        granularity: "TOTAL",
        level: "ADVERTISER",
      });
      const res = await fetch(
        `https://api.pinterest.com/v5/ad_accounts/${account.id}/analytics?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const rows: Array<{ SPEND_IN_DOLLAR?: number }> = data ?? [];
      for (const row of rows) {
        const spend = Number(row.SPEND_IN_DOLLAR ?? 0);
        if (spend > 0) {
          totalSpend += spend;
          hasData = true;
        }
      }
    })
  );

  return NextResponse.json({
    adSpend: hasData ? Math.round(totalSpend * 100) / 100 : 0,
    noAdAccount: false,
    period: { startDate, endDate },
  });
}
