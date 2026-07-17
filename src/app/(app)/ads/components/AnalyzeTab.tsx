"use client";
import { useState } from "react";
import { formatNumber, cn } from "@/lib/utils";
import { MOCK_CAMPAIGNS, MOCK_CREATIVES, MOCK_AUDIENCES, FUNNEL_DATA, AI_INSIGHTS } from "@/lib/ads-data";
import {
  Eye, MousePointerClick, Bookmark, DollarSign, TrendingUp, TrendingDown,
  BarChart2, Users, ImageIcon, Sparkles, ArrowUpRight, AlertCircle,
  CheckCircle2, Info, Film,
} from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  ended: "bg-gray-100 text-gray-600",
  draft: "bg-blue-100 text-blue-700",
};

const FATIGUE_COLOR: Record<string, string> = {
  none: "bg-green-100 text-green-700",
  low: "bg-yellow-100 text-yellow-600",
  medium: "bg-orange-100 text-orange-600",
  high: "bg-red-100 text-red-600",
};

const FORMAT_ICON: Record<string, React.ElementType> = {
  standard: ImageIcon,
  video: Film,
  carousel: BarChart2,
  idea: Sparkles,
};

type AnalyzeSection = "dashboard" | "funnel" | "audience" | "creative" | "insights";

const SECTIONS = [
  { key: "dashboard", label: "Performance Dashboard", icon: BarChart2 },
  { key: "funnel", label: "Funnel Analysis", icon: TrendingUp },
  { key: "audience", label: "Audience Analysis", icon: Users },
  { key: "creative", label: "Creative Analysis", icon: ImageIcon },
  { key: "insights", label: "AI Insights", icon: Sparkles },
] as const;

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

