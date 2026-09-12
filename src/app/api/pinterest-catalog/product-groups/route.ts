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
  if (!res.ok) return { _error: res.status };
  try { return JSON.parse(text); } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const feedId = searchParams.get("feedId") ?? undefined;

  const feedParam = feedId ? `?feed_id=${encodeURIComponent(feedId)}&page_size=50` : "?page_size=50";
  const data = await pGet(`/catalogs/product_groups${feedParam}`, accessToken);

  if (data?._error) {
    return NextResponse.json({
      scopeError: data._error === 403 || data._error === 401,
      error: "Failed to fetch product groups",
    }, { status: 502 });
  }

  const groups: Record<string, unknown>[] = data?.items ?? [];

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      feedId: g.feed_id,
      filterV2: g.filter_v2,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    })),
    bookmark: data?.bookmark ?? null,
  });
}
