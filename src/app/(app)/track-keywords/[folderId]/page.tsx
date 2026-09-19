"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, AlertTriangle, Tag, BookmarkCheck,
  BarChart2, PlayCircle, StopCircle, Trash2, ExternalLink, RefreshCw,
  X, Search as SearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import type { SavedKeyword, KeywordFolder } from "@/lib/track-keywords-db";

type TrackingStatus = "NOT_TRACKED" | "TRACKING" | "SYNCING" | "ERROR" | "PAUSED";

function StatusBadge({ status }: { status: TrackingStatus }) {
  const cfg: Record<TrackingStatus, { label: string; cls: string }> = {
    TRACKING:    { label: "Tracking",     cls: "bg-green-100 text-green-700" },
    NOT_TRACKED: { label: "Not Tracking", cls: "bg-gray-100 text-gray-500" },
    SYNCING:     { label: "Syncing",      cls: "bg-blue-100 text-blue-700" },
    ERROR:       { label: "Error",        cls: "bg-red-100 text-red-600" },
    PAUSED:      { label: "Paused",       cls: "bg-amber-100 text-amber-700" },
  };
  const { label, cls } = cfg[status] ?? cfg.NOT_TRACKED;
  return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", cls)}>{label}</span>;
}

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

export default function FolderDetailPage() {
  const { folderId } = useParams() as { folderId: string };
  const router = useRouter();

  const [folder, setFolder] = useState<(KeywordFolder & { total: number; tracked: number; pinCount: number }) | null>(null);
  const [keywords, setKeywords] = useState<SavedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SavedKeyword | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/track-keywords/folders/${folderId}`);
      const json = await res.json() as { folder?: typeof folder; keywords?: SavedKeyword[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load folder");
      setFolder(json.folder ?? null);
      setKeywords(json.keywords ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  async function handleTrackToggle(kw: SavedKeyword) {
    const newTracked = !kw.isTracked;
    // Optimistic update
    setKeywords(prev => prev.map(k => k.id === kw.id
      ? { ...k, isTracked: newTracked, trackingStatus: newTracked ? "TRACKING" : "NOT_TRACKED" }
      : k
    ));
    await fetch(`/api/track-keywords/keywords/${kw.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTracked: newTracked, trackingStatus: newTracked ? "TRACKING" : "NOT_TRACKED" }),
    });
    if (newTracked) {
      // Trigger sync in background
      setSyncing(prev => new Set(prev).add(kw.id));
      setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, trackingStatus: "SYNCING" } : k));
      try {
        const syncRes = await fetch(`/api/track-keywords/keywords/${kw.id}/sync`, { method: "POST" });
        if (syncRes.ok) {
          setKeywords(prev => prev.map(k => k.id === kw.id
            ? { ...k, trackingStatus: "TRACKING", lastSyncedAt: Date.now() } : k
          ));
        }
      } finally {
        setSyncing(prev => { const n = new Set(prev); n.delete(kw.id); return n; });
      }
    }
  }

  async function handleSync(kw: SavedKeyword) {
    setSyncing(prev => new Set(prev).add(kw.id));
    setKeywords(prev => prev.map(k => k.id === kw.id ? { ...k, trackingStatus: "SYNCING" } : k));
    try {
      await fetch(`/api/track-keywords/keywords/${kw.id}/sync`, { method: "POST" });
      setKeywords(prev => prev.map(k => k.id === kw.id
        ? { ...k, trackingStatus: "TRACKING", lastSyncedAt: Date.now() } : k
      ));
    } finally {
      setSyncing(prev => { const n = new Set(prev); n.delete(kw.id); return n; });
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(removeTarget.id);
    try {
      await fetch(`/api/track-keywords/keywords/${removeTarget.id}`, { method: "DELETE" });
      setKeywords(prev => prev.filter(k => k.id !== removeTarget.id));
      setRemoveTarget(null);
    } finally {
      setRemoving(null);
    }
  }

  const filtered = keywords.filter(k =>
    !search || k.keyword.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading folder…</span>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm font-semibold text-gray-700">{error ?? "Folder not found"}</p>
        <button onClick={() => router.push("/track-keywords")} className="text-sm text-[#e60023]">
          ← Back to Track Keywords
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Back */}
        <Link href="/track-keywords" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Track Keywords
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
            {folder.description && <p className="text-sm text-gray-500 mt-0.5">{folder.description}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 w-full sm:max-w-sm">
          {[
            { label: "Keywords", value: folder.total, icon: Tag },
            { label: "Tracked", value: folder.tracked, icon: BookmarkCheck },
            { label: "Pins", value: folder.pinCount, icon: BarChart2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search + controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search keywords…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
            />
          </div>
          <Link
            href="/keywords"
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Keywords
          </Link>
        </div>

        {/* Keywords table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Tag className="w-8 h-8 text-gray-300" />
            {search ? (
              <>
                <p className="text-sm font-semibold text-gray-700">No keywords match "{search}"</p>
                <button onClick={() => setSearch("")} className="text-xs text-[#e60023]">Clear search</button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-700">No keywords in this folder yet.</p>
                <Link href="/keywords" className="text-xs px-3 py-1.5 bg-[#e60023] text-white rounded-lg hover:bg-[#c0001d] transition-colors">
                  Add Keywords
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="px-5 py-3 text-left font-medium">Keyword</th>
                    <th className="px-3 py-3 text-left font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Monthly Searches</th>
                    <th className="px-3 py-3 text-right font-medium">Competition</th>
                    <th className="px-3 py-3 text-right font-medium">Avg CPC</th>
                    <th className="px-3 py-3 text-right font-medium">Last Sync</th>
                    <th className="px-3 py-3 text-right font-medium pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(kw => (
                    <tr key={kw.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        {kw.isTracked ? (
                          <Link
                            href={`/track-keywords/${folderId}/${kw.id}`}
                            className="font-medium text-gray-900 hover:text-[#e60023] transition-colors"
                          >
                            {kw.keyword}
                          </Link>
                        ) : (
                          <span className="font-medium text-gray-900">{kw.keyword}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={kw.trackingStatus} />
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {kw.monthlySearches != null ? formatNumber(kw.monthlySearches) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {kw.competition ? (
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                            kw.competition === "low" ? "bg-green-50 text-green-700" :
                            kw.competition === "medium" ? "bg-amber-50 text-amber-700" :
                            "bg-red-50 text-red-700"
                          )}>{kw.competition}</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {kw.avgCpc != null ? `$${kw.avgCpc.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-400 text-xs">
                        {timeAgo(kw.lastSyncedAt)}
                      </td>
                      <td className="px-3 py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {kw.isTracked && (
                            <>
                              {kw.trackingStatus !== "SYNCING" && !syncing.has(kw.id) && (
                                <button
                                  onClick={() => handleSync(kw)}
                                  title="Refresh data"
                                  className="text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {syncing.has(kw.id) && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                              )}
                              <Link
                                href={`/track-keywords/${folderId}/${kw.id}`}
                                className="text-gray-400 hover:text-[#e60023] transition-colors"
                                title="View details"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </>
                          )}
                          <button
                            onClick={() => handleTrackToggle(kw)}
                            disabled={syncing.has(kw.id)}
                            title={kw.isTracked ? "Stop tracking" : "Start tracking"}
                            className={cn(
                              "transition-colors disabled:opacity-40",
                              kw.isTracked ? "text-green-500 hover:text-red-400" : "text-gray-300 hover:text-green-500"
                            )}
                          >
                            {kw.isTracked
                              ? <StopCircle className="w-4 h-4" />
                              : <PlayCircle className="w-4 h-4" />
                            }
                          </button>
                          <button
                            onClick={() => setRemoveTarget(kw)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            title="Remove from folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Remove confirmation */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Remove keyword?</h2>
              <button onClick={() => setRemoveTarget(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600">
              Remove <span className="font-semibold">"{removeTarget.keyword}"</span> from this folder?
              Tracking history will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
              >Cancel</button>
              <button
                onClick={handleRemove}
                disabled={removing !== null}
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
