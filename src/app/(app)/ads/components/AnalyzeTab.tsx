"use client";
import { useState, useEffect } from "react";
import { formatNumber, cn } from "@/lib/utils";
import { MOCK_CAMPAIGNS, MOCK_CREATIVES, MOCK_AUDIENCES, FUNNEL_DATA } from "@/lib/ads-data";
import {
  Eye, MousePointerClick, Bookmark, DollarSign, TrendingUp, TrendingDown,
  BarChart2, Users, ImageIcon, Sparkles, ArrowUpRight, AlertCircle,
  Film, Zap, Target, ShoppingCart, Palette, Settings2, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdGroup {
  id: string; name: string; status: string;
  targetingType?: string; bidInMicroCurrency?: number | null;
  placementGroup?: string;
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

type Severity = "critical" | "warning" | "opportunity";
type SuggestionCategory = "creative" | "audience" | "landing_page" | "budget" | "setup" | "scale";

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
  critical:    "bg-red-500",
  warning:     "bg-amber-400",
  opportunity: "bg-emerald-500",
};

function generateSuggestions(campaigns: RealCampaign[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let idx = 0;
  const id = () => String(idx++);

  const active = campaigns.filter(c => c.status === "active");

  // Account-level: no active campaigns
  if (active.length === 0 && campaigns.length > 0) {
    suggestions.push({
      id: id(), severity: "critical", category: "setup",
      title: "No active campaigns running",
      detail: "All campaigns are paused or ended. Your ads are not being shown to anyone right now.",
      action: "Re-activate your best performing campaign in Pinterest Ads Manager.",
    });
  }

  for (const c of campaigns) {
    const ctr = c.ctr ?? 0;
    const cpc = c.cpc ?? 0;
    const saveRate = c.saveRate ?? 0;
    const spend = c.spend ?? 0;
    const impressions = c.impressions ?? 0;
    const clicks = c.clicks ?? 0;
    const saves = c.saves ?? 0;
    const isActive = c.status === "active";
    const name = c.name;

    // ── Creative problems ─────────────────────────────────────────
    if (impressions >= 1000 && ctr < 0.2) {
      suggestions.push({
        id: id(), severity: "critical", category: "creative",
        title: "Very low CTR — pin is not thumb-stopping",
        detail: `"${name}" has only ${ctr}% CTR across ${formatNumber(impressions)} impressions. Users are scrolling past. This is almost always a creative problem: wrong first frame, text-heavy image, or unclear value.`,
        action: "A/B test a new pin with a bold close-up, lifestyle image, or short video. First 2 seconds must stop the scroll.",
        campaignName: name, metric: `CTR ${ctr}%`,
      });
    } else if (impressions >= 5000 && ctr >= 0.2 && ctr < 0.5) {
      suggestions.push({
        id: id(), severity: "warning", category: "creative",
        title: "CTR below average — creative can improve",
        detail: `"${name}" has ${ctr}% CTR. Pinterest benchmark is ~0.5–1.5%. Your creative is getting some clicks but leaving engagement on the table.`,
        action: "Try a different pin format (video or carousel often outperforms static). Add a clear CTA text overlay.",
        campaignName: name, metric: `CTR ${ctr}%`,
      });
    }

    // ── Budget / spend issues ─────────────────────────────────────
    if (isActive && spend === 0 && impressions === 0) {
      suggestions.push({
        id: id(), severity: "critical", category: "budget",
        title: "Active campaign not spending",
        detail: `"${name}" is active but has $0 spend and 0 impressions. This usually means bid is too low for the auction, or targeting is too narrow to find eligible users.`,
        action: "Increase your bid by 20–30% or widen your targeting (add more interests or use broad match keywords).",
        campaignName: name, metric: "Spend $0",
      });
    } else if (isActive && spend > 0 && c.dailyBudget && spend / 30 > c.dailyBudget * 0.95) {
      suggestions.push({
        id: id(), severity: "warning", category: "budget",
        title: "Budget exhausting — missing reach",
        detail: `"${name}" is hitting its daily cap. You're cutting off impressions mid-day, missing peak evening hours when Pinterest usage is highest.`,
        action: `Increase daily budget by ~20% (to $${Math.round((c.dailyBudget ?? 0) * 1.2)}) to capture full-day reach.`,
        campaignName: name, metric: `Budget $${c.dailyBudget}/day`,
      });
    }

    // ── Audience / targeting problems ────────────────────────────
    if (impressions >= 10000 && ctr < 0.3 && spend > 20) {
      suggestions.push({
        id: id(), severity: "warning", category: "audience",
        title: "Wrong audience — low engagement despite spend",
        detail: `"${name}" has spent $${spend.toFixed(0)} but only ${ctr}% CTR. When spend is high and CTR is low, the creative is reaching people who don't care about your product — a targeting mismatch.`,
        action: "Narrow your interest targeting to 3–5 highly relevant categories. Try layering with keyword targeting for higher intent.",
        campaignName: name, metric: `$${spend.toFixed(0)} spent, ${ctr}% CTR`,
      });
    }

    if (cpc > 3.0 && clicks > 20) {
      suggestions.push({
        id: id(), severity: "warning", category: "audience",
        title: "High CPC — expensive clicks",
        detail: `"${name}" is paying $${cpc.toFixed(2)} per click. High CPC usually means you're in a competitive auction with poor quality score, or targeting is too broad.`,
        action: "Refresh your creative (better CTR = lower CPC). Try more specific interest or keyword targeting to reduce competition.",
        campaignName: name, metric: `CPC $${cpc.toFixed(2)}`,
      });
    }

    // ── Landing page / post-click problems ───────────────────────
    if (clicks >= 50 && saveRate < 2 && ctr > 0.4) {
      suggestions.push({
        id: id(), severity: "critical", category: "landing_page",
        title: "Clicks not converting — landing page issue",
        detail: `"${name}" has good CTR (${ctr}%) but only ${saveRate}% of clicks save/engage. People are clicking but immediately leaving. Common causes: slow page load, price too high, no trust signals, or the landing page doesn't match the pin's promise.`,
        action: "Check: 1) Page load speed on mobile (<3s) 2) Price vs competitors 3) Add reviews/social proof 4) Pin image must match landing page hero image exactly.",
        campaignName: name, metric: `${saveRate}% save rate after click`,
      });
    } else if (clicks >= 30 && saveRate >= 2 && saveRate < 5 && ctr > 0.3) {
      suggestions.push({
        id: id(), severity: "warning", category: "landing_page",
        title: "Post-click engagement is low",
        detail: `"${name}" gets clicks but ${saveRate}% save rate suggests users aren't finding what they expected. This could be a price objection or weak trust.`,
        action: "Add urgency (limited stock, sale deadline), customer reviews above the fold, and a clear primary CTA button. Consider a free shipping threshold.",
        campaignName: name, metric: `${saveRate}% save rate`,
      });
    }

    // ── High saves, low clicks (awareness but no purchase intent) ─
    if (impressions >= 5000 && saves > 0 && clicks > 0) {
      const savesPerClick = saves / clicks;
      if (savesPerClick > 3 && ctr < 0.5) {
        suggestions.push({
          id: id(), severity: "warning", category: "creative",
          title: "Pins are being saved but not clicked",
          detail: `"${name}" gets ${saves} saves but only ${clicks} clicks — a ${(savesPerClick).toFixed(1)}× ratio. People love the content and save it for later, but aren't clicking through to buy. Your creative looks inspirational but lacks a purchase trigger.`,
          action: "Add a stronger CTA to your pin ('Shop Now', price overlay, 'Limited Time'). Consider running a separate Consideration campaign targeting people who saved your pins.",
          campaignName: name, metric: `${saves} saves, ${clicks} clicks`,
        });
      }
    }

    // ── Objective mismatch ────────────────────────────────────────
    const obj = (c.objective ?? "").toUpperCase();
    if (obj === "BRAND_AWARENESS" && cpc > 1.5) {
      suggestions.push({
        id: id(), severity: "warning", category: "setup",
        title: "Awareness campaign with high CPC",
        detail: `"${name}" is set to Brand Awareness but optimizing for expensive clicks. Awareness campaigns should maximize impressions at low CPM, not expensive clicks.`,
        action: "Change optimization goal to 'Impressions' or 'Reach'. For conversions, create a separate Consideration or Conversion campaign.",
        campaignName: name, metric: `Objective: ${c.objective}`,
      });
    }

    if ((obj === "CONVERSIONS" || obj === "CATALOG_SALES") && impressions >= 5000 && ctr < 0.3) {
      suggestions.push({
        id: id(), severity: "critical", category: "setup",
        title: "Conversion campaign with very low CTR",
        detail: `"${name}" targets conversions but ${ctr}% CTR means few people reach your site. Pinterest's algorithm needs enough click data to optimize — you're starving it.`,
        action: "Fix the creative first to get CTR above 0.5%. Once traffic flows, Pinterest can optimize for conversions. Consider running a Consideration campaign first to build retargeting audiences.",
        campaignName: name, metric: `${ctr}% CTR on conversion campaign`,
      });
    }

    // ── Scaling opportunities ─────────────────────────────────────
    if (ctr > 1.0 && saves > 50 && isActive) {
      suggestions.push({
        id: id(), severity: "opportunity", category: "scale",
        title: "High-performer — ready to scale",
        detail: `"${name}" has excellent metrics: ${ctr}% CTR and ${saves} saves. This campaign is working. Scaling it will multiply results proportionally.`,
        action: `Increase daily budget by 30–50%. Create a lookalike audience from people who engaged. Test same creative in a new campaign targeting related interests.`,
        campaignName: name, metric: `CTR ${ctr}%, ${saves} saves`,
      });
    }

    if (saveRate > 15 && clicks >= 20 && isActive) {
      suggestions.push({
        id: id(), severity: "opportunity", category: "scale",
        title: "Strong post-click engagement — expand reach",
        detail: `"${name}" has ${saveRate}% save rate — users are highly engaged after clicking. This is a winning funnel. The audience is right and the landing page is working.`,
        action: "Broaden your targeting (add 2–3 more interest categories). Build a lookalike audience based on website visitors or purchasers.",
        campaignName: name, metric: `${saveRate}% save rate`,
      });
    }

    // ── Paused campaigns ─────────────────────────────────────────
    if (c.status === "paused" && impressions > 50000) {
      suggestions.push({
        id: id(), severity: "opportunity", category: "scale",
        title: `Paused campaign with proven reach`,
        detail: `"${name}" has 50k+ historical impressions but is paused. It has proven audience fit. Reactivating it could deliver results quickly without the learning period of a new campaign.`,
        action: "Review why it was paused. If budget was the reason, reactivate with a modest daily budget increase.",
        campaignName: name,
      });
    }
  }

  // Sort: critical first, then warning, then opportunity
  const order: Record<Severity, number> = { critical: 0, warning: 1, opportunity: 2 };
  return suggestions.sort((a, b) => order[a.severity] - order[b.severity]);
}

function campaignHealthScore(c: RealCampaign): number {
  let score = 100;
  const ctr = c.ctr ?? 0;
  const saveRate = c.saveRate ?? 0;
  const spend = c.spend ?? 0;

  if (c.status === "active" && spend === 0) return 20;
  if (ctr < 0.1) score -= 35;
  else if (ctr < 0.3) score -= 25;
  else if (ctr < 0.5) score -= 10;
  else if (ctr > 1.0) score += 10;

  if (c.cpc > 3) score -= 15;
  else if (c.cpc > 2) score -= 8;

  if (saveRate < 1 && (c.clicks ?? 0) > 30) score -= 20;
  else if (saveRate < 3) score -= 8;
  else if (saveRate > 10) score += 10;

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

const FATIGUE_COLOR: Record<string, string> = {
  none:   "bg-green-100 text-green-700",
  low:    "bg-yellow-100 text-yellow-600",
  medium: "bg-orange-100 text-orange-600",
  high:   "bg-red-100 text-red-600",
};

const FORMAT_ICON: Record<string, React.ElementType> = {
  standard: ImageIcon,
  video:    Film,
  carousel: BarChart2,
  idea:     Sparkles,
};

type AnalyzeSection = "dashboard" | "optimizer" | "funnel" | "audience" | "creative";

const SECTIONS = [
  { key: "dashboard", label: "Performance",       icon: BarChart2 },
  { key: "optimizer", label: "Optimization AI",   icon: Sparkles  },
  { key: "funnel",    label: "Funnel Analysis",    icon: TrendingUp },
  { key: "audience",  label: "Audience Analysis",  icon: Users     },
  { key: "creative",  label: "Creative Analysis",  icon: ImageIcon },
] as const;

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, change, icon: Icon, color }: {
  label: string; value: string; change?: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {change !== undefined && (
        <div className={cn("flex items-center gap-1 text-xs font-medium mt-1", change >= 0 ? "text-green-600" : "text-red-500")}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change)}% vs last month
        </div>
      )}
    </div>
  );
}

