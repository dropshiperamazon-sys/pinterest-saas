"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  Upload, AlertCircle, CheckCircle, Clock, XCircle,
  RefreshCw, Download, Database, BarChart2, FileText, TrendingUp, Trash2,
} from "lucide-react";

type GapStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

interface DataGap {
  id: string;
  keyword: string;
  country: string;
  missingFields: string[];
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: GapStatus;
  requestCount: number;
  createdAt: number;
  lastRequestedAt: number;
}

interface ImportRecord {
  id: string;
  filename: string;
  importedBy: string;
  source: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newKeywords: number;
  updatedKeywords: number;
  duplicateRows: number;
  errors: string[];
  importedAt: number;
}

interface ImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newKeywords: number;
  updatedKeywords: number;
  duplicateRows: number;
  suggestionsGenerated: number;
  importId?: string;
  errors: string[];
  expansionSeeds?: { keyword: string; category: string | null; subcategory: string | null; country: string; monthlySearches: number | null; avgCpc: number | null }[];
  importedNormalizedKeywords?: string[];
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
};

const STATUS_COLOR: Record<GapStatus, string> = {
  PENDING: "bg-orange-100 text-orange-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-gray-100 text-gray-500",
};

const StatusIcon = ({ status }: { status: GapStatus }) => {
  if (status === "COMPLETED") return <CheckCircle className="w-3.5 h-3.5" />;
  if (status === "REJECTED") return <XCircle className="w-3.5 h-3.5" />;
  if (status === "IN_PROGRESS") return <RefreshCw className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
};

