import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { username?: string };
  const targetUsername = body.username;

  const rawList = await redis.get(`pinterest_connections:${email}`);
  let accounts: { username: string }[] = rawList
    ? (typeof rawList === "string" ? JSON.parse(rawList) : (rawList as { username: string }[]))
    : [];

  if (targetUsername) {
    accounts = accounts.filter((a) => a.username !== targetUsername);
  } else {
    accounts = [];
  }

  if (accounts.length === 0) {
    await Promise.all([
      redis.del(`pinterest_connections:${email}`),
      redis.del(`pinterest_active:${email}`),
      redis.del(`pinterest_connection:${email}`),
    ]);
  } else {
    const activeUsername = await redis.get<string>(`pinterest_active:${email}`);
    const stillActive = accounts.some((a) => a.username === activeUsername);
    await redis.set(`pinterest_connections:${email}`, JSON.stringify(accounts));
    if (!stillActive) {
      await redis.set(`pinterest_active:${email}`, accounts[0].username);
    }
  }

  return NextResponse.json({ success: true });
}