// ─── Shared data hook ─────────────────────────────────────────────────────────

function useAdsData() {
  const [real, setReal] = useState<AdsApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pinterest-ads")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setReal(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return { real, loading, error };
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function DataBanner({ loading, real, error }: { loading: boolean; real: AdsApiData | null; error: string | null }) {
  if (loading) return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-gray-400 animate-pulse">
      <span className="w-2 h-2 rounded-full bg-gray-300" /> Loading Pinterest Business data…
    </div>
  );
  if (real) return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-green-700">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      Live data from <strong className="mx-1">{real.adAccountName}</strong> · {real.period.startDate} → {real.period.endDate}
    </div>
  );
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {error === "Pinterest not connected" ? "Connect your Pinterest account to see real ad data." : `Using sample data${error ? ` (${error})` : ""}.`}
    </div>
  );
}

// ─── Performance Dashboard ────────────────────────────────────────────────────

function PerformanceDashboard() {
  const { real, loading, error } = useAdsData();

  const mockTotals = MOCK_CAMPAIGNS.reduce((acc, c) => ({
    spend: acc.spend + c.totalSpend, impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks, saves: acc.saves + c.saves,
    conversions: acc.conversions + c.conversions, revenue: acc.revenue + c.revenue,
  }), { spend: 0, impressions: 0, clicks: 0, saves: 0, conversions: 0, revenue: 0 });

  const totals = real?.totals ?? { spend: mockTotals.spend, impressions: mockTotals.impressions, clicks: mockTotals.clicks, saves: mockTotals.saves, engagements: 0 };
  const campaigns = real?.campaigns ?? null;
  const isReal = !!real;

  const avgCtr = totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0.00";
  const avgCpc = totals.clicks ? (totals.spend / totals.clicks).toFixed(2) : "0.00";
  const avgCpm = totals.impressions ? ((totals.spend / totals.impressions) * 1000).toFixed(2) : "0.00";
  const avgRoas = isReal ? null : (mockTotals.revenue / mockTotals.spend).toFixed(1);

  return (
    <div className="space-y-5">
      <DataBanner loading={loading} real={real} error={error} />

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Spend"  value={`$${formatNumber(totals.spend)}`}         icon={DollarSign}       color="bg-[#e60023]/10 text-[#e60023]" />
        <StatCard label="Impressions"  value={formatNumber(totals.impressions)}          icon={Eye}              color="bg-blue-50 text-blue-600" />
        <StatCard label="Clicks"       value={formatNumber(totals.clicks)}               icon={MousePointerClick} color="bg-purple-50 text-purple-600" />
        <StatCard label="Saves"        value={formatNumber(totals.saves)}                icon={Bookmark}         color="bg-pink-50 text-pink-600" />
        {isReal ? (
          <StatCard label="Engagements" value={formatNumber(totals.engagements)} icon={TrendingUp} color="bg-green-50 text-green-600" />
        ) : (
          <>
            <StatCard label="Conversions" value={formatNumber(mockTotals.conversions)} change={18.6} icon={TrendingUp}  color="bg-green-50 text-green-600" />
            <StatCard label="Revenue"     value={`$${formatNumber(mockTotals.revenue)}`} change={24.3} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Avg. ROAS"   value={`${avgRoas}×`}                      change={14.8} icon={BarChart2}  color="bg-orange-50 text-orange-600" />
          </>
        )}
        <StatCard label="Avg. CTR" value={`${avgCtr}%`} icon={MousePointerClick} color="bg-indigo-50 text-indigo-600" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">Avg. CPC</span>
          <span className="text-lg font-bold text-gray-900">${avgCpc}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">Avg. CPM</span>
          <span className="text-lg font-bold text-gray-900">${avgCpm}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Campaign Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Campaign", "Status", "Spend", "Impr.", "Clicks", "CTR", isReal ? "Saves" : "Conversions", isReal ? "CPC" : "ROAS"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(campaigns ?? MOCK_CAMPAIGNS).map((c) => {
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
                    <td className="px-3 py-3 text-sm font-semibold text-gray-800">{isReal ? rc.ctr : mc.ctr}%</td>
                    {isReal ? (
                      <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(rc.saves)}</td>
                    ) : (
                      <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(mc.conversions)}</td>
                    )}
                    {isReal ? (
                      <td className="px-3 py-3 text-sm font-semibold text-gray-800">${rc.cpc.toFixed(2)}</td>
                    ) : (
                      <td className="px-3 py-3">
                        <span className={cn("text-sm font-bold", mc.roas >= 5 ? "text-green-600" : mc.roas >= 3 ? "text-yellow-600" : "text-red-500")}>{mc.roas}×</span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Optimization Advisor ─────────────────────────────────────────────────────

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";
  const label = score >= 75 ? "Healthy" : score >= 50 ? "Needs Work" : "Critical";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-semibold w-20 text-right", score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600")}>
        {score}/100 · {label}
      </span>
    </div>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORY_META[s.category];
  const CatIcon = cat.icon;
  const severityLabel = s.severity === "critical" ? "Critical" : s.severity === "warning" ? "Warning" : "Opportunity";

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
              s.severity === "warning" ? "text-amber-600" : "text-emerald-600"
            )}>{severityLabel}</span>
            {s.metric && <span className="text-xs text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">{s.metric}</span>}
          </div>
          <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
          {s.campaignName && (
            <div className="text-xs text-gray-500 mt-0.5">Campaign: <span className="font-medium text-gray-700">{s.campaignName}</span></div>
          )}

          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-2">
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? "Hide" : "Why & how to fix"}
          </button>

          {open && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">{s.detail}</p>
              <div className="bg-white/80 rounded-lg px-3 py-2.5 border border-white">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Recommended Action</div>
                <p className="text-sm font-medium text-gray-900">{s.action}</p>
              </div>
            </div>
          )}
        </div>
        <ArrowUpRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      </div>
    </div>
  );
}