export default function AdminKeywordsPage() {
  const [tab, setTab] = useState<"gaps" | "import" | "history" | "top">("gaps");
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GapStatus | "ALL">("PENDING");
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [topSearched, setTopSearched] = useState<{ keyword: string; country: string; searchCount: number; hasData: boolean }[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [topDays, setTopDays] = useState(30);
  const [kwModal, setKwModal] = useState<{ importId: string; type: "new" | "updated" | "suggestions"; label: string } | null>(null);
  const [kwModalData, setKwModalData] = useState<{ keyword: string; country: string; category: string | null; subcategory: string | null; monthlySearches: number | null; competition: string | null; source: string }[]>([]);
  const [kwModalLoading, setKwModalLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; keyword: string; country: string; category: string | null; subcategory: string | null; monthlySearches: number | null; avgCpc: number | null; confidence: string }[]>([]);
  const [selectedSuggIds, setSelectedSuggIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [suggPage, setSuggPage] = useState(1);
  const [suggCountry, setSuggCountry] = useState<"ALL" | "US" | "GB" | "CA" | "AU">("ALL");
  const SUGG_PER_PAGE = 50;
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{ repaired: number; total: number } | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [expandResult, setExpandResult] = useState<{ created: number; skipped: number } | null>(null);
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState<{ deleted: number } | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState(false);

  const loadGaps = useCallback(async () => {
    setGapsLoading(true);
    try {
      const status = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const res = await fetch(`/api/keyword-db/gaps?limit=100${status}`);
      const data = await res.json();
      setGaps(data.gaps ?? []);
    } finally {
      setGapsLoading(false);
    }
  }, [statusFilter]);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/keyword-db/gaps?type=imports&limit=20");
    const data = await res.json();
    setImports(data.imports ?? []);
  }, []);

  const loadSuggestions = useCallback(async () => {
    const res = await fetch("/api/keyword-db/suggestions?limit=10000");
    const data = await res.json();
    setSuggestions(data.suggestions ?? []);
    setSelectedSuggIds(new Set());
    setSuggPage(1);
  }, []);

  const loadTopSearched = useCallback(async (days: number) => {
    setTopLoading(true);
    try {
      const res = await fetch(`/api/keyword-db/top-searched?days=${days}&limit=50`);
      const data = await res.json();
      setTopSearched(data.results ?? []);
    } finally {
      setTopLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "gaps") { loadGaps(); loadSuggestions(); } }, [tab, loadGaps, loadSuggestions]);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, loadHistory]);
  useEffect(() => { if (tab === "top") loadTopSearched(topDays); }, [tab, topDays, loadTopSearched]);

  async function updateStatus(id: string, status: GapStatus) {
    setUpdatingId(id);
    try {
      await fetch("/api/keyword-db/gaps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setGaps(prev => prev.map(g => g.id === id ? { ...g, status } : g));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleImport() {
    if (!csvText.trim()) return;
    setImportLoading(true);
    setImportResult(null);
    setImportError(null);
    try {
      const res = await fetch("/api/keyword-db/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const text = await res.text();
      if (!text.trim() || res.status === 504) {
        // Empty/504 response: function timed out but keywords were likely saved.
        // Auto-check Import History to confirm.
        setImportError("Checking if import succeeded…");
        await new Promise(r => setTimeout(r, 2000));
        const histRes = await fetch("/api/keyword-db/gaps?type=imports&limit=1").catch(() => null);
        if (histRes?.ok) {
          const histData = await histRes.json() as { imports?: ImportRecord[] };
          const latest = histData.imports?.[0];
          // If there's a recent import (within last 5 minutes), treat as success
          if (latest && Date.now() - latest.importedAt < 5 * 60 * 1000) {
            setImports(prev => prev[0]?.id === latest.id ? prev : [latest, ...prev]);
            setImportResult({ totalRows: latest.totalRows, validRows: latest.validRows, invalidRows: latest.invalidRows, newKeywords: latest.newKeywords, updatedKeywords: latest.updatedKeywords, duplicateRows: latest.duplicateRows, suggestionsGenerated: 0, importId: latest.id, errors: latest.errors ?? [] });
            setCsvText("");
            setImportError(null);
            return;
          }
        }
        setImportError("The server timed out. Check Import History — your keywords may have been saved.");
        loadHistory();
        return;
      }
      let data: ImportResult & { error?: string };
      try { data = JSON.parse(text); } catch {
        setImportError("Unexpected server response. Keywords may have been partially saved — check Import History.");
        loadHistory();
        return;
      }
      if (!res.ok) { setImportError(data.error ?? "Import failed"); return; }
      setImportResult(data);
      setCsvText("");
      // Fire AI expansion in background — doesn't block the UI
      if (Array.isArray(data.expansionSeeds) && data.expansionSeeds.length > 0) {
        fetch("/api/keyword-db/expand-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seeds: data.expansionSeeds,
            importedNormalizedKeywords: data.importedNormalizedKeywords ?? [],
          }),
        }).catch(() => {});
      }
    } catch (e) {
      setImportError(String(e));
    } finally {
      setImportLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }

  async function openKwModal(importId: string, type: "new" | "updated" | "suggestions", label: string) {
    setKwModal({ importId, type, label });
    setKwModalLoading(true);
    setKwModalData([]);
    try {
      const res = await fetch(`/api/keyword-db/import-keywords?importId=${importId}&type=${type}`);
      const data = await res.json();
      setKwModalData(data.keywords ?? []);
    } finally {
      setKwModalLoading(false);
    }
  }

  async function pushSuggestions(ids: string[]) {
    if (ids.length === 0) return;
    setPushing(true);
    try {
      await fetch("/api/keyword-db/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      // Remove pushed items from local state
      setSuggestions(prev => prev.filter(s => !ids.includes(s.id)));
      setSelectedSuggIds(new Set());
    } finally {
      setPushing(false);
    }
  }

  async function runRepair() {
    setRepairing(true);
    setRepairResult(null);
    try {
      const res = await fetch("/api/keyword-db/suggestions/repair", { method: "POST" });
      const data = await res.json();
      setRepairResult({ repaired: data.repaired ?? 0, total: data.total ?? 0 });
      if (data.repaired > 0) await loadSuggestions();
    } finally {
      setRepairing(false);
    }
  }

  async function runExpand() {
    setExpanding(true);
    setExpandResult(null);
    try {
      const res = await fetch("/api/keyword-db/suggestions/expand-countries", { method: "POST" });
      const data = await res.json();
      setExpandResult({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      if ((data.created ?? 0) > 0) await loadSuggestions();
    } finally {
      setExpanding(false);
    }
  }

  async function runWipe() {
    setWiping(true);
    setWipeResult(null);
    try {
      const res = await fetch("/api/keyword-db/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "yes delete everything" }),
      });
      const data = await res.json();
      setWipeResult({ deleted: data.deleted ?? 0 });
      setWipeConfirm(false);
      await loadSuggestions();
    } finally {
      setWiping(false);
    }
  }

  const fmt = (n: number) => new Date(n).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <Header title="Keyword Admin" subtitle="Manage the keyword knowledge store — data gaps, CSV imports, import history" />
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["gaps", "import", "history", "top"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("text-sm font-semibold px-5 py-2 rounded-lg transition-all",
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}>
              {t === "gaps" ? "Data Requests" : t === "import" ? "CSV Import" : t === "history" ? "Import History" : "Top Searched"}
            </button>
          ))}
        </div>

        {/* ── DATA GAPS TAB ── */}
        {tab === "gaps" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                      statusFilter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {/* Push controls — shown when suggestions exist */}
                {suggestions.length > 0 && (
                  <>
                    {selectedSuggIds.size > 0 && (
                      <span className="text-xs text-purple-700 font-semibold">{selectedSuggIds.size} selected</span>
                    )}
                    <button
                      onClick={() => pushSuggestions(Array.from(selectedSuggIds))}
                      disabled={selectedSuggIds.size === 0 || pushing}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {pushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Push Selected
                    </button>
                    <button
                      onClick={() => pushSuggestions(suggestions.map(s => s.id))}
                      disabled={pushing}
                      className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 border border-purple-200 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Push All AI ({suggestions.length})
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    const visibleGaps = gaps.filter(g => statusFilter === "ALL" || g.status === statusFilter);
                    if (visibleGaps.length === 0) return;
                    const header = "keyword,country,monthly_searches,competition,avg_cpc,trend,language,category,subcategory,source,source_reference";
                    const rows = visibleGaps.map(g => `${g.keyword},${g.country},,,,,,,,Pinterest,`);
                    const csv = [header, ...rows].join("\n");
                    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `data-requests-${statusFilter.toLowerCase()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={gaps.length === 0}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
                <button onClick={() => { loadGaps(); loadSuggestions(); }} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={runRepair}
                  disabled={repairing}
                  title="Find existing AI keywords and move them to Data Requests pending list"
                  className="flex items-center gap-1.5 text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {repairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                  Sync AI
                </button>
                {repairResult && (
                  <span className="text-xs text-indigo-600 font-medium">
                    {repairResult.repaired > 0
                      ? `✓ ${repairResult.repaired} AI keywords moved to pending`
                      : `✓ ${repairResult.total} AI keywords already indexed`}
                  </span>
                )}
                <button
                  onClick={runExpand}
                  disabled={expanding}
                  title="Copy all US AI keywords to GB, CA, AU"
                  className="flex items-center gap-1.5 text-xs text-teal-600 border border-teal-200 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {expanding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  Add GB/CA/AU
                </button>
                {expandResult && (
                  <span className="text-xs text-teal-600 font-medium">
                    {expandResult.created > 0
                      ? `✓ ${expandResult.created.toLocaleString()} country copies created`
                      : `✓ Already expanded to all countries`}
                  </span>
                )}
                {/* Wipe database */}
                <div className="flex items-center gap-2 ml-auto">
                  {wipeResult && (
                    <span className="text-xs text-red-600 font-medium">✓ {wipeResult.deleted.toLocaleString()} keys deleted</span>
                  )}
                  {wipeConfirm ? (
                    <>
                      <span className="text-xs text-red-600 font-semibold">Are you sure? This deletes everything.</span>
                      <button onClick={runWipe} disabled={wiping}
                        className="flex items-center gap-1.5 text-xs text-white bg-red-600 border border-red-700 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {wiping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        {wiping ? "Wiping..." : "Yes, delete all"}
                      </button>
                      <button onClick={() => setWipeConfirm(false)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setWipeConfirm(true)}
                      className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                      <Database className="w-3.5 h-3.5" />
                      Wipe Database
                    </button>
                  )}
                </div>
                {/* Country filter tabs */}
                {suggestions.length > 0 && (
                  <div className="flex gap-1 ml-2 border-l border-gray-200 pl-2">
                    {(["ALL", "US", "GB", "CA", "AU"] as const).map(c => (
                      <button key={c} onClick={() => { setSuggCountry(c); setSuggPage(1); }}
                        className={cn("text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all",
                          suggCountry === c ? "bg-blue-600 text-white border-blue-600" : "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                        )}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Unified table — AI suggestions first (pending approval), then regular gaps */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* AI Suggestions section — grouped by keyword, all countries on one row */}
              {suggestions.length > 0 && (() => {
                // Filter by selected country, then group
                const filtered = suggCountry === "ALL" ? suggestions : suggestions.filter(s => s.country === suggCountry);

                // Group by normalized keyword
                const groups = new Map<string, typeof suggestions>();
                for (const s of filtered) {
                  const key = s.keyword.toLowerCase().trim();
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(s);
                }
                const groupList = [...groups.values()];
                const totalGroups = groupList.length;
                const totalPages = Math.ceil(totalGroups / SUGG_PER_PAGE);
                const pageGroups = groupList.slice((suggPage - 1) * SUGG_PER_PAGE, suggPage * SUGG_PER_PAGE);

                const pageNums: (number | "…")[] = [];
                for (let p = 1; p <= totalPages; p++) {
                  if (p === 1 || p === totalPages || (p >= suggPage - 2 && p <= suggPage + 2)) {
                    pageNums.push(p);
                  } else if (pageNums[pageNums.length - 1] !== "…") {
                    pageNums.push("…");
                  }
                }

                const allIds = suggestions.map(s => s.id);
                const allSelected = allIds.every(id => selectedSuggIds.has(id));

                return (
                  <>
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-50 border-b border-purple-100">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={e => setSelectedSuggIds(e.target.checked ? new Set(allIds) : new Set())}
                        className="w-4 h-4 accent-purple-600 cursor-pointer"
                      />
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                        ✦ AI Suggestions — {totalGroups.toLocaleString()} keywords{suggCountry !== "ALL" ? ` · ${suggCountry}` : " · all countries"} · page {suggPage}/{totalPages} · select to push to dataset
                      </span>
                    </div>
                    {pageGroups.map(group => {
                      const rep = group[0]; // representative record for display
                      const groupIds = group.map(s => s.id);
                      const groupSelected = groupIds.every(id => selectedSuggIds.has(id));
                      const countries = group.map(s => s.country).sort();
                      const estimate = group.find(s => s.monthlySearches != null);

                      return (
                        <div key={rep.keyword} className={cn("flex items-center gap-3 px-4 py-2.5 border-b border-purple-50 hover:bg-purple-50/50 transition-colors", groupSelected && "bg-purple-50")}>
                          <input
                            type="checkbox"
                            checked={groupSelected}
                            onChange={e => {
                              const next = new Set(selectedSuggIds);
                              groupIds.forEach(id => e.target.checked ? next.add(id) : next.delete(id));
                              setSelectedSuggIds(next);
                            }}
                            className="w-4 h-4 accent-purple-600 cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 truncate">{rep.keyword}</span>
                              {/* Country badges — all on the same row */}
                              {countries.map(c => (
                                <span key={c} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">{c}</span>
                              ))}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {rep.category ?? ""}{rep.subcategory ? ` / ${rep.subcategory}` : ""}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end flex-shrink-0">
                            {!estimate?.monthlySearches && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">monthly_searches</span>}
                            {!estimate?.avgCpc && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">avg_cpc</span>}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">competition</span>
                          </div>
                          <div className="text-right w-28 flex-shrink-0">
                            {estimate?.monthlySearches != null
                              ? <span className="text-xs text-gray-600">~{estimate.monthlySearches.toLocaleString()} <span className="text-gray-400">searches</span></span>
                              : <span className="text-xs text-gray-300">no estimate</span>}
                          </div>
                        </div>
                      );
                    })}
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-1 px-4 py-3 bg-purple-50/50 border-b border-purple-100">
                        <button onClick={() => setSuggPage(p => Math.max(1, p - 1))} disabled={suggPage === 1}
                          className="px-2.5 py-1 text-xs text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
                        {pageNums.map((p, i) =>
                          p === "…"
                            ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                            : <button key={p} onClick={() => setSuggPage(p as number)}
                                className={cn("min-w-[28px] px-2 py-1 text-xs rounded-lg border transition-colors",
                                  suggPage === p ? "bg-purple-600 text-white border-purple-600 font-semibold" : "text-purple-600 border-purple-200 hover:bg-purple-100"
                                )}>{p}</button>
                        )}
                        <button onClick={() => setSuggPage(p => Math.min(totalPages, p + 1))} disabled={suggPage === totalPages}
                          className="px-2.5 py-1 text-xs text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Regular gaps header */}
              <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <span className="col-span-3">Keyword</span>
                <span className="col-span-1">Country</span>
                <span className="col-span-3">Missing Data</span>
                <span className="col-span-1 text-center">Priority</span>
                <span className="col-span-1 text-center">Requests</span>
                <span className="col-span-1 text-center">Status</span>
                <span className="col-span-2 text-right">Actions</span>
              </div>
              {gapsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              ) : gaps.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">
                  <Database className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  No data requests found
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                  {gaps.map(gap => (
                    <div key={gap.id} className="grid grid-cols-12 items-center px-4 py-3">
                      <div className="col-span-3">
                        <span className="text-sm font-medium text-gray-800">{gap.keyword}</span>
                        <div className="text-[10px] text-gray-400 mt-0.5">{fmt(gap.lastRequestedAt)}</div>
                      </div>
                      <span className="col-span-1 text-xs font-bold text-gray-600">{gap.country}</span>
                      <div className="col-span-3 flex flex-wrap gap-1">
                        {gap.missingFields.map(f => (
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">{f}</span>
                        ))}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", PRIORITY_COLOR[gap.priority])}>{gap.priority}</span>
                      </div>
                      <span className="col-span-1 text-center text-sm font-bold text-gray-700">{gap.requestCount}</span>
                      <div className="col-span-1 flex justify-center">
                        <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_COLOR[gap.status])}>
                          <StatusIcon status={gap.status} />{gap.status}
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-end gap-1">
                        {gap.status === "PENDING" && (
                          <button onClick={() => updateStatus(gap.id, "IN_PROGRESS")}
                            disabled={updatingId === gap.id}
                            className="text-[10px] font-semibold px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 disabled:opacity-50">
                            Start
                          </button>
                        )}
                        {(gap.status === "PENDING" || gap.status === "IN_PROGRESS") && (
                          <button onClick={() => updateStatus(gap.id, "COMPLETED")}
                            disabled={updatingId === gap.id}
                            className="text-[10px] font-semibold px-2 py-1 rounded bg-green-50 text-green-600 border border-green-100 hover:bg-green-100 disabled:opacity-50">
                            Done
                          </button>
                        )}
                        {gap.status !== "REJECTED" && gap.status !== "COMPLETED" && (
                          <button onClick={() => updateStatus(gap.id, "REJECTED")}
                            disabled={updatingId === gap.id}
                            className="text-[10px] font-semibold px-2 py-1 rounded bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 disabled:opacity-50">
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CSV IMPORT TAB ── */}
        {tab === "import" && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Upload className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Import Keywords from CSV</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Required columns: <code className="bg-gray-100 px-1 rounded">keyword</code>, <code className="bg-gray-100 px-1 rounded">country</code></p>
                  <p className="text-xs text-gray-400 mt-0.5">Optional: monthly_searches, competition (low/medium/high), avg_cpc, trend, language, category, source, source_reference</p>
                </div>
              </div>

              {/* Example */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Example CSV</p>
                <pre className="text-xs text-gray-600 font-mono leading-relaxed overflow-x-auto">{`keyword,monthly_searches,competition,avg_cpc,trend,country,language,category,subcategory,source
room decor,135000,high,1.20,8,US|GB|AU,en,Home Decor,General,Pinterest
bedroom decor,90000,high,1.15,5,US,en,Home Decor,Bedroom,Pinterest
living room decor ideas,74000,medium,1.05,12,US|CA,en,Home Decor,Living Room,Pinterest`}</pre>
                <p className="text-[10px] text-gray-400 mt-1.5">Tip: Use <span className="font-mono">US|GB|AU</span> in the country column to apply the same keyword to multiple countries at once.</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Tip: <span className="font-mono">subcategory</span> helps the AI expand into sibling subcategories (e.g. Bedroom → Living Room, Dining Room…).</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Valid sources: <span className="font-mono">Pinterest, Google Keyword Planner, SEMrush, Ahrefs, Manual</span></p>
              </div>

              {/* File picker */}
              <div className="flex gap-3 items-center">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700">
                  <FileText className="w-4 h-4" /> Choose CSV file
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" />
                <span className="text-xs text-gray-400">or paste CSV below</span>
              </div>

              {/* Textarea */}
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="Paste CSV here, or choose a file above..."
                rows={8}
                className="w-full text-xs font-mono p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y"
              />

              <button onClick={handleImport} disabled={!csvText.trim() || importLoading}
                className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {importLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importLoading ? "Importing..." : "Import Keywords"}
              </button>

              {/* Result */}
              {importError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700">{importError}</span>
                </div>
              )}
              {importResult && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-bold text-green-800">Import complete</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["Total rows", importResult.totalRows],
                      ["Valid rows", importResult.validRows],
                      ["Invalid rows", importResult.invalidRows],
                      ["New keywords", importResult.newKeywords],
                      ["Updated", importResult.updatedKeywords],
                      ["Duplicates", importResult.duplicateRows],
                    ].map(([label, val]) => (
                      <div key={label as string} className="rounded-lg p-2 text-center bg-white">
                        <div className="text-lg font-bold text-gray-900">{val}</div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
                      </div>
                    ))}
                    {/* AI Suggestions tile — clickable when importId available */}
                    {importResult.importId && importResult.suggestionsGenerated > 0 ? (
                      <button
                        onClick={() => openKwModal(importResult.importId!, "suggestions", "AI Suggestions")}
                        className="rounded-lg p-2 text-center bg-purple-50 border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
                      >
                        <div className="text-lg font-bold text-purple-700">{importResult.suggestionsGenerated}</div>
                        <div className="text-[10px] uppercase tracking-wider text-purple-500 underline decoration-dotted">AI Suggestions</div>
                      </button>
                    ) : (
                      <div className="rounded-lg p-2 text-center bg-purple-50 border border-purple-100">
                        <div className="text-lg font-bold text-purple-700">{importResult.suggestionsGenerated}</div>
                        <div className="text-[10px] uppercase tracking-wider text-purple-500">AI Suggestions</div>
                      </div>
                    )}
                  </div>
                  {importResult.suggestionsGenerated > 0 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                      <span className="text-purple-600 text-xs">✦</span>
                      <p className="text-xs text-purple-700">
                        <span className="font-semibold">{importResult.suggestionsGenerated} new keyword suggestions</span> generated from patterns in your data — check the <button onClick={() => setTab("gaps")} className="underline font-semibold">Data Requests</button> tab to see them.
                      </p>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 mb-1">Errors (first {importResult.errors.length}):</p>
                      <ul className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                        {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Download template */}
            <button
              onClick={() => {
                const csv = "keyword,monthly_searches,competition,avg_cpc,trend,country,language,category,subcategory,source,source_reference\nroom decor,135000,high,1.20,8,US|GB|AU,en,Home Decor,General,Pinterest,\nbedroom decor,90000,high,1.15,5,US,en,Home Decor,Bedroom,Pinterest,\nliving room decor ideas,74000,medium,1.05,12,US|CA,en,Home Decor,Living Room,Pinterest,\n";
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                const a = document.createElement("a"); a.href = url; a.download = "keyword-import-template.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV template
            </button>
          </div>
        )}

        {/* ── IMPORT HISTORY TAB ── */}
        {tab === "history" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <span className="col-span-2">Date</span>
              <span className="col-span-2">Imported By</span>
              <span className="col-span-2">Source</span>
              <span className="col-span-1 text-center">Total</span>
              <span className="col-span-1 text-center">New</span>
              <span className="col-span-1 text-center">Updated</span>
              <span className="col-span-1 text-center">Invalid</span>
              <span className="col-span-2 text-center">Status</span>
            </div>
            {imports.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">
                <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                No imports yet
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {imports.map(imp => (
                  <div key={imp.id} className="grid grid-cols-12 items-center px-4 py-3">
                    <span className="col-span-2 text-xs text-gray-600">{fmt(imp.importedAt)}</span>
                    <span className="col-span-2 text-xs text-gray-700 truncate">{imp.importedBy}</span>
                    <span className="col-span-2 text-xs text-gray-600 truncate">{imp.source}</span>
                    <span className="col-span-1 text-center text-sm font-bold text-gray-800">{imp.totalRows}</span>
                    <button
                      onClick={() => imp.newKeywords > 0 && openKwModal(imp.id, "new", `New keywords — ${fmt(imp.importedAt)}`)}
                      disabled={imp.newKeywords === 0}
                      className="col-span-1 text-center text-sm font-bold text-green-700 underline decoration-dotted hover:text-green-900 disabled:no-underline disabled:cursor-default"
                    >{imp.newKeywords}</button>
                    <button
                      onClick={() => imp.updatedKeywords > 0 && openKwModal(imp.id, "updated", `Updated keywords — ${fmt(imp.importedAt)}`)}
                      disabled={imp.updatedKeywords === 0}
                      className="col-span-1 text-center text-sm font-bold text-blue-700 underline decoration-dotted hover:text-blue-900 disabled:no-underline disabled:cursor-default"
                    >{imp.updatedKeywords}</button>
                    <span className="col-span-1 text-center text-sm font-bold text-red-500">{imp.invalidRows}</span>
                    <div className="col-span-2 flex items-center justify-center gap-2">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                        imp.invalidRows === 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {imp.invalidRows === 0 ? "✓ Clean" : `${imp.invalidRows} errors`}
                      </span>
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this import record?")) return;
                          const res = await fetch(`/api/keyword-db/imports/${imp.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setImports(prev => prev.filter(r => r.id !== imp.id));
                          } else {
                            const errData = await res.json().catch(() => ({})) as { error?: string };
                            alert(`Delete failed: ${res.status} — ${errData.error ?? res.statusText}`);
                          }
                        }}
                        title="Delete import record"
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── KEYWORD MODAL ── */}
        {kwModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setKwModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">{kwModal.label}</h3>
                <button onClick={() => setKwModal(null)} className="text-gray-400 hover:text-gray-700 text-lg font-bold">×</button>
              </div>
              <div className="overflow-y-auto flex-1">
                {kwModalLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
                  </div>
                ) : kwModalData.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-400">No keyword data available for older imports.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <span className="col-span-5">Keyword</span>
                      <span className="col-span-1">Country</span>
                      <span className="col-span-2">Category</span>
                      <span className="col-span-2 text-center">Searches</span>
                      <span className="col-span-2 text-center">Competition</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {kwModalData.map((kw, i) => (
                        <div key={i} className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-gray-50/50">
                          <span className="col-span-5 text-sm font-medium text-gray-800 truncate">{kw.keyword}</span>
                          <span className="col-span-1 text-xs font-mono text-gray-500">{kw.country}</span>
                          <div className="col-span-2 text-xs text-gray-500 truncate">
                            {kw.subcategory ? `${kw.category} / ${kw.subcategory}` : (kw.category ?? "—")}
                          </div>
                          <span className="col-span-2 text-center text-sm font-semibold text-gray-700">
                            {kw.monthlySearches != null ? kw.monthlySearches.toLocaleString() : "—"}
                          </span>
                          <span className="col-span-2 text-center">
                            {kw.competition ? (
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                                kw.competition === "high" ? "bg-red-100 text-red-700" :
                                kw.competition === "medium" ? "bg-yellow-100 text-yellow-700" :
                                "bg-green-100 text-green-700"
                              )}>{kw.competition}</span>
                            ) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-right">
                {kwModalData.length} keyword{kwModalData.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        )}

        {/* ── TOP SEARCHED TAB ── */}
        {tab === "top" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {([7, 14, 30] as const).map(d => (
                  <button key={d} onClick={() => setTopDays(d)}
                    className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                      topDays === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}>
                    Last {d} days
                  </button>
                ))}
              </div>
              <button onClick={() => loadTopSearched(topDays)} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {topLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : topSearched.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">No search data yet</p>
                <p className="text-xs text-gray-400 mt-1">Search signals are logged as users search on the Keyword Research page.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <span className="col-span-1">#</span>
                  <span className="col-span-5">Keyword</span>
                  <span className="col-span-1">Country</span>
                  <span className="col-span-2 text-center">Searches</span>
                  <span className="col-span-2 text-center">Data Status</span>
                  <span className="col-span-1"></span>
                </div>
                {topSearched.map((entry, i) => (
                  <div key={`${entry.keyword}:::${entry.country}`}
                    className="grid grid-cols-12 px-4 py-3 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <span className="col-span-1 text-sm font-bold text-gray-300">{i + 1}</span>
                    <span className="col-span-5 text-sm font-semibold text-gray-800 truncate">{entry.keyword}</span>
                    <span className="col-span-1 text-xs font-mono text-gray-500">{entry.country}</span>
                    <div className="col-span-2 flex items-center justify-center gap-1.5">
                      <div className="flex-1 max-w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-[#e60023] rounded-full"
                          style={{ width: `${Math.min(100, (entry.searchCount / (topSearched[0]?.searchCount || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{entry.searchCount}</span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      {entry.hasData ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Has data
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Missing
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {!entry.hasData && (
                        <button
                          onClick={() => {
                            const csv = `keyword,country\n${entry.keyword},${entry.country}`;
                            navigator.clipboard.writeText(csv).catch(() => {});
                          }}
                          title="Copy as CSV row"
                          className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50">
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {topSearched.length > 0 && (
              <p className="text-xs text-gray-400 text-center">
                {topSearched.filter(e => !e.hasData).length} of {topSearched.length} keywords are missing data —
                import their metrics via CSV to enrich future results.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
