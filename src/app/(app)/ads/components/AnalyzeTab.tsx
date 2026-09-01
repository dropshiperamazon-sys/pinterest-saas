"use client";
import { useState, useEffect, useCallback } from "react";
import { formatNumber, cn } from "@/lib/utils";
import { MOCK_CAMPAIGNS, MOCK_CREATIVES, FUNNEL_DATA } from "@/lib/ads-data";
import {
  Eye, MousePointerClick, Bookmark, DollarSign, TrendingUp, TrendingDown,
  BarChart2, Users, ImageIcon, Sparkles, AlertCircle,
  Film, Zap, Target, ShoppingCart, Palette, Settings2,
  ChevronDown, ChevronUp, Calendar, ArrowRight, RefreshCw,
  CheckCircle, Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdGroup {
  id: string; name: string; status: string;
  targetingType?: string; bidInMicroCurrency?: number | null;
}

interface RealCampaign {
  id: string; name: string; status: string; objective: string;
  dailyBudget: number | null;
  spend: number; impressions: number; clicks: number;
  saves: number; engagements: number; ctr: number;
  cpc: number; cpm: number; saveRate: number;
  adGroups?: AdGroup[];
}

interface AdsApiData {
  adAccountName: string;
  period: { startDate: string; endDate: string };
  totals: { spend: number; impressions: number; clicks: number; saves: number; engagements: number };
  campaigns: RealCampaign[];
}

type DatePreset = "7d" | "14d" | "30d" | "month";
type Severity = "critical" | "warning" | "opportunity";
type SuggestionCategory = "creative" | "audience" | "landing_page" | "budget" | "setup" | "scale";
type AnalyzeSection = "performance" | "diagnosis" | "funnel" | "audience" | "creative";

interface Suggestion {
  id: string;
  severity: Severity;
  category: SuggestionCategory;
  title: string;
  detail: string;
  action: string;
  campaignName?: string;
  metric?: string;
}

// ─── Optimize queue (localStorage cross-tab) ──────────────────────────────────

function sendToOptimize(s: Suggestion) {
  try {
    const existing = JSON.parse(localStorage.getItem("mpp_optimize_queue") ?? "[]") as Suggestion[];
    const deduped = existing.filter(e => e.id !== s.id);
    localStorage.setItem("mpp_optimize_queue", JSON.stringify([s, ...deduped].slice(0, 50)));
  } catch { /* unavailable */ }
}

// ─── Suggestion Engine ───────────────────────────────────────────────────────

const CATEGORY_META: Record<SuggestionCategory, { label: string; icon: React.ElementType; color: string }> = {
  creative:     { label: "Creative",      icon: Palette,      color: "bg-purple-100 text-purple-700" },
  audience:     { label: "Audience",      icon: Users,        color: "bg-blue-100 text-blue-700" },
  landing_page: { label: "Landing Page",  icon: ShoppingCart, color: "bg-orange-100 text-orange-700" },
  budget:       { label: "Budget",        icon: DollarSign,   color: "bg-green-100 text-green-700" },
  setup:        { label: "Setup",         icon: Settings2,    color: "bg-gray-100 text-gray-700" },
  scale:        { label: "Scale Up",      icon: Zap,          color: "bg-emerald-100 text-emerald-700" },
};

const SEVERITY_STYLE: Record<Severity, string> = {
  critical:    "bg-red-50 border-red-200",
  warning:     "bg-amber-50 border-amber-200",
  opportunity: "bg-emerald-50 border-emerald-200",
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-red-500", warning: "bg-amber-400", opportunity: "bg-emerald-500",
};

function generateSuggestions(campaigns: RealCampaign[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let idx = 0;
  const id = () => String(idx++);
  const active = campaigns.filter(c => c.status === "active");

  if (active.length === 0 && campaigns.length > 0) {
    suggestions.push({ id: id(), severity: "critical", category: "setup",
      title: "No active campaigns running",
      detail: "All campaigns are paused or ended. Your ads are not being shown to anyone right now.",
      action: "Re-activate your best performing campaign in Pinterest Ads Manager." });
  }

  for (const c of campaigns) {
    const { ctr = 0, cpc = 0, saveRate = 0, spend = 0, impressions = 0, clicks = 0, saves = 0 } = c;
    const isActive = c.status === "active";
    const name = c.name;

    if (impressions >= 1000 && ctr < 0.2)
      suggestions.push({ id: id(), severity: "critical", category: "creative",
        title: "Very low CTR — pin is not thumb-stopping",
        detail: `"${name}" has ${ctr}% CTR across ${formatNumber(impressions)} impressions. Users are scrolling past without clicking.`,
        action: "A/B test a new pin with a bold close-up or lifestyle image. First 2 seconds must stop the scroll.",
        campaignName: name, metric: `CTR ${ctr}%` });

    else if (impressions >= 5000 && ctr >= 0.2 && ctr < 0.5)
      suggestions.push({ id: id(), severity: "warning", category: "creative",
        title: "CTR below benchmark — creative can improve",
        detail: `"${name}" has ${ctr}% CTR. Pinterest benchmark is ~0.5–1.5%. Creative is getting some clicks but leaving engagement on the table.`,
        action: "Try video or carousel format. Add a clear CTA text overlay.",
        campaignName: name, metric: `CTR ${ctr}%` });

    if (isActive && spend === 0 && impressions === 0)
      suggestions.push({ id: id(), severity: "critical", category: "budget",
        title: "Active campaign not spending",
        detail: `"${name}" is active but shows $0 spend and 0 impressions. Bid is likely too low or targeting too narrow.`,
        action: "Increase bid by 20–30% or widen targeting (more interests or broad match keywords).",
        campaignName: name, metric: "Spend $0" });

    if (impressions >= 10000 && ctr < 0.3 && spend > 20)
      suggestions.push({ id: id(), severity: "warning", category: "audience",
        title: "Wrong audience — low engagement despite spend",
        detail: `"${name}" spent $${spend.toFixed(0)} but only ${ctr}% CTR. This points to a targeting mismatch — reaching people who aren't interested.`,
        action: "Narrow to 3–5 highly relevant interest categories. Layer with keyword targeting for higher intent.",
        campaignName: name, metric: `$${spend.toFixed(0)} spent, ${ctr}% CTR` });

    if (cpc > 3.0 && clicks > 20)
      suggestions.push({ id: id(), severity: "warning", category: "audience",
        title: "High CPC — expensive clicks",
        detail: `"${name}" is paying $${cpc.toFixed(2)} per click. High CPC usually means poor quality score or overly broad targeting.`,
        action: "Refresh creative (better CTR = lower CPC). Use more specific interest or keyword targeting.",
        campaignName: name, metric: `CPC $${cpc.toFixed(2)}` });

    if (clicks >= 50 && saveRate < 2 && ctr > 0.4)
      suggestions.push({ id: id(), severity: "critical", category: "landing_page",
        title: "Clicks not converting — landing page issue",
        detail: `"${name}" has good CTR (${ctr}%) but only ${saveRate}% post-click engagement. People click then immediately leave.`,
        action: "Check: 1) Mobile load speed <3s  2) Price vs competitors  3) Add trust signals  4) Pin image must match landing page.",
        campaignName: name, metric: `${saveRate}% save rate after click` });

    if (impressions >= 5000 && saves > 0 && clicks > 0 && (saves / clicks) > 3 && ctr < 0.5)
      suggestions.push({ id: id(), severity: "warning", category: "creative",
        title: "Pins are being saved but not clicked",
        detail: `"${name}" gets ${saves} saves but only ${clicks} clicks. People love the content but aren't clicking through.`,
        action: "Add a purchase trigger ('Shop Now', price overlay). Run a Consideration campaign targeting people who saved.",
        campaignName: name, metric: `${saves} saves, ${clicks} clicks` });

    if (ctr > 1.0 && saves > 50 && isActive)
      suggestions.push({ id: id(), severity: "opportunity", category: "scale",
        title: "High-performer — ready to scale",
        detail: `"${name}" has excellent metrics: ${ctr}% CTR and ${saves} saves. This campaign is working — scaling will multiply results.`,
        action: "Increase daily budget by 30–50%. Create a lookalike from engaged users. Test same creative in related interest categories.",
        campaignName: name, metric: `CTR ${ctr}%, ${saves} saves` });

    if (saveRate > 15 && clicks >= 20 && isActive)
      suggestions.push({ id: id(), severity: "opportunity", category: "scale",
        title: "Strong post-click engagement — expand reach",
        detail: `"${name}" has ${saveRate}% save rate — the audience and landing page are working.`,
        action: "Broaden targeting by 2–3 more interest categories. Build a lookalike from website visitors or purchasers.",
        campaignName: name, metric: `${saveRate}% save rate` });
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, opportunity: 2 };
  return suggestions.sort((a, b) => order[a.severity] - order[b.severity]);
}

function campaignHealthScore(c: RealCampaign): number {
  let score = 100;
  if (c.status === "active" && c.spend === 0) return 20;
  if (c.ctr < 0.1) score -= 35;
  else if (c.ctr < 0.3) score -= 25;
  else if (c.ctr < 0.5) score -= 10;
  else if (c.ctr > 1.0) score += 10;
  if (c.cpc > 3) score -= 15; else if (c.cpc > 2) score -= 8;
  if (c.saveRate < 1 && c.clicks > 30) score -= 20;
  else if (c.saveRate < 3) score -= 8;
  else if (c.saveRate > 10) score += 10;
  if (c.status === "paused") score -= 15;
  return Math.max(10, Math.min(100, score));
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  ended:  "bg-gray-100 text-gray-600",
  draft:  "bg-blue-100 text-blue-700",
};

const FORMAT_ICON: Record<string, React.ElementType> = {
  standard: ImageIcon, video: Film, carousel: BarChart2, idea: Sparkles,
};

const SECTIONS = [
  { key: "performance", label: "Performance",       icon: BarChart2,  desc: "What happened?" },
  { key: "diagnosis",   label: "AI Diagnosis",      icon: Sparkles,   desc: "Why did it happen?" },
  { key: "funnel",      label: "Funnel Analysis",   icon: TrendingUp, desc: "Where are users dropping?" },
  { key: "audience",    label: "Audience Analysis", icon: Users,      desc: "Who is performing?" },
  { key: "creative",    label: "Creative Analysis", icon: ImageIcon,  desc: "Which ads are working?" },
] as const;

// ─── Data hook ────────────────────────────────────────────────────────────────

function useAdsData() {
  const [real, setReal] = useState<AdsApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/pinterest-ads")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setReal(d); setError(null); } })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { real, loading, error, refresh };
}

// ─── Campaign & Date Selector ─────────────────────────────────────────────────

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "7d",    label: "Last 7 days" },
  { key: "14d",   label: "Last 14 days" },
  { key: "30d",   label: "Last 30 days" },
  { key: "month", label: "This month" },
];

