import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getUserPlan,
  getLimitsForPlan,
  getKeywordSearchCount,
  getAiCreditCount,
  getSeoCheckCount,
  getScheduledPinCount,
} from "@/lib/plan-limits";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [plan, kwCount, aiCount, seoCount, pinCount] = await Promise.all([
    getUserPlan(email),
    getKeywordSearchCount(email),
    getAiCreditCount(email),
    getSeoCheckCount(email),
    getScheduledPinCount(email),
  ]);

  const limits = getLimitsForPlan(plan);

  return NextResponse.json({
    plan,
    limits,
    usage: {
      keywordSearchesToday: kwCount,
      aiCreditsThisMonth: aiCount,
      seoChecksThisMonth: seoCount,
      pinSchedulesThisMonth: pinCount,
    },
  });
}
