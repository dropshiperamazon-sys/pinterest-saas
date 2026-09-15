import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";

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
  console.log(`[pin-analytics] GET ${path} → HTTP ${res.status}`, text.slice(0, 400));
  if (!res.ok) return { _error: res.status, _body: text };
  try { return JSON.parse(text); } catch { return null; }
}

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getActivePinterestToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });


  const { searchParams } = new URL(req.url);
  const pinId = searchParams.get("pinId");
  if (!pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  const days = Number(searchParams.get("days") ?? "30");
  const startDate = dateStr(Math.min(days, 90));
  const endDate = dateStr(0);
  const metricTypes = "ENGAGEMENT,IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE,VIDEO_V50_WATCH_TIME";
  const appTypes = searchParams.get("appTypes") ?? "ALL";

  // GET /pins/{pin_id}/analytics
  const analyticsPath =
    `/pins/${encodeURIComponent(pinId)}/analytics` +
    `?start_date=${startDate}&end_date=${endDate}` +
    `&metric_types=${metricTypes}&app_types=${appTypes}`;

  // GET /pins/{pin_id} — basic pin info
  const [analyticsData, pinData] = await Promise.all([
    pGet(analyticsPath, accessToken),
    pGet(`/pins/${encodeURIComponent(pinId)}`, accessToken),
  ]);

  if (analyticsData?._error) {
    return NextResponse.json(
      { error: `Pinterest API error ${analyticsData._error}`, detail: String(analyticsData._body ?? "").slice(0, 400) },
      { status: 502 }
    );
  }

  // Pinterest returns: { all: { daily_metrics: [{data_status, date, metrics: {IMPRESSION, ...}}] } }
  const allData = analyticsData?.all ?? analyticsData ?? {};
  const daily: Array<{ date: string; impression: number; save: number; pinClick: number; outboundClick: number; engagement: number; watchTime: number }> = [];

  const rows = Array.isArray(allData?.daily_metrics)
    ? (allData.daily_metrics as Record<string, unknown>[])
    : Array.isArray(analyticsData)
      ? (analyticsData as Record<string, unknown>[])
      : [];

  for (const row of rows) {
    const metrics = (row.metrics ?? row) as Record<string, unknown>;
    daily.push({
      date: String(row.date ?? ""),
      impression: Number(metrics.IMPRESSION ?? 0),
      save: Number(metrics.SAVE ?? 0),
      pinClick: Number(metrics.PIN_CLICK ?? 0),
      outboundClick: Number(metrics.OUTBOUND_CLICK ?? 0),
      engagement: Number(metrics.ENGAGEMENT ?? 0),
      watchTime: Number(metrics.VIDEO_V50_WATCH_TIME ?? 0),
    });
  }

  // Totals
  const totals = daily.reduce(
    (acc, d) => ({
      impression: acc.impression + d.impression,
      save: acc.save + d.save,
      pinClick: acc.pinClick + d.pinClick,
      outboundClick: acc.outboundClick + d.outboundClick,
      engagement: acc.engagement + d.engagement,
    }),
    { impression: 0, save: 0, pinClick: 0, outboundClick: 0, engagement: 0 }
  );

  // Pin info
  const pin = pinData?._error ? null : pinData;
  const pinImages = (pin?.media?.images ?? pin?.images ?? {}) as Record<string, { url?: string }>;
  const imageUrl =
    pinImages["1200x"]?.url ?? pinImages["736x"]?.url ?? pinImages["400x300"]?.url ?? pinImages["150x150"]?.url ?? "";

  return NextResponse.json({
    pinId,
    pin: pin
      ? {
          title: pin.title ?? "",
          description: pin.description ?? "",
          link: pin.link ?? "",
          imageUrl,
          boardId: pin.board_id ?? "",
        }
      : null,
    period: { startDate, endDate, days, appTypes },
    daily,
    totals,
  });
}
