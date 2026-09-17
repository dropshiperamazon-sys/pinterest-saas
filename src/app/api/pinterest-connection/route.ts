import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import { getUserLimits } from "@/lib/plan-limits";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface PinterestAccount {
  username: string;
  pinterestName: string;
  accessToken: string;
  refreshToken: string | null;
  connectedAt: string;
  grantedScopes: string[];
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ connected: false });

  const [rawList, activeUsername] = await Promise.all([
    redis.get(`pinterest_connections:${email}`),
    redis.get<string>(`pinterest_active:${email}`),
  ]);

  const accounts: PinterestAccount[] = rawList
    ? (typeof rawList === "string" ? JSON.parse(rawList) : (rawList as PinterestAccount[]))
    : [];

  // Migrate legacy single-connection key
  if (accounts.length === 0) {
    const legacy = await redis.get(`pinterest_connection:${email}`);
    if (legacy) {
      const d = typeof legacy === "string" ? JSON.parse(legacy) : (legacy as PinterestAccount);
      accounts.push(d as PinterestAccount);
      await Promise.all([
        redis.set(`pinterest_connections:${email}`, JSON.stringify(accounts)),
        redis.set(`pinterest_active:${email}`, (d as PinterestAccount).username || ""),
        redis.del(`pinterest_connection:${email}`),
      ]);
    }
  }

  if (accounts.length === 0) {
    const planLimitsEmpty = await getUserLimits(email);
    return NextResponse.json({ connected: false, accounts: [], plan: planLimitsEmpty.plan });
  }

  const active = accounts.find((a) => a.username === activeUsername) ?? accounts[0];
  const planLimits = await getUserLimits(email);

  return NextResponse.json({
    connected: true,
    accounts: accounts.map(({ accessToken: _, refreshToken: __, ...safe }) => safe),
    activeUsername: active.username,
    pinterestUsername: active.username,
    pinterestName: active.pinterestName,
    grantedScopes: active.grantedScopes,
    hasAds: active.grantedScopes?.includes("ads:read"),
    hasCatalog: active.grantedScopes?.includes("catalogs:read"),
    canAddMore: accounts.length < planLimits.maxPinterestAccounts,
    plan: planLimits.plan,
  });
}
