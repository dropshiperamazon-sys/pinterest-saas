import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ connected: false });
  }

  // Check OAuth session token first (Pinterest login)
  const sessionToken = (session as { accessToken?: string }).accessToken;
  if (sessionToken) {
    return NextResponse.json({
      connected: true,
      accessToken: sessionToken,
      pinterestName: session.user.name,
      pinterestUsername: session.user.name,
    });
  }

  // Check manually linked Pinterest account
  const connection = await redis.get<string>(`pinterest_connection:${session.user.email}`);
  if (connection) {
    const data = typeof connection === "string" ? JSON.parse(connection) : connection;
    return NextResponse.json({ connected: true, ...data });
  }

  return NextResponse.json({ connected: false });
}
