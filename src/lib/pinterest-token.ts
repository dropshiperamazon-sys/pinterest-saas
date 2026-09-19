import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface PinterestAccount {
  username: string;
  pinterestName: string;
  accessToken: string;
  refreshToken: string | null;
  connectedAt: string;
  grantedScopes: string[];
}

async function getActiveAccount(email: string): Promise<PinterestAccount | null> {
  const [rawList, activeUsername] = await Promise.all([
    redis.get(`pinterest_connections:${email}`),
    redis.get<string>(`pinterest_active:${email}`),
  ]);

  let accounts: PinterestAccount[] = rawList
    ? (typeof rawList === "string" ? JSON.parse(rawList) : (rawList as PinterestAccount[]))
    : [];

  // Migrate legacy single-connection key
  if (accounts.length === 0) {
    const legacy = await redis.get(`pinterest_connection:${email}`);
    if (legacy) {
      const d = typeof legacy === "string" ? JSON.parse(legacy) : (legacy as PinterestAccount);
      accounts = [d];
      await Promise.all([
        redis.set(`pinterest_connections:${email}`, JSON.stringify(accounts)),
        redis.set(`pinterest_active:${email}`, d.username || ""),
        redis.del(`pinterest_connection:${email}`),
      ]);
    }
  }

  if (accounts.length === 0) return null;
  return accounts.find((a) => a.username === activeUsername) ?? accounts[0];
}

/**
 * Returns the access token for the user's active Pinterest account.
 * Handles migration from the legacy single-connection key.
 */
export async function getActivePinterestToken(email: string): Promise<string | null> {
  const account = await getActiveAccount(email);
  return account?.accessToken ?? null;
}

/**
 * Returns the full active Pinterest account object (token + scopes + username).
 */
export async function getActivePinterestAccount(email: string): Promise<PinterestAccount | null> {
  return getActiveAccount(email);
}
