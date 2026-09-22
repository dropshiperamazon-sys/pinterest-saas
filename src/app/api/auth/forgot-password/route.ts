import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    console.log(`[forgot-password] Received request for email: ${email}`);
    const user = await redis.get(`user:${email}`);
    console.log(`[forgot-password] User found in Redis: ${!!user}`);
    // Always return success to prevent email enumeration
    if (!user) return NextResponse.json({ success: true });

    const token = crypto.randomUUID();
    await redis.set(`reset:${token}`, email, { ex: 3600 }); // expires in 1 hour

    const baseUrl = process.env.NEXTAUTH_URL ?? "https://pinterest-saas-production.up.railway.app";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    console.log(`[forgot-password] Sending reset email to ${email}, resetUrl: ${resetUrl}`);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "noreply@rambforce.com",
      to: email,
      subject: "Reset your Rambforce password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <img src="${baseUrl}/rambforce-logo.png" alt="Rambforce" style="height:40px;margin-bottom:24px;" />
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px;">Reset your password</h2>
          <p style="color:#555;font-size:14px;margin-bottom:24px;">Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#e60023;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none;">Reset password</a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    console.log(`[forgot-password] Email sent successfully to ${email}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
