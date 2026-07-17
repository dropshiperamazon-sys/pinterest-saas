import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { hashPassword } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await redis.get(`user:${email}`);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = {
      id: `user_${Date.now()}`,
      name,
      email,
      passwordHash,
      plan: "free",
      createdAt: new Date().toISOString(),
    };

    await redis.set(`user:${email}`, JSON.stringify(user));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
