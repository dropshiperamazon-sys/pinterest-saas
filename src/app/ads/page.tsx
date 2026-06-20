"use client";
import { useState } from "react";
import Header from "@/components/Header";
import { MOCK_COMPETITORS, AD_OBJECTIVES } from "@/lib/pinterest-data";
import { formatNumber, formatCurrency, cn } from "@/lib/utils";
import {
  Megaphone, Target, Users, Eye, MousePointerClick, DollarSign,
  TrendingUp, ChevronRight, Plus, BarChart2, ExternalLink, ArrowUpRight,
  Zap, Shield, Search,
} from "lucide-react";

type Tab = "campaigns" | "create" | "competitors";

const MOCK_CAMPAIGNS = [
  { id: "1", name: "Summer Sale - Home Decor", objective: "conversions", status: "active", budget: 50, spent: 32.40, impressions: 124000, clicks: 3240, ctr: 2.6, roas: 4.2 },
  { id: "2", name: "Brand Awareness Q2", objective: "awareness", status: "active", budget: 30, spent: 28.10, impressions: 210000, clicks: 1890, ctr: 0.9, roas: 2.1 },
  { id: "3", name: "Traffic - Blog Posts", objective: "traffic", status: "paused", budget: 20, spent: 8.50, impressions: 45000, clicks: 980, ctr: 2.2, roas: 1.8 },
];

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  ended: "bg-gray-100 text-gray-600",
};

