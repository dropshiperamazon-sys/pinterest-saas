import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Plan definitions ──────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "enterprise";

export interface PlanLimits {
  plan: Plan;
  pinSchedulesPerMonth: number;   // -1 = unlimited
  keywordSearchesPerDay: number;  // -1 = unlimited
  aiCreditsPerMonth: number;      // -1 = unlimited
  seoChecksPerMonth: number;      // -1 = unlimited
  maxPinterestAccounts: number;
  maxKeywordResults: number;      // -1 = unlimited
  // Feature flags
  canTrackKeywords: boolean;
  canSeoAudit: boolean;
  canKeywordExtractor: boolean;
  canAccountAudit: boolean;
  canAnalytics: boolean;
  canAds: boolean;
  canCatalog: boolean;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    plan: "free",
    pinSchedulesPerMonth: 10,
    keywordSearchesPerDay: 3,
    aiCreditsPerMonth: 5,
    seoChecksPerMonth: 5,
    maxPinterestAccounts: 1,
    maxKeywordResults: 15,
    canTrackKeywords: false,
    canSeoAudit: false,
    canKeywordExtractor: false,
    canAccountAudit: false,
    canAnalytics: false,
    canAds: false,
    canCatalog: false,
  },
  pro: {
    plan: "pro",
    pinSchedulesPerMonth: 1000,
    keywordSearchesPerDay: -1,
    aiCreditsPerMonth: 200,
    seoChecksPerMonth: -1,
    maxPinterestAccounts: 2,
    maxKeywordResults: -1,
    canTrackKeywords: true,
    canSeoAudit: true,
    canKeywordExtractor: true,
    canAccountAudit: true,
    canAnalytics: true,
    canAds: false,
    canCatalog: false,
  },
  enterprise: {
    plan: "enterprise",
    pinSchedulesPerMonth: 2000,
    keywordSearchesPerDay: -1,
    aiCreditsPerMonth: 500,
    seoChecksPerMonth: -1,
    maxPinterestAccounts: 3,
    maxKeywordResults: -1,
    canTrackKeywords: true,
    canSeoAudit: true,
    canKeywordExtractor: true,
    canAccountAudit: true,
    canAnalytics: true,
    canAds: true,
    canCatalog: true,
  },
};

export function getLimitsForPlan(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

// ── User plan resolution ──────────────────────────────────────────────────────

interface UserRecord {
  plan?: Plan;
  subscriptionStatus?: string;
  trialStatus?: string;
  trialEndDate?: string;
  subscriptionEndDate?: string;
}

export async function getUserPlan(email: string): Promise<Plan> {
  const raw = await redis.get<string>(`user:${email}`);
  if (!raw) return "free";
  const user: UserRecord = typeof raw === "string" ? JSON.parse(raw) : raw;

  // Active trial counts as the plan it was granted for (stored as plan field)
  if (user.trialStatus === "active" && user.trialEndDate) {
    if (new Date(user.trialEndDate) > new Date()) {
      return (user.plan as Plan) ?? "free";
    }
  }

  // Active subscription
  if (
    user.subscriptionStatus === "active" &&
    user.plan &&
    user.plan !== "free"
  ) {
    // Check end date if present
    if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date()) {
      return "free";
    }
    return user.plan as Plan;
  }

  return (user.plan as Plan) ?? "free";
}

export async function getUserLimits(email: string): Promise<PlanLimits> {
  const plan = await getUserPlan(email);
  return getLimitsForPlan(plan);
}

// ── Usage counters ────────────────────────────────────────────────────────────