function OptimizationAdvisor() {
  const { real, loading, error } = useAdsData();
  const [filter, setFilter] = useState<Severity | "all">("all");

  const campaigns = real?.campaigns ?? [];
  const suggestions = campaigns.length > 0 ? generateSuggestions(campaigns) : [];
  const filtered = filter === "all" ? suggestions : suggestions.filter(s => s.severity === filter);

  const counts = {
    critical:    suggestions.filter(s => s.severity === "critical").length,
    warning:     suggestions.filter(s => s.severity === "warning").length,
    opportunity: suggestions.filter(s => s.severity === "opportunity").length,
  };

  return (
    <div className="space-y-5">
      <DataBanner loading={loading} real={real} error={error} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">Campaign Optimization Advisor</h2>
          <p className="text-xs text-gray-500">
            {real ? `Analyzing ${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} from your Pinterest account` : "Connect your Pinterest account for personalized analysis"}
          </p>
        </div>
      </div>

      {/* Campaign health cards */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {campaigns.map(c => {
            const score = campaignHealthScore(c);
            const issues = suggestions.filter(s => s.campaignName === c.name).length;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-500")}>{c.status}</span>
                    <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {issues > 0 && <span className="bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{issues} issue{issues > 1 ? "s" : ""}</span>}
                    <span className="text-gray-400">${c.spend?.toFixed(0) ?? 0} · {c.ctr ?? 0}% CTR</span>
                  </div>
                </div>
                <HealthBar score={score} />
              </div>
            );
          })}
        </div>
      )}

      {/* Summary counters + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "critical", "warning", "opportunity"] as const).map(f => {
          const count = f === "all" ? suggestions.length : counts[f];
          const color = f === "critical" ? "border-red-200 text-red-700 bg-red-50" :
                        f === "warning" ? "border-amber-200 text-amber-700 bg-amber-50" :
                        f === "opportunity" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                        "border-gray-200 text-gray-700 bg-gray-50";
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all",
                color, filter === f ? "ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100"
              )}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Suggestions */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          {!real ? (
            <>
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700 mb-1">Connect Pinterest to get personalized suggestions</p>
              <p className="text-sm text-gray-500">Once connected, we'll analyze your live campaign data and flag exactly what to fix.</p>
            </>
          ) : (
            <>
              <Target className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">No {filter !== "all" ? filter : ""} issues found</p>
              <p className="text-sm text-gray-500 mt-1">Your campaigns look healthy in this category.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => <SuggestionCard key={s.id} s={s} />)}
        </div>
      )}

      {/* Disclaimer */}
      {real && (
        <p className="text-xs text-gray-400 text-center">
          Suggestions based on 30-day performance data. Changes should be made in Pinterest Ads Manager.
        </p>
      )}
    </div>
  );
}

