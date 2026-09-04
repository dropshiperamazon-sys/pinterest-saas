import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [scheduledKeys, publishedKeys] = await Promise.all([
    redis.keys(`scheduled_pin:${email}:*`),
    redis.keys(`published_pin:${email}:*`),
  ]);
  const allKeys = [...scheduledKeys, ...publishedKeys];
  if (!allKeys.length) return NextResponse.json({ pins: [] });

  const pins = await Promise.all(
    allKeys.map(async (key) => {
      const raw = await redis.get(key);
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      const pinId = key.replace(`scheduled_pin:${email}:`, "").replace(`published_pin:${email}:`, "");
      // strip accessToken before sending to client
      const { accessToken: _tok, ...safe } = (data as Record<string, unknown>);
      void _tok;
      return { id: pinId, ...safe };
    })
  );

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
    const { title, description, imageUrl, board, boardId, scheduledAt, link, pinType } = body;

    if (!title || !scheduledAt) {
      return NextResponse.json({ error: "Title and scheduledAt are required" }, { status: 400 });
    }

    const pinId = `pin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const pinData = {
      title,
      description: description || "",
      imageUrl: imageUrl || "",
      board: board || "",
      boardId: boardId || "",
      link: link || "",
      pinType: pinType || "",
      scheduledAt,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      email,
      accessToken, // stored so publish-pin can use it without re-fetching
    };

    await redis.set(`scheduled_pin:${email}:${pinId}`, JSON.stringify(pinData), {
      ex: 60 * 60 * 24 * 90,
    });

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

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { pinId } = await req.json();
  if (!pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  await redis.del(`scheduled_pin:${email}:${pinId}`);
  return NextResponse.json({ success: true });
}