function PerformanceDashboard() {
  const totals = MOCK_CAMPAIGNS.reduce((acc, c) => ({
    spend: acc.spend + c.totalSpend,
    impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks,
    saves: acc.saves + c.saves,
    conversions: acc.conversions + c.conversions,
    revenue: acc.revenue + c.revenue,
  }), { spend: 0, impressions: 0, clicks: 0, saves: 0, conversions: 0, revenue: 0 });

  const avgRoas = (totals.revenue / totals.spend).toFixed(1);
  const avgCtr = ((totals.clicks / totals.impressions) * 100).toFixed(2);
  const avgCpc = (totals.spend / totals.clicks).toFixed(2);
  const avgCpm = ((totals.spend / totals.impressions) * 1000).toFixed(2);

  return (
    <div className="space-y-5">
      {/* Top metrics */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Spend" value={`$${formatNumber(totals.spend)}`} change={8.4} icon={DollarSign} color="bg-[#e60023]/10 text-[#e60023]" />
        <StatCard label="Impressions" value={formatNumber(totals.impressions)} change={14.2} icon={Eye} color="bg-blue-50 text-blue-600" />
        <StatCard label="Clicks" value={formatNumber(totals.clicks)} change={11.8} icon={MousePointerClick} color="bg-purple-50 text-purple-600" />
        <StatCard label="Saves" value={formatNumber(totals.saves)} change={22.1} icon={Bookmark} color="bg-pink-50 text-pink-600" />
        <StatCard label="Conversions" value={formatNumber(totals.conversions)} change={18.6} icon={TrendingUp} color="bg-green-50 text-green-600" />
        <StatCard label="Revenue" value={`$${formatNumber(totals.revenue)}`} change={24.3} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Avg. ROAS" value={`${avgRoas}×`} change={14.8} icon={BarChart2} color="bg-orange-50 text-orange-600" />
        <StatCard label="Avg. CTR" value={`${avgCtr}%`} change={-2.1} icon={MousePointerClick} color="bg-indigo-50 text-indigo-600" />
      </div>

      {/* Secondary metrics row */}
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

      {/* Campaign table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Campaign Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Campaign", "Status", "Spend", "Impressions", "Clicks", "CTR", "CPC", "Conversions", "ROAS"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_CAMPAIGNS.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3">
                    <div className="text-sm font-medium text-gray-800 whitespace-nowrap">{c.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{c.objective}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[c.status])}>{c.status}</span>
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">${formatNumber(c.totalSpend)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(c.impressions)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(c.clicks)}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">{c.ctr}%</td>
                  <td className="px-3 py-3 text-sm text-gray-700">${c.cpc}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(c.conversions)}</td>
                  <td className="px-3 py-3">
                    <span className={cn("text-sm font-bold", c.roas >= 5 ? "text-green-600" : c.roas >= 3 ? "text-yellow-600" : "text-red-500")}>
                      {c.roas}×
                    </span>
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
                    <div className="w-24 text-xs text-red-500 font-medium">
                      −{dropOff}% drop
                    </div>
                  )}
                </div>
                {next && (
                  <div className="ml-36 mt-1 mb-1 h-4 w-px bg-gray-200 ml-[146px]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Attribution */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Attribution Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { model: "First-Touch", conversions: 312, revenue: "$14,040", desc: "Credits the first ad the user saw" },
            { model: "Last-Touch", conversions: 745, revenue: "$28,530", desc: "Credits the last ad before conversion" },
            { model: "Assisted", conversions: 1240, revenue: "$48,200", desc: "All touchpoints that contributed" },
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

function AudienceAnalysis() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        {/* Device performance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Device Performance</h3>
          {[
            { device: "Mobile", impressions: 2800000, clicks: 42000, convRate: 1.8, color: "bg-blue-500" },
            { device: "Desktop", impressions: 1400000, clicks: 19000, convRate: 2.4, color: "bg-purple-500" },
            { device: "Tablet", impressions: 440000, clicks: 4700, convRate: 1.5, color: "bg-green-500" },
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

        {/* Geographic */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Geographic Performance</h3>
          {[
            { location: "California, US", spend: 480, roas: 8.2, convRate: 3.1 },
            { location: "New York, US", spend: 320, roas: 6.8, convRate: 2.7 },
            { location: "London, UK", spend: 240, roas: 5.9, convRate: 2.4 },
            { location: "Toronto, CA", spend: 180, roas: 5.2, convRate: 2.1 },
            { location: "Sydney, AU", spend: 140, roas: 4.8, convRate: 1.9 },
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

      {/* Best-performing demographics */}
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
                { segment: "Women 35–44", impressions: 980000, clicks: 18200, ctr: 1.86, conv: 142, roas: 7.1, rec: "Expand lookalike" },
                { segment: "Women 18–24", impressions: 760000, clicks: 11400, ctr: 1.50, conv: 54, roas: 4.2, rec: "Test video format" },
                { segment: "Men 25–34", impressions: 420000, clicks: 5400, ctr: 1.29, conv: 18, roas: 2.1, rec: "Reduce bids" },
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
                      rec === "Reduce bids" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"
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
                        <Icon className="w-3.5 h-3.5" />
                        {ad.format}
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

      {/* Format comparison */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Format Performance Comparison</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { format: "Video", emoji: "🎬", avgCtr: 2.14, saves: 2200 },
            { format: "Carousel", emoji: "🎠", avgCtr: 2.24, saves: 3000 },
            { format: "Standard", emoji: "🖼️", avgCtr: 2.44, saves: 2800 },
            { format: "Idea", emoji: "💡", avgCtr: 0.92, saves: 1900 },
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

function AiInsightsPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">AI Performance Insights</h3>
          <p className="text-xs text-gray-400">Auto-generated from your campaign data</p>
        </div>
      </div>
      {AI_INSIGHTS.map((insight, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-4 p-4 rounded-2xl border",
            insight.type === "warning" ? "bg-orange-50 border-orange-200" :
            insight.type === "success" ? "bg-green-50 border-green-200" :
            "bg-blue-50 border-blue-100"
          )}
        >
          <span className="text-2xl flex-shrink-0">{insight.icon}</span>
          <div className="flex-1">
            <p className={cn("text-sm", insight.type === "warning" ? "text-orange-800" : insight.type === "success" ? "text-green-800" : "text-blue-800")}>
              {insight.message}
            </p>
          </div>
          <button className={cn(
            "flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0",
            insight.type === "warning" ? "bg-orange-600 text-white hover:bg-orange-700" :
            insight.type === "success" ? "bg-green-600 text-white hover:bg-green-700" :
            "bg-blue-600 text-white hover:bg-blue-700"
          )}>
            {insight.action} <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AnalyzeTab() {
  const [section, setSection] = useState<AnalyzeSection>("dashboard");

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
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        {section === "dashboard" && <PerformanceDashboard />}
        {section === "funnel" && <FunnelAnalysis />}
        {section === "audience" && <AudienceAnalysis />}
        {section === "creative" && <CreativeAnalysis />}
        {section === "insights" && <AiInsightsPanel />}
      </div>
    </div>
  );
}
