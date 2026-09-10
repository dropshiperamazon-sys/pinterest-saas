// Background AI suggestion expansion — called after CSV import completes.
// Processes all expansion seeds stored by the import route and generates
// AI keyword suggestions without blocking the import response.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  batchUpsertKeywords,
  recordDataGap,
  normalizeKeyword,
  getVerifiedKeywordsByCategory,
  listPendingSuggestions,
  reEstimateAiKeywords,
} from "@/lib/keyword-db";
import { expandKeywords } from "@/lib/keyword-expander";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const AI_COUNTRIES = ["US", "GB", "CA", "AU"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json() as {
    seeds: { keyword: string; category: string | null; subcategory: string | null; country: string; monthlySearches: number | null; avgCpc: number | null }[];
    importedNormalizedKeywords: string[];
  };

  const { seeds, importedNormalizedKeywords } = body;
  if (!Array.isArray(seeds) || seeds.length === 0) {
    return NextResponse.json({ suggestionsGenerated: 0, success: true });
  }

  const importedNormalized = new Set(importedNormalizedKeywords ?? []);

  const uniqueCategories = [...new Set(seeds.map(k => k.category).filter(Boolean) as string[])];
  const historicalRecords = (
    await Promise.all(uniqueCategories.map(cat => getVerifiedKeywordsByCategory(cat, 500)))
  ).flat();

  const existingPending = await listPendingSuggestions(5000);
  const alreadyInDb = new Set(historicalRecords.map(r => r.normalizedKeyword));
  const alreadyPendingNorms = new Set(existingPending.map(kw => normalizeKeyword(kw.keyword)));
  const skipSet = new Set([...importedNormalized, ...alreadyInDb, ...alreadyPendingNorms]);

  const historicalMetrics = historicalRecords.filter(r => r.monthlySearches != null || r.avgCpc != null);
  const suggestions = expandKeywords(seeds, skipSet, historicalMetrics);

  let suggestionsGenerated = 0;

  const expandItems = suggestions.flatMap(s => {
    const hasEstimate = s.estimatedMonthlySearches != null || s.estimatedAvgCpc != null;
    return AI_COUNTRIES.map(country => ({
      keyword: s.keyword, country, language: "en" as const,
      monthlySearches: s.estimatedMonthlySearches ?? null, competition: null as null,
      avgCpc: s.estimatedAvgCpc ?? null, trend: null as null,
      category: s.category, subcategory: s.subcategory,
      source: "AI_INFERRED" as const,
      sourceReference: `expanded from: ${s.basedOn}`,
      confidence: (hasEstimate ? "ESTIMATED" : "UNVERIFIED") as "ESTIMATED" | "UNVERIFIED",
      lastVerifiedAt: null as null, pendingApproval: true,
      _suggestion: s,
    }));
  });

  const expandResults = await batchUpsertKeywords(expandItems).catch(() => [] as never[]);

  const gapFiredFor = new Set<string>();
  for (let i = 0; i < expandItems.length; i++) {
    const item = expandItems[i];
    const result = expandResults[i];
    if (!result) continue;
    if (result.action === "created" || result.action === "updated") {
      suggestionsGenerated++;
      if (result.action === "created" && !gapFiredFor.has(item.keyword)) {
        gapFiredFor.add(item.keyword);
        recordDataGap({ keyword: item.keyword, country: item.country, missingFields: ["monthly_searches", "competition", "avg_cpc"] }).catch(() => {});
      }
    }
  }

  // Re-estimate metrics for all affected categories
  if (uniqueCategories.length > 0) {
    reEstimateAiKeywords(uniqueCategories).catch(() => {});
  }

  return NextResponse.json({ suggestionsGenerated, success: true });
}
