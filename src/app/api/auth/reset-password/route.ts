import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { hashPassword } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Temporary admin password reset — protected by CRON_SECRET
export async function POST(req: NextRequest) {
  const { email, newPassword, secret } = await req.json();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await redis.get<string>(`user:${email}`);
  if (!raw) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = typeof raw === "string" ? JSON.parse(raw) : raw;
  user.passwordHash = await hashPassword(newPassword);
  await redis.set(`user:${email}`, JSON.stringify(user));

  return NextResponse.json({ success: true });
}
