import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { hashPassword } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

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
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };

    await redis.set(`user:${email}`, JSON.stringify(user));

    // Send verification email
    const token = crypto.randomUUID();
    await redis.set(`verify:${token}`, email, { ex: 86400 }); // 24hr TTL

    const baseUrl = process.env.NEXTAUTH_URL ?? "https://app.rambforce.com";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "noreply@app.rambforce.com",
      to: email,
      subject: "Verify your Rambforce App email",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <img src="${baseUrl}/rambforce-logo.png" alt="Rambforce" style="height:80px;width:auto;margin-bottom:24px;display:block;" />
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">Verify your email address</h2>
          <p style="color:#555;font-size:14px;margin-bottom:8px;">Hi ${name}, welcome to Rambforce!</p>
          <p style="color:#555;font-size:14px;margin-bottom:24px;">Click the button below to verify your email and activate your account. This link expires in 24 hours.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#e60023;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">Verify email</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">If you didn't create a Rambforce account, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
