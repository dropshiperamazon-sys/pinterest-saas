import { NextResponse } from "next/server";
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
  if (!res.ok) {
    console.error(`Pinterest Catalog ${path} → ${res.status}:`, text.slice(0, 300));
    return { _error: res.status, _body: text };
  }
  try { return JSON.parse(text); } catch { return null; }
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  // Fetch catalogs + feeds in parallel
  const [catalogsData, feedsData] = await Promise.all([
    pGet("/catalogs?page_size=10", accessToken),
    pGet("/catalogs/feeds?page_size=25", accessToken),
  ]);

  const scopeError =
    (catalogsData?._error === 403 || catalogsData?._error === 401) ||
    (feedsData?._error === 403 || feedsData?._error === 401);

  if (scopeError) {
    return NextResponse.json({
      scopeError: true,
      message: "Catalog access requires reconnecting Pinterest with catalog permissions.",
    });
  }

  const catalogs: Record<string, unknown>[] = catalogsData?.items ?? [];
  const feeds: Record<string, unknown>[] = feedsData?.items ?? [];

  // Count totals from feed metadata
  const totalProducts = feeds.reduce((sum: number, f: Record<string, unknown>) => {
    const counts = f.counts as Record<string, number> | undefined;
    return sum + (counts?.TOTAL ?? 0);
  }, 0);

  const totalIngested = feeds.reduce((sum: number, f: Record<string, unknown>) => {
    const counts = f.counts as Record<string, number> | undefined;
    return sum + (counts?.INGESTED ?? 0);
  }, 0);

  const totalErrors = feeds.reduce((sum: number, f: Record<string, unknown>) => {
    const counts = f.counts as Record<string, number> | undefined;
    return sum + (counts?.FAILED ?? 0);
  }, 0);

  return NextResponse.json({
    scopeError: false,
    catalogs,
    feeds,
    summary: {
      totalCatalogs: catalogs.length,
      totalFeeds: feeds.length,
      totalProducts,
      totalIngested,
      totalErrors,
    },
  });
}
