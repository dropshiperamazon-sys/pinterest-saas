import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const baseUrl = process.env.NEXTAUTH_URL!;

  if (searchParams.get("error") || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }

  // Verify state exists
  const storedValue = await redis.get<string>(`pinterest_oauth_state:${state}`);
  if (!storedValue) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }
  await redis.del(`pinterest_oauth_state:${state}`);

  // Get current user session to get their email
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Exchange code for access token
  const redirectUri = `${baseUrl}/api/pinterest-oauth/callback`;
  const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("Pinterest token exchange failed:", err);
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }

  const tokenData = await tokenRes.json();

  // Fetch Pinterest user info
  const userRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const pinterestUser = userRes.ok ? await userRes.json() : {};

  // Log granted scopes server-side for debugging (never log the tokens themselves)
  const grantedScopes: string[] = tokenData.scope
    ? String(tokenData.scope).split(/[\s,]+/).filter(Boolean)
    : [];
  console.log("Pinterest OAuth: granted scopes:", grantedScopes);

  // Store Pinterest token linked to the user's email (update-in-place, no duplicate)
  await redis.set(`pinterest_connection:${email}`, JSON.stringify({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    pinterestUsername: pinterestUser.username || "",
    pinterestName: pinterestUser.business_name || pinterestUser.username || "",
    connectedAt: new Date().toISOString(),
    grantedScopes,
  }));

  return NextResponse.redirect(`${baseUrl}/account?pinterest=connected`);
}
