import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Called by Vercel Cron every minute: publishes all pins whose scheduledAt has passed.
export async function GET(req: Request) {
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

  const results: { published: number; skipped: number; failed: number; errors: string[] } = {
    published: 0, skipped: 0, failed: 0, errors: [],
  };

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

    // Resolve access token:
    // 1. Stored in pin (new pins)
    // 2. Re-fetch via pin.email (new pins without token — fallback)
    // 3. Derive email from Redis key pattern scheduled_pin:{email}:{pinId}
    let accessToken: string = pin.accessToken || "";

    if (!accessToken) {
      // Try email from pin data first
      let email: string = pin.email || "";

      // If not in pin data, extract from key: scheduled_pin:{email}:{pinId}
      if (!email) {
        const parts = key.split(":");
        // key = "scheduled_pin:user@example.com:pin_xxx"
        if (parts.length >= 3) {
          email = parts.slice(1, parts.length - 1).join(":");
        }
      }

      if (email) {
        const connRaw = await redis.get(`pinterest_connection:${email}`);
        const conn = connRaw
          ? (typeof connRaw === "string" ? JSON.parse(connRaw) : connRaw) as { accessToken?: string }
          : null;
        accessToken = conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
      } else {
        accessToken = process.env.PINTEREST_ACCESS_TOKEN ?? "";
      }
    }

    if (!accessToken) {
      results.errors.push(`No token for ${key}`);
      results.failed++;
      continue;
    }

    // Resolve boardId: use stored boardId, or look up board name via Pinterest API
    let boardId: string = pin.boardId || "";
    if (!boardId && pin.board) {
      try {
        const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=100", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const boardsData = await boardsRes.json();
        const match = (boardsData.items ?? []).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: any) => b.name?.toLowerCase() === pin.board?.toLowerCase()
        );
        boardId = match?.id ?? "";
      } catch { /* non-fatal */ }
    }

    try {
      const body: Record<string, unknown> = {
        title: pin.title,
        description: pin.description || "",
        link: pin.link || undefined,
      };

      if (boardId) body.board_id = boardId;

      // Image: use stored URL if it's a real URL, else placeholder
      const imageUrl = pin.imageUrl?.startsWith("http") ? pin.imageUrl : null;
      body.media_source = imageUrl
        ? { source_type: "image_url", url: imageUrl }
        : { source_type: "image_url", url: "https://i.pinimg.com/736x/2e/12/4e/2e124e26b98ec4e72bbb52db65f8db84.jpg" };

      const pinterestRes = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const pinterestData = await pinterestRes.json();

      if (!pinterestRes.ok) {
        results.errors.push(`Pinterest error for ${key}: ${JSON.stringify(pinterestData)}`);
        results.failed++;
        continue;
      }

      // Move to published
      const publishedKey = key.replace("scheduled_pin:", "published_pin:");
      await redis.set(
        publishedKey,
        JSON.stringify({ ...pin, status: "published", publishedAt: new Date().toISOString(), pinterestPinId: pinterestData.id }),
        { ex: 60 * 60 * 24 * 90 }
      );
      await redis.del(key);
      results.published++;
    } catch (err) {
      results.errors.push(`Exception for ${key}: ${String(err)}`);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...results, checkedAt: new Date().toISOString() });
}
