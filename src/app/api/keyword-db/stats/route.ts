import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PENDING_IDX = "kwdb:pending:idx";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [totalAll, totalPending, importCount] = await Promise.all([
    redis.zcard("kwdb:idx:all"),
    redis.zcard(PENDING_IDX),
    redis.zcard("kwdb:import:idx"),
  ]);

  const totalVerified = (totalAll as number) - (totalPending as number);

  return NextResponse.json({
    totalKeywords: totalAll,
    verifiedKeywords: totalVerified,
    aiSuggestions: totalPending,
    importCount,
  });
}
