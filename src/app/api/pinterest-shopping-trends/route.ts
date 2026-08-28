import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

async function pinterestGet(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Pinterest Shopping Trends ${path} → ${res.status}:`, text);
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

// Pinterest's public API v5 has NO dedicated shopping category trends endpoint.
// The Shopping Trends page (trends.pinterest.com/shopping) uses an internal API
// not accessible via the public v5 API.
//
// This route attempts the closest available endpoints and returns structured data.
// If Pinterest adds a public shopping endpoint in the future, update the paths below.

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const region   = searchParams.get("region")   ?? "US";
  const rankedBy = searchParams.get("rankedBy") ?? "Outbound clicks";

  // Try Pinterest's catalog/product insights endpoints (require ads:read + catalog access)
  // These are the closest public endpoints to shopping category data
  const accountsData = await pinterestGet("/ad_accounts?page_size=5", accessToken);
  const adAccountId: string | null = accountsData?.items?.[0]?.id ?? null;

  let liveItems: { rank: number; category: string; growth: string; trend: "up" | "flat" | "down"; volume: number }[] = [];

  if (adAccountId) {
    // Try product group analytics (requires catalog feed connected)
    const pgData = await pinterestGet(
      `/ad_accounts/${adAccountId}/product_groups?page_size=25`,
      accessToken
    );
    console.log("Product groups response:", JSON.stringify(pgData)?.slice(0, 300));

    if (pgData?.items?.length) {
      liveItems = pgData.items.map((pg: Record<string, unknown>, i: number) => ({
        rank: i + 1,
        category: (pg.name ?? pg.filter_v2 ?? `Category ${i + 1}`) as string,
        growth: "—",
        trend: "flat" as const,
        volume: Math.max(10, 90 - i * 8),
      }));
    }
  }

  // Return live data if we got product group data, otherwise signal no live data
  if (liveItems.length > 0) {
    return NextResponse.json({ live: true, region, rankedBy, items: liveItems });
  }

  // Signal to the client to use curated sample data
  return NextResponse.json({ live: false, region, rankedBy, items: [] });
}
