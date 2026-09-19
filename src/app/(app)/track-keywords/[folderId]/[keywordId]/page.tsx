"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, AlertTriangle, RefreshCw, StopCircle, Trash2,
  ExternalLink, Eye, Heart, Bookmark, MousePointerClick, TrendingUp, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { SavedKeyword, PinSnapshot, PinAssociation } from "@/lib/track-keywords-db";

type PinWithSnapshot = PinAssociation & { snapshot: PinSnapshot | null };

function timeAgo(ms: number | null): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? formatNumber(value) : value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function KeywordDetailPage() {
  const { folderId, keywordId } = useParams() as { folderId: string; keywordId: string };
  const router = useRouter();

  const [keyword, setKeyword] = useState<SavedKeyword | null>(null);
  const [pins, setPins] = useState<PinWithSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<"impressions" | "engagements" | "saves" | "pinClicks">("impressions");
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/track-keywords/keywords/${keywordId}`);
      const json = await res.json() as { keyword?: SavedKeyword; pins?: PinWithSnapshot[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load keyword");
      setKeyword(json.keyword ?? null);
      setPins(json.pins ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [keywordId]);

  useEffect(() => { load(); }, [load]);

  async function handleSync() {
    setSyncing(true);
    setKeyword(prev => prev ? { ...prev, trackingStatus: "SYNCING" } : prev);
    try {
      await fetch(`/api/track-keywords/keywords/${keywordId}/sync`, { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleStopTracking() {
    await fetch(`/api/track-keywords/keywords/${keywordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTracked: false, trackingStatus: "NOT_TRACKED" }),
    });
    router.push(`/track-keywords/${folderId}`);
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await fetch(`/api/track-keywords/keywords/${keywordId}`, { method: "DELETE" });
      router.push(`/track-keywords/${folderId}`);
    } finally {
      setRemoving(false);
    }
  }

  const hasPins = pins.some(p => p.snapshot);
  const snappedPins = pins.filter(p => p.snapshot);

  // Aggregate totals
  const totals = snappedPins.reduce(
    (acc, p) => {
      const s = p.snapshot!;
      acc.impressions += s.impressions;
      acc.engagements += s.engagements;
      acc.saves += s.saves;
      acc.pinClicks += s.pinClicks;
      acc.outboundClicks += s.outboundClicks;
      return acc;
    },
    { impressions: 0, engagements: 0, saves: 0, pinClicks: 0, outboundClicks: 0 }
  );
  const avgEngRate = snappedPins.length > 0
    ? Math.round(snappedPins.reduce((a, p) => a + (p.snapshot?.engagementRate ?? 0), 0) / snappedPins.length * 100) / 100
    : 0;

  // Chart data — one entry per matched pin for sparkline comparison
  const chartData = snappedPins
    .sort((a, b) => (b.snapshot?.impressions ?? 0) - (a.snapshot?.impressions ?? 0))
    .slice(0, 10)
    .map(p => ({
      name: (p.snapshot?.title || p.pinId).slice(0, 20),
      Impressions: p.snapshot?.impressions ?? 0,
      Saves: p.snapshot?.saves ?? 0,
      Engagements: p.snapshot?.engagements ?? 0,
    }));

  const sortedPins = [...snappedPins].sort((a, b) => (b.snapshot?.[sortBy] ?? 0) - (a.snapshot?.[sortBy] ?? 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading keyword…</span>
      </div>
    );
  }

  if (error || !keyword) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm font-semibold text-gray-700">{error ?? "Keyword not found"}</p>
        <button onClick={() => router.push(`/track-keywords/${folderId}`)} className="text-sm text-[#e60023]">
          ← Back to Folder
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/track-keywords" className="hover:text-gray-700 transition-colors">Track Keywords</Link>
          <span>/</span>
          <Link href={`/track-keywords/${folderId}`} className="hover:text-gray-700 transition-colors">Folder</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{keyword.keyword}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{keyword.keyword}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Last synced {timeAgo(keyword.lastSyncedAt)}
              {keyword.country && ` · ${keyword.country.toUpperCase()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Syncing…" : "Refresh Data"}
            </button>
            <button
              onClick={handleStopTracking}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Stop Tracking
            </button>
            <button
              onClick={() => setShowRemoveModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-red-100 bg-white rounded-xl text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Impressions" value={totals.impressions} icon={Eye} color="bg-blue-50 text-blue-600" />
          <KpiCard label="Engagements" value={totals.engagements} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
          <KpiCard label="Saves" value={totals.saves} icon={Bookmark} color="bg-green-50 text-green-600" />
          <KpiCard label="Pin Clicks" value={totals.pinClicks} icon={MousePointerClick} color="bg-amber-50 text-amber-600" />
          <KpiCard label="Outbound Clicks" value={totals.outboundClicks} icon={ExternalLink} color="bg-rose-50 text-rose-600" />
          <KpiCard label="Avg Eng. Rate" value={`${avgEngRate}%`} icon={Heart} color="bg-pink-50 text-pink-600" />
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Pins Performance (last 30 days)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e60023" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#e60023" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSaves" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Impressions" stroke="#e60023" fill="url(#colorImp)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Saves" stroke="#10b981" fill="url(#colorSaves)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pins table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Matched Pins
              {snappedPins.length > 0 && <span className="ml-2 text-xs text-gray-400 font-normal">{snappedPins.length} pins</span>}
            </h2>
            {snappedPins.length > 0 && (
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
              >
                <option value="impressions">Sort: Impressions</option>
                <option value="engagements">Sort: Engagements</option>
                <option value="saves">Sort: Saves</option>
                <option value="pinClicks">Sort: Pin Clicks</option>
              </select>
            )}
          </div>

          {snappedPins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              {keyword.trackingStatus === "NOT_TRACKED" ? (
                <>
                  <p className="text-sm font-semibold text-gray-700">This keyword is not being tracked.</p>
                  <p className="text-xs text-gray-500">Start tracking to see which of your Pins match this keyword.</p>
                </>
              ) : syncing || keyword.trackingStatus === "SYNCING" ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <p className="text-sm text-gray-500">Syncing — fetching your Pins and analytics…</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-700">No matching Pins found.</p>
                  <p className="text-xs text-gray-500 max-w-xs">
                    None of your recent Pins mention "{keyword.keyword}" in their title or description.
                  </p>
                  <button
                    onClick={handleSync}
                    className="text-xs text-[#e60023] hover:underline"
                  >
                    Refresh to check again
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="px-5 py-3 text-left font-medium">Pin</th>
                    <th className="px-3 py-3 text-right font-medium">Impressions</th>
                    <th className="px-3 py-3 text-right font-medium">Engagements</th>
                    <th className="px-3 py-3 text-right font-medium">Saves</th>
                    <th className="px-3 py-3 text-right font-medium">Clicks</th>
                    <th className="px-3 py-3 text-right font-medium">Eng. Rate</th>
                    <th className="px-3 py-3 text-right font-medium pr-4">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedPins.map(p => {
                    const s = p.snapshot!;
                    return (
                      <tr key={p.pinId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {s.imageUrl ? (
                              <img
                                src={s.imageUrl}
                                alt={s.title}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate max-w-[200px]">{s.title || "Untitled Pin"}</p>
                              {s.boardName && <p className="text-xs text-gray-400 truncate">{s.boardName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{formatNumber(s.impressions)}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{formatNumber(s.engagements)}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{formatNumber(s.saves)}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{formatNumber(s.pinClicks)}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{s.engagementRate}%</td>
                        <td className="px-3 py-3 pr-4 text-right">
                          {s.link ? (
                            <a
                              href={`https://pinterest.com/pin/${p.pinId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-[#e60023] transition-colors inline-flex"
                              title="View on Pinterest"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <a
                              href={`https://pinterest.com/pin/${p.pinId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-[#e60023] transition-colors inline-flex"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Remove confirmation modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Remove keyword?</h2>
              <button onClick={() => setShowRemoveModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600">
              Remove <span className="font-semibold">"{keyword.keyword}"</span> from this folder?
              All tracking history and pin associations will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
              >Cancel</button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {removing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
