"use client";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import {
  Eye, MousePointerClick, Heart, ArrowUpRight, ArrowDownRight,
  Loader2, TrendingUp, Percent, Activity, Calendar,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

interface DayData {
  date: string;
  impressions: number;
  clicks: number;
  saves: number;
  ctr: number;
  saveRate: number;
}

interface Analytics {
  impressions: number;
  pinClicks: number;
  saves: number;
  ctr: number;
  saveRate: number;
  engagementRate: number;
  impressionsChange: number | null;
  pinClicksChange: number | null;
  savesChange: number | null;
  ctrChange: number | null;
  saveRateChange: number | null;
  engagementRateChange: number | null;
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
function yesterday() {
  return dateStr(1);
}

function StatCard({
  label, value, change, icon: Icon, iconBg, valueColor, isRate,
}: {
  label: string; value: number; change: number | null;
  icon: React.ElementType; iconBg: string; valueColor: string; isRate?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
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
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="font-bold text-gray-800">
            {p.name.includes("Rate") || p.name === "CTR" ? `${p.value.toFixed(2)}%` : formatNumber(p.value)}
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
            <p className="text-sm text-gray-500 mb-6">Link your account to view real impressions, clicks, saves, and rates.</p>
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
    "Pin Clicks": d.clicks,
    Saves: d.saves,
    "CTR (%)": d.ctr,
    "Save Rate (%)": d.saveRate,
  }));

  const stats = [
    { label: "Impressions", value: data?.impressions ?? 0, change: data?.impressionsChange ?? null, icon: Eye, iconBg: "bg-blue-50 text-blue-600", valueColor: "text-blue-700" },
    { label: "Pin Clicks", value: data?.pinClicks ?? 0, change: data?.pinClicksChange ?? null, icon: MousePointerClick, iconBg: "bg-green-50 text-green-600", valueColor: "text-green-700" },
    { label: "Saves", value: data?.saves ?? 0, change: data?.savesChange ?? null, icon: Heart, iconBg: "bg-pink-50 text-pink-600", valueColor: "text-pink-700" },
    { label: "Click-Through Rate", value: data?.ctr ?? 0, change: data?.ctrChange ?? null, icon: Percent, iconBg: "bg-indigo-50 text-indigo-600", valueColor: "text-indigo-700", isRate: true },
    { label: "Save Rate", value: data?.saveRate ?? 0, change: data?.saveRateChange ?? null, icon: Activity, iconBg: "bg-orange-50 text-orange-600", valueColor: "text-orange-700", isRate: true },
    { label: "Engagement Rate", value: data?.engagementRate ?? 0, change: data?.engagementRateChange ?? null, icon: TrendingUp, iconBg: "bg-purple-50 text-purple-600", valueColor: "text-purple-700", isRate: true },
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
              <input
                type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                max={customEnd || yesterday()}
                className="text-xs border-none outline-none text-gray-700"
              />
              <span className="text-gray-400 text-xs">→</span>
              <input
                type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                min={customStart} max={yesterday()}
                className="text-xs border-none outline-none text-gray-700"
              />
              <button
                onClick={applyCustom} disabled={!customStart || !customEnd}
                className="bg-[#e60023] text-white text-xs px-3 py-1 rounded-lg font-medium disabled:opacity-40 hover:bg-[#ad081b] transition-colors"
              >
                Apply
              </button>
            </div>
          )}
          {data?.period && (
            <span className="text-xs text-gray-400 ml-auto">
              {data.period.startDate} → {data.period.endDate}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#e60023]" />
            Loading your Pinterest data…
          </div>
        ) : (
          <>
            {/* 6 stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map(s => <StatCard key={s.label} {...s} />)}
            </div>

            {chartData.length > 0 && (
              <>
                {/* Impressions over time */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Impressions over time</h2>
                  <p className="text-xs text-gray-400 mb-4">How many times your pins were shown</p>
                  <ResponsiveContainer width="100%" height={220}>
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

                {/* Clicks & Saves */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Pin Clicks</h2>
                    <p className="text-xs text-gray-400 mb-4">Clicks on your pins per day</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gClk" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="Pin Clicks" stroke="#22c55e" strokeWidth={2} fill="url(#gClk)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-900 mb-1">Saves</h2>
                    <p className="text-xs text-gray-400 mb-4">Times users saved your pins</p>
                    <ResponsiveContainer width="100%" height={180}>
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
                </div>

                {/* CTR & Save Rate */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Click-Through & Save Rate</h2>
                  <p className="text-xs text-gray-400 mb-4">What % of impressions led to clicks or saves each day</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gCTR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gSR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="CTR (%)" stroke="#6366f1" strokeWidth={2} fill="url(#gCTR)" dot={false} />
                      <Area type="monotone" dataKey="Save Rate (%)" stroke="#f97316" strokeWidth={2} fill="url(#gSR)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Daily bar breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Daily breakdown</h2>
                  <p className="text-xs text-gray-400 mb-4">Impressions, clicks, and saves side-by-side</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barGap={1} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Impressions" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={10} />
                      <Bar dataKey="Pin Clicks" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={10} />
                      <Bar dataKey="Saves" fill="#ec4899" radius={[3, 3, 0, 0]} maxBarSize={10} />
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
