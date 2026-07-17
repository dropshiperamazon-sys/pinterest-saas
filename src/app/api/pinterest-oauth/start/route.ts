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
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  // Store the user's email in a short-lived state token
  const state = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await redis.set(`pinterest_oauth_state:${state}`, session.user.email, { ex: 600 });

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/pinterest-oauth/callback`;
  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id", process.env.PINTEREST_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "boards:read,boards:write,pins:read,pins:write,user_accounts:read");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