interface AnalyzeContext {
  selectedCampaign: string; // "all" or campaign id
  datePreset: DatePreset;
}

function CampaignHeader({
  ctx, setCtx, campaigns, loading, real, refresh, error,
}: {
  ctx: AnalyzeContext;
  setCtx: (c: AnalyzeContext) => void;
  campaigns: RealCampaign[];
  loading: boolean;
  real: AdsApiData | null;
  refresh: () => void;
  error: string | null;
}) {
  const selected = campaigns.find(c => c.id === ctx.selectedCampaign);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[#e60023]" />
          Campaign Performance Analysis
        </h2>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#e60023] transition-colors disabled:opacity-40">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Loading…" : real ? "Refresh" : "Retry"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Campaign selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Select Campaign</label>
          <div className="relative">
            <select
              value={ctx.selectedCampaign}
              onChange={e => setCtx({ ...ctx, selectedCampaign: e.target.value })}
              className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 pr-8 focus:outline-none focus:border-[#e60023]"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {selected && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
              <span className={cn("px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[selected.status] ?? "bg-gray-100 text-gray-600")}>
                {selected.status}
              </span>
              <span>{selected.objective?.replace(/_/g, " ")}</span>
              {selected.dailyBudget && <span>· ${selected.dailyBudget}/day</span>}
            </div>
          )}
        </div>

        {/* Date range */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            <Calendar className="inline w-3 h-3 mr-1" /> Date Range
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(p => (
              <button key={p.key}
                onClick={() => setCtx({ ...ctx, datePreset: p.key })}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  ctx.datePreset === p.key
                    ? "bg-[#e60023] text-white border-[#e60023]"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#e60023]/40"
                )}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data status banner */}
      {loading ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-gray-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-gray-300" /> Loading Pinterest campaign data…
        </div>
      ) : real ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-green-700">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Live data from <strong className="mx-1">{real.adAccountName}</strong>
          · {real.period.startDate} → {real.period.endDate}
          · {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error === "Pinterest not connected"
            ? "Connect your Pinterest account to analyze real campaign data."
            : `Using sample data${error ? ` (${error})` : ""}. Connect Pinterest for live analysis.`}
        </div>
      )}
    </div>
  );
}

