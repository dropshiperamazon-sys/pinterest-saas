import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const email = await redis.get<string>(`verify:${token}`);
    if (!email) return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 });

    const raw = await redis.get<string>(`user:${email}`);
    if (!raw) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const user = typeof raw === "string" ? JSON.parse(raw) : raw;
    user.emailVerified = true;
    await redis.set(`user:${email}`, JSON.stringify(user));
    await redis.del(`verify:${token}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Verify email error:", err);
    return NextResponse.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
