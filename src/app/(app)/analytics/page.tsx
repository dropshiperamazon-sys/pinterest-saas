"use client";
import { usePlan } from "@/hooks/usePlan";
import UpgradeGate from "@/components/UpgradeGate";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import {
  Eye, MousePointerClick, Heart, ArrowUpRight, ArrowDownRight,
  Loader2, TrendingUp, Percent, Activity, ExternalLink, Calendar, Zap,
  Users, UserCheck, ChevronDown, ShoppingBag, DollarSign, Target,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

interface DayData {
  date: string;
  impressions: number;
  pinClicks: number;
  outboundClicks: number;
  saves: number;
  engagements: number;
  ctr: number;
  saveRate: number;
}

interface TopPin {
  pinId: string;
  impressions: number;
  saves: number;
  pinClicks: number;
  outboundClicks: number;
  engagements: number;
}

interface Analytics {
  impressions: number;
  pinClicks: number;
  outboundClicks: number;
  saves: number;
  engagements: number;
  totalAudience: number;
  engagedAudience: number;
  ctr: number;
  saveRate: number;
  impressionsChange: number | null;
  pinClicksChange: number | null;
  outboundClicksChange: number | null;
  savesChange: number | null;
  engagementsChange: number | null;
  ctrChange: number | null;
  saveRateChange: number | null;
  daily: DayData[];
  topPins: TopPin[];
  period: { startDate: string; endDate: string };
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
];

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function yesterday() { return dateStr(1); }

function StatCard({
  label, value, change, icon: Icon, iconBg, valueColor, isRate, tooltip,
}: {
  label: string; value: number; change: number | null;
  icon: React.ElementType; iconBg: string; valueColor: string;
  isRate?: boolean; tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
          {tooltip && (
            <span title={tooltip} className="text-gray-300 cursor-help text-xs">ⓘ</span>
          )}
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${valueColor}`}>
        {isRate ? `${value.toFixed(2)}%` : formatNumber(value)}
      </div>
      {change !== null ? (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
          {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}% vs prior period
        </div>
      ) : (
        <div className="text-xs text-gray-400 mt-1">vs prior period</div>
      )}
    </div>
  );
}

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs min-w-[150px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-bold text-gray-800">
            {p.name.includes("%") ? `${Number(p.value).toFixed(2)}%` : formatNumber(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

type ContentType = "ALL" | "ORGANIC" | "PAID";

interface PaidCampaign {
  id: unknown; name: unknown; status: string;
  spend: number; impressions: number; clicks: number;
  saves: number; engagements: number;
  ctr: number; cpc: number; cpm: number;
  checkouts: number; addToCart: number; pageVisits: number; revenue: number; aov: number;
}

interface PaidData {
  adAccountId: string;
  adAccountName: string;
  period: { startDate: string; endDate: string };
  totals: {
    spend: number; impressions: number; clicks: number; saves: number; engagements: number;
    checkouts: number; addToCart: number; pageVisits: number; revenue: number; aov: number;
  };
  campaigns: PaidCampaign[];
}

type PinSortKey = "impressions" | "engagements" | "pinClicks" | "outboundClicks" | "saves";
const PIN_SORT_OPTIONS: { key: PinSortKey; label: string }[] = [
  { key: "impressions",    label: "Impressions" },
  { key: "engagements",   label: "Engagements" },
  { key: "pinClicks",     label: "Pin clicks" },
  { key: "outboundClicks", label: "Outbound clicks" },
  { key: "saves",         label: "Saves" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [preset, setPreset] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [contentType, setContentType] = useState<ContentType>("ALL");
  const [pinSort, setPinSort] = useState<PinSortKey>("impressions");
  const [pinImages, setPinImages] = useState<Record<string, { title: string; imageUrl: string }>>({});
  const [paidData, setPaidData] = useState<PaidData | null>(null);
  const [paidLoading, setPaidLoading] = useState(false);
  const [paidError, setPaidError] = useState<string | null>(null);

  const fetchData = useCallback((start: string, end: string) => {
    setLoading(true);
    fetch(`/api/pinterest-analytics?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(a => { if (!a.error) setData(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchPaid = useCallback((days: number) => {
    setPaidLoading(true);
    setPaidError(null);
    fetch(`/api/pinterest-ads?days=${days}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setPaidError(d.error);
        else setPaidData(d as PaidData);
      })
      .catch(() => setPaidError("Unable to load paid data"))
      .finally(() => setPaidLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/pinterest-connection")
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        if (d.connected) {
          fetchData(dateStr(30), yesterday());
          fetchPaid(30);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enrich top pin IDs with images + titles via pin-analytics endpoint
  useEffect(() => {
    if (!data?.topPins?.length) return;
    for (const pin of data.topPins.slice(0, 12)) {
      if (pinImages[pin.pinId]) continue;
      fetch(`/api/pinterest-catalog/pin-analytics?pinId=${encodeURIComponent(pin.pinId)}&days=1`)
        .then(r => r.json())
        .then(d => {
          if (d.pin) {
            setPinImages(prev => ({ ...prev, [pin.pinId]: { title: d.pin.title, imageUrl: d.pin.imageUrl } }));
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.topPins]);

  const { limits, loading: planLoading } = usePlan();
  if (!planLoading && !limits.canAnalytics) return <UpgradeGate requiredPlan="pro" feature="Analytics Dashboard" />;

  function applyPreset(days: number) {
    setPreset(days);
    setShowCustom(false);
    fetchData(dateStr(days), yesterday());
    fetchPaid(days);
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    fetchData(customStart, customEnd);
    setShowCustom(false);
  }

  if (!connected && !loading) {
    return (
      <div>
        <Header title="Analytics" subtitle="Real-time data from your Pinterest account." />
        <div className="p-6">
          <div className="bg-gradient-to-r from-[#e60023]/5 to-[#e60023]/10 border border-[#e60023]/20 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-[#e60023] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Connect Pinterest to see analytics</h2>
            <p className="text-sm text-gray-500 mb-6">Link your account to view impressions, clicks, saves, and more.</p>
            <a href="/api/pinterest-oauth/start" className="inline-block bg-[#e60023] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors">
              Connect Pinterest
            </a>
          </div>
        </div>
      </div>
    );
  }

  const chartData = (data?.daily ?? []).map(d => ({
    date: shortDate(d.date),
    Impressions: d.impressions,
    "Pin Clicks": d.pinClicks,
    "Outbound Clicks": d.outboundClicks,
    Saves: d.saves,
    Engagements: d.engagements,
    "CTR %": d.ctr,
    "Save Rate %": d.saveRate,
  }));

  const stats = [
    {
      label: "Impressions", value: data?.impressions ?? 0, change: data?.impressionsChange ?? null,
      icon: Eye, iconBg: "bg-blue-50 text-blue-600", valueColor: "text-blue-700",
      tooltip: "Total times your pins were shown to people",
    },
    {
      label: "Engagements", value: data?.engagements ?? 0, change: data?.engagementsChange ?? null,
      icon: Zap, iconBg: "bg-yellow-50 text-yellow-600", valueColor: "text-yellow-700",
      tooltip: "Total interactions: clicks + saves + closeups",
    },
    {
      label: "Outbound Clicks", value: data?.outboundClicks ?? 0, change: data?.outboundClicksChange ?? null,
      icon: ExternalLink, iconBg: "bg-green-50 text-green-600", valueColor: "text-green-700",
      tooltip: "Clicks that sent people to your website from a pin",
    },
    {
      label: "Saves", value: data?.saves ?? 0, change: data?.savesChange ?? null,
      icon: Heart, iconBg: "bg-pink-50 text-pink-600", valueColor: "text-pink-700",
      tooltip: "Times people saved your pins to their boards",
    },
    {
      label: "Total Audience", value: data?.totalAudience ?? 0, change: null,
      icon: Users, iconBg: "bg-cyan-50 text-cyan-600", valueColor: "text-cyan-700",
      tooltip: "Unique people who saw your pins in this period",
    },
    {
      label: "Engaged Audience", value: data?.engagedAudience ?? 0, change: null,
      icon: UserCheck, iconBg: "bg-teal-50 text-teal-600", valueColor: "text-teal-700",
      tooltip: "Unique people who interacted with your pins",
    },
    {
      label: "Pin Clicks", value: data?.pinClicks ?? 0, change: data?.pinClicksChange ?? null,
      icon: MousePointerClick, iconBg: "bg-indigo-50 text-indigo-600", valueColor: "text-indigo-700",
      tooltip: "Clicks to view your pin in closeup (not to your website)",
    },
    {
      label: "Click-Through Rate", value: data?.ctr ?? 0, change: data?.ctrChange ?? null,
      icon: Percent, iconBg: "bg-orange-50 text-orange-600", valueColor: "text-orange-700",
      isRate: true,
      tooltip: "Outbound clicks ÷ Impressions — how often pins drive traffic",
    },
    {
      label: "Save Rate", value: data?.saveRate ?? 0, change: data?.saveRateChange ?? null,
      icon: Activity, iconBg: "bg-purple-50 text-purple-600", valueColor: "text-purple-700",
      isRate: true,
      tooltip: "Saves ÷ Impressions — how often people save your pins",
    },
  ];

  const sortedPins = [...(data?.topPins ?? [])].sort((a, b) => b[pinSort] - a[pinSort]);

  return (
    <div>
      <Header title="Analytics" subtitle="Real-time performance data from your Pinterest account." />
      <div className="p-4 sm:p-6 space-y-6">

        {/* Time frame selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => applyPreset(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  preset === p.days && !showCustom
                    ? "bg-[#e60023] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustom(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
              showCustom ? "bg-[#e60023] text-white border-[#e60023]" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Custom range
          </button>
          {showCustom && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                max={customEnd || yesterday()} className="text-xs border-none outline-none text-gray-700" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                min={customStart} max={yesterday()} className="text-xs border-none outline-none text-gray-700" />
              <button onClick={applyCustom} disabled={!customStart || !customEnd}
                className="bg-[#e60023] text-white text-xs px-3 py-1 rounded-lg font-medium disabled:opacity-40 hover:bg-[#ad081b] transition-colors">
                Apply
              </button>
            </div>
          )}
          {/* Content type filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {(["ALL", "ORGANIC", "PAID"] as ContentType[]).map(ct => (
              <button
                key={ct}
                onClick={() => setContentType(ct)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  contentType === ct ? "bg-[#e60023] text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {ct === "ALL" ? "All" : ct === "ORGANIC" ? "Organic" : "Paid and earned"}
              </button>
            ))}
          </div>

          {data?.period && (
            <span className="text-xs text-gray-400 ml-auto">{data.period.startDate} → {data.period.endDate}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#e60023]" />
            Loading your Pinterest data…
          </div>
        ) : (
          <>
            {/* ── Paid Performance ─────────────────────────────────────── */}
            {contentType !== "ORGANIC" && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-5 h-5 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Target className="w-3 h-3 text-purple-600" />
                      </span>
                      Paid Performance
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {paidData ? `${paidData.adAccountName} · ${paidData.period.startDate} – ${paidData.period.endDate}` : "Ad account data"}
                    </p>
                  </div>
                  {paidData && (
                    <span className="text-xs bg-purple-50 text-purple-600 font-medium px-3 py-1 rounded-xl">
                      {paidData.campaigns.length} campaigns
                    </span>
                  )}
                </div>

                {paidLoading ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> Loading paid data…
                  </div>
                ) : paidError ? (
                  <div className="px-5 py-6 text-sm text-amber-600 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    {paidError === "No ad accounts found"
                      ? "No Pinterest ad account linked to this Pinterest account."
                      : paidError}
                  </div>
                ) : paidData ? (
                  <div className="p-5 space-y-5">
                    {/* Paid totals */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      {[
                        { label: "Spend", value: `$${paidData.totals.spend.toFixed(2)}`, icon: DollarSign, color: "text-purple-700", bg: "bg-purple-50 text-purple-600" },
                        { label: "Impressions", value: formatNumber(paidData.totals.impressions), icon: Eye, color: "text-blue-700", bg: "bg-blue-50 text-blue-600" },
                        { label: "Clicks", value: formatNumber(paidData.totals.clicks), icon: MousePointerClick, color: "text-indigo-700", bg: "bg-indigo-50 text-indigo-600" },
                        { label: "Saves", value: formatNumber(paidData.totals.saves), icon: Heart, color: "text-pink-700", bg: "bg-pink-50 text-pink-600" },
                        { label: "Engagements", value: formatNumber(paidData.totals.engagements), icon: Zap, color: "text-yellow-700", bg: "bg-yellow-50 text-yellow-600" },
                        { label: "Revenue", value: `$${paidData.totals.revenue.toFixed(2)}`, icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-50 text-emerald-600" },
                        { label: "Checkouts", value: formatNumber(paidData.totals.checkouts), icon: ShoppingBag, color: "text-teal-700", bg: "bg-teal-50 text-teal-600" },
                        { label: "Add to Cart", value: formatNumber(paidData.totals.addToCart), icon: ShoppingBag, color: "text-cyan-700", bg: "bg-cyan-50 text-cyan-600" },
                        { label: "Page Visits", value: formatNumber(paidData.totals.pageVisits), icon: Activity, color: "text-orange-700", bg: "bg-orange-50 text-orange-600" },
                        { label: "AOV", value: paidData.totals.aov > 0 ? `$${paidData.totals.aov.toFixed(2)}` : "—", icon: DollarSign, color: "text-violet-700", bg: "bg-violet-50 text-violet-600" },
                      ].map(({ label, value, icon: Icon, color, bg }) => (
                        <div key={label} className="bg-gray-50 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
                              <Icon className="w-3 h-3" />
                            </div>
                          </div>
                          <p className={`text-xl font-bold ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Campaign table */}
                    {paidData.campaigns.length > 0 && (
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                              <th className="px-4 py-3 text-left font-medium">Campaign</th>
                              <th className="px-3 py-3 text-left font-medium">Status</th>
                              <th className="px-3 py-3 text-right font-medium">Spend</th>
                              <th className="px-3 py-3 text-right font-medium">Impressions</th>
                              <th className="px-3 py-3 text-right font-medium">Clicks</th>
                              <th className="px-3 py-3 text-right font-medium">CTR</th>
                              <th className="px-3 py-3 text-right font-medium">CPC</th>
                              <th className="px-3 py-3 text-right font-medium">Saves</th>
                              <th className="px-3 py-3 text-right font-medium">Revenue</th>
                              <th className="px-3 py-3 text-right font-medium">Checkouts</th>
                              <th className="px-3 py-3 text-right font-medium">Add to Cart</th>
                              <th className="px-3 py-3 text-right font-medium pr-4">AOV</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {paidData.campaigns.map((c) => (
                              <tr key={String(c.id)} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                                  {String(c.name)}
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    c.status === "active"
                                      ? "bg-green-100 text-green-700"
                                      : c.status === "paused"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-gray-100 text-gray-500"
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-right text-purple-700 font-semibold">
                                  ${c.spend.toFixed(2)}
                                </td>
                                <td className="px-3 py-3 text-right text-gray-700">{formatNumber(c.impressions)}</td>
                                <td className="px-3 py-3 text-right text-gray-700">{formatNumber(c.clicks)}</td>
                                <td className="px-3 py-3 text-right text-gray-600">{c.ctr.toFixed(2)}%</td>
                                <td className="px-3 py-3 text-right text-gray-600">
                                  {c.cpc > 0 ? `$${c.cpc.toFixed(2)}` : "—"}
                                </td>
                                <td className="px-3 py-3 text-right text-gray-600">{formatNumber(c.saves)}</td>
                                <td className="px-3 py-3 text-right text-emerald-700 font-semibold">
                                  {c.revenue > 0 ? `$${c.revenue.toFixed(2)}` : "—"}
                                </td>
                                <td className="px-3 py-3 text-right text-teal-700">{c.checkouts > 0 ? formatNumber(c.checkouts) : "—"}</td>
                                <td className="px-3 py-3 text-right text-cyan-700">{c.addToCart > 0 ? formatNumber(c.addToCart) : "—"}</td>
                                <td className="px-3 py-3 text-right text-violet-700 pr-4">
                                  {c.aov > 0 ? `$${c.aov.toFixed(2)}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Organic Performance ────────────────────────────────── */}
            {contentType !== "PAID" && (
              <>
            {/* Stat cards — row 1: Impressions, Engagements, Outbound, Saves */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.slice(0, 4).map(s => <StatCard key={s.label} {...s} />)}
            </div>
            {/* Row 2: Total Audience, Engaged Audience, Pin Clicks, CTR, Save Rate */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {stats.slice(4).map(s => <StatCard key={s.label} {...s} />)}
            </div>

            {chartData.length > 0 && (
              <>
                {/* Impressions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Impressions</h2>
                  <p className="text-xs text-gray-400 mb-4">How many times your pins were shown</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gImp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Impressions" stroke="#3b82f6" strokeWidth={2} fill="url(#gImp)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Pin Clicks vs Outbound Clicks */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-1">
                    <h2 className="text-base font-semibold text-gray-900">Pin Clicks vs Outbound Clicks</h2>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    <span className="text-indigo-500 font-medium">Pin Clicks</span> = closeup views &nbsp;·&nbsp;
                    <span className="text-green-500 font-medium">Outbound Clicks</span> = traffic to your website
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gPC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gOC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="Pin Clicks" stroke="#6366f1" strokeWidth={2} fill="url(#gPC)" dot={false} />
                      <Area type="monotone" dataKey="Outbound Clicks" stroke="#22c55e" strokeWidth={2} fill="url(#gOC)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Saves & Engagements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Saves</h2>
                    <p className="text-xs text-gray-400 mb-4">Times users saved your pins to boards</p>
                    <ResponsiveContainer width="100%" height={170}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gSav" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="Saves" stroke="#ec4899" strokeWidth={2} fill="url(#gSav)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Engagements</h2>
                    <p className="text-xs text-gray-400 mb-4">Total interactions (clicks + saves + closeups)</p>
                    <ResponsiveContainer width="100%" height={170}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gEng" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="Engagements" stroke="#eab308" strokeWidth={2} fill="url(#gEng)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* CTR & Save Rate */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Click-Through Rate & Save Rate</h2>
                  <p className="text-xs text-gray-400 mb-4">CTR = Outbound Clicks ÷ Impressions · Save Rate = Saves ÷ Impressions</p>
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gCTR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gSR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="CTR %" stroke="#f97316" strokeWidth={2} fill="url(#gCTR)" dot={false} />
                      <Area type="monotone" dataKey="Save Rate %" stroke="#a855f7" strokeWidth={2} fill="url(#gSR)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Daily bar chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Daily breakdown</h2>
                  <p className="text-xs text-gray-400 mb-4">All key metrics per day</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barGap={1} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Impressions" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={8} />
                      <Bar dataKey="Pin Clicks" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={8} />
                      <Bar dataKey="Outbound Clicks" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={8} />
                      <Bar dataKey="Saves" fill="#ec4899" radius={[3, 3, 0, 0]} maxBarSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* ── Top Pins (organic) ────────────────────────────────── */}
            {sortedPins.length > 0 && contentType !== ("PAID" as ContentType) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Top Pins</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Displays up to 25 pins based on the sorted metric · {data?.period.startDate} – {data?.period.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-xs text-gray-500">Sort by</span>
                    <div className="relative">
                      <select
                        value={pinSort}
                        onChange={(e) => setPinSort(e.target.value as PinSortKey)}
                        className="appearance-none text-sm border border-gray-200 rounded-xl pl-3 pr-8 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e60023]/30 cursor-pointer"
                      >
                        {PIN_SORT_OPTIONS.map(o => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-5 py-3 text-left font-medium">Pin</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className={`px-4 py-3 text-right font-medium ${pinSort === "impressions" ? "text-[#e60023]" : ""}`}>Impressions</th>
                        <th className={`px-4 py-3 text-right font-medium ${pinSort === "engagements" ? "text-[#e60023]" : ""}`}>Engagements</th>
                        <th className={`px-4 py-3 text-right font-medium ${pinSort === "pinClicks" ? "text-[#e60023]" : ""}`}>Pin Clicks</th>
                        <th className={`px-4 py-3 text-right font-medium ${pinSort === "outboundClicks" ? "text-[#e60023]" : ""}`}>Outbound Clicks</th>
                        <th className="px-4 py-3 text-right font-medium pr-5">Saves</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sortedPins.map((pin, i) => {
                        const meta = pinImages[pin.pinId];
                        return (
                          <tr key={pin.pinId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                {meta?.imageUrl ? (
                                  <img src={meta.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <ShoppingBag className="w-4 h-4 text-gray-300" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate max-w-[220px]">
                                    {meta?.title || `Pin ${pin.pinId}`}
                                  </p>
                                  <p className="text-xs text-gray-400 font-mono">#{i + 1}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Organic</span>
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${pinSort === "impressions" ? "text-[#e60023]" : "text-gray-700"}`}>
                              {formatNumber(pin.impressions)}
                            </td>
                            <td className={`px-4 py-3 text-right ${pinSort === "engagements" ? "font-semibold text-[#e60023]" : "text-gray-600"}`}>
                              {formatNumber(pin.engagements)}
                            </td>
                            <td className={`px-4 py-3 text-right ${pinSort === "pinClicks" ? "font-semibold text-[#e60023]" : "text-gray-600"}`}>
                              {formatNumber(pin.pinClicks)}
                            </td>
                            <td className={`px-4 py-3 text-right ${pinSort === "outboundClicks" ? "font-semibold text-[#e60023]" : "text-gray-600"}`}>
                              {formatNumber(pin.outboundClicks)}
                            </td>
                            <td className={`px-4 py-3 text-right pr-5 ${pinSort === "saves" ? "font-semibold text-[#e60023]" : "text-gray-600"}`}>
                              {formatNumber(pin.saves)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
