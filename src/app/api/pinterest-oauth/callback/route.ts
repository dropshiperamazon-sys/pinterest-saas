import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL!;

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }

  // Verify state and get the user's email
  const email = await redis.get<string>(`pinterest_oauth_state:${state}`);
  if (!email) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }
  await redis.del(`pinterest_oauth_state:${state}`);

  // Exchange code for access token
  const redirectUri = `${baseUrl}/api/pinterest-oauth/callback`;
  const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }

  const tokenData = await tokenRes.json();

  // Fetch Pinterest user info
  const userRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const pinterestUser = userRes.ok ? await userRes.json() : {};

  // Store Pinterest token in Redis linked to the user's email
  await redis.set(`pinterest_connection:${email}`, JSON.stringify({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    pinterestUsername: pinterestUser.username || "",
    pinterestName: pinterestUser.business_name || pinterestUser.username || "",
    connectedAt: new Date().toISOString(),
  }));

  return NextResponse.redirect(`${baseUrl}/account?pinterest=connected`);
}
