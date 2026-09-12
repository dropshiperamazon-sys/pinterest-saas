"use client";
import { useState, useEffect } from "react";
import { AUTOMATED_RULES, MOCK_AUDIENCES, KEYWORD_PLAN } from "@/lib/ads-data";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { AlertCircle, TrendingUp } from "lucide-react";

interface RealCampaign {
  id: string; name: string; status: string; objective: string;
  dailyBudget: number | null; spend: number; impressions: number;
  clicks: number; saves: number; engagements: number;
  ctr: number; cpc: number; cpm: number; saveRate: number;
}
interface AdsApiData {
  adAccountName: string;
  period: { startDate: string; endDate: string };
  totals: { spend: number; impressions: number; clicks: number; saves: number; engagements: number };
  campaigns: RealCampaign[];
}
interface Rec {
  id: string; priority: "high" | "medium" | "low"; category: string;
  title: string; details: string; impact: string; effort: string;
}

function useAdsData() {
  const [data, setData] = useState<AdsApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/pinterest-ads")
      .then(r => r.json())
      .then((d: AdsApiData & { error?: string }) => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading, error };
}

function computeOpportunityScore(campaigns: RealCampaign[]) {
  const active = campaigns.filter(c => c.status === "active");
  if (!active.length) return { overall: 0, breakdown: [] as { label: string; score: number; status: string }[] };
  const avgCtr      = active.reduce((s, c) => s + c.ctr, 0) / active.length;
  const avgCpc      = active.reduce((s, c) => s + c.cpc, 0) / active.length;
  const avgSaveRate = active.reduce((s, c) => s + c.saveRate, 0) / active.length;
  const spending    = active.filter(c => c.spend > 0).length;

  const ctrScore  = Math.min(100, Math.round((avgCtr / 1.5) * 100));
  const bidScore  = Math.min(100, Math.max(0, Math.round(100 - (avgCpc / 3) * 100)));
  const engScore  = Math.min(100, Math.round((avgSaveRate / 10) * 100));
  const budgScore = Math.round((spending / active.length) * 100);
  const audScore  = Math.min(100, ctrScore + 10);
  const overall   = Math.round((ctrScore + bidScore + engScore + budgScore + audScore) / 5);

  const st = (s: number) => s >= 70 ? "good" : s >= 40 ? "fair" : "needs_work";
  return {
    overall,
    breakdown: [
      { label: "Creative Performance (CTR)",  score: ctrScore,  status: st(ctrScore)  },
      { label: "Bid Efficiency (CPC)",        score: bidScore,  status: st(bidScore)  },
      { label: "Audience Engagement (Saves)", score: engScore,  status: st(engScore)  },
      { label: "Budget Utilisation",          score: budgScore, status: st(budgScore) },
      { label: "Audience Targeting",          score: audScore,  status: st(audScore)  },
    ],
  };
}

function generateRecs(campaigns: RealCampaign[]): Rec[] {
  const recs: Rec[] = [];
  let i = 0;
  for (const c of campaigns) {
    if (c.status === "active" && c.spend === 0)
      recs.push({ id: String(i++), priority: "high", category: "Budget", effort: "5 min",
        title: `"${c.name}" is active but not spending`,
        details: "Bid is likely below auction floor or targeting is too narrow.",
        impact: "Restore impressions and reach" });
    if (c.impressions > 1000 && c.ctr < 0.3)
      recs.push({ id: String(i++), priority: "high", category: "Creative", effort: "1–2 hrs",
        title: `Refresh creative for "${c.name}" (CTR ${c.ctr}%)`,
        details: "Low CTR means users are scrolling past. Try lifestyle close-up, bold overlay, or short video.",
        impact: "Est. +40–80% more clicks at same spend" });
    if (c.clicks > 50 && c.saveRate < 2)
      recs.push({ id: String(i++), priority: "high", category: "Landing Page", effort: "2–4 hrs",
        title: `Fix landing page for "${c.name}" (${c.saveRate}% post-click rate)`,
        details: "Users click but leave immediately. Check page speed, price, social proof, and mobile UX.",
        impact: "Est. +2–3× conversion rate" });
    if (c.cpc > 2.5 && c.clicks > 20)
      recs.push({ id: String(i++), priority: "medium", category: "Bid", effort: "30 min",
        title: `Reduce CPC for "${c.name}" ($${c.cpc.toFixed(2)}/click)`,
        details: "High CPC means poor quality score or broad targeting. Tighten interests and refresh creative.",
        impact: "Est. −20–30% cost per click" });
    if (c.ctr > 1.0 && c.saves > 20 && c.status === "active")
      recs.push({ id: String(i++), priority: "medium", category: "Scale", effort: "10 min",
        title: `Scale budget for "${c.name}" — top performer`,
        details: `${c.ctr}% CTR with ${c.saves} saves. Increase daily budget 30–50%.`,
        impact: `Est. +${Math.round(c.saves * 0.4)} more saves/month` });
  }
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

function DataBanner({ loading, data, error }: { loading: boolean; data: AdsApiData | null; error: string | null }) {
  if (loading) return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-gray-400 animate-pulse">
      <span className="w-2 h-2 rounded-full bg-gray-300" /> Loading Pinterest data…
    </div>
  );
  if (data) return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-green-700">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      Live data · <strong className="mx-1">{data.adAccountName}</strong> · {data.period.startDate} → {data.period.endDate}
    </div>
  );
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {error === "Pinterest not connected" ? "Connect your Pinterest account to see live optimization data." : `Using sample data${error ? ` (${error})` : ""}.`}
    </div>
  );
}

