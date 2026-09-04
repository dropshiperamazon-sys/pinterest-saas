import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Called by Vercel Cron every minute: publishes all pins whose scheduledAt has passed.
export async function GET(req: Request) {
  // Protect with a shared secret so only cron can call it
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = Date.now();

  // Scan all scheduled pins across all users
  let cursor = 0;
  const allKeys: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "scheduled_pin:*", count: 100 });
    cursor = Number(nextCursor);
    allKeys.push(...keys);
  } while (cursor !== 0);

  const results = { published: 0, skipped: 0, failed: 0 };

  for (const key of allKeys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pin: any = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Skip if not yet due
    if (!pin.scheduledAt || new Date(pin.scheduledAt).getTime() > now) {
      results.skipped++;
      continue;
    }

    // Resolve access token: stored in pin, or re-fetch from connection
    let accessToken: string = pin.accessToken || "";
    if (!accessToken && pin.email) {
      const connRaw = await redis.get(`pinterest_connection:${pin.email}`);
      const conn = connRaw ? (typeof connRaw === "string" ? JSON.parse(connRaw) : connRaw) as { accessToken?: string } : null;
      accessToken = conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
    }

    if (!accessToken) {
      console.error(`No access token for pin ${key}`);
      results.failed++;
      continue;
    }

    try {
      const pinterestRes = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: pin.title,
          description: pin.description || "",
          board_id: pin.boardId || undefined,
          link: pin.link || undefined,
          media_source: pin.imageUrl?.startsWith("http")
            ? { source_type: "image_url", url: pin.imageUrl }
            : { source_type: "image_url", url: "https://i.pinimg.com/736x/placeholder.jpg" },
        }),
      });

      const pinterestData = await pinterestRes.json();

      if (!pinterestRes.ok) {
        console.error(`Pinterest publish failed for ${key}:`, pinterestData);
        results.failed++;
        continue;
      }

      // Mark as published
      await redis.set(key.replace("scheduled_pin:", "published_pin:"),
        JSON.stringify({ ...pin, status: "published", publishedAt: new Date().toISOString(), pinterestPinId: pinterestData.id }),
        { ex: 60 * 60 * 24 * 90 }
      );
      await redis.del(key);
      results.published++;
    } catch (err) {
      console.error(`Failed to publish ${key}:`, err);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...results, checkedAt: new Date().toISOString() });
}