export default function AdsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("campaigns");
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [adForm, setAdForm] = useState({
    name: "",
    objective: "",
    dailyBudget: "",
    targetKeywords: "",
    audience: "all",
    startDate: "",
  });

  const competitor = MOCK_COMPETITORS.find((c) => c.id === selectedCompetitor);

  return (
    <div>
      <Header title="Ads Manager" subtitle="Create, manage, and analyze your Pinterest ad campaigns" />
      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
          {([
            { key: "campaigns", label: "My Campaigns", icon: Megaphone },
            { key: "create", label: "Create Campaign", icon: Plus },
            { key: "competitors", label: "Competitor Ads", icon: Search },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === key ? "bg-[#e60023] text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Campaigns Tab */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Spend", value: "$69.00", icon: DollarSign, color: "text-[#e60023] bg-red-50" },
                { label: "Impressions", value: "379K", icon: Eye, color: "text-blue-600 bg-blue-50" },
                { label: "Total Clicks", value: "6,110", icon: MousePointerClick, color: "text-purple-600 bg-purple-50" },
                { label: "Avg. ROAS", value: "2.7x", icon: TrendingUp, color: "text-green-600 bg-green-50" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Campaign List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Active Campaigns</h3>
                <button
                  onClick={() => setActiveTab("create")}
                  className="flex items-center gap-1.5 bg-[#e60023] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#ad081b] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Campaign
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      {["Campaign", "Status", "Budget/day", "Spent", "Impressions", "Clicks", "CTR", "ROAS"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {MOCK_CAMPAIGNS.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-sm text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-400 capitalize mt-0.5">{c.objective}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold capitalize", STATUS_STYLE[c.status])}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">${c.budget}/day</td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">${c.spent}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatNumber(c.impressions)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatNumber(c.clicks)}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                            {c.ctr}%
                            <div className="w-12 bg-gray-100 rounded-full h-1.5 ml-1">
                              <div className="bg-[#e60023] h-1.5 rounded-full" style={{ width: `${Math.min(c.ctr * 10, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn("text-sm font-semibold", c.roas >= 3 ? "text-green-600" : c.roas >= 2 ? "text-yellow-600" : "text-red-500")}>
                            {c.roas}x
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Create Campaign Tab */}
        {activeTab === "create" && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              {/* Campaign Name */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Campaign Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Campaign Name *</label>
                    <input
                      value={adForm.name}
                      onChange={(e) => setAdForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Summer Sale - Home Decor"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Daily Budget</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={adForm.dailyBudget}
                        onChange={(e) => setAdForm((f) => ({ ...f, dailyBudget: e.target.value }))}
                        placeholder="10.00"
                        className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Target Keywords</label>
                    <textarea
                      value={adForm.targetKeywords}
                      onChange={(e) => setAdForm((f) => ({ ...f, targetKeywords: e.target.value }))}
                      placeholder="home decor ideas, minimalist bedroom, cozy living room..."
                      rows={3}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Separate keywords with commas</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={adForm.startDate}
                      onChange={(e) => setAdForm((f) => ({ ...f, startDate: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                </div>
              </div>

              {/* Objective */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Campaign Objective</h3>
                <div className="grid grid-cols-2 gap-3">
                  {AD_OBJECTIVES.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => setAdForm((f) => ({ ...f, objective: obj.id }))}
                      className={cn(
                        "text-left p-4 border-2 rounded-xl transition-all",
                        adForm.objective === obj.id
                          ? "border-[#e60023] bg-[#e60023]/5"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="text-2xl mb-2">{obj.icon}</div>
                      <div className="text-sm font-semibold text-gray-800">{obj.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{obj.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="w-full bg-[#e60023] text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors flex items-center justify-center gap-2"
              >
                <Megaphone className="w-4 h-4" />
                Launch Campaign
              </button>
            </div>

            {/* Tips Sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900">Campaign Tips</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { tip: "Start with $10-20/day budget to test performance before scaling.", icon: DollarSign },
                    { tip: "Use 5-10 targeted keywords for better relevance scores.", icon: Target },
                    { tip: "Vertical images (2:3 ratio) perform best on Pinterest.", icon: BarChart2 },
                    { tip: "Add text overlay to pins to increase click-through rates by up to 40%.", icon: TrendingUp },
                  ].map(({ tip, icon: Icon }, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 bg-yellow-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3 h-3 text-yellow-600" />
                      </div>
                      <p className="text-xs text-gray-600">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-[#e60023] to-[#ad081b] rounded-2xl p-5 text-white">
                <Shield className="w-6 h-6 mb-3 opacity-80" />
                <h4 className="font-semibold mb-1">Pro Ad Intelligence</h4>
                <p className="text-xs opacity-80 mb-3">Get AI-powered ad recommendations based on your niche and competitors.</p>
                <button className="bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-white/30 transition-colors">
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Competitors Tab */}
        {activeTab === "competitors" && (
          <div className="grid grid-cols-3 gap-6">
            {/* Competitor List */}
            <div className="col-span-1 space-y-3">
              <h3 className="font-semibold text-gray-900">Competitors Running Ads</h3>
              {MOCK_COMPETITORS.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedCompetitor(comp.id)}
                  className={cn(
                    "w-full text-left p-4 bg-white rounded-2xl border transition-all",
                    selectedCompetitor === comp.id ? "border-[#e60023] shadow-md" : "border-gray-100 shadow-sm hover:border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#e60023]/10 text-[#e60023] rounded-xl flex items-center justify-center font-bold text-sm">
                      {comp.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{comp.name}</div>
                      <div className="text-xs text-gray-500">{comp.niche}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                  <div className="flex gap-3 mt-3">
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-900">{formatNumber(comp.followers)}</div>
                      <div className="text-xs text-gray-400">followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-900">{comp.adsRunning}</div>
                      <div className="text-xs text-gray-400">active ads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-900">{formatNumber(comp.monthlyImpressions)}</div>
                      <div className="text-xs text-gray-400">impressions</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Competitor Detail */}
            <div className="col-span-2">
              {competitor ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-14 h-14 bg-[#e60023]/10 text-[#e60023] rounded-2xl flex items-center justify-center font-bold text-lg">
                        {competitor.avatar}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{competitor.name}</h3>
                        <p className="text-sm text-gray-500">{competitor.niche} • {competitor.adsRunning} active ads</p>
                      </div>
                      <button className="ml-auto flex items-center gap-1.5 text-xs text-[#e60023] border border-[#e60023]/30 px-3 py-2 rounded-lg hover:bg-[#e60023]/5 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Profile
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-gray-900">{formatNumber(competitor.followers)}</div>
                        <div className="text-xs text-gray-500">Followers</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-gray-900">{formatNumber(competitor.monthlyImpressions)}</div>
                        <div className="text-xs text-gray-500">Mo. Impressions</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-lg font-bold text-gray-900">{competitor.adsRunning}</div>
                        <div className="text-xs text-gray-500">Running Ads</div>
                      </div>
                    </div>

                    {/* Top Keywords */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Top Keywords They Target</h4>
                      <div className="flex flex-wrap gap-2">
                        {competitor.topKeywords.map((kw) => (
                          <span key={kw} className="bg-[#e60023]/10 text-[#e60023] text-xs px-3 py-1.5 rounded-full font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ad Creatives */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Their Ad Creatives</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {competitor.creatives.map((creative) => (
                        <div key={creative.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                          <div className="bg-gray-50 h-32 flex items-center justify-center text-4xl">
                            {creative.image}
                          </div>
                          <div className="p-3">
                            <div className="text-sm font-semibold text-gray-800 mb-1 truncate">{creative.title}</div>
                            <div className="text-xs text-gray-400 mb-2">{creative.format}</div>
                            <div className="grid grid-cols-3 gap-1 text-center">
                              <div>
                                <div className="text-xs font-bold text-gray-900">{creative.ctr}%</div>
                                <div className="text-xs text-gray-400">CTR</div>
                              </div>
                              <div>
                                <div className="text-xs font-bold text-gray-900">${creative.spend}</div>
                                <div className="text-xs text-gray-400">Spend</div>
                              </div>
                              <div>
                                <div className="text-xs font-bold text-gray-900">{formatNumber(creative.impressions)}</div>
                                <div className="text-xs text-gray-400">Impr.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button className="flex-1 flex items-center justify-center gap-2 bg-[#e60023] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors">
                      <Megaphone className="w-4 h-4" />
                      Create Similar Campaign
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
                      <Users className="w-4 h-4" />
                      Track Competitor
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 mb-1">Select a Competitor</h3>
                  <p className="text-sm text-gray-400 max-w-xs">
                    Click on a competitor to see their active ads, creatives, and keyword targeting strategy.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
