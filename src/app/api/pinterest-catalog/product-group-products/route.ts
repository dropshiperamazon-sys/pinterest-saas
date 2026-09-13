import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

async function pGet(path: string, token: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  // Server-side debug log (never logs the token)
  console.log(`[product-group-products] ${path} → HTTP ${res.status}`, text.slice(0, 800));
  if (!res.ok) return { _error: res.status, _body: text };
  try { return JSON.parse(text); } catch { return null; }
}

function computeSeoScore(attrs: Record<string, unknown>) {
  const title = (attrs.title as string) ?? "";
  const description = (attrs.description as string) ?? "";
  const imageLink = (attrs.image_link as string) ?? "";
  const link = (attrs.link as string) ?? "";
  const brand = (attrs.brand as string) ?? "";
  const googleProductCategory = (attrs.google_product_category as string) ?? "";
  const condition = (attrs.condition as string) ?? "";
  const availability = (attrs.availability as string) ?? "";

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

  return { score, issues };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const { searchParams } = new URL(req.url);
  const productGroupId = searchParams.get("productGroupId");
  const feedId = searchParams.get("feedId") ?? undefined;
  const bookmark = searchParams.get("bookmark") ?? undefined;
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "25"), 100);

  if (!productGroupId) {
    return NextResponse.json({ error: "productGroupId required" }, { status: 400 });
  }

  console.log(`[product-group-products] productGroupId=${productGroupId} feedId=${feedId} pageSize=${pageSize} bookmark=${bookmark}`);

  // Official Pinterest endpoint 1: product count
  const countPath = `/catalogs/product_groups/${encodeURIComponent(productGroupId)}/product_count`;

  // Official Pinterest endpoint 2: list products by product group
  const bookmarkParam = bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : "";
  const feedParam = feedId ? `&feed_id=${encodeURIComponent(feedId)}` : "";
  const productsPath = `/catalogs/items?product_group_id=${encodeURIComponent(productGroupId)}${feedParam}&page_size=${pageSize}${bookmarkParam}`;

  console.log(`[product-group-products] count endpoint: GET ${BASE}${countPath}`);
  console.log(`[product-group-products] products endpoint: GET ${BASE}${productsPath}`);

  const [countData, productsData] = await Promise.all([
    pGet(countPath, accessToken),
    pGet(productsPath, accessToken),
  ]);

  const productCount: number | null =
    countData?._error ? null : (typeof countData?.count === "number" ? countData.count : null);

  const productsApiError = productsData?._error
    ? { status: productsData._error, body: (productsData._body as string)?.slice(0, 800) }
    : null;

  const items: Record<string, unknown>[] = productsData?.items ?? [];

  const products = items.map((item) => {
    const attrs = (item.attributes ?? {}) as Record<string, unknown>;
    const { score, issues } = computeSeoScore(attrs);
    return {
      id: item.id ?? item.item_id,
      itemId: String(item.id ?? item.item_id ?? ""),
      itemGroupId: (attrs.item_group_id as string) ?? "",
      title: (attrs.title as string) ?? "",
      description: (attrs.description as string) ?? "",
      imageLink:
        (attrs.image_link as string) ??
        (Array.isArray(attrs.additional_image_links) ? (attrs.additional_image_links as string[])[0] : "") ??
        "",
      link: (attrs.link as string) ?? "",
      price: (attrs.price as string) ?? "",
      salePrice: (attrs.sale_price as string) ?? "",
      currency: (attrs.currency as string) ?? "",
      availability: (attrs.availability as string) ?? "",
      brand: (attrs.brand as string) ?? "",
      condition: (attrs.condition as string) ?? "",
      googleProductCategory: (attrs.google_product_category as string) ?? "",
      productType: (attrs.product_type as string) ?? "",
      status: (item.pin_status as string) ?? "",
      seoScore: score,
      issues,
    };
  });

  return NextResponse.json({
    productCount,
    products,
    bookmark: productsData?.bookmark ?? null,
    totalReturnedThisPage: products.length,
    // Debug/audit fields
    _debug: {
      countEndpoint: `${BASE}${countPath}`,
      productsEndpoint: `${BASE}${productsPath}`,
      countStatus: countData?._error ?? 200,
      productsStatus: productsData?._error ?? 200,
      productsApiError,
    },
  });
}
