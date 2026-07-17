"use client";
import { useState } from "react";
import {
  OPTIMIZATION_RECOMMENDATIONS,
  AUTOMATED_RULES,
  OPPORTUNITY_SCORE,
  MOCK_CAMPAIGNS,
  MOCK_AUDIENCES,
  KEYWORD_PLAN,
} from "@/lib/ads-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

const SECTIONS = [
  "Opportunity Score",
  "Recommendations",
  "Budget & Bid",
  "Audience",
  "Creative & Keywords",
  "Automated Rules",
  "AI Copilot",
];

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const STATUS_COLOR: Record<string, string> = {
  good: "text-green-600",
  fair: "text-yellow-600",
  needs_work: "text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  needs_work: "Needs Work",
};

const COPILOT_SUGGESTIONS = [
  "Why is my ROAS dropping?",
  "Which campaigns should I scale?",
  "How do I reduce wasted spend?",
  "What audiences should I add?",
];

const COPILOT_RESPONSES: Record<string, string> = {
  "Why is my ROAS dropping?":
    "Your ROAS dipped primarily because creative fatigue on 'Budget Home Decor Finds' caused a 40% engagement drop. Additionally, broad match keywords are generating irrelevant clicks (23% of spend, only 8% of conversions). Refreshing the creative and tightening keyword match types should recover 15–20% ROAS.",
  "Which campaigns should I scale?":
    "Campaign A (Summer Home Collection) is your clear scale candidate — 7.9× ROAS with stable CTR and no creative fatigue on top performers. Increase daily budget by $15–20 and monitor for 3 days. Campaign D (Video Views) at 6.4× ROAS is also ready to expand, especially with more video creatives.",
  "How do I reduce wasted spend?":
    "Three quick wins: (1) Pause 3 zero-conversion keywords ('home accessories online', 'cheap room ideas diy', 'wall art prints buy') — saving ~$240/month. (2) Add negative keywords: 'free', 'clearance', 'DIY tutorial only'. (3) Reduce broad match bids by 12% — estimated saving of $180/month with minimal conversion loss.",
  "What audiences should I add?":
    "Your top opportunity is a 1% lookalike audience built from Website Visitors (30d) — they convert at 5.8% and a lookalike could reach 2.1M similar users. Also consider layering the Women 25–34 demographic with Home Decor Enthusiasts interest to create a high-intent combined segment.",
};

