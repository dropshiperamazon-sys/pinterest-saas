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

  const { username } = await req.json() as { username: string };
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const rawList = await redis.get(`pinterest_connections:${email}`);
  const accounts: { username: string }[] = rawList
    ? (typeof rawList === "string" ? JSON.parse(rawList) : (rawList as { username: string }[]))
    : [];

  if (!accounts.some((a) => a.username === username)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await redis.set(`pinterest_active:${email}`, username);
  return NextResponse.json({ success: true, activeUsername: username });
}