// ─── Funnel Analysis ──────────────────────────────────────────────────────────

function FunnelAnalysis() {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-5">Conversion Funnel</h3>
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
                    <div
                      className={cn("h-10 rounded-xl flex items-center px-3 text-white text-xs font-semibold transition-all", stage.color)}
                      style={{ width: `${Math.max(stage.pct ?? 5, 5)}%`, minWidth: "60px" }}
                    >
                      {stage.icon} {stage.pct !== null ? `${stage.pct.toFixed(1)}%` : ""}
                    </div>
                  </div>
                  {dropOff && (
                    <div className="w-24 text-xs text-red-500 font-medium">−{dropOff}% drop</div>
                  )}
                </div>
                {next && <div className="mt-1 mb-1 h-4 w-px bg-gray-200 ml-[146px]" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Attribution Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { model: "First-Touch",  conversions: 312,  revenue: "$14,040", desc: "Credits the first ad the user saw" },
            { model: "Last-Touch",   conversions: 745,  revenue: "$28,530", desc: "Credits the last ad before conversion" },
            { model: "Assisted",     conversions: 1240, revenue: "$48,200", desc: "All touchpoints that contributed" },
          ].map(({ model, conversions, revenue, desc }) => (
            <div key={model} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-sm font-bold text-gray-900">{model}</div>
              <div className="text-xs text-gray-500 mt-0.5 mb-3">{desc}</div>
              <div className="text-xl font-bold text-gray-900">{conversions}</div>
              <div className="text-xs text-gray-500">conversions</div>
              <div className="text-sm font-semibold text-green-600 mt-1">{revenue} revenue</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Audience Analysis ────────────────────────────────────────────────────────

function AudienceAnalysis() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Device Performance</h3>
          {[
            { device: "Mobile",  impressions: 2800000, clicks: 42000, convRate: 1.8, color: "bg-blue-500" },
            { device: "Desktop", impressions: 1400000, clicks: 19000, convRate: 2.4, color: "bg-purple-500" },
            { device: "Tablet",  impressions: 440000,  clicks: 4700,  convRate: 1.5, color: "bg-green-500" },
          ].map(({ device, impressions, clicks, convRate, color }) => (
            <div key={device} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
              <div className={cn("w-2 h-8 rounded-full flex-shrink-0", color)} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800">{device}</div>
                <div className="text-xs text-gray-400">{formatNumber(impressions)} impressions</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{formatNumber(clicks)}</div>
                <div className="text-xs text-gray-500">clicks · {convRate}% conv.</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Geographic Performance</h3>
          {[
            { location: "California, US", spend: 480, roas: 8.2, convRate: 3.1 },
            { location: "New York, US",   spend: 320, roas: 6.8, convRate: 2.7 },
            { location: "London, UK",     spend: 240, roas: 5.9, convRate: 2.4 },
            { location: "Toronto, CA",    spend: 180, roas: 5.2, convRate: 2.1 },
            { location: "Sydney, AU",     spend: 140, roas: 4.8, convRate: 1.9 },
          ].map(({ location, spend, roas, convRate }) => (
            <div key={location} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">{location}</div>
                <div className="text-xs text-gray-400">${spend} spend</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-green-600">{roas}× ROAS</div>
                <div className="text-xs text-gray-400">{convRate}% conv.</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Best-Performing Demographics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Segment", "Impressions", "Clicks", "CTR", "Conversions", "ROAS", "Recommendation"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { segment: "Women 25–34", impressions: 1840000, clicks: 41000, ctr: 2.23, conv: 312, roas: 9.2, rec: "Increase budget" },
                { segment: "Women 35–44", impressions: 980000,  clicks: 18200, ctr: 1.86, conv: 142, roas: 7.1, rec: "Expand lookalike" },
                { segment: "Women 18–24", impressions: 760000,  clicks: 11400, ctr: 1.50, conv: 54,  roas: 4.2, rec: "Test video format" },
                { segment: "Men 25–34",   impressions: 420000,  clicks: 5400,  ctr: 1.29, conv: 18,  roas: 2.1, rec: "Reduce bids" },
              ].map(({ segment, impressions, clicks, ctr, conv, roas, rec }) => (
                <tr key={segment} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">{segment}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(impressions)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(clicks)}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">{ctr}%</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{conv}</td>
                  <td className="px-3 py-3">
                    <span className={cn("text-sm font-bold", roas >= 6 ? "text-green-600" : roas >= 4 ? "text-yellow-600" : "text-red-500")}>{roas}×</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                      rec === "Increase budget" ? "bg-green-100 text-green-700" :
                      rec === "Reduce bids"     ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"
                    )}>{rec}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Creative Analysis ────────────────────────────────────────────────────────

function CreativeAnalysis() {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Creative Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Ad", "Format", "Impressions", "Clicks", "CTR", "Saves", "Conversions", "Fatigue", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_CREATIVES.map((ad) => {
                const Icon = FORMAT_ICON[ad.format];
                return (
                  <tr key={ad.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ad.emoji}</span>
                        <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{ad.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 capitalize">
                        <Icon className="w-3.5 h-3.5" /> {ad.format}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(ad.impressions)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(ad.clicks)}</td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-900">{ad.ctr}%</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(ad.saves)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{ad.conversions}</td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", FATIGUE_COLOR[ad.fatigue])}>{ad.fatigue}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[ad.status])}>{ad.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Format Performance Comparison</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { format: "Video",    emoji: "🎬", avgCtr: 2.14, saves: 2200 },
            { format: "Carousel", emoji: "🎠", avgCtr: 2.24, saves: 3000 },
            { format: "Standard", emoji: "🖼️", avgCtr: 2.44, saves: 2800 },
            { format: "Idea",     emoji: "💡", avgCtr: 0.92, saves: 1900 },
          ].map(({ format, emoji, avgCtr, saves }) => (
            <div key={format} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <div className="text-2xl mb-2">{emoji}</div>
              <div className="text-sm font-bold text-gray-800">{format}</div>
              <div className="text-lg font-bold text-gray-900 mt-2">{avgCtr}%</div>
              <div className="text-xs text-gray-400">Avg. CTR</div>
              <div className="text-xs font-semibold text-[#e60023] mt-1">{formatNumber(saves)} saves</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AnalyzeTab() {
  const [section, setSection] = useState<AnalyzeSection>("optimizer");

  return (
    <div className="flex gap-6">
      <div className="w-52 flex-shrink-0 space-y-1">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
              section === key ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            {key === "optimizer" && <span className="ml-auto text-xs bg-white/20 px-1.5 py-0.5 rounded-md">AI</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        {section === "dashboard"  && <PerformanceDashboard />}
        {section === "optimizer"  && <OptimizationAdvisor />}
        {section === "funnel"     && <FunnelAnalysis />}
        {section === "audience"   && <AudienceAnalysis />}
        {section === "creative"   && <CreativeAnalysis />}
      </div>
    </div>
  );
}
