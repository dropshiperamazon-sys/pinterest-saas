import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Free tier: 10 searches per day. Reset at UTC midnight.
const FREE_DAILY_LIMIT = 10;

function todayKey(email: string) {
  const d = new Date();
  const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return `search_count:${email}:${day}`;
}

// GET — return current count and limit
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const key = todayKey(email);
  const count = (await redis.get<number>(key)) ?? 0;
  return NextResponse.json({ count, limit: FREE_DAILY_LIMIT, remaining: Math.max(0, FREE_DAILY_LIMIT - count) });
}

// POST — increment count, return whether search is allowed
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const key = todayKey(email);
  const count = (await redis.get<number>(key)) ?? 0;

  if (count >= FREE_DAILY_LIMIT) {
    return NextResponse.json({ allowed: false, count, limit: FREE_DAILY_LIMIT, remaining: 0 });
  }

  // Increment, set TTL to 48h so it expires after the day rolls over
  await redis.incr(key);
  await redis.expire(key, 172800);

  const newCount = count + 1;
  return NextResponse.json({ allowed: true, count: newCount, limit: FREE_DAILY_LIMIT, remaining: FREE_DAILY_LIMIT - newCount });
}