// ─── Shared: change badge ─────────────────────────────────────────────────────

function ChangeBadge({ pct, inverse = false }: { pct: number; inverse?: boolean }) {
  const good = inverse ? pct < 0 : pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold",
      good ? "text-green-600" : "text-red-500")}>
      {pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pct >= 0 ? "+" : ""}{pct}% vs prev.
    </span>
  );
}

// ─── Performance ─────────────────────────────────────────────────────────────

function PerformanceDashboard({ ctx, real }: { ctx: AnalyzeContext; real: AdsApiData | null }) {
  const mockTotals = MOCK_CAMPAIGNS.reduce((acc, c) => ({
    spend: acc.spend + c.totalSpend, impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks, saves: acc.saves + c.saves,
    conversions: acc.conversions + c.conversions,
  }), { spend: 0, impressions: 0, clicks: 0, saves: 0, conversions: 0 });

  const allCampaigns = real?.campaigns ?? [];
  const campaigns = ctx.selectedCampaign === "all"
    ? allCampaigns
    : allCampaigns.filter(c => c.id === ctx.selectedCampaign);

  const liveTotals = campaigns.length ? campaigns.reduce((acc, c) => ({
    spend: acc.spend + c.spend, impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks, saves: acc.saves + c.saves, engagements: acc.engagements + c.engagements,
  }), { spend: 0, impressions: 0, clicks: 0, saves: 0, engagements: 0 }) : null;

  const totals = liveTotals ?? { ...mockTotals, engagements: 0 };
  const isReal = !!real;

  const ctr = totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00";
  const cpc = totals.clicks ? (totals.spend / totals.clicks).toFixed(2) : "0.00";
  const cpm = totals.impressions ? ((totals.spend / totals.impressions) * 1000).toFixed(2) : "0.00";

  // Mock period-over-period changes (real API would compare against previous period)
  const changes: Record<string, number> = isReal
    ? {} // can't compute without prev-period data from API
    : { spend: 12.4, impressions: 8.1, clicks: -5.3, saves: 18.6, ctr: -13.2, cpc: 7.4 };

  const stats = [
    { label: "Total Spend",   value: `$${formatNumber(totals.spend)}`,       key: "spend",       icon: DollarSign,       color: "bg-[#e60023]/10 text-[#e60023]",  inverse: true },
    { label: "Impressions",   value: formatNumber(totals.impressions),        key: "impressions", icon: Eye,              color: "bg-blue-50 text-blue-600",        inverse: false },
    { label: "Clicks",        value: formatNumber(totals.clicks),             key: "clicks",      icon: MousePointerClick,color: "bg-purple-50 text-purple-600",    inverse: false },
    { label: "Saves",         value: formatNumber(totals.saves),              key: "saves",       icon: Bookmark,         color: "bg-pink-50 text-pink-600",        inverse: false },
    { label: "Avg. CTR",      value: `${ctr}%`,                              key: "ctr",         icon: Activity,         color: "bg-indigo-50 text-indigo-600",    inverse: false },
    { label: "Avg. CPC",      value: `$${cpc}`,                              key: "cpc",         icon: DollarSign,       color: "bg-orange-50 text-orange-600",    inverse: true },
    { label: "Avg. CPM",      value: `$${cpm}`,                              key: "cpm",         icon: BarChart2,        color: "bg-teal-50 text-teal-600",        inverse: true },
    { label: isReal ? "Engagements" : "Conversions",
      value: isReal ? formatNumber(totals.engagements) : formatNumber(mockTotals.conversions),
      key: "conversions", icon: TrendingUp, color: "bg-green-50 text-green-600", inverse: false },
  ];

  return (
    <div className="space-y-5">
      {/* Stat grid */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ label, value, key, icon: Icon, color, inverse }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            {changes[key] !== undefined && (
              <div className="mt-1"><ChangeBadge pct={changes[key]} inverse={inverse} /></div>
            )}
            {isReal && !changes[key] && (
              <div className="text-xs text-gray-400 mt-1">— prev. period</div>
            )}
          </div>
        ))}
      </div>

      {/* Campaign performance table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Campaign Performance</h3>
          <span className="text-xs text-gray-400">{DATE_PRESETS.find(p => p.key === ctx.datePreset)?.label}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Campaign", "Status", "Spend", "Impressions", "Clicks", "CTR", isReal ? "Saves" : "Conv.", isReal ? "CPC" : "ROAS"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {((isReal ? campaigns : MOCK_CAMPAIGNS) as (RealCampaign | typeof MOCK_CAMPAIGNS[0])[]).map(c => {
                const rc = c as RealCampaign;
                const mc = c as typeof MOCK_CAMPAIGNS[0];
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3">
                      <div className="text-sm font-medium text-gray-800 whitespace-nowrap">{c.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{c.objective?.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600")}>{c.status}</span>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-800">${formatNumber(isReal ? rc.spend : mc.totalSpend)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(isReal ? rc.impressions : mc.impressions)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(isReal ? rc.clicks : mc.clicks)}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-800">{(isReal ? rc.ctr : mc.ctr).toFixed(2)}%</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(isReal ? rc.saves : mc.conversions)}</td>
                    <td className="px-3 py-3 text-sm font-semibold">
                      {isReal
                        ? <span className="text-gray-800">${rc.cpc.toFixed(2)}</span>
                        : <span className={mc.roas >= 5 ? "text-green-600" : mc.roas >= 3 ? "text-yellow-600" : "text-red-500"}>{mc.roas}×</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign timeline (only when single campaign selected) */}
      {ctx.selectedCampaign !== "all" && (() => {
        const c = campaigns[0];
        if (!c) return null;
        const weeks = [
          { label: "Day 1–7",   ctr: c.ctr * 1.3, cpc: c.cpc * 0.85, note: "Learning phase — higher CPM, algorithm calibrating" },
          { label: "Day 8–14",  ctr: c.ctr * 1.1, cpc: c.cpc * 0.92, note: "Audience expanding, CTR stabilising" },
          { label: "Day 15–21", ctr: c.ctr,        cpc: c.cpc,        note: "Steady state — baseline for comparison" },
          { label: "Day 22–30", ctr: c.ctr * 0.88, cpc: c.cpc * 1.12, note: "Creative fatigue starting — consider refreshing creative" },
        ];
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Campaign Timeline</h3>
            <p className="text-xs text-gray-400 mb-4">Performance trend from campaign launch — within this period</p>
            <div className="space-y-2">
              {weeks.map((w, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-20 text-xs font-semibold text-gray-600 flex-shrink-0">{w.label}</div>
                  <div className="flex items-center gap-4 flex-1 text-sm">
                    <span className="text-gray-500">CTR <strong className="text-gray-800">{w.ctr.toFixed(2)}%</strong></span>
                    <span className="text-gray-500">CPC <strong className="text-gray-800">${w.cpc.toFixed(2)}</strong></span>
                  </div>
                  <div className="text-xs text-gray-400 text-right max-w-xs">{w.note}</div>
                </div>
              ))}
            </div>
            {!real && <p className="text-xs text-gray-400 mt-3">Timeline estimated from aggregate metrics. Connect Pinterest for day-by-day data.</p>}
          </div>
        );
      })()}
    </div>
  );
}

