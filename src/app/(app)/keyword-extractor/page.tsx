"use client";
import { useState, useMemo, useRef } from "react";
import {
  Globe, Copy, Download, Sparkles, CheckCircle,
  XCircle, AlertTriangle, ChevronUp, ChevronDown, Loader2,
  Lightbulb, ExternalLink, Filter, ChevronLeft, ChevronRight,
  BarChart2, FileText, Tag, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/app/api/keyword-extractor/extract/route";
import type { AutoDiscoverResponse, ArticleResult } from "@/app/api/keyword-extractor/auto-discover/route";
import type { KeywordAggregate, TopicCluster } from "@/lib/keyword-extractor/article-keyword-extractor";
import type { ContentIdea } from "@/lib/keyword-extractor/content-idea-generator";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProgressState {
  stage: string;
  message: string;
  counts?: Record<string, number>;
  log: string[];
}

type ResultTab = "articles" | "keywords" | "clusters";

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(conf: number) {
  if (conf >= 90) return "bg-green-100 text-green-700";
  if (conf >= 75) return "bg-blue-100 text-blue-700";
  if (conf >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
}

function confidenceLabel(conf: number) {
  if (conf >= 90) return "Very High";
  if (conf >= 75) return "High";
  if (conf >= 60) return "Medium";
  return "Low";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

const PAGE_SIZE = 25;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KeywordExtractorPage() {
  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [data, setData] = useState<AutoDiscoverResponse | null>(null);
  const [tab, setTab] = useState<ResultTab>("articles");
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [articlePage, setArticlePage] = useState(1);
  const [kwPage, setKwPage] = useState(1);
  const [sortField, setSortField] = useState<"confidence" | "keyword" | "articles">("confidence");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  function validateDomain(val: string): boolean {
    try {
      const u = new URL(val.startsWith("http") ? val : `https://${val}`);
      if (!["http:", "https:"].includes(u.protocol)) { setDomainError("URL must use http or https"); return false; }
      setDomainError(null);
      return true;
    } catch {
      setDomainError("Please enter a valid website domain");
      return false;
    }
  }

  async function handleAnalyze() {
    if (!validateDomain(domain)) return;
    setExtracting(true);
    setExtractError(null);
    setData(null);
    setSelected(new Set());
    setIdeas(null);
    setSearch("");
    setArticlePage(1);
    setKwPage(1);
    setClusterFilter(null);
    setTab("articles");
    setProgress({ stage: "init", message: "Starting…", log: [] });

    try {
      const res = await fetch("/api/keyword-extractor/auto-discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
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
                log: [...(prev?.log ?? []), event.message].slice(-30),
              }));
              setTimeout(() => { logRef.current?.scrollTo({ top: 9999 }); }, 50);
            } else if (event.type === "complete") {
              setData(event.data as unknown as AutoDiscoverResponse);
              setProgress(null);
            } else if (event.type === "error") {
              setExtractError(event.message);
              setProgress(null);
            }
          } catch { /* malformed SSE */ }
        }
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Request failed");
      setProgress(null);
    } finally {
      setExtracting(false);
    }
  }

  // ── Filter + sort articles ─────────────────────────────────────────────────
  const filteredArticles = useMemo((): ArticleResult[] => {
    if (!data) return [];
    let list = data.articles;
    if (clusterFilter) list = list.filter((a) => a.cluster === clusterFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.primaryKeyword.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.url.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const va = sortField === "confidence" ? a.confidence : a.primaryKeyword.toLowerCase();
      const vb = sortField === "confidence" ? b.confidence : b.primaryKeyword.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, clusterFilter, search, sortField, sortDir]);

  // ── Filter + sort keywords ─────────────────────────────────────────────────
  const filteredKeywords = useMemo((): KeywordAggregate[] => {
    if (!data) return [];
    let list = data.keywords;
    if (clusterFilter) list = list.filter((k) => k.cluster === clusterFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortField === "articles") return sortDir === "asc" ? a.articleCount - b.articleCount : b.articleCount - a.articleCount;
      if (sortField === "confidence") return sortDir === "asc" ? a.avgConfidence - b.avgConfidence : b.avgConfidence - a.avgConfidence;
      const va = a.keyword; const vb = b.keyword;
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [data, clusterFilter, search, sortField, sortDir]);

  const articlePages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const safeAPage = Math.min(articlePage, articlePages);
  const pageArticles = filteredArticles.slice((safeAPage - 1) * PAGE_SIZE, safeAPage * PAGE_SIZE);

  const kwPages = Math.max(1, Math.ceil(filteredKeywords.length / PAGE_SIZE));
  const safeKwPage = Math.min(kwPage, kwPages);
  const pageKeywords = filteredKeywords.slice((safeKwPage - 1) * PAGE_SIZE, safeKwPage * PAGE_SIZE);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setArticlePage(1); setKwPage(1);
  }

  function toggleSelect(url: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(url) ? next.delete(url) : next.add(url); return next; });
  }

  async function handleGenerateIdeas() {
    if (selected.size === 0) return;
    const selectedArticles = (data?.articles ?? []).filter((a) => selected.has(a.url));
    const keywords = selectedArticles.map((a) => a.primaryKeyword);
    const urls = selectedArticles.map((a) => a.url);
    setGeneratingIdeas(true); setIdeaError(null); setIdeas(null);
    try {
      const res = await fetch("/api/keyword-extractor/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, urls, category: "" }),
      });
      const d = await res.json();
      if (d.error) setIdeaError(d.error); else setIdeas(d.ideas ?? []);
    } catch { setIdeaError("AI generation failed"); }
    finally { setGeneratingIdeas(false); }
  }

  function exportCSV() {
    if (!data) return;
    const rows = [["URL", "Title", "Primary Keyword", "Confidence", "Cluster", "Secondary Keywords", "Published Date"]];
    for (const a of filteredArticles) {
      rows.push([a.url, a.title, a.primaryKeyword, String(a.confidence) + "%", a.cluster, a.secondaryKeywords.join("; "), a.datePublished ?? ""]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    dl("keywords.csv", csv, "text/csv");
  }

  function exportKeywordsCSV() {
    if (!data) return;
    const rows = [["Keyword", "Article Count", "Avg Confidence", "Cluster"]];
    for (const k of filteredKeywords) {
      rows.push([k.keyword, String(k.articleCount), String(k.avgConfidence) + "%", k.cluster]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    dl("keyword-aggregates.csv", csv, "text/csv");
  }

  function dl(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
  }

  const stageLabel: Record<string, string> = {
    init: "Initializing…", sitemap: "Discovering sitemaps…", homepage: "Scanning homepage…",
    discovery: "Processing URLs…", classify: "Classifying articles…",
    analysis: "Extracting keywords…", aggregating: "Clustering keywords…",
  };

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3 text-gray-300" />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-7 h-7 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Keyword Extractor</h1>
          <p className="text-sm text-gray-500">Automatically discover every keyword a website ranks for — no topic needed</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="max-w-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Website Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setDomainError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
            placeholder="https://www.heytherehome.com"
            className={cn(
              "w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-3",
              domainError ? "border-red-300" : "border-gray-200"
            )}
          />
          {domainError && <p className="text-xs text-red-500 mb-2">{domainError}</p>}
          <p className="text-xs text-gray-400 mb-4">
            Enter any public website. We&apos;ll discover all articles via sitemap, analyze each page, and extract the primary keyword automatically.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={extracting || !domain.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            {extracting ? "Analyzing…" : "Analyze Website"}
          </button>
        </div>
        {extractError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700 text-sm">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {extractError}
          </div>
        )}
      </div>

      {/* Progress */}
      {extracting && progress && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
            <span className="text-sm font-semibold text-blue-800">{stageLabel[progress.stage] ?? progress.stage}</span>
          </div>
          {progress.counts && (
            <div className="flex flex-wrap gap-3 mb-3">
              {progress.counts.sitemapsDiscovered !== undefined && (
                <Chip label="Sitemaps" value={progress.counts.sitemapsDiscovered} />
              )}
              {progress.counts.urlsFromSitemaps !== undefined && (
                <Chip label="Sitemap URLs" value={progress.counts.urlsFromSitemaps} />
              )}
              {progress.counts.totalUrls !== undefined && (
                <Chip label="Total URLs" value={progress.counts.totalUrls} />
              )}
              {progress.counts.articleCandidates !== undefined && (
                <Chip label="Articles" value={progress.counts.articleCandidates} />
              )}
              {progress.counts.analyzing !== undefined && progress.counts.total !== undefined && (
                <Chip label="Analyzed" value={`${progress.counts.analyzing} / ${progress.counts.total}`} />
              )}
            </div>
          )}
          <div ref={logRef} className="bg-white border border-blue-100 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs text-gray-500 space-y-0.5">
            {progress.log.map((line, i) => <div key={i} className="truncate">{line}</div>)}
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <StatCard label="Total URLs" value={data.totalUrlsFound} />
            <StatCard label="Article Candidates" value={data.totalArticleCandidates} />
            <StatCard label="Articles Analyzed" value={data.articlesAnalyzed} />
            <StatCard label="Keywords Extracted" value={data.articles.length} />
            <StatCard label="Unique Keywords" value={data.uniquePrimaryKeywords} highlight />
            <StatCard label="Clusters" value={data.totalClusters} />
          </div>

          {/* Discovery summary */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-4 text-xs text-blue-700 space-y-0.5">
            <div className="font-semibold mb-1">Discovery summary</div>
            <div>Sitemap Files Discovered: <strong>{data.sitemapsFound.length}</strong> · Sitemap Files Processed: <strong>{data.sitemapsProcessed}</strong> · URLs From Sitemaps: <strong>{data.urlsFromSitemaps.toLocaleString()}</strong></div>
            <div>Supplemental Internal URLs: <strong>{data.homepageLinks}</strong> · Total Unique URLs: <strong>{data.totalUrlsFound.toLocaleString()}</strong> · Article Candidates: <strong>{data.totalArticleCandidates.toLocaleString()}</strong></div>
          </div>

          <div className="flex gap-5">
            {/* Cluster sidebar */}
            {data.clusters.length > 0 && (
              <div className="hidden lg:block w-52 shrink-0">
                <div className="bg-white border border-gray-200 rounded-xl p-3 sticky top-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Topic Clusters</div>
                  <button
                    onClick={() => setClusterFilter(null)}
                    className={cn("w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 transition-colors",
                      !clusterFilter ? "bg-red-50 text-red-600 font-medium" : "hover:bg-gray-50 text-gray-600")}
                  >
                    All clusters
                  </button>
                  {data.clusters.filter((c) => c.totalArticles >= 2).map((c) => (
                    <button
                      key={c.name}
                      onClick={() => { setClusterFilter(c.name === clusterFilter ? null : c.name); setArticlePage(1); setKwPage(1); }}
                      className={cn("w-full text-left text-xs px-2 py-1.5 rounded-lg mb-0.5 flex items-center justify-between transition-colors",
                        clusterFilter === c.name ? "bg-red-50 text-red-600 font-medium" : "hover:bg-gray-50 text-gray-600")}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-gray-400 ml-1">{c.totalArticles}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Tabs */}
              <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
                {([
                  { id: "articles" as ResultTab, label: "Articles", icon: FileText, count: data.articles.length },
                  { id: "keywords" as ResultTab, label: "Keywords", icon: Tag, count: data.keywords.length },
                  { id: "clusters" as ResultTab, label: "Clusters", icon: BarChart2, count: data.clusters.length },
                ] as const).map(({ id, label, icon: Icon, count }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      tab === id ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700")}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full",
                      tab === id ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500")}>{count}</span>
                  </button>
                ))}
              </div>

              {/* Search + export toolbar */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-48">
                  <Search className="w-4 h-4 text-gray-300" />
                  <input
                    type="text" value={search}
                    onChange={(e) => { setSearch(e.target.value); setArticlePage(1); setKwPage(1); }}
                    placeholder={tab === "articles" ? "Filter articles…" : "Filter keywords…"}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <div className="flex gap-2 ml-auto">
                  {tab === "articles" && (
                    <>
                      <span className="text-xs text-gray-400 self-center">{selected.size} selected</span>
                      <button onClick={() => copyToClipboard(filteredArticles.map((a) => a.primaryKeyword).join("\n"))}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Copy className="w-3 h-3" /> Copy Keywords
                      </button>
                      <button onClick={exportCSV}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Download className="w-3 h-3" /> CSV
                      </button>
                    </>
                  )}
                  {tab === "keywords" && (
                    <button onClick={exportKeywordsCSV}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                </div>
              </div>

              {/* ── Articles tab ── */}
              {tab === "articles" && (
                <>
                  {filteredArticles.length === 0 ? (
                    <EmptyState message={search ? `No articles match "${search}"` : "No articles found"} />
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                              <th className="px-4 py-3 w-8">
                                <input type="checkbox"
                                  checked={pageArticles.length > 0 && pageArticles.every((a) => selected.has(a.url))}
                                  onChange={() => {
                                    const all = pageArticles.every((a) => selected.has(a.url));
                                    setSelected((prev) => {
                                      const next = new Set(prev);
                                      for (const a of pageArticles) all ? next.delete(a.url) : next.add(a.url);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-gray-300 text-red-500 focus:ring-red-300" />
                              </th>
                              <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort("confidence")}>
                                <span className="flex items-center gap-1">Confidence <SortIcon field="confidence" /></span>
                              </th>
                              <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort("keyword")}>
                                <span className="flex items-center gap-1">Primary Keyword <SortIcon field="keyword" /></span>
                              </th>
                              <th className="px-4 py-3 text-left hidden xl:table-cell">Secondary Keywords</th>
                              <th className="px-4 py-3 text-left hidden lg:table-cell">Article</th>
                              <th className="px-4 py-3 text-left hidden md:table-cell">Cluster</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {pageArticles.map((a) => (
                              <tr key={a.url} className={cn("hover:bg-gray-50 cursor-pointer", selected.has(a.url) && "bg-red-50")}
                                onClick={() => toggleSelect(a.url)}>
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={selected.has(a.url)} onChange={() => toggleSelect(a.url)}
                                    className="rounded border-gray-300 text-red-500 focus:ring-red-300" />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", confidenceBadge(a.confidence))}>
                                    {a.confidence}% · {confidenceLabel(a.confidence)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-900 text-sm">{a.primaryKeyword}</p>
                                </td>
                                <td className="px-4 py-3 hidden xl:table-cell max-w-xs">
                                  <p className="text-xs text-gray-400 truncate">{a.secondaryKeywords.join(", ")}</p>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                                  <p className="text-xs font-medium text-gray-700 truncate">{a.title}</p>
                                  <a href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5 truncate max-w-xs">
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{a.url.replace(/^https?:\/\//, "")}</span>
                                  </a>
                                  {a.datePublished && (
                                    <p className="text-xs text-gray-300 mt-0.5">{new Date(a.datePublished).toLocaleDateString()}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{a.cluster}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pagination page={safeAPage} total={articlePages} onChange={setArticlePage}
                        showing={`${(safeAPage - 1) * PAGE_SIZE + 1}–${Math.min(safeAPage * PAGE_SIZE, filteredArticles.length)} of ${filteredArticles.length}`} />
                    </div>
                  )}

                  {/* Generate Ideas CTA */}
                  {data.articles.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-5 mb-5">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            <h3 className="font-semibold text-gray-800">Generate Content Ideas</h3>
                          </div>
                          <p className="text-sm text-gray-500">
                            Select articles above, then generate original Pinterest content ideas.
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

              {/* ── Keywords tab ── */}
              {tab === "keywords" && (
                filteredKeywords.length === 0 ? (
                  <EmptyState message={search ? `No keywords match "${search}"` : "No keywords found"} />
                ) : (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                            <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort("keyword")}>
                              <span className="flex items-center gap-1">Keyword <SortIcon field="keyword" /></span>
                            </th>
                            <th className="px-4 py-3 text-left cursor-pointer w-28" onClick={() => toggleSort("articles")}>
                              <span className="flex items-center gap-1">Articles <SortIcon field="articles" /></span>
                            </th>
                            <th className="px-4 py-3 text-left cursor-pointer w-32" onClick={() => toggleSort("confidence")}>
                              <span className="flex items-center gap-1">Avg Confidence <SortIcon field="confidence" /></span>
                            </th>
                            <th className="px-4 py-3 text-left w-28 hidden md:table-cell">Cluster</th>
                            <th className="px-4 py-3 text-left hidden lg:table-cell">Sample Articles</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pageKeywords.map((kw) => (
                            <tr key={kw.keyword} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{kw.keyword}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                                  {kw.articleCount}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", confidenceBadge(kw.avgConfidence))}>
                                  {kw.avgConfidence}%
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{kw.cluster}</span>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <div className="space-y-0.5">
                                  {kw.articles.slice(0, 2).map((a) => (
                                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer"
                                      className="text-xs text-blue-400 hover:underline truncate flex items-center gap-0.5 max-w-xs">
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      <span className="truncate">{a.title || a.url}</span>
                                    </a>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={safeKwPage} total={kwPages} onChange={setKwPage}
                      showing={`${(safeKwPage - 1) * PAGE_SIZE + 1}–${Math.min(safeKwPage * PAGE_SIZE, filteredKeywords.length)} of ${filteredKeywords.length}`} />
                  </div>
                )
              )}

              {/* ── Clusters tab ── */}
              {tab === "clusters" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {data.clusters.map((c) => (
                    <div key={c.name} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-red-200 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{c.name}</h3>
                        <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                          {c.totalArticles} articles
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.keywords.slice(0, 8).map((kw) => (
                          <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{kw}</span>
                        ))}
                        {c.keywords.length > 8 && (
                          <span className="text-xs text-gray-400">+{c.keywords.length - 8} more</span>
                        )}
                      </div>
                      <button
                        onClick={() => { setClusterFilter(c.name); setTab("keywords"); setKwPage(1); }}
                        className="mt-3 text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        View keywords →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Content Ideas */}
      {ideas && ideas.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-900">Content Ideas ({ideas.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map((idea, i) => <IdeaCard key={i} idea={idea} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-blue-100 rounded-lg px-3 py-1.5 text-center min-w-14">
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
      <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
      <p className="text-gray-600 font-medium">{message}</p>
    </div>
  );
}

function Pagination({ page, total, onChange, showing }: { page: number; total: number; onChange: (p: number) => void; showing: string }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <span className="text-xs text-gray-500">{showing}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {(() => {
          const pages: (number | "…")[] =
            total <= 7
              ? Array.from({ length: total }, (_, i) => i + 1)
              : page <= 4
              ? [1, 2, 3, 4, 5, "…", total]
              : page >= total - 3
              ? [1, "…", total - 4, total - 3, total - 2, total - 1, total]
              : [1, "…", page - 1, page, page + 1, "…", total];
          return pages.map((pg, i) =>
            pg === "…" ? (
              <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
            ) : (
              <button key={pg} onClick={() => onChange(pg as number)}
                className={cn("w-7 h-7 text-xs rounded", pg === page ? "bg-red-500 text-white" : "hover:bg-gray-100 text-gray-600")}>
                {pg}
              </button>
            )
          );
        })()}
        <button onClick={() => onChange(Math.min(total, page + 1))} disabled={page === total}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 text-sm">{idea.title}</h3>
        <button onClick={() => { copyToClipboard(idea.title); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-gray-300 hover:text-gray-500 shrink-0">
          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {idea.angle && <p className="text-xs text-gray-500 mb-2">{idea.angle}</p>}
      <div className="flex flex-wrap gap-1">
        {idea.pinterestKeywords?.map((k: string) => (
          <span key={k} className="text-xs bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">{k}</span>
        ))}
      </div>
    </div>
  );
}

// Keep unused imports referenced so they don't error — Filter is used via Search
const _unused = Filter;
void _unused;
