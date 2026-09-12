import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { pinId } = await req.json();
  if (!pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  const scheduledKey = `scheduled_pin:${email}:${pinId}`;
  const raw = await redis.get(scheduledKey);
  if (!raw) return NextResponse.json({ error: "Pin not found" }, { status: 404 });

  const pin = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);

  // Resolve access token: stored on pin → user connection → env fallback
  let accessToken: string = (pin.accessToken as string) || "";
  if (!accessToken) {
    const connRaw = await redis.get(`pinterest_connection:${email}`);
    const conn = connRaw
      ? (typeof connRaw === "string" ? JSON.parse(connRaw) : connRaw) as { accessToken?: string }
      : null;
    accessToken = conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
  }
  if (!accessToken) return NextResponse.json({ error: "No Pinterest access token available" }, { status: 401 });

  // Build description with tagged product links appended
  const taggedProducts: { url: string; title?: string }[] = Array.isArray(pin.taggedProducts)
    ? (pin.taggedProducts as unknown[]).map((p) =>
        typeof p === "string" ? { url: p } : (p as { url: string; title?: string })
      )
    : [];
  const resolvedLink =
    (typeof pin.link === "string" && pin.link.startsWith("https://") ? pin.link : null) ??
    taggedProducts.find((p) => p.url?.startsWith("https://"))?.url ??
    undefined;
  let resolvedDescription = (pin.description as string) || "";
  if (taggedProducts.length > 0) {
    const shopLines = taggedProducts.map((p) => `🛍️ Shop: ${p.url}`).join("\n");
    resolvedDescription = resolvedDescription
      ? `${resolvedDescription}\n\n${shopLines}`
      : shopLines;
  }

  const imageUrl = (pin.imageUrl as string) || "";
  const pinterestRes = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: pin.title,
      description: resolvedDescription,
      board_id: pin.boardId,
      link: resolvedLink,
      media_source: imageUrl.startsWith("http")
        ? { source_type: "image_url", url: imageUrl }
        : { source_type: "image_url", url: "https://i.pinimg.com/736x/placeholder.jpg" },
    }),
  });

  const pinterestData = await pinterestRes.json();
  if (!pinterestRes.ok) {
    console.error("Pinterest API error (pin-now):", pinterestData);
    return NextResponse.json({ error: "Pinterest API failed", details: pinterestData }, { status: 500 });
  }

  const publishedKey = `published_pin:${email}:${pinId}`;
  await Promise.all([
    redis.set(
      publishedKey,
      JSON.stringify({
        ...pin,
        publishedAt: new Date().toISOString(),
        pinterestPinId: pinterestData.id,
        status: "published",
      }),
      { ex: 60 * 60 * 24 * 90 }
    ),
    redis.del(scheduledKey),
  ]);

  console.log(`Pin published (pin-now): ${pinId} →`, pin.title, "Pinterest ID:", pinterestData.id);
  return NextResponse.json({ success: true, pinId, pinterestPinId: pinterestData.id });
}
