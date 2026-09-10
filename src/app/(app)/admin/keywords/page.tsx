"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  Upload, AlertCircle, CheckCircle, Clock, XCircle,
  RefreshCw, Download, Database, BarChart2, FileText, TrendingUp,
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
  errors: string[];
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

  useEffect(() => { if (tab === "gaps") loadGaps(); }, [tab, loadGaps]);
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
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Import failed"); return; }
      setImportResult(data);
      setCsvText("");
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
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all",
                      statusFilter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={loadGaps} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                <div className="text-center py-12 text-sm text-gray-400">
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
                      ["AI Suggestions", importResult.suggestionsGenerated],
                    ].map(([label, val]) => (
                      <div key={label as string} className={`rounded-lg p-2 text-center ${label === "AI Suggestions" ? "bg-purple-50 border border-purple-100" : "bg-white"}`}>
                        <div className={`text-lg font-bold ${label === "AI Suggestions" ? "text-purple-700" : "text-gray-900"}`}>{val}</div>
                        <div className={`text-[10px] uppercase tracking-wider ${label === "AI Suggestions" ? "text-purple-500" : "text-gray-500"}`}>{label}</div>
                      </div>
                    ))}
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
                    <span className="col-span-1 text-center text-sm font-bold text-green-700">{imp.newKeywords}</span>
                    <span className="col-span-1 text-center text-sm font-bold text-blue-700">{imp.updatedKeywords}</span>
                    <span className="col-span-1 text-center text-sm font-bold text-red-500">{imp.invalidRows}</span>
                    <div className="col-span-2 flex justify-center">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                        imp.invalidRows === 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {imp.invalidRows === 0 ? "✓ Clean" : `${imp.invalidRows} errors`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
