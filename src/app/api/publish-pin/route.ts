import { NextRequest, NextResponse } from "next/server";

async function handler(req: NextRequest) {
  try {
    // Lazy-load Redis and QStash to avoid build-time errors when env vars are missing
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const { pinId } = await req.json();

    const raw = await redis.get<string>(`scheduled_pin:${pinId}`);
    if (!raw) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    const pin = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Prefer token stored in pin, fall back to user's connection record
    let accessToken: string = pin.accessToken || "";
    if (!accessToken && pin.email) {
      const connRaw = await redis.get<string>(`pinterest_connection:${pin.email}`);
      const conn = connRaw ? (typeof connRaw === "string" ? JSON.parse(connRaw) : connRaw) as { accessToken?: string } : null;
      accessToken = conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
    }
    if (!accessToken) accessToken = process.env.PINTEREST_ACCESS_TOKEN ?? "";

    if (!accessToken) {
      return NextResponse.json({ error: "No Pinterest access token available" }, { status: 401 });
    }

    const pinterestRes = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: pin.title,
        description: pin.description,
        board_id: pin.boardId,
        link: pin.link || undefined,
        media_source: pin.imageUrl?.startsWith("http")
          ? { source_type: "image_url", url: pin.imageUrl }
          : { source_type: "image_url", url: "https://i.pinimg.com/736x/placeholder.jpg" },
      }),
    });

    const pinterestData = await pinterestRes.json();

    if (!pinterestRes.ok) {
      console.error("Pinterest API error:", pinterestData);
      return NextResponse.json({ error: "Pinterest API failed", details: pinterestData }, { status: 500 });
    }

    await redis.set(
      `published_pin:${pinId}`,
      JSON.stringify({ ...pin, publishedAt: new Date().toISOString(), pinterestPinId: pinterestData.id }),
      { ex: 60 * 60 * 24 * 90 }
    );
    await redis.del(`scheduled_pin:${pinId}`);

    console.log(`Pin published: ${pinId}`, pin.title, "Pinterest ID:", pinterestData.id);
    return NextResponse.json({ success: true, pinId, pinterestPinId: pinterestData.id });
  } catch (err) {
    console.error("publish-pin error:", err);
    return NextResponse.json({ error: "Failed to publish pin" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Verify QStash signature if signing keys are configured
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (currentKey && nextKey) {
    const { verifySignatureAppRouter } = await import("@upstash/qstash/nextjs");
    return verifySignatureAppRouter(handler)(req);
  }

  return handler(req);
}