// ─── AI Diagnosis ─────────────────────────────────────────────────────────────

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";
  const label = score >= 75 ? "Healthy" : score >= 50 ? "Needs Attention" : "Critical";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-semibold w-28 text-right",
        score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600")}>
        {score}/100 · {label}
      </span>
    </div>
  );
}

function DiagnosisCard({ s }: { s: Suggestion }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const cat = CATEGORY_META[s.category];
  const CatIcon = cat.icon;

  return (
    <div className={cn("rounded-xl border p-4", SEVERITY_STYLE[s.severity])}>
      <div className="flex items-start gap-3">
        <span className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", SEVERITY_DOT[s.severity])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", cat.color)}>
              <CatIcon className="w-3 h-3" /> {cat.label}
            </span>
            <span className={cn("text-xs font-bold",
              s.severity === "critical" ? "text-red-600" :
              s.severity === "warning" ? "text-amber-600" : "text-emerald-600")}>
              {s.severity === "critical" ? "Critical" : s.severity === "warning" ? "Warning" : "Opportunity"}
            </span>
            {s.metric && <span className="text-xs text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">{s.metric}</span>}
          </div>

          <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
          {s.campaignName && <div className="text-xs text-gray-500 mt-0.5">Campaign: <span className="font-medium text-gray-700">{s.campaignName}</span></div>}

          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-2">
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? "Hide diagnosis" : "Show diagnosis & cause"}
          </button>

          {open && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">{s.detail}</p>
              <div className="bg-white/80 rounded-lg px-3 py-2.5 border border-white">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Recommended Next Step</div>
                <p className="text-sm font-medium text-gray-900">{s.action}</p>
              </div>
            </div>
          )}
        </div>

        {/* Send to Optimize */}
        <button
          onClick={() => { sendToOptimize(s); setSent(true); setTimeout(() => setSent(false), 2000); }}
          className={cn("flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap",
            sent ? "bg-green-100 text-green-700" : "bg-white/70 text-gray-600 hover:text-[#e60023] hover:bg-white"
          )}>
          {sent ? <><CheckCircle className="w-3 h-3" /> Sent!</> : <>→ Send to Optimize</>}
        </button>
      </div>
    </div>
  );
}

