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
  const feedId = searchParams.get("feedId");
  const bookmark = searchParams.get("bookmark") ?? undefined;
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "25"), 100);

  if (!feedId) return NextResponse.json({ error: "feedId required" }, { status: 400 });

  // Get items for a specific feed
  const bookmarkParam = bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : "";
  const data = await pGet(
    `/catalogs/items?feed_id=${encodeURIComponent(feedId)}&page_size=${pageSize}${bookmarkParam}`,
    accessToken
  );

  if (data?._error) {
    return NextResponse.json({
      scopeError: data._error === 403 || data._error === 401,
      error: "Failed to fetch products",
      status: data._error,
    }, { status: data._error >= 400 ? 502 : 500 });
  }

  const items: Record<string, unknown>[] = data?.items ?? [];

  // Enrich each item with an SEO score
  const products = items.map((item: Record<string, unknown>) => {
    const attrs = (item.attributes ?? {}) as Record<string, unknown>;
    const title = (attrs.title as string) ?? "";
    const description = (attrs.description as string) ?? "";
    const imageLink = (attrs.image_link as string) ?? (attrs.additional_image_links as string[])?.[0] ?? "";
    const link = (attrs.link as string) ?? "";
    const availability = (attrs.availability as string) ?? "";
    const price = (attrs.price as string) ?? "";
    const brand = (attrs.brand as string) ?? "";
    const condition = (attrs.condition as string) ?? "";
    const googleProductCategory = (attrs.google_product_category as string) ?? "";

    // Simple SEO score based on field completeness
    let score = 0;
    if (title.length >= 20 && title.length <= 150) score += 25;
    else if (title.length > 0) score += 10;
    if (description.length >= 100) score += 25;
    else if (description.length > 0) score += 10;
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
      id: item.id ?? item.item_id,
      title,
      description,
      imageLink,
      link,
      availability,
      price,
      brand,
      condition,
      googleProductCategory,
      seoScore: score,
      issues,
      status: (item.pin_status as string) ?? "ACTIVE",
    };
  });

  return NextResponse.json({
    products,
    bookmark: data?.bookmark ?? null,
    totalCount: data?.items?.length ?? 0,
  });
}
