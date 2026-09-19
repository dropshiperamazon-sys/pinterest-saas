"use client";
import { usePlan } from "@/hooks/usePlan";
import UpgradeGate from "@/components/UpgradeGate";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderOpen, Plus, Search, Loader2, AlertTriangle,
  BookmarkCheck, Tag, BarChart2, Clock, Trash2, X, Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

interface FolderWithStats {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  total: number;
  tracked: number;
  pinCount: number;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(ms).toLocaleDateString();
}

export default function TrackKeywordsPage() {
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Create folder modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete folder
  const [deleteTarget, setDeleteTarget] = useState<FolderWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/track-keywords/folders");
      const json = await res.json() as { folders?: FolderWithStats[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load folders");
      setFolders(json.folders ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { limits, loading: planLoading } = usePlan();
  if (!planLoading && !limits.canTrackKeywords) return <UpgradeGate requiredPlan="pro" feature="Track Keywords" />;

  const filteredFolders = folders.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newName.trim()) { setCreateError("Folder name is required"); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/track-keywords/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json() as { folder?: FolderWithStats; error?: string };
      if (!res.ok) { setCreateError(json.error ?? "Failed to create folder"); return; }
      setFolders(prev => [{ ...json.folder!, total: 0, tracked: 0, pinCount: 0 }, ...prev]);
      setShowCreate(false);
      setNewName("");
    } catch {
      setCreateError("Network error — please try again");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/track-keywords/folders/${deleteTarget.id}`, { method: "DELETE" });
      setFolders(prev => prev.filter(f => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // ignore — folder list will still show
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Track Keywords</h1>
            <p className="text-sm text-gray-500 mt-1">
              Organize your saved keywords and monitor how your Pins perform around them.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setNewName(""); setCreateError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#e60023] text-white text-sm font-semibold rounded-xl hover:bg-[#c0001d] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Folder
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search folders…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading folders…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">{error}</p>
              <button onClick={load} className="mt-2 text-xs text-red-600 underline">Try again</button>
            </div>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Folder className="w-8 h-8 text-gray-300" />
            </div>
            {search ? (
              <>
                <p className="text-sm font-semibold text-gray-700">No folders match "{search}"</p>
                <button onClick={() => setSearch("")} className="text-xs text-[#e60023]">Clear search</button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-gray-700">Organize your keywords</p>
                <p className="text-sm text-gray-500 max-w-xs">
                  Create folders to save and track Pinterest keywords in one place.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-[#e60023] text-white text-sm font-semibold rounded-xl hover:bg-[#c0001d] transition-colors"
                >
                  Create Folder
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#e60023]/10 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="w-4.5 h-4.5 text-[#e60023]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{f.name}</p>
                      {f.description && <p className="text-xs text-gray-400 truncate">{f.description}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(f)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-1"
                    title="Delete folder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                      <Tag className="w-3 h-3" />
                    </div>
                    <p className="text-base font-bold text-gray-800">{f.total}</p>
                    <p className="text-xs text-gray-400">Keywords</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                      <BookmarkCheck className="w-3 h-3" />
                    </div>
                    <p className="text-base font-bold text-gray-800">{f.tracked}</p>
                    <p className="text-xs text-gray-400">Tracked</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                      <BarChart2 className="w-3 h-3" />
                    </div>
                    <p className="text-base font-bold text-gray-800">{f.pinCount}</p>
                    <p className="text-xs text-gray-400">Pins</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {timeAgo(f.updatedAt)}
                  </div>
                  <Link
                    href={`/track-keywords/${f.id}`}
                    className="text-xs font-semibold text-[#e60023] hover:underline"
                  >
                    Open Folder →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Create New Folder</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Folder Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError(null); }}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                placeholder="e.g. Home Decor"
                maxLength={80}
                autoFocus
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
              />
              {createError && <p className="text-xs text-red-500">{createError}</p>}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="flex-1 py-2.5 bg-[#e60023] text-white text-sm font-semibold rounded-xl hover:bg-[#c0001d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Delete "{deleteTarget.name}"?</h2>
            <p className="text-sm text-gray-500">
              This will remove the folder and all its keywords. Tracked analytics history will be deleted.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
