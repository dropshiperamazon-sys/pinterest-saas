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

  const connection = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    accessToken: string;
    grantedScopes?: string[];
  };
  const { accessToken } = connection;
  const grantedScopes: string[] = connection.grantedScopes ?? [];

  // If we have scope info and catalogs:read is absent, tell the user immediately
  if (grantedScopes.length > 0 && !grantedScopes.includes("catalogs:read")) {
    console.log("Pinterest Catalog: missing catalogs:read — granted:", grantedScopes);
    return NextResponse.json({
      scopeError: true,
      reason: "missing_scope",
      grantedScopes,
      message: "Catalog access requires reconnecting Pinterest with catalog permissions.",
    });
  }

  // Fetch catalogs + feeds in parallel
  const [catalogsData, feedsData] = await Promise.all([
    pGet("/catalogs?page_size=10", accessToken),
    pGet("/catalogs/feeds?page_size=25", accessToken),
  ]);

  if (catalogsData?._error === 401 || feedsData?._error === 401) {
    return NextResponse.json({
      scopeError: true,
      reason: "token_expired",
      message: "Pinterest token expired. Please reconnect your Pinterest account.",
    });
  }

  if (catalogsData?._error === 403 || feedsData?._error === 403) {
    // Distinguish missing scope from missing business access
    const reason = grantedScopes.includes("catalogs:read") ? "business_access" : "missing_scope";
    const debugInfo = { endpoint: "/catalogs", status: 403, grantedScopes };
    console.log("Pinterest Catalog 403:", debugInfo);
    return NextResponse.json({
      scopeError: true,
      reason,
      grantedScopes,
      message: reason === "business_access"
        ? "Your Pinterest account has catalogs:read permission but does not have business access to this catalog."
        : "Catalog access requires reconnecting Pinterest with catalog permissions.",
    });
  }

  if (catalogsData?._error) {
    return NextResponse.json({
      scopeError: true,
      reason: "api_error",
      status: catalogsData._error,
      message: "Pinterest Catalog API returned an error. Please try again.",
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
