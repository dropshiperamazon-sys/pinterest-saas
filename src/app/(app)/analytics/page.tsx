"use client";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import {
  Eye, MousePointerClick, Heart, ArrowUpRight, ArrowDownRight,
  Loader2, TrendingUp, Percent, Activity, ExternalLink, Calendar, Zap,
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

interface Analytics {
  impressions: number;
  pinClicks: number;
  outboundClicks: number;
  saves: number;
  engagements: number;
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

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [preset, setPreset] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const fetchData = useCallback((start: string, end: string) => {
    setLoading(true);
    fetch(`/api/pinterest-analytics?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(a => { if (!a.error) setData(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/pinterest-connection")
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        if (d.connected) fetchData(dateStr(30), yesterday());
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(days: number) {
    setPreset(days);
    setShowCustom(false);
    fetchData(dateStr(days), yesterday());
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
      label: "Pin Clicks", value: data?.pinClicks ?? 0, change: data?.pinClicksChange ?? null,
      icon: MousePointerClick, iconBg: "bg-indigo-50 text-indigo-600", valueColor: "text-indigo-700",
      tooltip: "Clicks to view your pin in closeup (not to your website)",
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
      label: "Engagements", value: data?.engagements ?? 0, change: data?.engagementsChange ?? null,
      icon: Zap, iconBg: "bg-yellow-50 text-yellow-600", valueColor: "text-yellow-700",
      tooltip: "Total interactions: clicks + saves + closeups",
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

  return (
    <div>
      <Header title="Analytics" subtitle="Real-time performance data from your Pinterest account." />
      <div className="p-6 space-y-6">

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
            {/* 7 stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.slice(0, 4).map(s => <StatCard key={s.label} {...s} />)}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-2 gap-6">
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
          </>
        )}
      </div>
    </div>
  );
}