function utcDay(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function utcMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Keyword searches
export async function getKeywordSearchCount(email: string): Promise<number> {
  return (await redis.get<number>(`search_count:${email}:${utcDay()}`)) ?? 0;
}

export async function incrementKeywordSearch(email: string): Promise<number> {
  const key = `search_count:${email}:${utcDay()}`;
  const n = await redis.incr(key);
  await redis.expire(key, 172800); // 48h TTL
  return n;
}

// AI writing credits
export async function getAiCreditCount(email: string): Promise<number> {
  return (await redis.get<number>(`ai_credits:${email}:${utcMonth()}`)) ?? 0;
}

export async function incrementAiCredit(email: string): Promise<number> {
  const key = `ai_credits:${email}:${utcMonth()}`;
  const n = await redis.incr(key);
  await redis.expire(key, 60 * 60 * 24 * 35); // ~35 days
  return n;
}

// SEO checks
export async function getSeoCheckCount(email: string): Promise<number> {
  return (await redis.get<number>(`seo_checks:${email}:${utcMonth()}`)) ?? 0;
}

export async function incrementSeoCheck(email: string): Promise<number> {
  const key = `seo_checks:${email}:${utcMonth()}`;
  const n = await redis.incr(key);
  await redis.expire(key, 60 * 60 * 24 * 35);
  return n;
}

// Pin schedules — count from the user_pins set (scheduled only)
export async function getScheduledPinCount(email: string): Promise<number> {
  const month = utcMonth();
  return (await redis.get<number>(`pins_scheduled:${email}:${month}`)) ?? 0;
}

export async function incrementScheduledPin(email: string): Promise<void> {
  const key = `pins_scheduled:${email}:${utcMonth()}`;
  await redis.incr(key);
  await redis.expire(key, 60 * 60 * 24 * 35);
}

// ── Guard helpers (used in API routes) ───────────────────────────────────────

export interface GuardResult {
  allowed: boolean;
  error?: string;
  upgradeRequired?: Plan;
  count?: number;
  limit?: number;
}

export async function guardFeature(
  email: string,
  feature: keyof Pick<
    PlanLimits,
    | "canTrackKeywords"
    | "canSeoAudit"
    | "canKeywordExtractor"
    | "canAccountAudit"
    | "canAnalytics"
    | "canAds"
    | "canCatalog"
  >
): Promise<GuardResult> {
  const limits = await getUserLimits(email);
  if (!limits[feature]) {
    const requiredPlan = feature === "canAds" || feature === "canCatalog" ? "enterprise" : "pro";
    return {
      allowed: false,
      error: `This feature requires a ${requiredPlan === "enterprise" ? "Enterprise" : "Pro"} plan.`,
      upgradeRequired: requiredPlan,
    };
  }
  return { allowed: true };
}

export async function guardKeywordSearch(email: string): Promise<GuardResult> {
  const limits = await getUserLimits(email);
  if (limits.keywordSearchesPerDay === -1) return { allowed: true };
  const count = await getKeywordSearchCount(email);
  if (count >= limits.keywordSearchesPerDay) {
    return {
      allowed: false,
      error: `You've used all ${limits.keywordSearchesPerDay} keyword searches for today. Upgrade to Pro for unlimited searches.`,
      upgradeRequired: "pro",
      count,
      limit: limits.keywordSearchesPerDay,
    };
  }
  return { allowed: true, count, limit: limits.keywordSearchesPerDay };
}

export async function guardPinSchedule(email: string): Promise<GuardResult> {
  const limits = await getUserLimits(email);
  const count = await getScheduledPinCount(email);
  if (count >= limits.pinSchedulesPerMonth) {
    return {
      allowed: false,
      error: `You've reached your ${limits.pinSchedulesPerMonth} pin schedule limit for this month.`,
      upgradeRequired: limits.plan === "free" ? "pro" : "enterprise",
      count,
      limit: limits.pinSchedulesPerMonth,
    };
  }
  return { allowed: true, count, limit: limits.pinSchedulesPerMonth };
}

export async function guardAiCredit(email: string): Promise<GuardResult> {
  const limits = await getUserLimits(email);
  if (limits.aiCreditsPerMonth === -1) return { allowed: true };
  const count = await getAiCreditCount(email);
  if (count >= limits.aiCreditsPerMonth) {
    return {
      allowed: false,
      error: `You've used all ${limits.aiCreditsPerMonth} AI writing credits for this month.`,
      upgradeRequired: limits.plan === "free" ? "pro" : "enterprise",
      count,
      limit: limits.aiCreditsPerMonth,
    };
  }
  return { allowed: true, count, limit: limits.aiCreditsPerMonth };
}

export async function guardSeoCheck(email: string): Promise<GuardResult> {
  const limits = await getUserLimits(email);
  if (limits.seoChecksPerMonth === -1) return { allowed: true };
  const count = await getSeoCheckCount(email);
  if (count >= limits.seoChecksPerMonth) {
    return {
      allowed: false,
      error: `You've used all ${limits.seoChecksPerMonth} SEO checks for this month. Upgrade to Pro for unlimited checks.`,
      upgradeRequired: "pro",
      count,
      limit: limits.seoChecksPerMonth,
    };
  }
  return { allowed: true, count, limit: limits.seoChecksPerMonth };
}
