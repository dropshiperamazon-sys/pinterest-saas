"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import {
  Eye, MousePointerClick, Heart, ArrowUpRight, ArrowDownRight, Loader2, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

interface DayData {
  date: string;
  impressions: number;
  clicks: number;
  saves: number;
}

interface Analytics {
  impressions: number;
  pinClicks: number;
  saves: number;
  impressionsChange: number | null;
  pinClicksChange: number | null;
  savesChange: number | null;
  daily: DayData[];
  period: { startDate: string; endDate: string };
}

function StatCard({
  label, value, change, icon: Icon, color, accent,
}: {
  label: string;
  value: number;
  change: number | null;
  icon: React.ElementType;
  color: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{formatNumber(value)}</div>
      {change !== null ? (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
          {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}% vs previous 30 days
        </div>
      ) : (
        <div className="text-xs text-gray-400 mt-1">No prior data</div>
      )}
    </div>
  );
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="font-medium">{p.name}:</span> {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch("/api/pinterest-connection")
      .then(r => r.json())
      .then(d => {
        setConnected(d.connected);
        if (d.connected) {
          fetch("/api/pinterest-analytics")
            .then(r => r.json())
            .then(a => { if (!a.error) setData(a); })
            .catch(() => {})
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <Header title="Analytics" subtitle="Real-time data from your Pinterest account." />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-[#e60023]" />
          <span className="ml-2 text-gray-500 text-sm">Loading your Pinterest data…</span>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div>
        <Header title="Analytics" subtitle="Real-time data from your Pinterest account." />
        <div className="p-6">
          <div className="bg-gradient-to-r from-[#e60023]/5 to-[#e60023]/10 border border-[#e60023]/20 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-[#e60023] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Connect Pinterest to see analytics</h2>
            <p className="text-sm text-gray-500 mb-6">Link your account to view real impressions, clicks, and saves.</p>
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
    Clicks: d.clicks,
    Saves: d.saves,
  }));

  return (
    <div>
      <Header
        title="Analytics"
        subtitle={data ? `${data.period.startDate} → ${data.period.endDate} (last 30 days)` : "Real-time data from your Pinterest account."}
      />
      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Impressions"
            value={data?.impressions ?? 0}
            change={data?.impressionsChange ?? null}
            icon={Eye}
            color="bg-blue-50 text-blue-600"
            accent="text-blue-700"
          />
          <StatCard
            label="Pin Clicks"
            value={data?.pinClicks ?? 0}
            change={data?.pinClicksChange ?? null}
            icon={MousePointerClick}
            color="bg-green-50 text-green-600"
            accent="text-green-700"
          />
          <StatCard
            label="Saves"
            value={data?.saves ?? 0}
            change={data?.savesChange ?? null}
            icon={Heart}
            color="bg-pink-50 text-pink-600"
            accent="text-pink-700"
          />
        </div>

        {/* Impressions over time */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Impressions over time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradImp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Impressions" stroke="#3b82f6" strokeWidth={2} fill="url(#gradImp)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Clicks & Saves side by side */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Pin Clicks over time</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradClk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Clicks" stroke="#22c55e" strokeWidth={2} fill="url(#gradClk)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Saves over time</h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradSav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Saves" stroke="#ec4899" strokeWidth={2} fill="url(#gradSav)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Combined bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Daily breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => formatNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Impressions" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={12} />
              <Bar dataKey="Clicks" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={12} />
              <Bar dataKey="Saves" fill="#ec4899" radius={[3, 3, 0, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