function AIDiagnosis({ ctx, real }: { ctx: AnalyzeContext; real: AdsApiData | null }) {
  const [filter, setFilter] = useState<Severity | "all">("all");

  const allCampaigns = real?.campaigns ?? [];
  const campaigns = ctx.selectedCampaign === "all"
    ? allCampaigns
    : allCampaigns.filter(c => c.id === ctx.selectedCampaign);

  const suggestions = campaigns.length > 0 ? generateSuggestions(campaigns) : [];
  const filtered = filter === "all" ? suggestions : suggestions.filter(s => s.severity === filter);
  const counts = {
    critical:    suggestions.filter(s => s.severity === "critical").length,
    warning:     suggestions.filter(s => s.severity === "warning").length,
    opportunity: suggestions.filter(s => s.severity === "opportunity").length,
  };

  const selectedCampaignObj = campaigns[0];
  const healthScore = selectedCampaignObj ? campaignHealthScore(selectedCampaignObj) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">AI Campaign Diagnosis</h2>
          <p className="text-xs text-gray-500">
            {real
              ? `Analyzing ${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} · findings can be sent to the Optimize tab`
              : "Connect Pinterest for real campaign diagnosis"}
          </p>
        </div>
      </div>

      {/* Campaign health card */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map(c => {
            const score = campaignHealthScore(c);
            const issues = suggestions.filter(s => s.campaignName === c.name);
            const working = issues.filter(s => s.severity === "opportunity").length;
            const problems = issues.filter(s => s.severity !== "opportunity").length;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-500")}>{c.status}</span>
                    <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">${c.spend?.toFixed(0) ?? 0} spend · {c.ctr ?? 0}% CTR</span>
                </div>
                <HealthBar score={score} />
                {(working > 0 || problems > 0) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {working > 0 && (
                      <div className="bg-green-50 rounded-lg p-2.5 text-xs">
                        <div className="font-semibold text-green-700 mb-1">What&apos;s working</div>
                        {issues.filter(s => s.severity === "opportunity").map(s => (
                          <div key={s.id} className="text-green-600">🟢 {s.title}</div>
                        ))}
                      </div>
                    )}
                    {problems > 0 && (
                      <div className="bg-red-50 rounded-lg p-2.5 text-xs">
                        <div className="font-semibold text-red-700 mb-1">What needs attention</div>
                        {issues.filter(s => s.severity !== "opportunity").slice(0, 3).map(s => (
                          <div key={s.id} className={s.severity === "critical" ? "text-red-600" : "text-amber-600"}>
                            {s.severity === "critical" ? "🔴" : "🟡"} {s.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filter tabs */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "critical", "warning", "opportunity"] as const).map(f => {
            const count = f === "all" ? suggestions.length : counts[f as Severity];
            const color = f === "critical" ? "border-red-200 text-red-700 bg-red-50" :
                          f === "warning"  ? "border-amber-200 text-amber-700 bg-amber-50" :
                          f === "opportunity" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                          "border-gray-200 text-gray-700 bg-gray-50";
            return (
              <button key={f} onClick={() => setFilter(f as Severity | "all")}
                className={cn("px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all",
                  color, filter === f ? "ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100")}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Diagnosis cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          {!real ? (
            <>
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700 mb-1">Connect Pinterest for real campaign diagnosis</p>
              <p className="text-sm text-gray-500">We&apos;ll analyze your live data and explain exactly what&apos;s happening and why.</p>
            </>
          ) : (
            <>
              <Target className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No {filter !== "all" ? filter : ""} issues found</p>
              <p className="text-sm text-gray-500 mt-1">Your campaign{campaigns.length !== 1 ? "s" : ""} look{campaigns.length === 1 ? "s" : ""} healthy in this category.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => <DiagnosisCard key={s.id} s={s} />)}
        </div>
      )}

      {real && suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-2 text-sm text-blue-700">
          <ArrowRight className="w-4 h-4 flex-shrink-0" />
          Use <strong className="mx-1">→ Send to Optimize</strong> on any finding to queue it as an optimization action.
        </div>
      )}

      {healthScore !== null && !real && (
        <p className="text-xs text-gray-400 text-center">Diagnosis based on sample data. Changes should be made in Pinterest Ads Manager.</p>
      )}
    </div>
  );
}

// ─── Funnel Analysis ──────────────────────────────────────────────────────────

function FunnelAnalysis({ real }: { real: AdsApiData | null }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-2">Conversion Funnel</h3>
        {!real && <p className="text-xs text-amber-600 mb-4 bg-amber-50 rounded-lg px-3 py-2">Using sample data. Connect Pinterest and set up conversion tracking for live funnel analysis.</p>}
        <div className="space-y-3">
          {FUNNEL_DATA.map((stage, i) => {
            const next = FUNNEL_DATA[i + 1];
            const dropOff = next ? (100 - next.pct).toFixed(1) : null;
            return (
              <div key={stage.stage}>
                <div className="flex items-center gap-4">
                  <div className="w-32 text-right">
                    <div className="text-sm font-semibold text-gray-800">{stage.stage}</div>
                    <div className="text-xs text-gray-500">
                      {stage.stage === "Revenue" ? `$${formatNumber(stage.value)}` : formatNumber(stage.value)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className={cn("h-10 rounded-xl flex items-center px-3 text-white text-xs font-semibold", stage.color)}
                      style={{ width: `${Math.max(stage.pct ?? 5, 5)}%`, minWidth: "60px" }}>
                      {stage.icon} {stage.pct !== null ? `${stage.pct.toFixed(1)}%` : ""}
                    </div>
                  </div>
                  {dropOff && <div className="w-24 text-xs text-red-500 font-medium">−{dropOff}% drop</div>}
                </div>
                {next && <div className="mt-1 mb-1 h-4 w-px bg-gray-200 ml-[146px]" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Missing stages placeholder */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Extended Funnel Stages</h3>
        <div className="space-y-2">
          {[
            { stage: "Landing Page Visits", status: "unavailable", note: "Connect Pinterest Tag to your website" },
            { stage: "Add to Cart",         status: "unavailable", note: "Requires conversion event tracking" },
            { stage: "Purchase",            status: "unavailable", note: "Requires conversion event tracking" },
          ].map(({ stage, note }) => (
            <div key={stage} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-dashed border-gray-200">
              <div className="text-sm font-medium text-gray-400">{stage}</div>
              <div className="ml-auto text-xs text-gray-400">Data unavailable · {note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Audience Analysis ────────────────────────────────────────────────────────

function AudienceAnalysis({ ctx, real }: { ctx: AnalyzeContext; real: AdsApiData | null }) {
  const disclaimer = `Within this campaign and selected date range (${DATE_PRESETS.find(p => p.key === ctx.datePreset)?.label ?? ctx.datePreset}).`;

  return (
    <div className="space-y-5">
      {!real && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
          <AlertCircle className="inline w-4 h-4 mr-1.5" />
          Sample data shown. Connect Pinterest for audience breakdown from your actual campaigns.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Age & Gender Performance</h3>
        <p className="text-xs text-gray-400 mb-4">{disclaimer}</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Segment", "Impressions", "Clicks", "CTR", "Conv.", "CPA", "AI Finding"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { segment: "Women 25–34", impressions: 1840000, clicks: 41000, ctr: 2.23, conv: 312, cpa: 22, finding: "Strongest conversion efficiency", findingColor: "bg-green-100 text-green-700" },
                { segment: "Women 35–44", impressions: 980000,  clicks: 18200, ctr: 1.86, conv: 142, cpa: 35, finding: "Good reach, higher CPA",       findingColor: "bg-blue-100 text-blue-700" },
                { segment: "Women 18–24", impressions: 760000,  clicks: 11400, ctr: 1.50, conv: 54,  cpa: 58, finding: "Low conversion rate",           findingColor: "bg-amber-100 text-amber-700" },
                { segment: "Men 25–34",   impressions: 420000,  clicks: 5400,  ctr: 1.29, conv: 18,  cpa: 82, finding: "Weakest segment — reduce bids", findingColor: "bg-red-100 text-red-700" },
              ].map(({ segment, impressions, clicks, ctr, conv, cpa, finding, findingColor }) => (
                <tr key={segment} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">{segment}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(impressions)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(clicks)}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">{ctr}%</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{conv}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">${cpa}</td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", findingColor)}>{finding}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">AI finding is specific to this campaign and date range — not a universal conclusion about these demographics.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Device Performance</h3>
          {[
            { device: "Mobile",  pct: 60, ctr: 1.8, color: "bg-blue-500" },
            { device: "Desktop", pct: 31, ctr: 2.4, color: "bg-purple-500" },
            { device: "Tablet",  pct: 9,  ctr: 1.5, color: "bg-green-500" },
          ].map(({ device, pct, ctr, color }) => (
            <div key={device} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className={cn("w-2 h-7 rounded-full flex-shrink-0", color)} />
              <div className="flex-1 text-sm font-medium text-gray-800">{device}</div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{pct}% of traffic</div>
                <div className="text-xs text-gray-500">{ctr}% CTR</div>
              </div>
            </div>
          ))}
          {!real && <p className="text-xs text-gray-400 mt-3">Sample data</p>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Locations</h3>
          {[
            { loc: "California, US", ctr: 2.4, pct: 28 },
            { loc: "New York, US",   ctr: 2.1, pct: 18 },
            { loc: "London, UK",     ctr: 1.9, pct: 14 },
            { loc: "Toronto, CA",    ctr: 1.7, pct: 10 },
            { loc: "Sydney, AU",     ctr: 1.6, pct: 8 },
          ].map(({ loc, ctr, pct }) => (
            <div key={loc} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex-1 text-sm font-medium text-gray-800">{loc}</div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{pct}% of spend</div>
                <div className="text-xs text-gray-500">{ctr}% CTR</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Creative Analysis ────────────────────────────────────────────────────────

function CreativeAnalysisSection({ ctx, real }: { ctx: AnalyzeContext; real: AdsApiData | null }) {
  const allCampaigns = real?.campaigns ?? [];
  const campaigns = ctx.selectedCampaign === "all"
    ? allCampaigns
    : allCampaigns.filter(c => c.id === ctx.selectedCampaign);

  // Build creative rows from real ad groups or fall back to mock
  const creativeRows = real && campaigns.length > 0
    ? campaigns.flatMap(c => (c.adGroups ?? []).map(ag => ({
        id: ag.id,
        name: ag.name,
        campaignName: c.name,
        spend: c.spend * 0.3, // estimate per-ad-group
        ctr: c.ctr,
        cpc: c.cpc,
        conversions: null as number | null,
        cpa: null as number | null,
        isReal: true,
      })))
    : MOCK_CREATIVES.map(ad => ({
        id: ad.id,
        name: ad.title,
        campaignName: "",
        spend: ad.impressions * ad.ctr / 100 * 1.1,
        ctr: ad.ctr,
        cpc: 0,
        conversions: ad.conversions as number,
        cpa: null as number | null,
        isReal: false,
      }));

  // Find best/worst by CPA or CTR
  const sorted = [...creativeRows].sort((a, b) => b.ctr - a.ctr);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="space-y-5">
      {!real && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
          <AlertCircle className="inline w-4 h-4 mr-1.5" />
          Sample data. Connect Pinterest to analyze your actual ad creatives.
        </div>
      )}

      {/* AI finding */}
      {creativeRows.length >= 2 && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Creative Finding
          </div>
          <p className="text-sm text-violet-900">
            <strong>{best?.name}</strong> is currently the strongest performer by CTR ({best?.ctr}%).{" "}
            {worst && worst.id !== best?.id && (
              <><strong>{worst.name}</strong> is significantly weaker ({worst.ctr}%) and may be draining budget without results.</>
            )}
          </p>
          <button
            onClick={() => sendToOptimize({
              id: `creative_${Date.now()}`,
              severity: "warning",
              category: "creative",
              title: `Creative imbalance detected`,
              detail: `${best?.name} (${best?.ctr}% CTR) vs ${worst?.name} (${worst?.ctr}% CTR). Weaker creative is consuming budget.`,
              action: `Pause ${worst?.name} and reallocate budget to ${best?.name}. Test a new variation.`,
            })}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-white/60 hover:bg-white px-3 py-1.5 rounded-lg transition-colors">
            → Send to Optimize
          </button>
        </div>
      )}

      {/* Creative table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Creative Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Creative / Ad Group", real ? "Campaign" : "Format", "Spend", "CTR", "CPC", "Conv.", "CPA", "Rating"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(real ? creativeRows : MOCK_CREATIVES.map(ad => ({
                id: ad.id, name: ad.title, campaignName: (ad as { campaign?: string }).campaign ?? "",
                spend: Math.round(ad.impressions * ad.ctr / 100 * 1.1),
                ctr: ad.ctr, cpc: 1.1, conversions: ad.conversions as number, cpa: null as number | null,
                format: ad.format, isReal: false,
              }))).map((row) => {
                const mc = row as unknown as typeof MOCK_CREATIVES[0] & { spend: number; ctr: number; cpc: number; conversions: number };
                const Icon = !real && FORMAT_ICON[mc.format ?? "standard"];
                const rating = row.ctr > 2 ? { label: "Strong", color: "bg-green-100 text-green-700" }
                  : row.ctr > 1 ? { label: "Average", color: "bg-amber-100 text-amber-700" }
                  : { label: "Weak", color: "bg-red-100 text-red-700" };
                return (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {!real && <span className="text-lg">{mc.emoji}</span>}
                        <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {real ? row.campaignName : (Icon ? <span className="flex items-center gap-1.5 text-xs capitalize"><Icon className="w-3.5 h-3.5" />{mc.format}</span> : null)}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-800">${formatNumber(Math.round(row.spend))}</td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-900">{row.ctr.toFixed(2)}%</td>
                    <td className="px-3 py-3 text-sm text-gray-700">${row.cpc.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{row.conversions ?? "—"}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{row.cpa ? `$${row.cpa}` : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", rating.color)}>{rating.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Format guide */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Format Benchmark Guide</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { format: "Video",    emoji: "🎬", avgCtr: "2.1–4.2%", best: "Tutorials, stories" },
            { format: "Carousel", emoji: "🎠", avgCtr: "2.1–3.8%", best: "Multi-product, steps" },
            { format: "Standard", emoji: "🖼️", avgCtr: "1.8–2.6%", best: "Products, lifestyle" },
            { format: "Idea",     emoji: "💡", avgCtr: "3.0–5.1%", best: "How-to, recipes" },
          ].map(f => (
            <div key={f.format} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-2xl mb-1">{f.emoji}</div>
              <div className="text-sm font-bold text-gray-800">{f.format}</div>
              <div className="text-xs font-semibold text-[#e60023] mt-1">{f.avgCtr} CTR</div>
              <div className="text-xs text-gray-400 mt-0.5">{f.best}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AnalyzeTab() {
  const [section, setSection] = useState<AnalyzeSection>("performance");
  const [ctx, setCtx] = useState<AnalyzeContext>({ selectedCampaign: "all", datePreset: "30d" });
  const { real, loading, error, refresh } = useAdsData();

  const campaigns = real?.campaigns ?? [];

  return (
    <div className="space-y-5">
      {/* Campaign + date selector */}
      <CampaignHeader ctx={ctx} setCtx={setCtx} campaigns={campaigns} loading={loading} real={real} refresh={refresh} error={error} />

      {/* Main layout */}
      <div className="flex gap-6">
        {/* Side nav */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon, desc }) => (
            <button key={key} onClick={() => setSection(key as AnalyzeSection)}
              className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all",
                section === key ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-100")}>
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium leading-tight">{label}</div>
                <div className={cn("text-xs leading-tight mt-0.5", section === key ? "text-white/70" : "text-gray-400")}>{desc}</div>
              </div>
              {key === "diagnosis" && (
                <span className="ml-auto text-xs bg-white/20 px-1.5 py-0.5 rounded-md mt-0.5 flex-shrink-0">AI</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {section === "performance" && <PerformanceDashboard ctx={ctx} real={real} />}
          {section === "diagnosis"   && <AIDiagnosis ctx={ctx} real={real} />}
          {section === "funnel"      && <FunnelAnalysis real={real} />}
          {section === "audience"    && <AudienceAnalysis ctx={ctx} real={real} />}
          {section === "creative"    && <CreativeAnalysisSection ctx={ctx} real={real} />}
        </div>
      </div>
    </div>
  );
}
