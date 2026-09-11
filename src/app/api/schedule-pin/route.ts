import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Redis Set key that tracks all pin IDs for a user — avoids unreliable KEYS scan
const userPinSetKey = (email: string) => `user_pins:${email}`;

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Fetch pin IDs from the user's set (reliable, no KEYS scan)
  const pinIds: string[] = await redis.smembers(userPinSetKey(email));

  if (!pinIds.length) return NextResponse.json({ pins: [] });

  // Fetch each pin — try scheduled key first, then published key
  const pins = (
    await Promise.all(
      pinIds.map(async (pinId) => {
        const raw =
          (await redis.get(`scheduled_pin:${email}:${pinId}`)) ??
          (await redis.get(`published_pin:${email}:${pinId}`));
        if (!raw) {
          // Pin missing from Redis (expired or deleted) — remove from set
          await redis.srem(userPinSetKey(email), pinId);
          return null;
        }
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        const { accessToken: _tok, ...safe } = data as Record<string, unknown>;
        void _tok;
        return { id: pinId, ...safe };
      })
    )
  ).filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pins.sort((a: any, b: any) =>
    new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()
  );

  return NextResponse.json({ pins });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Fetch the stored Pinterest access token for this user
  const connRaw = await redis.get(`pinterest_connection:${email}`);
  const conn = connRaw ? (typeof connRaw === "string" ? JSON.parse(connRaw) : connRaw) as { accessToken?: string } : null;
  const accessToken = conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";

  try {
    const body = await req.json();
    const { title, description, imageUrl, board, boardId, scheduledAt, link, pinType, taggedProducts, altText } = body;

    if (!title || !scheduledAt) {
      return NextResponse.json({ error: "Title and scheduledAt are required" }, { status: 400 });
    }

    const pinId = `pin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let resolvedImageUrl: string = imageUrl || "";
    if (resolvedImageUrl.startsWith("data:")) {
      await redis.set(`pin_image:${pinId}`, resolvedImageUrl, { ex: 60 * 60 * 24 * 90 });
      const appUrl = process.env.NEXTAUTH_URL || "https://pin-saas-5eb4.vercel.app";
      resolvedImageUrl = `${appUrl}/api/pin-image/${pinId}.jpg`;
    }

    const pinData = {
      title,
      description: description || "",
      imageUrl: resolvedImageUrl,
      board: board || "",
      boardId: boardId || "",
      link: link || "",
      pinType: pinType || "",
      taggedProducts: Array.isArray(taggedProducts) ? taggedProducts : [],
      altText: altText || "",
      scheduledAt,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      email,
      accessToken,
    };

    // Save pin data and register its ID in the user's set atomically
    await Promise.all([
      redis.set(`scheduled_pin:${email}:${pinId}`, JSON.stringify(pinData), {
        ex: 60 * 60 * 24 * 90,
      }),
      redis.sadd(userPinSetKey(email), pinId),
    ]);

    // Try QStash (non-fatal if missing)
    const qstashToken = process.env.QSTASH_TOKEN;
    if (qstashToken) {
      try {
        const { Client } = await import("@upstash/qstash");
        const qstash = new Client({ token: qstashToken });
        const delay = Math.max(5, Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000));
        const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        await qstash.publishJSON({
          url: `${appUrl}/api/publish-pin`,
          delay,
          body: { pinId: `${email}:${pinId}` },
        });
      } catch (e) {
        console.error("QStash queue failed (non-fatal):", e);
      }
    }

    return NextResponse.json({ success: true, pinId, pin: { id: pinId, ...pinData } });
  } catch (err) {
    console.error("schedule-pin POST error:", err);
    return NextResponse.json({ error: "Failed to schedule pin" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { pinId, title, description, scheduledAt } = await req.json();
  if (!pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  const scheduledKey = `scheduled_pin:${email}:${pinId}`;
  const publishedKey = `published_pin:${email}:${pinId}`;
  const rawScheduled = await redis.get(scheduledKey);
  const rawPublished = rawScheduled ? null : await redis.get(publishedKey);
  const raw = rawScheduled ?? rawPublished;
  const activeKey = rawScheduled ? scheduledKey : publishedKey;
  if (!raw) return NextResponse.json({ error: "Pin not found" }, { status: 404 });

  const pin = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updated = { ...pin, ...(title !== undefined && { title }), ...(description !== undefined && { description }), ...(scheduledAt !== undefined && { scheduledAt }) };
  await redis.set(activeKey, JSON.stringify(updated), { ex: 60 * 60 * 24 * 90 });
  return NextResponse.json({ success: true, pin: { id: pinId, ...updated } });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { pinId } = await req.json();
  if (!pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  await Promise.all([
    redis.del(`scheduled_pin:${email}:${pinId}`),
    redis.srem(userPinSetKey(email), pinId),
  ]);
  return NextResponse.json({ success: true });
}
