"use client";
import { useEffect, useState } from "react";
import type { Plan, PlanLimits } from "@/lib/plan-limits";

export interface PlanUsage {
  keywordSearchesToday: number;
  aiCreditsThisMonth: number;
  seoChecksThisMonth: number;
  pinSchedulesThisMonth: number;
}

export interface PlanState {
  plan: Plan;
  limits: PlanLimits;
  usage: PlanUsage;
  loading: boolean;
  // Helper booleans
  isFree: boolean;
  isPro: boolean;
  isEnterprise: boolean;
}

const DEFAULT_LIMITS: PlanLimits = {
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
};

export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({
    plan: "free",
    limits: DEFAULT_LIMITS,
    usage: { keywordSearchesToday: 0, aiCreditsThisMonth: 0, seoChecksThisMonth: 0, pinSchedulesThisMonth: 0 },
    loading: true,
    isFree: true,
    isPro: false,
    isEnterprise: false,
  });

  useEffect(() => {
    fetch("/api/plan")
      .then((r) => r.json())
      .then((data) => {
        setState({
          plan: data.plan,
          limits: data.limits,
          usage: data.usage,
          loading: false,
          isFree: data.plan === "free",
          isPro: data.plan === "pro",
          isEnterprise: data.plan === "enterprise",
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  return state;
}
