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

    // TODO: Replace with real Pinterest API call once OAuth is set up
    // const pinterestRes = await fetch("https://api.pinterest.com/v5/pins", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${userAccessToken}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     title: pin.title,
    //     description: pin.description,
    //     board_id: pin.boardId,
    //     media_source: { source_type: "image_url", url: pin.imageUrl },
    //   }),
    // });

    // Mark as published in Redis
    await redis.set(`published_pin:${pinId}`, JSON.stringify({ ...pin, publishedAt: new Date().toISOString() }), { ex: 60 * 60 * 24 * 90 });
    await redis.del(`scheduled_pin:${pinId}`);

    console.log(`Pin published: ${pinId}`, pin.title);
    return NextResponse.json({ success: true, pinId });
  } catch (err) {
    console.error("publish-pin error:", err);
    return NextResponse.json({ error: "Failed to publish pin" }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
