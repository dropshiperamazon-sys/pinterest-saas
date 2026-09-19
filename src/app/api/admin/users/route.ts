import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Scan all user keys
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, { match: "user:*", count: 100 });
    keys.push(...batch.filter((k) => !k.includes(":"  + "connection") && k.split(":").length === 2));
    cursor = Number(nextCursor);
  } while (cursor !== 0);

  const users = await Promise.all(
    keys.map(async (key) => {
      const raw = await redis.get(key);
      if (!raw) return null;
      const u = typeof raw === "string" ? JSON.parse(raw) : raw;
      // Strip password hash
      const { passwordHash: _, ...safe } = u as Record<string, unknown> & { passwordHash?: string };
      return safe;
    })
  );

  return NextResponse.json({ users: users.filter(Boolean) });
}
