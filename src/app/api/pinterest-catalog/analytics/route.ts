import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

async function pGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  console.log(`[catalog-analytics] GET ${path} → HTTP ${res.status}`, text.slice(0, 400));
  if (!res.ok) return { _error: res.status, _body: text };
  try { return JSON.parse(text); } catch { return null; }
}

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Aggregate a Pinterest daily analytics array into totals
function sumMetrics(daily: Record<string, unknown>[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of daily) {
    const metrics = (row.metrics ?? row) as Record<string, unknown>;
    for (const [k, v] of Object.entries(metrics)) {
      if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
    }
  }
  return totals;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const fromType = searchParams.get("type") ?? "ORGANIC"; // ORGANIC | PAID | ALL

  const startDate = dateStr(30);
  const endDate = dateStr(0);
  const metrics = "ENGAGEMENT,IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE,VIDEO_V50_WATCH_TIME";

  // 1. Account-level organic analytics
  const accountAnalyticsPath =
    `/user_account/analytics?start_date=${startDate}&end_date=${endDate}` +
    `&metric_types=${metrics}&split_field=NO_SPLIT`;
  const accountData = await pGet(accountAnalyticsPath, accessToken);

  // 2. Top pins analytics (organic)
  const topPinsPath =
    `/user_account/top_pins_analytics?start_date=${startDate}&end_date=${endDate}` +
    `&sort_by=IMPRESSION&metric_types=${metrics}&num_of_pins=25`;
  const topPinsData = await pGet(topPinsPath, accessToken);

  // 3. Try catalog-specific analytics (Pinterest v5 — may 404)
  // GET /catalogs/analytics does not exist in v5; we use account analytics as proxy
  const catalogsData = await pGet("/catalogs?page_size=10", accessToken);
  const catalogs: Record<string, unknown>[] = catalogsData?._error ? [] : (catalogsData?.items ?? []);

  // 4. Per-catalog: try /catalogs/{id}/products/analytics (Pinterest v5 Commerce)
  const catalogAnalytics: Record<string, Record<string, number>> = {};
  for (const cat of catalogs) {
    const catId = String(cat.id ?? "");
    if (!catId) continue;
    const catPath =
      `/catalogs/${encodeURIComponent(catId)}/products/analytics?start_date=${startDate}&end_date=${endDate}` +
      `&metric_types=${metrics}`;
    const catData = await pGet(catPath, accessToken);
    if (!catData?._error && catData?.daily_metrics) {
      catalogAnalytics[catId] = sumMetrics(catData.daily_metrics as Record<string, unknown>[]);
    }
  }

  // Summarise account totals
  const accountTotals = accountData?._error
    ? null
    : sumMetrics(
        Array.isArray(accountData?.all)
          ? (accountData.all as Record<string, unknown>[])
          : Array.isArray(accountData)
            ? (accountData as Record<string, unknown>[])
            : []
      );

  // Top pins with product metadata
  const topPins = topPinsData?._error
    ? []
    : ((topPinsData?.pins ?? topPinsData?.items ?? []) as Record<string, unknown>[]).map((pin) => {
        const metrics = (pin.metrics ?? {}) as Record<string, number>;
        const pinData = (pin.pin ?? pin) as Record<string, unknown>;
        return {
          id: pinData.id ?? pin.pin_id,
          title: pinData.title ?? pinData.description ?? "",
          imageUrl:
            (pinData.media as Record<string, unknown> | undefined)
              ? (() => {
                  const imgs = ((pinData.media as Record<string, unknown>).images ?? {}) as Record<string, { url?: string }>;
                  return imgs["150x150"]?.url ?? imgs["400x300"]?.url ?? "";
                })()
              : "",
          link: pinData.link ?? "",
          impressions: metrics.IMPRESSION ?? 0,
          saves: metrics.SAVE ?? 0,
          pinClicks: metrics.PIN_CLICK ?? 0,
          outboundClicks: metrics.OUTBOUND_CLICK ?? 0,
          engagement: metrics.ENGAGEMENT ?? 0,
          type: fromType,
        };
      });

  return NextResponse.json({
    period: { startDate, endDate, days: 30 },
    type: fromType,
    catalogs: catalogs.map((c) => {
      const catId = String(c.id ?? "");
      const cm = catalogAnalytics[catId] ?? null;
      return {
        id: catId,
        name: (c.name as string) ?? catId,
        catalogType: (c.catalog_type as string) ?? "",
        // Use catalog-specific metrics if available, else null (shown as —)
        impressions: cm?.IMPRESSION ?? null,
        saves: cm?.SAVE ?? null,
        pinClicks: cm?.PIN_CLICK ?? null,
        outboundClicks: cm?.OUTBOUND_CLICK ?? null,
        engagement: cm?.ENGAGEMENT ?? null,
      };
    }),
    accountTotals,
    topPins,
    _debug: {
      accountAnalyticsStatus: accountData?._error ?? 200,
      topPinsStatus: topPinsData?._error ?? 200,
      catalogAnalyticsKeys: Object.keys(catalogAnalytics),
    },
  });
}