const SECTIONS = ["Opportunity Score","Recommendations","Budget & Bid","Audience","Creative & Keywords","Automated Rules","AI Copilot"];
const PRIORITY_COLOR: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-gray-100 text-gray-600" };
const STATUS_COLOR:   Record<string, string> = { good: "text-green-600", fair: "text-yellow-600", needs_work: "text-red-600" };
const STATUS_LABEL:   Record<string, string> = { good: "Good", fair: "Fair", needs_work: "Needs Work" };
const COPILOT_SUGGESTIONS = ["Why is my CTR low?","Which campaigns should I scale?","How do I reduce wasted spend?","What audiences should I add?"];

export default function OptimizeTab() {
  const { data, loading, error } = useAdsData();
  const [activeSection, setActiveSection] = useState("Opportunity Score");
  const [appliedRecs, setAppliedRecs] = useState<Set<string>>(new Set());
  const [ruleStatuses, setRuleStatuses] = useState<Record<string, string>>(
    Object.fromEntries(AUTOMATED_RULES.map((r) => [r.id, r.status]))
  );
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hi! I'm your AI Growth Copilot. Ask me anything about your campaigns — budget, CTR, audiences, or scaling strategy." },
  ]);

  const campaigns: RealCampaign[] = data?.campaigns ?? [];
  const isReal = !!data;
  const opportunity = isReal
    ? computeOpportunityScore(campaigns)
    : { overall: 72, breakdown: [
        { label: "Creative Performance (CTR)", score: 68, status: "fair" },
        { label: "Bid Efficiency (CPC)",       score: 80, status: "good" },
        { label: "Audience Engagement",        score: 55, status: "fair" },
        { label: "Budget Utilisation",         score: 90, status: "good" },
        { label: "Audience Targeting",         score: 67, status: "fair" },
      ] };
  const recs: Rec[] = isReal ? generateRecs(campaigns) : [];
  const score = opportunity.overall;
  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  const scoreRing  = score >= 80 ? "stroke-green-500" : score >= 60 ? "stroke-yellow-500" : "stroke-red-500";

  function sendCopilot(text: string) {
    const msg = text.trim();
    if (!msg) return;
    const top    = campaigns.filter(c => c.ctr > 0.8)[0];
    const lowCtr = campaigns.filter(c => c.ctr < 0.3 && c.impressions > 1000)[0];
    let reply = "Great question! Review your top-performing campaigns and reallocate budget from low-CTR ones.";
    if (/ctr|creative/i.test(msg))
      reply = lowCtr
        ? `Your lowest CTR campaign is "${lowCtr.name}" at ${lowCtr.ctr}% across ${formatNumber(lowCtr.impressions)} impressions. Replace the static image with a lifestyle close-up or video.`
        : "Low CTR means the creative isn't stopping the scroll. Try bold images, price overlays, or video — typically 2× higher CTR than static.";
    else if (/scale/i.test(msg))
      reply = top
        ? `Best scale candidate: "${top.name}" — ${top.ctr}% CTR, ${top.saves} saves. Increase daily budget 30–50% and build a 1% lookalike from engagers.`
        : "Scale campaigns with CTR >1% and stable save rates. Increase budget 30% and create lookalike audiences from your best engagers.";
    else if (/wasted|spend/i.test(msg)) {
      const zero = campaigns.filter(c => c.status === "active" && c.spend === 0);
      reply = `${zero.length > 0 ? `${zero.length} active campaign(s) have $0 spend — fix delivery first. ` : ""}Pause campaigns under 1,000 impressions with 0 saves, and add negative keywords like 'free' and 'DIY only'.`;
    } else if (/audience/i.test(msg))
      reply = campaigns.length
        ? `Build a 1% lookalike from users who saved your pins. Your avg CTR is ${(campaigns.reduce((s,c) => s + c.ctr, 0) / campaigns.length).toFixed(2)}% — layer interest + keyword targeting for higher intent.`
        : "Add retargeting from website visitors (30d) then build a 1% lookalike to scale to similar users.";
    setCopilotMessages(prev => [...prev, { role: "user", text: msg }, { role: "ai", text: reply }]);
    setCopilotInput("");
  }

  return (
    <div className="flex gap-6">
      <aside className="w-52 flex-shrink-0">
        <nav className="space-y-1 sticky top-4">
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeSection === s ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-100")}>
              {s}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 space-y-5">

        {/* ── Opportunity Score ── */}
        {activeSection === "Opportunity Score" && (
          <div className="space-y-5">
            <DataBanner loading={loading} data={data} error={error} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Opportunity Score</h2>
              <p className="text-sm text-gray-500 mt-0.5">{isReal ? "Calculated from your live campaign metrics" : "Account health score"}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                    <circle cx="50" cy="50" r="40" fill="none" className={scoreRing} strokeWidth="10"
                      strokeDasharray={`${(score / 100) * 251.2} 251.2`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${scoreColor}`}>{score}</span>
                    <span className="text-xs text-gray-500">/ 100</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700 mt-3">Overall Score</p>
                <p className="text-xs text-gray-400 mt-1">{score >= 80 ? "Great — keep scaling" : score >= 60 ? "Good — room to improve" : "Needs attention"}</p>
                {isReal && <span className="mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Live</span>}
              </div>
              <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Score Breakdown</h3>
                <div className="space-y-3">
                  {opportunity.breakdown.map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{item.label}</span>
                        <span className={cn("font-semibold", STATUS_COLOR[item.status])}>{item.score} — {STATUS_LABEL[item.status]}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", item.status === "good" ? "bg-green-500" : item.status === "fair" ? "bg-yellow-400" : "bg-red-400")}
                          style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {isReal && recs.length > 0 && (
              <div className="bg-gradient-to-r from-[#e60023]/5 to-purple-50 rounded-xl border border-[#e60023]/20 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">🎯 Top Quick Wins</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recs.slice(0, 3).map(r => (
                    <div key={r.id} className="bg-white rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-[#e60023] mb-1">{r.category}</p>
                      <p className="text-sm font-medium text-gray-800 leading-snug">{r.title}</p>
                      <p className="text-xs text-green-700 mt-2 font-medium">{r.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Recommendations ── */}
        {activeSection === "Recommendations" && (
          <div className="space-y-5">
            <DataBanner loading={loading} data={data} error={error} />
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Optimization Recommendations</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isReal ? `${recs.length} actions from your live campaign data` : "Connect Pinterest to get personalized recommendations"}
                </p>
              </div>
              {isReal && <span className="text-sm text-gray-500">{appliedRecs.size}/{recs.length} applied</span>}
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : !isReal || recs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-600">{isReal ? "No issues — campaigns look healthy!" : "Connect your Pinterest account to get live recommendations"}</p>
              </div>
            ) : recs.map(rec => {
              const applied = appliedRecs.has(rec.id);
              return (
                <div key={rec.id} className={cn("bg-white rounded-xl border p-5", applied ? "border-green-200 opacity-60" : "border-gray-200")}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", PRIORITY_COLOR[rec.priority])}>{rec.priority.toUpperCase()}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{rec.category}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Effort: {rec.effort}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{rec.details}</p>
                      <p className="text-xs text-green-700 font-medium mt-2">Est. impact: {rec.impact}</p>
                    </div>
                    <button onClick={() => setAppliedRecs(prev => { const n = new Set(prev); applied ? n.delete(rec.id) : n.add(rec.id); return n; })}
                      className={cn("flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        applied ? "bg-green-100 text-green-700" : "bg-[#e60023] text-white hover:bg-[#c8001e]")}>
                      {applied ? "✓ Applied" : "Apply"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Budget & Bid ── */}
        {activeSection === "Budget & Bid" && (
          <div className="space-y-5">
            <DataBanner loading={loading} data={data} error={error} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Budget & Bid Optimization</h2>
              <p className="text-sm text-gray-500 mt-0.5">Suggested budget reallocation based on live performance</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Campaign Budget Allocation</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      {["Campaign","Status","Daily Budget","CTR","CPC","Suggested","Change"].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(isReal ? campaigns : []).map(c => {
                      const budget = c.dailyBudget ?? 0;
                      const perfGood = c.ctr > 0.8;
                      const perfBad  = c.ctr < 0.3;
                      const suggested = budget ? (perfGood ? Math.round(budget * 1.3) : perfBad ? Math.round(budget * 0.7) : budget) : 0;
                      const diff = suggested - budget;
                      return (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 font-medium text-gray-800">{c.name}</td>
                          <td className="py-3 pr-4">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize",
                              c.status === "active" ? "bg-green-100 text-green-700" : c.status === "paused" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"
                            )}>{c.status}</span>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{budget ? `${formatCurrency(budget)}/day` : "—"}</td>
                          <td className="py-3 pr-4 font-semibold"
                            style={{ color: perfGood ? "#16a34a" : perfBad ? "#ef4444" : "#ca8a04" }}>
                            {c.ctr}%
                          </td>
                          <td className="py-3 pr-4 text-gray-600">${c.cpc.toFixed(2)}</td>
                          <td className="py-3 pr-4 text-gray-600">{suggested ? `${formatCurrency(suggested)}/day` : "—"}</td>
                          <td className="py-3">
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                              diff > 0 ? "bg-green-100 text-green-700" : diff < 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500")}>
                              {diff > 0 ? `+${formatCurrency(diff)}` : diff < 0 ? formatCurrency(diff) : "No change"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!isReal && (
                      <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">Connect Pinterest account to see live budget suggestions</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {isReal && <p className="text-xs text-gray-400 mt-3">+30% for CTR &gt;0.8% · −30% for CTR &lt;0.3% · Apply changes in Pinterest Ads Manager.</p>}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Bid Strategy Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Broad Keywords",        action: "Reduce bids by 12%",  saving: "−$180/mo",         reason: "23% of spend, only 8% of conversions" },
                  { label: "Exact Keywords",         action: "Increase bids by 8%", impact: "+$420/mo revenue", reason: "High intent, under-allocated" },
                  { label: "Retargeting Audience",   action: "Increase bids by 15%",impact: "+$640/mo revenue", reason: "Highest conversion segment" },
                  { label: "Low-engagement segment", action: "Reduce bids by 20%",  saving: "−$90/mo",          reason: "Low conversion rate" },
                ].map(item => (
                  <div key={item.label} className="border border-gray-100 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{item.action}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.reason}</p>
                    <p className={cn("text-xs font-medium mt-2", item.saving ? "text-red-600" : "text-green-600")}>{item.saving ?? item.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Audience ── */}
        {activeSection === "Audience" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Audience Optimization</h2>
              <p className="text-sm text-gray-500 mt-0.5">Expand reach and improve targeting efficiency</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Audience Performance Review</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      {["Audience","Type","Size","CTR","Conv. Rate","Action"].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {MOCK_AUDIENCES.sort((a, b) => b.convRate - a.convRate).map(aud => (
                      <tr key={aud.id}>
                        <td className="py-3 pr-4 font-medium text-gray-800">{aud.name}</td>
                        <td className="py-3 pr-4"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{aud.type}</span></td>
                        <td className="py-3 pr-4 text-gray-600">{formatNumber(aud.size)}</td>
                        <td className="py-3 pr-4 text-gray-600">{aud.ctr}%</td>
                        <td className="py-3 pr-4 font-semibold" style={{ color: aud.convRate >= 4 ? "#16a34a" : aud.convRate >= 2 ? "#ca8a04" : "#ef4444" }}>
                          {aud.convRate}%
                        </td>
                        <td className="py-3">
                          <button className="text-xs text-[#e60023] font-medium hover:underline">
                            {aud.type === "retargeting" ? "Create Lookalike" : "Increase Budget"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 Audience Expansion Suggestion</h3>
              <p className="text-sm text-blue-700">
                Create a 1% lookalike from your <strong>Website Visitors (30d)</strong> retargeting list — estimated reach of <strong>2.1M similar users</strong> at 3–4% conv. rate.
              </p>
            </div>
          </div>
        )}

        {/* ── Creative & Keywords ── */}
        {activeSection === "Creative & Keywords" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Creative & Keyword Optimization</h2>
              <p className="text-sm text-gray-500 mt-0.5">Refresh underperforming creatives and tighten keyword strategy</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Creative Refresh Queue</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Low CTR creative",  fatigue: "High",   drop: "−40% engagement", action: "Replace with video" },
                  { title: "Behind the Scenes", fatigue: "Medium", drop: "−18% engagement", action: "Update thumbnail" },
                  { title: "Static product pin",fatigue: "Low",    drop: "−8% engagement",  action: "A/B test copy" },
                ].map(item => (
                  <div key={item.title} className="border border-gray-100 rounded-lg p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Fatigue: <span className={cn("font-medium", item.fatigue === "High" ? "text-red-600" : item.fatigue === "Medium" ? "text-yellow-600" : "text-green-600")}>{item.fatigue}</span>
                        {" · "}{item.drop}
                      </p>
                    </div>
                    <button className="flex-shrink-0 text-xs bg-[#e60023] text-white px-3 py-1.5 rounded-lg hover:bg-[#c8001e]">{item.action}</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Keyword Optimization</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      {["Keyword","Type","Vol.","Bid","Action"].map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {KEYWORD_PLAN.map((kw, i) => (
                      <tr key={i} className={kw.negative ? "opacity-50" : ""}>
                        <td className="py-2.5 pr-4 font-medium text-gray-800">
                          {kw.keyword}
                          {kw.negative && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">−neg</span>}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                            kw.type === "exact" ? "bg-orange-100 text-orange-700" : kw.type === "phrase" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                            {kw.type === "exact" ? `[${kw.type}]` : kw.type === "phrase" ? `"${kw.type}"` : kw.type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">{kw.volume ? formatNumber(kw.volume) : "—"}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{kw.suggestedBid ? formatCurrency(kw.suggestedBid) : "—"}</td>
                        <td className="py-2.5">{!kw.negative && <button className="text-xs text-[#e60023] font-medium hover:underline">{kw.competition === "high" ? "Review bid" : "Add"}</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Automated Rules ── */}
        {activeSection === "Automated Rules" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Automated Rules</h2>
                <p className="text-sm text-gray-500 mt-0.5">Set-and-forget rules that run on your schedule</p>
              </div>
              <button className="px-4 py-2 bg-[#e60023] text-white text-sm font-medium rounded-lg hover:bg-[#c8001e]">+ New Rule</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs text-gray-500">
                    {["Rule Name","Condition","Action","Frequency","Status",""].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {AUTOMATED_RULES.map(rule => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{rule.name}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.condition}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.action}</td>
                      <td className="px-4 py-3 text-gray-500">{rule.frequency}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setRuleStatuses(prev => ({ ...prev, [rule.id]: prev[rule.id] === "active" ? "paused" : "active" }))}
                          className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            ruleStatuses[rule.id] === "active" ? "bg-green-500" : "bg-gray-200")}>
                          <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                            ruleStatuses[rule.id] === "active" ? "translate-x-4" : "translate-x-1")} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs text-gray-400 hover:text-[#e60023]">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800">
              <strong>Tip:</strong> The &quot;No conversion pause&quot; rule is paused. Enable it to automatically pause ads with 0 conversions after 1,000 impressions.
            </div>
          </div>
        )}

        {/* ── AI Copilot ── */}
        {activeSection === "AI Copilot" && (
          <div className="space-y-5">
            <DataBanner loading={loading} data={data} error={error} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Growth Copilot</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isReal ? `Answering based on your ${campaigns.length} live campaign${campaigns.length !== 1 ? "s" : ""}` : "Ask anything about campaigns — budget, CTR, audiences, or strategy"}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: "520px" }}>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {copilotMessages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "ai" && <div className="w-7 h-7 rounded-full bg-[#e60023] flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5">AI</div>}
                    <div className={cn("max-w-[80%] text-sm rounded-xl px-4 py-3",
                      msg.role === "user" ? "bg-[#e60023] text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {COPILOT_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendCopilot(s)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full">{s}</button>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input type="text" value={copilotInput} onChange={e => setCopilotInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendCopilot(copilotInput)}
                  placeholder="Ask about your campaigns..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                <button onClick={() => sendCopilot(copilotInput)} disabled={!copilotInput.trim()}
                  className="px-4 py-2 bg-[#e60023] text-white text-sm font-medium rounded-lg hover:bg-[#c8001e] disabled:opacity-40">Send</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
