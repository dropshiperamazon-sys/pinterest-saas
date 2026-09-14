import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const BASE = "https://api.pinterest.com/v5";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

  const body = await req.json() as {
    productId: string;
    title?: string;
    description?: string;
    catalogId?: string;
  };

  const { productId, title, description, catalogId } = body;
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
  if (!title && !description) return NextResponse.json({ error: "Nothing to apply" }, { status: 400 });

  const attributes: Record<string, string> = {};
  if (title) attributes.title = title;
  if (description) attributes.description = description;

  const batchBody: Record<string, unknown> = {
    country: "US",
    language: "EN",
    operation: "UPDATE",
    items: [{ item_id: productId, attributes }],
  };

  if (catalogId) batchBody.catalog_id = catalogId;

  const res = await fetch(`${BASE}/catalogs/items/batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batchBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[apply-suggestions] Pinterest batch error:", res.status, text.slice(0, 400));
    return NextResponse.json({ error: "Failed to update catalog item" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ success: true, batch: data });
}
