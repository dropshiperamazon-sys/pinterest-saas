import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to, subject, body, type } = await req.json() as {
    to: string | string[];
    subject: string;
    body: string;
    type: "single" | "broadcast";
  };

  if (!subject || !body) {
    return NextResponse.json({ error: "subject and body required" }, { status: 400 });
  }

  const recipients = Array.isArray(to) ? to : [to];

  // Resend integration
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured (RESEND_API_KEY missing)" }, { status: 500 });
  }

  const fromEmail = process.env.EMAIL_FROM ?? "noreply@rambforce.com";
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const recipient of recipients) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipient,
        subject,
        html: body.replace(/\n/g, "<br>"),
        text: body,
      }),
    });
    if (res.ok) {
      results.push({ email: recipient, success: true });
    } else {
      const err = await res.text();
      results.push({ email: recipient, success: false, error: err.slice(0, 200) });
    }
  }

  const failed = results.filter((r) => !r.success);
  return NextResponse.json({
    sent: results.filter((r) => r.success).length,
    failed: failed.length,
    results,
    type,
  });
}
