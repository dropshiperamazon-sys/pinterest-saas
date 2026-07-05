import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function handler(req: NextRequest) {
  try {
    const { pinId } = await req.json();

    const raw = await redis.get<string>(`scheduled_pin:${pinId}`);
    if (!raw) {
      return NextResponse.json({ error: "Pin not found" }, { status: 404 });
    }

    const pin = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Use user's OAuth token if available, fall back to env access token
    const accessToken = pin.accessToken || process.env.PINTEREST_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json({ error: "No Pinterest access token available" }, { status: 401 });
    }

    // Publish to Pinterest API
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

    // Mark as published in Redis
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

export const POST = verifySignatureAppRouter(handler);
