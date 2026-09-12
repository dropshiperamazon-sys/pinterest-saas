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

  const raw = await redis.get(`user_spacing:${email}`);
  const data = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
  return NextResponse.json({
    pinSpacing: typeof data.pinSpacing === "number" ? data.pinSpacing : 2,
    spacingLocked: typeof data.spacingLocked === "boolean" ? data.spacingLocked : false,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const pinSpacing = typeof body.pinSpacing === "number" ? body.pinSpacing : undefined;
  const spacingLocked = typeof body.spacingLocked === "boolean" ? body.spacingLocked : undefined;

  if (pinSpacing === undefined && spacingLocked === undefined) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const raw = await redis.get(`user_spacing:${email}`);
  const existing = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
  const updated = {
    ...existing,
    ...(pinSpacing !== undefined && { pinSpacing }),
    ...(spacingLocked !== undefined && { spacingLocked }),
  };
  await redis.set(`user_spacing:${email}`, JSON.stringify(updated));
  return NextResponse.json({ success: true, ...updated });
}
