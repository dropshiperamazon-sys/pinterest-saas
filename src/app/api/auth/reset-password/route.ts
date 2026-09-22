import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { hashPassword } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    console.log(`[reset-password] Looking up token: ${token?.substring(0, 8)}...`);
    const email = await redis.get<string>(`reset:${token}`);
    if (!email) {
      console.error(`[reset-password] Token not found or expired`);
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }
    console.log(`[reset-password] Resetting password for: ${email}`);

    const raw = await redis.get<string>(`user:${email}`);
    if (!raw) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const user = typeof raw === "string" ? JSON.parse(raw) : raw;
    user.passwordHash = await hashPassword(newPassword);
    await redis.set(`user:${email}`, JSON.stringify(user));
    await redis.del(`reset:${token}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