export default function OptimizeTab() {
  const [activeSection, setActiveSection] = useState("Opportunity Score");
  const [appliedRecs, setAppliedRecs] = useState<Set<string>>(new Set());
  const [ruleStatuses, setRuleStatuses] = useState<Record<string, string>>(
    Object.fromEntries(AUTOMATED_RULES.map((r) => [r.id, r.status]))
  );
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([
    {
      role: "ai",
      text: "Hi! I'm your AI Growth Copilot. Ask me anything about your campaigns — budget, ROAS, audiences, creative performance, or scaling strategy.",
    },
  ]);

  function sendCopilot(text: string) {
    const msg = text.trim();
    if (!msg) return;
    const aiReply =
      COPILOT_RESPONSES[msg] ||
      "Great question! Based on your account data, I'd recommend reviewing your top-performing campaigns and reallocating budget from low-ROAS campaigns. Would you like me to analyse a specific area?";
    setCopilotMessages((prev) => [
      ...prev,
      { role: "user", text: msg },
      { role: "ai", text: aiReply },
    ]);
    setCopilotInput("");
  }

  const score = OPPORTUNITY_SCORE.overall;
  const scoreColor =
    score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  const scoreRing =
    score >= 80 ? "stroke-green-500" : score >= 60 ? "stroke-yellow-500" : "stroke-red-500";

  return (
    <div className="flex gap-6">
      {/* Left nav */}
      <aside className="w-52 flex-shrink-0">
        <nav className="space-y-1 sticky top-4">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === s
                  ? "bg-[#e60023] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* ── Opportunity Score ── */}
        {activeSection === "Opportunity Score" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Opportunity Score</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                AI-generated health score across your entire account
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Gauge */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      className={scoreRing}
                      strokeWidth="10"
                      strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${scoreColor}`}>{score}</span>
                    <span className="text-xs text-gray-500">/ 100</span>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700 mt-3">Overall Score</p>
                <p className="text-xs text-gray-400 mt-1">Good — room to improve</p>
              </div>

              {/* Breakdown */}
              <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Score Breakdown</h3>
                <div className="space-y-3">
                  {OPPORTUNITY_SCORE.breakdown.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{item.label}</span>
                        <span className={`font-semibold ${STATUS_COLOR[item.status]}`}>
                          {item.score} — {STATUS_LABEL[item.status]}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.status === "good"
                              ? "bg-green-500"
                              : item.status === "fair"
                              ? "bg-yellow-400"
                              : "bg-red-400"
                          }`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick wins */}
            <div className="bg-gradient-to-r from-[#e60023]/5 to-purple-50 rounded-xl border border-[#e60023]/20 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">🎯 Top 3 Quick Wins</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {OPTIMIZATION_RECOMMENDATIONS.filter((r) => r.priority === "high")
                  .slice(0, 3)
                  .map((r) => (
                    <div key={r.id} className="bg-white rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-semibold text-[#e60023] mb-1">{r.category}</p>
                      <p className="text-sm font-medium text-gray-800 leading-snug">{r.title}</p>
                      <p className="text-xs text-green-700 mt-2 font-medium">{r.impact}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Recommendations ── */}
        {activeSection === "Recommendations" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Optimization Recommendations</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  AI-prioritized actions to improve performance
                </p>
              </div>
              <span className="text-sm text-gray-500">
                {appliedRecs.size}/{OPTIMIZATION_RECOMMENDATIONS.length} applied
              </span>
            </div>

            <div className="space-y-3">
              {OPTIMIZATION_RECOMMENDATIONS.map((rec) => {
                const applied = appliedRecs.has(rec.id);
                return (
                  <div
                    key={rec.id}
                    className={`bg-white rounded-xl border p-5 ${
                      applied ? "border-green-200 opacity-60" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              PRIORITY_COLOR[rec.priority]
                            }`}
                          >
                            {rec.priority.toUpperCase()}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {rec.category}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            Effort: {rec.effort}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{rec.details}</p>
                        <p className="text-xs text-green-700 font-medium mt-2">
                          Est. impact: {rec.impact}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setAppliedRecs((prev) => {
                            const next = new Set(prev);
                            if (applied) next.delete(rec.id);
                            else next.add(rec.id);
                            return next;
                          })
                        }
                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          applied
                            ? "bg-green-100 text-green-700"
                            : "bg-[#e60023] text-white hover:bg-[#c8001e]"
                        }`}
                      >
                        {applied ? "✓ Applied" : "Apply"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Budget & Bid ── */}
        {activeSection === "Budget & Bid" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Budget & Bid Optimization</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Reallocate budget and adjust bids for maximum ROAS
              </p>
            </div>

            {/* Budget allocation */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Campaign Budget Allocation</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Campaign</th>
                      <th className="pb-2 pr-4">Daily Budget</th>
                      <th className="pb-2 pr-4">ROAS</th>
                      <th className="pb-2 pr-4">Suggested Budget</th>
                      <th className="pb-2">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {MOCK_CAMPAIGNS.map((c) => {
                      const suggested =
                        c.id === "c1"
                          ? c.dailyBudget + 15
                          : c.id === "c2"
                          ? c.dailyBudget - 15
                          : c.dailyBudget;
                      const diff = suggested - c.dailyBudget;
                      return (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 font-medium text-gray-800">{c.name}</td>
                          <td className="py-3 pr-4 text-gray-600">{formatCurrency(c.dailyBudget)}/day</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`font-semibold ${
                                c.roas >= 5
                                  ? "text-green-600"
                                  : c.roas >= 3
                                  ? "text-yellow-600"
                                  : "text-red-500"
                              }`}
                            >
                              {c.roas}×
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{formatCurrency(suggested)}/day</td>
                          <td className="py-3">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                diff > 0
                                  ? "bg-green-100 text-green-700"
                                  : diff < 0
                                  ? "bg-red-100 text-red-600"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {diff > 0 ? `+${formatCurrency(diff)}` : diff < 0 ? formatCurrency(diff) : "No change"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="mt-4 px-4 py-2 bg-[#e60023] text-white text-sm font-medium rounded-lg hover:bg-[#c8001e] transition-colors">
                Apply Suggested Allocation
              </button>
            </div>

            {/* Bid strategy */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Bid Strategy Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Broad Keywords", action: "Reduce bids by 12%", saving: "−$180/mo", reason: "23% of spend, only 8% of conversions" },
                  { label: "Exact Keywords", action: "Increase bids by 8%", impact: "+$420/mo revenue", reason: "High intent, under-allocated" },
                  { label: "Retargeting Audience", action: "Increase bids by 15%", impact: "+$640/mo revenue", reason: "5.8% conversion rate — highest performer" },
                  { label: "DIY & Crafts Segment", action: "Reduce bids by 20%", saving: "−$90/mo", reason: "1.1% conversion rate — lowest performer" },
                ].map((item) => (
                  <div key={item.label} className="border border-gray-100 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{item.action}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.reason}</p>
                    <p className={`text-xs font-medium mt-2 ${item.saving ? "text-red-600" : "text-green-600"}`}>
                      {item.saving || item.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Audience ── */}
        {activeSection === "Audience" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Audience Optimization</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Expand reach and improve targeting efficiency
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Audience Performance Review</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Audience</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Size</th>
                      <th className="pb-2 pr-4">CTR</th>
                      <th className="pb-2 pr-4">Conv. Rate</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {MOCK_AUDIENCES.sort((a, b) => b.convRate - a.convRate).map((aud) => (
                      <tr key={aud.id}>
                        <td className="py-3 pr-4 font-medium text-gray-800">{aud.name}</td>
                        <td className="py-3 pr-4">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                            {aud.type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{formatNumber(aud.size)}</td>
                        <td className="py-3 pr-4 text-gray-600">{aud.ctr}%</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`font-semibold ${
                              aud.convRate >= 4
                                ? "text-green-600"
                                : aud.convRate >= 2
                                ? "text-yellow-600"
                                : "text-red-500"
                            }`}
                          >
                            {aud.convRate}%
                          </span>
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
                Create a 1% lookalike audience from your <strong>Website Visitors (30d)</strong> retargeting list. With a 5.8% conversion rate, this segment is your highest performer. A lookalike could reach <strong>2.1M similar users</strong> and is estimated to convert at 3–4%.
              </p>
              <button className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Create Lookalike Audience
              </button>
            </div>
          </div>
        )}

        {/* ── Creative & Keywords ── */}
        {activeSection === "Creative & Keywords" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Creative & Keyword Optimization</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Refresh underperforming creatives and tighten keyword strategy
              </p>
            </div>

            {/* Creative */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Creative Refresh Queue</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Budget Home Decor Finds", fatigue: "High", drop: "−40% engagement", action: "Replace with video" },
                  { title: "Behind the Scenes", fatigue: "Medium", drop: "−18% engagement", action: "Update thumbnail" },
                  { title: "Cozy Living Room Makeover", fatigue: "Low", drop: "−8% engagement", action: "A/B test copy" },
                ].map((item) => (
                  <div key={item.title} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Fatigue: <span className={`font-medium ${item.fatigue === "High" ? "text-red-600" : item.fatigue === "Medium" ? "text-yellow-600" : "text-green-600"}`}>{item.fatigue}</span>
                          {" · "}{item.drop}
                        </p>
                      </div>
                      <button className="flex-shrink-0 text-xs bg-[#e60023] text-white px-3 py-1.5 rounded-lg hover:bg-[#c8001e] transition-colors">
                        {item.action}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Keyword Optimization</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Keyword</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Vol.</th>
                      <th className="pb-2 pr-4">Bid</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {KEYWORD_PLAN.map((kw, i) => (
                      <tr key={i} className={kw.negative ? "opacity-50" : ""}>
                        <td className="py-2.5 pr-4 font-medium text-gray-800">
                          {kw.keyword}
                          {kw.negative && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">−neg</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            kw.type === "exact"
                              ? "bg-orange-100 text-orange-700"
                              : kw.type === "phrase"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {kw.type === "exact" ? `[${kw.type}]` : kw.type === "phrase" ? `"${kw.type}"` : kw.type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">{kw.volume ? formatNumber(kw.volume) : "—"}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{kw.suggestedBid ? formatCurrency(kw.suggestedBid) : "—"}</td>
                        <td className="py-2.5">
                          {!kw.negative && (
                            <button className="text-xs text-[#e60023] font-medium hover:underline">
                              {kw.competition === "high" ? "Review bid" : "Add"}
                            </button>
                          )}
                        </td>
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
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Automated Rules</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Set-and-forget rules that run on your schedule
                </p>
              </div>
              <button className="px-4 py-2 bg-[#e60023] text-white text-sm font-medium rounded-lg hover:bg-[#c8001e] transition-colors">
                + New Rule
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3">Rule Name</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {AUTOMATED_RULES.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{rule.name}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.condition}</td>
                      <td className="px-4 py-3 text-gray-600">{rule.action}</td>
                      <td className="px-4 py-3 text-gray-500">{rule.frequency}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setRuleStatuses((prev) => ({
                              ...prev,
                              [rule.id]: prev[rule.id] === "active" ? "paused" : "active",
                            }))
                          }
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            ruleStatuses[rule.id] === "active" ? "bg-green-500" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              ruleStatuses[rule.id] === "active" ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs text-gray-400 hover:text-[#e60023] transition-colors">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800">
              <strong>Tip:</strong> The "No conversion pause" rule is paused. Enable it to automatically pause ads with 0 conversions after 1,000 impressions and save wasted spend.
            </div>
          </div>
        )}

        {/* ── AI Copilot ── */}
        {activeSection === "AI Copilot" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Growth Copilot</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Ask anything about your campaigns — budget, ROAS, audiences, or strategy
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: "520px" }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {copilotMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "ai" && (
                      <div className="w-7 h-7 rounded-full bg-[#e60023] flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-0.5">
                        AI
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] text-sm rounded-xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-[#e60023] text-white rounded-tr-sm"
                          : "bg-gray-100 text-gray-800 rounded-tl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick suggestions */}
              <div className="px-5 pb-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {COPILOT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendCopilot(s)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCopilot(copilotInput)}
                  placeholder="Ask about your campaigns..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                />
                <button
                  onClick={() => sendCopilot(copilotInput)}
                  disabled={!copilotInput.trim()}
                  className="px-4 py-2 bg-[#e60023] text-white text-sm font-medium rounded-lg hover:bg-[#c8001e] transition-colors disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
