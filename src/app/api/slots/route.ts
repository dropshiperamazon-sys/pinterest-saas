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

  const raw = await redis.get(`user_slots:${email}`);
  const slots = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { slots } = await req.json();
  if (!Array.isArray(slots)) return NextResponse.json({ error: "slots must be an array" }, { status: 400 });

  await redis.set(`user_slots:${email}`, JSON.stringify(slots));
  return NextResponse.json({ success: true });
}
