import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, imageUrl, boardId, scheduledAt, userId } = body;

    if (!title || !imageUrl || !boardId || !scheduledAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const pinData = { title, description, imageUrl, boardId, userId, scheduledAt };
    const pinId = `pin_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Store pin data in Redis
    await redis.set(`scheduled_pin:${pinId}`, JSON.stringify(pinData), { ex: 60 * 60 * 24 * 30 });

    // Calculate delay in seconds
    const delay = Math.max(0, Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000));

    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Queue the publish job with QStash
    await qstash.publishJSON({
      url: `${appUrl}/api/publish-pin`,
      delay,
      body: { pinId },
    });

    return NextResponse.json({ success: true, pinId, scheduledAt });
  } catch (err) {
    console.error("schedule-pin error:", err);
    return NextResponse.json({ error: "Failed to schedule pin" }, { status: 500 });
  }
}
