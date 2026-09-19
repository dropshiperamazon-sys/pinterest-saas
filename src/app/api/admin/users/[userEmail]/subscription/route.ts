import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userEmail: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userEmail } = await params;
  const targetEmail = decodeURIComponent(userEmail);
  const body = await req.json() as Record<string, unknown>;

  const raw = await redis.get(`user:${targetEmail}`);
  if (!raw) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const user = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);

  // Allowed fields to update
  const allowed = [
    "plan", "subscriptionStatus", "subscriptionStartDate", "subscriptionEndDate",
    "trialStartDate", "trialEndDate", "trialStatus",
  ];
  for (const key of allowed) {
    if (key in body) {
      (user as Record<string, unknown>)[key] = body[key];
    }
  }

  await redis.set(`user:${targetEmail}`, JSON.stringify(user));
  return NextResponse.json({ success: true });
}
