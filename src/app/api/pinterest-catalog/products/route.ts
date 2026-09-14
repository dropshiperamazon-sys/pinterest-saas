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
  console.log(`[products] GET ${path} → HTTP ${res.status}`, text.slice(0, 400));
  if (!res.ok) return { _error: res.status, _body: text };
  try { return JSON.parse(text); } catch { return null; }
}

function mapAttrs(item: Record<string, unknown>) {
  const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
  const pin = (item.pin && typeof item.pin === "object" ? item.pin : {}) as Record<string, unknown>;
  const attrs = (item.attributes && typeof item.attributes === "object" ? item.attributes : {}) as Record<string, unknown>;

  const pinMedia = pin.media && typeof pin.media === "object" ? pin.media as Record<string, unknown> : {};
  const pinImages = pinMedia.images && typeof pinMedia.images === "object"
    ? pinMedia.images as Record<string, { url?: string }>
    : (pin.images && typeof pin.images === "object" ? pin.images as Record<string, { url?: string }> : {});

  const title = (pin.title as string) ?? (attrs.title as string) ?? "";
  const description = (pin.description as string) ?? (attrs.description as string) ?? "";
  const link = (pin.link as string) ?? (attrs.link as string) ?? "";
  const imageLink =
    pinImages["1200x"]?.url ?? pinImages["736x"]?.url ?? pinImages["600x"]?.url ??
    pinImages["400x300"]?.url ?? pinImages["150x150"]?.url ??
    (attrs.image_link as string) ?? "";
  const availability = (meta.availability as string) ?? (attrs.availability as string) ?? "";
  const price = String((meta.price as string | number) ?? (attrs.price as string) ?? "");
  const brand = (meta.brand as string) ?? (attrs.brand as string) ?? "";
  const condition = (meta.condition as string) ?? (attrs.condition as string) ?? "";
  const googleProductCategory = (meta.google_product_category as string) ?? (attrs.google_product_category as string) ?? "";
  const itemId = String((meta.item_id as string) ?? (attrs.item_id as string) ?? item.id ?? item.item_id ?? "");

  let score = 0;
  if (title.length >= 20 && title.length <= 150) score += 25; else if (title.length > 0) score += 10;
  if (description.length >= 100) score += 25; else if (description.length > 0) score += 10;
  if (imageLink) score += 20;
  if (link) score += 10;
  if (brand) score += 8;
  if (googleProductCategory) score += 7;
  if (condition) score += 3;
  if (availability) score += 2;

  const issues: string[] = [];
  if (!title) issues.push("Missing title");
  else if (title.length < 20) issues.push("Title too short (<20 chars)");
  else if (title.length > 150) issues.push("Title too long (>150 chars)");
  if (!description) issues.push("Missing description");
  else if (description.length < 100) issues.push("Description too short (<100 chars)");
  if (!imageLink) issues.push("Missing image");
  if (!link) issues.push("Missing product URL");
  if (!brand) issues.push("Missing brand");
  if (!googleProductCategory) issues.push("Missing Google Product Category");

  return {
    id: itemId,
    title, description, imageLink, link, availability, price, brand, condition,
    googleProductCategory, seoScore: score, issues,
    status: (item.pin_status as string) ?? (pin.status as string) ?? "ACTIVE",
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const feedId = searchParams.get("feedId");
  const bookmark = searchParams.get("bookmark") ?? undefined;
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "25"), 100);

  if (!feedId) return NextResponse.json({ error: "feedId required" }, { status: 400 });

  const bookmarkParam = bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : "";

  // Strategy 1: GET /catalogs/items?feed_id= (may return 405 on INTEGRATION feeds)
  const directPath = `/catalogs/items?feed_id=${encodeURIComponent(feedId)}&page_size=${pageSize}${bookmarkParam}`;
  const directData = await pGet(directPath, accessToken);

  if (!directData?._error) {
    const items: Record<string, unknown>[] = directData?.items ?? [];
    const products = items.map(mapAttrs);
    return NextResponse.json({
      products,
      bookmark: directData?.bookmark ?? null,
      totalCount: products.length,
      _source: "direct",
    });
  }

  console.log(`[products] direct feed endpoint failed (${directData._error}), falling back to product groups`);

  // Strategy 2: fetch product groups for the feed, then products from each group
  const groupsData = await pGet(`/catalogs/product_groups?feed_id=${encodeURIComponent(feedId)}&page_size=50`, accessToken);
  if (groupsData?._error) {
    return NextResponse.json({
      error: "Failed to fetch products",
      status: groupsData._error,
      _source: "none",
    }, { status: 502 });
  }

  const groups: Record<string, unknown>[] = groupsData?.items ?? [];
  if (groups.length === 0) {
    return NextResponse.json({ products: [], bookmark: null, totalCount: 0, _source: "groups-empty" });
  }

  // Fetch products from all groups in parallel (100 per group to get broad coverage)
  const groupFetches = groups.map((g) =>
    pGet(`/catalogs/product_groups/${encodeURIComponent(String(g.id))}/products?page_size=100`, accessToken)
  );
  const groupResults = await Promise.all(groupFetches);

  // Deduplicate by item_id across groups
  const seen = new Set<string>();
  const allItems: Record<string, unknown>[] = [];
  for (const result of groupResults) {
    if (!result?._error && Array.isArray(result?.items)) {
      for (const it of result.items as Record<string, unknown>[]) {
        const meta = (it.metadata && typeof it.metadata === "object" ? it.metadata : {}) as Record<string, unknown>;
        const id = String(meta.item_id ?? (it.id as string) ?? "");
        if (id && !seen.has(id)) { seen.add(id); allItems.push(it); }
      }
    }
  }

  const products = allItems.map(mapAttrs);

  return NextResponse.json({
    products,
    bookmark: null,
    totalCount: products.length,
    _source: "groups",
    _groupCount: groups.length,
  });
}
