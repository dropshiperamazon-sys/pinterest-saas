import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserLimits,
  getKeywordSearchCount,
  incrementKeywordSearch,
  guardKeywordSearch,
} from "@/lib/plan-limits";

// GET — return current count and limit for this user's plan
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [limits, count] = await Promise.all([getUserLimits(email), getKeywordSearchCount(email)]);
  const limit = limits.keywordSearchesPerDay;
  const unlimited = limit === -1;

  return NextResponse.json({
    count,
    limit: unlimited ? null : limit,
    remaining: unlimited ? null : Math.max(0, limit - count),
    unlimited,
    plan: limits.plan,
  });
}

// POST — check allowance and increment counter
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const guard = await guardKeywordSearch(email);
  if (!guard.allowed) {
    return NextResponse.json({
      allowed: false,
      error: guard.error,
      upgradeRequired: guard.upgradeRequired,
      count: guard.count,
      limit: guard.limit,
    });
  }

  const newCount = await incrementKeywordSearch(email);
  const limits = await getUserLimits(email);
  const limit = limits.keywordSearchesPerDay;
  const unlimited = limit === -1;

  return NextResponse.json({
    allowed: true,
    count: newCount,
    limit: unlimited ? null : limit,
    remaining: unlimited ? null : Math.max(0, limit - newCount),
    unlimited,
  });
}
