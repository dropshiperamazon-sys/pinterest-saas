import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const MAX_ACCOUNTS = 3;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const baseUrl = process.env.NEXTAUTH_URL!;

  if (searchParams.get("error") || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }

  const storedValue = await redis.get<string>(`pinterest_oauth_state:${state}`);
  if (!storedValue) {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }
  await redis.del(`pinterest_oauth_state:${state}`);

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.redirect(`${baseUrl}/login`);

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
    console.error("Pinterest token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${baseUrl}/account?pinterest=error`);
  }

  const tokenData = await tokenRes.json() as Record<string, string>;
  const grantedScopes: string[] = tokenData.scope
    ? String(tokenData.scope).split(/[\s,]+/).filter(Boolean)
    : [];
  console.log("Pinterest OAuth: granted scopes:", grantedScopes);

  // Fetch Pinterest user info
  const userRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const pinterestUser = userRes.ok ? await userRes.json() as Record<string, string> : {};

  const newAccount = {
    username: pinterestUser.username || `account_${Date.now()}`,
    pinterestName: pinterestUser.business_name || pinterestUser.username || "",
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    connectedAt: new Date().toISOString(),
    grantedScopes,
  };

  // Load existing accounts
  const rawList = await redis.get(`pinterest_connections:${email}`);
  let accounts: typeof newAccount[] = rawList
    ? (typeof rawList === "string" ? JSON.parse(rawList) : (rawList as typeof newAccount[]))
    : [];

  // Migrate legacy key
  if (accounts.length === 0) {
    const legacy = await redis.get(`pinterest_connection:${email}`);
    if (legacy) {
      const d = typeof legacy === "string" ? JSON.parse(legacy) : legacy;
      accounts.push(d as typeof newAccount);
      await redis.del(`pinterest_connection:${email}`);
    }
  }

  // Update if same username already connected, otherwise append (up to MAX_ACCOUNTS)
  const existingIdx = accounts.findIndex((a) => a.username === newAccount.username);
  if (existingIdx >= 0) {
    accounts[existingIdx] = newAccount;
  } else if (accounts.length < MAX_ACCOUNTS) {
    accounts.push(newAccount);
  } else {
    return NextResponse.redirect(`${baseUrl}/account?pinterest=limit`);
  }

  await Promise.all([
    redis.set(`pinterest_connections:${email}`, JSON.stringify(accounts)),
    redis.set(`pinterest_active:${email}`, newAccount.username),
  ]);

  return NextResponse.redirect(`${baseUrl}/account?pinterest=connected`);
}
