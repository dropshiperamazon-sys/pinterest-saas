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

    // If the image is a base64 data URL, upload it to Pinterest media API to get a public URL
    let resolvedImageUrl: string = imageUrl || "";
    if (resolvedImageUrl.startsWith("data:") && accessToken) {
      try {
        const matches = resolvedImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, "base64");

          // Step 1: Register media upload with Pinterest
          const registerRes = await fetch("https://api.pinterest.com/v5/media", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ media_type: "video" }), // Pinterest uses "video" for image uploads via this endpoint
          });

          if (registerRes.ok) {
            const registerData = await registerRes.json();
            const uploadUrl: string = registerData.upload_url;
            const mediaId: string = registerData.media_id;

            if (uploadUrl) {
              // Step 2: Upload the image bytes
              await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": mimeType },
                body: buffer,
              });
              // Use the media_id reference — Pinterest will process it
              resolvedImageUrl = `pinterest-media:${mediaId}`;
            }
          }
        }
      } catch {
        // Non-fatal: keep data URL, cron will skip publishing with a clear error
      }
    }

    const pinId = `pin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const pinData = {
      title,
      description: description || "",
      imageUrl: resolvedImageUrl,
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
