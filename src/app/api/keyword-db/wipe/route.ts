import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "yes delete everything") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  let deleted = 0;
  let cursor = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "kwdb:*", count: 200 });
    cursor = Number(nextCursor);
    if (keys.length > 0) {
      await redis.del(...(keys as string[]));
      deleted += keys.length;
    }
  } while (cursor !== 0);

  return NextResponse.json({ deleted, success: true });
}
