"use client";
import { useState, useMemo } from "react";
import {
  Globe, Copy, Download, Sparkles, CheckCircle,
  XCircle, AlertTriangle, ChevronUp, ChevronDown, Loader2,
  Lightbulb, ExternalLink, Filter, SlidersHorizontal, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relevanceLabel } from "@/lib/keyword-extractor/relevance-engine";
import type { ExtractedKeyword, ExtractResponse, DateFilter, ProgressEvent } from "@/app/api/keyword-extractor/extract/route";
import type { ContentIdea } from "@/lib/keyword-extractor/content-idea-generator";

const INTENT_COLORS: Record<string, string> = {
  Informational: "bg-blue-100 text-blue-700",
  Inspirational: "bg-pink-100 text-pink-700",
  Commercial: "bg-purple-100 text-purple-700",
  Transactional: "bg-green-100 text-green-700",
  Educational: "bg-indigo-100 text-indigo-700",
};

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
];

interface ProgressState {
  stage: string;
  message: string;
  counts?: Record<string, number>;
  log: string[];
}

function RelevanceBadge({ score }: { score: number }) {
  const { label, color } = relevanceLabel(score);
  return (
    <span className={cn("text-xs rounded px-1.5 py-0.5 font-medium", color)}>
      {score} · {label}
    </span>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

type SortField = "keyword" | "relevance" | "url";
type SortDir = "asc" | "desc";

export default function KeywordExtractorPage() {
  const [domain, setDomain] = useState("");
  const [topic, setTopic] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(65);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [results, setResults] = useState<ExtractedKeyword[] | null>(null);
  const [stats, setStats] = useState<{
    totalUrls: number;
    totalArticles: number;
    candidateArticles: number;
    stage2Fetched: number;
    homepageLinks: number;
    sitemaps: string[];
  } | null>(null);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("relevance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);

  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);

  function validateDomain(val: string): boolean {
    try {
      const u = new URL(val.startsWith("http") ? val : `https://${val}`);
      if (!["http:", "https:"].includes(u.protocol)) { setDomainError("URL must start with http:// or https://"); return false; }
      setDomainError(null);
      return true;
    } catch {
      setDomainError("Please enter a valid website domain");
      return false;
    }
  }

  async function handleExtract() {
    if (!validateDomain(domain)) return;
    if (!topic.trim()) { setDomainError("Keyword / Topic is required"); return; }

    setExtracting(true);
    setExtractError(null);
    setResults(null);
    setStats(null);
    setSelected(new Set());
    setIdeas(null);
    setSearch("");
    setPage(1);
    setProgress({ stage: "init", message: "Starting…", log: [] });

    try {
      const res = await fetch("/api/keyword-extractor/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, topic: topic.trim(), dateFilter }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "Request failed");
        setExtractError(text);
        setExtracting(false);
        setProgress(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as ProgressEvent;

            if (event.type === "progress") {
              setProgress((prev) => ({
                stage: event.stage,
                message: event.message,
                counts: event.counts,
                log: [...(prev?.log ?? []), event.message].slice(-20),
              }));
            } else if (event.type === "complete") {
              const data = event.data;
              setResults(data.relevant ?? []);
              setStats({
                totalUrls: data.totalUrlsFound,
                totalArticles: data.totalArticles,
                candidateArticles: data.candidateArticles ?? data.stage2Fetched ?? 0,
                stage2Fetched: data.stage2Fetched ?? 0,
                homepageLinks: data.homepageLinks ?? 0,
                sitemaps: data.sitemapsFound ?? [],
              });
              setProgress(null);
            } else if (event.type === "error") {
              setExtractError(event.message);
              setProgress(null);
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Request failed. Please check the domain and try again.");
      setProgress(null);
    } finally {
      setExtracting(false);
    }
  }

  async function handleGenerateIdeas() {
    if (selected.size === 0) return;
    const selectedItems = (results ?? []).filter((r) => selected.has(r.url));
    const keywords = selectedItems.map((r) => r.keyword);
    const urls = selectedItems.map((r) => r.url);

    setGeneratingIdeas(true);
    setIdeaError(null);
    setIdeas(null);

    try {
      const res = await fetch("/api/keyword-extractor/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, urls, category: topic.trim() }),
      });
      const data = await res.json();
      if (data.error) setIdeaError(data.error);
      else setIdeas(data.ideas ?? []);
    } catch {
      setIdeaError("AI generation failed. Please try again.");
    } finally {
      setGeneratingIdeas(false);
    }
  }

  const tableData = useMemo(() => {
    if (!results) return [];
    let data = results.filter((r) => r.relevance >= threshold);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((r) => r.keyword.toLowerCase().includes(q) || r.url.toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sortField === "relevance") { va = a.relevance; vb = b.relevance; }
      else if (sortField === "keyword") { va = a.keyword.toLowerCase(); vb = b.keyword.toLowerCase(); }
      else { va = a.url; vb = b.url; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [results, search, sortField, sortDir, threshold]);

  const totalPages = Math.max(1, Math.ceil(tableData.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageData = tableData.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(1);
  }

  function handleSearchChange(val: string) { setSearch(val); setPage(1); }
  function handleThresholdChange(val: number) { setThreshold(val); setPage(1); }

  function toggleSelect(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageUrls = new Set(pageData.map((r) => r.url));
    const allPageSelected = pageData.every((r) => selected.has(r.url));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const u of pageUrls) next.delete(u);
      } else {
        for (const u of pageUrls) next.add(u);
      }
      return next;
    });
  }

  function exportCSV() {
    if (!tableData.length) return;
    const rows = [["Source URL", "Page Title", "Keyword", "Relevance", "Match Reason"]];
    for (const r of tableData) rows.push([r.url, r.pageTitle ?? "", r.keyword, String(r.relevance), r.matchReason ?? ""]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    dl("keywords.csv", csv, "text/csv");
  }

  function exportTXT() {
    if (!tableData.length) return;
    dl("keywords.txt", tableData.map((r) => r.keyword).join("\n"), "text/plain");
  }

  function dl(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }

  function copyAllKeywords() {
    copyToClipboard(tableData.map((r) => r.keyword).join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field
      ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3 text-gray-300" />;

  const step = !results ? 1 : ideas ? 3 : 2;

  const stageLabel: Record<string, string> = {
    init: "Initializing…",
    sitemap: "Discovering sitemaps…",
    homepage: "Scanning homepage…",
    discovery: "Processing URLs…",
    filter: "Filtering articles…",
    analysis: "Analyzing pages…",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-7 h-7 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keyword Extractor</h1>
          <p className="text-sm text-gray-500">Find relevant articles from any public website by topic</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        {[
          { n: 1, label: "Enter website + topic" },
          { n: 2, label: "Review keywords" },
          { n: 3, label: "Generate content ideas" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              step >= n ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400")}>
              {n}
            </span>
            <span className={cn("text-sm hidden sm:inline", step >= n ? "text-gray-700 font-medium" : "text-gray-400")}>{label}</span>
            {n < 3 && <span className="text-gray-200 mx-1">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Website Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => { setDomain(e.target.value); setDomainError(null); }}
              placeholder="https://example.com"
              className={cn(
                "w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300",
                domainError ? "border-red-300" : "border-gray-200"
              )}
            />
            {domainError && <p className="text-xs text-red-500 mt-1">{domainError}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Keyword / Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. kitchen decor, fitness, personal finance…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <p className="text-xs text-gray-400 mt-1">Enter any keyword or topic. We&apos;ll analyze the public website and find relevant articles.</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date Filter</label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {DATE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex items-center gap-4 bg-gray-50 rounded-lg px-4 py-3">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">
              Min. Relevance Threshold: <span className="text-red-500 font-bold">{threshold}</span>
            </label>
            <input
              type="range" min={0} max={100} step={5} value={threshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="w-full mt-1 accent-red-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0 — All</span>
              <span>50 — Possibly Relevant</span>
              <span>65 — Relevant</span>
              <span>80 — Highly Relevant</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleExtract}
          disabled={extracting || !domain || !topic.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {extracting ? "Extracting…" : "Extract Keywords"}
        </button>

        {extractError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700 text-sm">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {extractError}
          </div>
        )}
      </div>

      {/* Progress panel */}
      {extracting && progress && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
            <span className="text-sm font-semibold text-blue-800">{stageLabel[progress.stage] ?? progress.stage}</span>
          </div>
          {progress.counts && (
            <div className="flex flex-wrap gap-4 mb-3">
              {progress.counts.sitemapsFound !== undefined && (
                <Chip label="Sitemaps" value={progress.counts.sitemapsFound} />
              )}
              {progress.counts.urlsCollected !== undefined && (
                <Chip label="URLs collected" value={progress.counts.urlsCollected} />
              )}
              {progress.counts.totalUrls !== undefined && (
                <Chip label="Total URLs" value={progress.counts.totalUrls} />
              )}
              {progress.counts.articleUrls !== undefined && (
                <Chip label="Articles" value={progress.counts.articleUrls} />
              )}
              {progress.counts.candidateArticles !== undefined && (
                <Chip label="Candidates" value={progress.counts.candidateArticles} />
              )}
              {progress.counts.analyzed !== undefined && progress.counts.total !== undefined && (
                <Chip label="Analyzed" value={`${progress.counts.analyzed} / ${progress.counts.total}`} />
              )}
            </div>
          )}
          <div className="bg-white border border-blue-100 rounded-lg p-3 max-h-36 overflow-y-auto font-mono text-xs text-gray-500 space-y-0.5">
            {progress.log.map((line, i) => (
              <div key={i} className="truncate">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Results */}
      {results && (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <StatCard label="Total URLs" value={stats?.totalUrls ?? 0} />
            <StatCard label="Article URLs" value={stats?.totalArticles ?? 0} />
            <StatCard label="Candidates" value={stats?.candidateArticles ?? 0} />
            <StatCard label="Analyzed" value={stats?.stage2Fetched ?? 0} />
            <StatCard label="Scored" value={results.length} />
            <StatCard label={`Shown (≥${threshold})`} value={tableData.length} highlight />
          </div>

          {stats && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-4 text-xs text-blue-700 space-y-0.5">
              <div className="font-semibold mb-1">Discovery summary</div>
              <div>Sitemaps used: {stats.sitemaps.length} · Sitemap URLs: {(stats.totalUrls - stats.homepageLinks).toLocaleString()} · Homepage supplemental links: {stats.homepageLinks}</div>
              <div>Total unique URLs: {stats.totalUrls.toLocaleString()} · Article candidates: {stats.totalArticles.toLocaleString()} · Analyzed: {stats.stage2Fetched}</div>
            </div>
          )}

          {stats?.sitemaps && stats.sitemaps.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 mb-4 text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1 items-center">
              <span className="font-medium text-gray-600">Sitemaps:</span>
              {stats.sitemaps.slice(0, 20).map((s, i) => {
                try {
                  return <a key={i} href={s} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{new URL(s).pathname}</a>;
                } catch {
                  return <span key={i}>{s}</span>;
                }
              })}
              {stats.sitemaps.length > 20 && <span className="text-gray-400">+{stats.sitemaps.length - 20} more</span>}
            </div>
          )}

          {tableData.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No keywords meet the threshold of {threshold} for &quot;{topic}&quot;</p>
              <p className="text-sm text-gray-400 mt-1">Lower the threshold slider above, or try a different topic.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 flex-1 min-w-48">
                  <Filter className="w-4 h-4 text-gray-300" />
                  <input
                    type="text" value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Filter keywords…"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <span className="text-xs text-gray-400">{selected.size} selected</span>
                  <button onClick={copyAllKeywords}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {copiedAll ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copiedAll ? "Copied!" : "Copy All"}
                  </button>
                  <button onClick={exportCSV}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <button onClick={exportTXT}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Download className="w-3 h-3" /> TXT
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox"
                          checked={pageData.length > 0 && pageData.every((r) => selected.has(r.url))}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-300" />
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("keyword")}>
                        <span className="flex items-center gap-1">Keyword <SortIcon field="keyword" /></span>
                      </th>
                      <th className="px-4 py-3 text-left hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("url")}>
                        <span className="flex items-center gap-1">Article URL <SortIcon field="url" /></span>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort("relevance")}>
                        <span className="flex items-center gap-1">Relevance <SortIcon field="relevance" /></span>
                      </th>
                      <th className="px-4 py-3 text-left hidden xl:table-cell">Match Reason</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageData.map((row) => (
                      <TableRow key={row.url} row={row} selected={selected.has(row.url)} onToggle={() => toggleSelect(row.url)} />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, tableData.length)} of {tableData.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pg: number;
                      if (totalPages <= 7) pg = i + 1;
                      else if (i === 0) pg = 1;
                      else if (i === 6) pg = totalPages;
                      else pg = Math.max(2, Math.min(totalPages - 1, safePage - 2 + i));
                      return (
                        <button key={pg} onClick={() => setPage(pg)}
                          className={cn("w-7 h-7 text-xs rounded", pg === safePage ? "bg-red-500 text-white" : "hover:bg-gray-100 text-gray-600")}>
                          {pg}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {tableData.length === 0 && search && (
                <div className="p-6 text-center text-sm text-gray-400">No results match &quot;{search}&quot;</div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-5 mb-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <h3 className="font-semibold text-gray-800">Generate Content Ideas</h3>
                  </div>
                  <p className="text-sm text-gray-500">
                    Select keywords above, then generate original content ideas with Pinterest angles.
                    {selected.size > 0 && <span className="text-purple-600 font-medium"> {selected.size} selected.</span>}
                  </p>
                </div>
                <button
                  onClick={handleGenerateIdeas}
                  disabled={selected.size === 0 || generatingIdeas}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {generatingIdeas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generatingIdeas ? "Generating…" : "Generate Content Ideas"}
                </button>
              </div>
              {ideaError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> {ideaError}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Step 3: Content Ideas */}
      {ideas && ideas.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-900">Content Ideas ({ideas.length})</h2>
            <span className="text-xs text-gray-400 ml-1">Original ideas — not copied from source</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map((idea, i) => <IdeaCard key={i} idea={idea} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-blue-100 rounded-lg px-3 py-1.5 text-center min-w-16">
      <div className="text-sm font-bold text-blue-800">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-xs text-blue-500">{label}</div>
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", highlight ? "bg-red-50 border-red-100" : "bg-white border-gray-200")}>
      <div className={cn("text-2xl font-bold", highlight ? "text-red-600" : "text-gray-900")}>{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function TableRow({ row, selected, onToggle }: { row: ExtractedKeyword; selected: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    copyToClipboard(row.keyword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <tr className={cn("hover:bg-gray-50 cursor-pointer transition-colors", selected && "bg-red-50")} onClick={onToggle}>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle}
          className="rounded border-gray-300 text-red-500 focus:ring-red-300" />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{row.keyword}</p>
        {row.pageTitle && <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{row.pageTitle}</p>}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
        <a href={row.url} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-500 hover:underline truncate flex items-center gap-1 max-w-xs">
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate">{row.url}</span>
        </a>
      </td>
      <td className="px-4 py-3 whitespace-nowrap"><RelevanceBadge score={row.relevance} /></td>
      <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500 max-w-xs">
        <span className="truncate block" title={row.matchReason}>{row.matchReason ?? ""}</span>
      </td>
      <td className="px-4 py-3">
        <button onClick={handleCopy} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </td>
    </tr>
  );
}

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 leading-snug">{idea.title}</h3>
          <button onClick={() => { copyToClipboard(idea.title); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="shrink-0 p-1.5 rounded hover:bg-gray-100">
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={cn("text-xs rounded px-2 py-0.5 font-medium", INTENT_COLORS[idea.searchIntent] ?? "bg-gray-100 text-gray-600")}>
            {idea.searchIntent}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{idea.primaryKeyword}</span>
        </div>
        <p className="text-sm text-gray-600 mb-3">{idea.angle}</p>
        {idea.subtopics?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Subtopics</p>
            <ul className="space-y-1">
              {idea.subtopics.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" /> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium mt-1">
          <Sparkles className="w-3 h-3" />
          {expanded ? "Hide" : "Show"} Pinterest Opportunity
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-purple-50 bg-purple-50 p-5">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">Pinterest Opportunity</p>
          <div className="space-y-2">
            <div><p className="text-xs text-gray-500 mb-0.5">Pin Title</p><p className="text-sm font-medium text-gray-800">{idea.pinterestTitle}</p></div>
            <div><p className="text-xs text-gray-500 mb-0.5">Pin Angle</p><p className="text-sm text-gray-700">{idea.pinterestAngle}</p></div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Related Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.pinterestKeywords?.map((kw, i) => (
                  <span key={i} className="text-xs bg-white border border-purple-100 text-purple-700 rounded-full px-2.5 py-0.5">{kw}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Suggested Board</p>
              <span className="text-xs bg-white border border-purple-100 text-purple-700 rounded px-2 py-0.5">{idea.suggestedBoard}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Pinterest keyword data shown is AI-estimated. Not official Pinterest search volume.</p>
        </div>
      )}
    </div>
  );
}
