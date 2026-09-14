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
  console.log(`[pgp] GET ${path} → HTTP ${res.status}`, text.slice(0, 800));
  if (!res.ok) return { _error: res.status, _body: text };
  try { return JSON.parse(text); } catch { return null; }
}

function computeSeoScore(attrs: Record<string, unknown>) {
  const title = (attrs.title as string) ?? "";
  const description = (attrs.description as string) ?? "";
  const imageLink = (attrs.imageLink as string) ?? (attrs.image_link as string) ?? "";
  const link = (attrs.link as string) ?? "";
  const brand = (attrs.brand as string) ?? "";
  const googleProductCategory = (attrs.googleProductCategory as string) ?? (attrs.google_product_category as string) ?? "";
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

function mapItem(item: Record<string, unknown>) {
  // Pinterest v5 /products response shape:
  //   item.metadata  → catalog fields: item_id, item_group_id, availability, price, sale_price, currency, condition, google_product_category, brand
  //   item.pin        → pin fields: title, description, link, images (for image URL)
  // Pinterest v5 /catalogs/items response shape:
  //   item.attributes → all fields flat
  const meta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
  const pin = (item.pin && typeof item.pin === "object" ? item.pin : {}) as Record<string, unknown>;
  const attrs = (item.attributes && typeof item.attributes === "object" ? item.attributes : {}) as Record<string, unknown>;

  // Derive each field: prefer /products structure (meta + pin), fall back to /catalogs/items (attrs)
  const itemId = String((meta.item_id as string) ?? (attrs.item_id as string) ?? item.id ?? item.item_id ?? "");
  const itemGroupId = String((meta.item_group_id as string) ?? (attrs.item_group_id as string) ?? "");
  const title = (pin.title as string) ?? (attrs.title as string) ?? "";
  const description = (pin.description as string) ?? (attrs.description as string) ?? "";
  const link = (pin.link as string) ?? (attrs.link as string) ?? "";

  // Image: pin.images is { "150x150": { url }, "400x300": { url }, "736x": { url } } — pick largest
  const pinImages = pin.images && typeof pin.images === "object" ? pin.images as Record<string, { url?: string }> : {};
  const imageLink =
    pinImages["736x"]?.url ??
    pinImages["400x300"]?.url ??
    pinImages["150x150"]?.url ??
    (attrs.image_link as string) ??
    (Array.isArray(attrs.additional_image_links) ? (attrs.additional_image_links as string[])[0] : "") ??
    "";

  const price = String((meta.price as string | number) ?? (attrs.price as string) ?? "");
  const salePrice = String((meta.sale_price as string | number) ?? (attrs.sale_price as string) ?? "");
  const currency = (meta.currency as string) ?? (attrs.currency as string) ?? "";
  const availability = (meta.availability as string) ?? (attrs.availability as string) ?? "";
  const brand = (meta.brand as string) ?? (attrs.brand as string) ?? "";
  const condition = (meta.condition as string) ?? (attrs.condition as string) ?? "";
  const googleProductCategory = (meta.google_product_category as string) ?? (attrs.google_product_category as string) ?? "";
  const productType = (meta.product_type as string) ?? (attrs.product_type as string) ?? "";
  const status = (item.pin_status as string) ?? (pin.status as string) ?? "";

  const enriched = { title, description, imageLink, link, brand, googleProductCategory, condition, availability };
  const { score, issues } = computeSeoScore(enriched);

  return {
    id: itemId,
    itemId,
    itemGroupId,
    title,
    description,
    imageLink,
    link,
    price,
    salePrice,
    currency,
    availability,
    brand,
    condition,
    googleProductCategory,
    productType,
    status,
    seoScore: score,
    issues,
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
  const productGroupId = searchParams.get("productGroupId");
  const feedId = searchParams.get("feedId") ?? undefined;
  const bookmark = searchParams.get("bookmark") ?? undefined;
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "25"), 100);

  if (!productGroupId) {
    return NextResponse.json({ error: "productGroupId required" }, { status: 400 });
  }

  console.log(`[pgp] productGroupId=${productGroupId} feedId=${feedId} pageSize=${pageSize} bookmark=${bookmark}`);

  const bookmarkParam = bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : "";

  // Strategy:
  // 1. GET /catalogs/product_groups/{id}  → product_count field on the group object
  // 2. GET /catalogs/product_groups/{id}/products  → paginated product list (Pinterest v5)
  // Fallback: GET /catalogs/items?feed_id={id}  if /products returns 404

  const groupPath = `/catalogs/product_groups/${encodeURIComponent(productGroupId)}`;
  const productsPath = `/catalogs/product_groups/${encodeURIComponent(productGroupId)}/products?page_size=${pageSize}${bookmarkParam}`;

  console.log(`[pgp] group endpoint:    GET ${BASE}${groupPath}`);
  console.log(`[pgp] products endpoint: GET ${BASE}${productsPath}`);

  const [groupData, productsData] = await Promise.all([
    pGet(groupPath, accessToken),
    pGet(productsPath, accessToken),
  ]);

  // Product count: read from the product group object (no separate count endpoint in v5)
  const productCount: number | null =
    groupData?._error
      ? null
      : typeof groupData?.product_count === "number"
        ? groupData.product_count
        : null;

  let items: Record<string, unknown>[] = [];
  let productsApiError: { status: number; body: string } | null = null;
  let actualProductsPath = `${BASE}${productsPath}`;
  let productsStatus = productsData?._error ?? 200;
  let usedFallback = false;

  if (productsData?._error) {
    productsApiError = { status: productsData._error, body: String(productsData._body ?? "").slice(0, 800) };

    // If /products returned 404 (endpoint doesn't exist in this API version),
    // fall back to /catalogs/items?feed_id= (all feed products — noted in response)
    if ((productsData._error === 404 || productsData._error === 405) && feedId) {
      const fallbackPath = `/catalogs/items?feed_id=${encodeURIComponent(feedId)}&page_size=${pageSize}${bookmarkParam}`;
      console.log(`[pgp] /products 404/405 — fallback: GET ${BASE}${fallbackPath}`);
      const fallbackData = await pGet(fallbackPath, accessToken);
      if (!fallbackData?._error) {
        items = fallbackData?.items ?? [];
        actualProductsPath = `${BASE}${fallbackPath}`;
        productsStatus = 200;
        productsApiError = null;
        usedFallback = true;
      } else {
        productsApiError = {
          status: fallbackData._error,
          body: String(fallbackData._body ?? "").slice(0, 800),
        };
        productsStatus = fallbackData._error;
      }
    }
  } else {
    items = productsData?.items ?? [];
  }

  const products = items.map(mapItem);

  return NextResponse.json({
    productCount,
    products,
    bookmark: !usedFallback ? (productsData?.bookmark ?? null) : null,
    totalReturnedThisPage: products.length,
    usedFallback,
    _debug: {
      groupEndpoint: `${BASE}${groupPath}`,
      groupStatus: groupData?._error ?? 200,
      productsEndpoint: actualProductsPath,
      productsStatus,
      productsApiError,
      note: usedFallback
        ? "Pinterest v5 /products endpoint not found — showing all products from feed (group filter not applied server-side)"
        : null,
      rawFirstItem: items[0] ?? null,
    },
  });
}
