import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ connected: false });
  }

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (raw) {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ connected: true, ...data });
  }

  return NextResponse.json({ connected: false });
}
