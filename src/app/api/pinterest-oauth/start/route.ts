import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL!;

  // Get session token from cookie to identify the user
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("authjs.session-token")?.value ||
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("next-auth.session-token")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const state = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  // Store session token so we can look up the user on callback
  await redis.set(`pinterest_oauth_state:${state}`, sessionToken, { ex: 600 });

  const redirectUri = `${baseUrl}/api/pinterest-oauth/callback`;
  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id", process.env.PINTEREST_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "boards:read,boards:write,pins:read,pins:write,user_accounts:read");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
