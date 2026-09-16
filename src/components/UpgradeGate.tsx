"use client";
import Link from "next/link";
import { Lock, Zap, Crown, Building2 } from "lucide-react";
import type { Plan } from "@/lib/plan-limits";

interface Props {
  requiredPlan: Plan;
  feature: string;
  children?: React.ReactNode;
  /** If true, renders a blur overlay over children instead of replacing them */
  overlay?: boolean;
  compact?: boolean;
}

const PLAN_META: Record<Plan, { label: string; icon: typeof Zap; color: string; bgColor: string }> = {
  free: { label: "Free", icon: Zap, color: "text-gray-600", bgColor: "bg-gray-50" },
  pro: { label: "Pro", icon: Crown, color: "text-violet-600", bgColor: "bg-violet-50" },
  enterprise: { label: "Enterprise", icon: Building2, color: "text-amber-600", bgColor: "bg-amber-50" },
};

export default function UpgradeGate({ requiredPlan, feature, children, overlay = false, compact = false }: Props) {
  const meta = PLAN_META[requiredPlan];
  const Icon = meta.icon;

  const gate = compact ? (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
      <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-sm text-gray-500 flex-1">{feature} requires {meta.label}</span>
      <Link
        href="/pricing"
        className="text-xs font-semibold text-[#e60023] hover:underline whitespace-nowrap"
      >
        Upgrade →
      </Link>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${meta.bgColor}`}>
        <Icon className={`w-7 h-7 ${meta.color}`} />
      </div>
      <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
        <Lock className="w-3 h-3" />
        {meta.label} Feature
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{feature}</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">
        Unlock {feature} and more powerful tools by upgrading to {meta.label}.
      </p>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#c0001e] transition-colors"
      >
        <Zap className="w-4 h-4" />
        Upgrade to {meta.label}
      </Link>
      <Link href="/pricing" className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
        See all plans →
      </Link>
    </div>
  );

  if (!overlay || !children) return gate;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-40">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-6">{gate}</div>
    </div>
  );
}

// Inline usage badge — show inside keyword results etc.
export function PlanBadge({ plan }: { plan: Plan }) {
  const meta = PLAN_META[plan];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}
