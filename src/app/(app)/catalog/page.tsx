"use client";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  BarChart2,
  Search,
  Layers,
  Wrench,
  ArrowUpRight,
  Info,
  Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Feed {
  id: string;
  name: string;
  format: string;
  location: string;
  status: string;
  catalog_type: string;
  counts?: {
    TOTAL?: number;
    INGESTED?: number;
    FAILED?: number;
    WARNINGS?: number;
    ORIGINAL?: number;
    EXPIRED?: number;
  };
  created_at?: string;
  updated_at?: string;
}

interface Catalog {
  id: string;
  name: string;
  catalog_type: string;
  created_at?: string;
}

interface OverviewData {
  scopeError?: boolean;
  message?: string;
  catalogs?: Catalog[];
  feeds?: Feed[];
  summary?: {
    totalCatalogs: number;
    totalFeeds: number;
    totalProducts: number;
    totalIngested: number;
    totalErrors: number;
  };
}

interface Product {
  id: unknown;
  title: string;
  description: string;
  imageLink: string;
  link: string;
  availability: string;
  price: string;
  brand: string;
  condition: string;
  googleProductCategory: string;
  seoScore: number;
  issues: string[];
  status: string;
}

interface ProductGroup {
  id: unknown;
  name: string;
  status: string;
  feedId: string;
  filterV2: unknown;
  createdAt?: string;
  updatedAt?: string;
}

type Tab = "overview" | "audit" | "seo" | "products" | "groups" | "diagnostics";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "audit", label: "Product Feed Audit", icon: AlertTriangle },
  { id: "seo", label: "Product SEO", icon: Search },
  { id: "products", label: "Products", icon: ShoppingBag },
  { id: "groups", label: "Product Groups", icon: Layers },
  { id: "diagnostics", label: "Diagnostics", icon: Wrench },
];

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function feedStatusColor(status: string) {
  const s = status?.toUpperCase();
  if (s === "ACTIVE") return "bg-green-100 text-green-700";
  if (s === "INACTIVE" || s === "INACTIVE_FEED_RETURN_ERROR") return "bg-red-100 text-red-700";
  if (s === "PROCESSING") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

function healthScore(feed: Feed): number {
  const total = feed.counts?.TOTAL ?? 0;
  if (total === 0) return 0;
  const ingested = feed.counts?.INGESTED ?? 0;
  const failed = feed.counts?.FAILED ?? 0;
  const warnings = feed.counts?.WARNINGS ?? 0;
  const score = Math.round(((ingested - warnings * 0.5 - failed) / total) * 100);
  return Math.max(0, Math.min(100, score));
}

// ─── Scope Error Banner ───────────────────────────────────────────────────────

function ScopeErrorBanner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Catalog Permissions Required</h2>
      <p className="text-gray-500 max-w-md mb-6">
        Accessing your Pinterest Catalog requires reconnecting your Pinterest account with
        catalog permissions (<code className="bg-gray-100 px-1 rounded text-xs">catalogs:read</code>).
      </p>
      <a
        href="/api/pinterest-oauth/start"
        className="inline-flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors"
      >
        Reconnect Pinterest
        <ArrowUpRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: OverviewData }) {
  if (data.scopeError) return <ScopeErrorBanner />;

  const { summary, feeds = [], catalogs = [] } = data;

  const statCards = [
    { label: "Catalogs", value: summary?.totalCatalogs ?? 0, icon: ShoppingBag, color: "bg-purple-100 text-purple-600" },
    { label: "Feeds", value: summary?.totalFeeds ?? 0, icon: Layers, color: "bg-blue-100 text-blue-600" },
    { label: "Total Products", value: (summary?.totalProducts ?? 0).toLocaleString(), icon: BarChart2, color: "bg-green-100 text-green-600" },
    { label: "Products with Errors", value: (summary?.totalErrors ?? 0).toLocaleString(), icon: XCircle, color: "bg-red-100 text-red-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", s.color)}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Feeds overview */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Active Feeds</h3>
        </div>
        {feeds.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No feeds found</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {feeds.map((feed) => {
              const hs = healthScore(feed);
              return (
                <div key={feed.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{feed.name || feed.id}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{feed.format} · {feed.catalog_type}</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", feedStatusColor(feed.status))}>
                      {feed.status}
                    </span>
                  </div>
                  <div className="w-20 text-right">
                    <p className={cn("text-sm font-bold", scoreColor(hs))}>{hs}%</p>
                    <p className="text-xs text-gray-400">health</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalogs */}
      {catalogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Catalogs</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {catalogs.map((cat) => (
              <div key={cat.id} className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{cat.name || cat.id}</p>
                  <p className="text-xs text-gray-400">{cat.catalog_type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feed Audit Tab ───────────────────────────────────────────────────────────

function AuditTab({ data }: { data: OverviewData }) {
  if (data.scopeError) return <ScopeErrorBanner />;
  const { feeds = [] } = data;

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-blue-700">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Feed health is calculated from ingested, failed, and warning counts reported by Pinterest&apos;s feed processing pipeline.</p>
      </div>

      {feeds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400 text-sm">
          No feeds found. Connect a product feed in Pinterest Business Hub first.
        </div>
      ) : (
        feeds.map((feed) => {
          const total = feed.counts?.TOTAL ?? 0;
          const ingested = feed.counts?.INGESTED ?? 0;
          const failed = feed.counts?.FAILED ?? 0;
          const warnings = feed.counts?.WARNINGS ?? 0;
          const expired = feed.counts?.EXPIRED ?? 0;
          const hs = healthScore(feed);

          const issues: { type: "critical" | "warning" | "ok"; label: string; count?: number }[] = [];
          if (failed > 0) issues.push({ type: "critical", label: "Products failed to ingest", count: failed });
          if (warnings > 0) issues.push({ type: "warning", label: "Products with warnings", count: warnings });
          if (expired > 0) issues.push({ type: "warning", label: "Expired products", count: expired });
          if (feed.status !== "ACTIVE") issues.push({ type: "critical", label: `Feed status: ${feed.status}` });
          if (issues.length === 0) issues.push({ type: "ok", label: "No critical issues found" });

          return (
            <div key={feed.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{feed.name || feed.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{feed.format} · Last updated: {feed.updated_at ? new Date(feed.updated_at).toLocaleDateString() : "—"}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-bold", scoreColor(hs))}>{hs}%</p>
                  <p className="text-xs text-gray-400">health score</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{ingested.toLocaleString()} ingested</span>
                  <span>{total.toLocaleString()} total</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-green-500 rounded-full"
                    style={{ width: total ? `${Math.round((ingested / total) * 100)}%` : "0%" }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                {[
                  { label: "Total", value: total, color: "text-gray-900" },
                  { label: "Ingested", value: ingested, color: "text-green-600" },
                  { label: "Failed", value: failed, color: "text-red-500" },
                  { label: "Warnings", value: warnings, color: "text-yellow-600" },
                ].map((stat) => (
                  <div key={stat.label} className="px-4 py-3 text-center">
                    <p className={cn("text-lg font-bold", stat.color)}>{stat.value.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Issues */}
              <div className="px-5 py-3 space-y-2">
                {issues.map((issue, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-sm rounded-lg px-3 py-2",
                    issue.type === "critical" ? "bg-red-50 text-red-700" :
                    issue.type === "warning" ? "bg-yellow-50 text-yellow-700" :
                    "bg-green-50 text-green-700"
                  )}>
                    {issue.type === "critical" ? <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> :
                     issue.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> :
                     <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span>{issue.label}{issue.count !== undefined ? ` (${issue.count.toLocaleString()})` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Product SEO Tab ──────────────────────────────────────────────────────────

function ProductSeoTab({ products, loading, feeds, selectedFeed, onFeedChange }: {
  products: Product[];
  loading: boolean;
  feeds: Feed[];
  selectedFeed: string;
  onFeedChange: (id: string) => void;
}) {
  if (loading) return <LoadingState label="Loading product SEO data..." />;

  const avgScore = products.length
    ? Math.round(products.reduce((s, p) => s + p.seoScore, 0) / products.length)
    : 0;

  const criticalCount = products.filter(p => p.seoScore < 40).length;
  const warningCount = products.filter(p => p.seoScore >= 40 && p.seoScore < 70).length;
  const goodCount = products.filter(p => p.seoScore >= 70).length;

  // Count issue frequency
  const issueFreq: Record<string, number> = {};
  for (const p of products) {
    for (const issue of p.issues) {
      issueFreq[issue] = (issueFreq[issue] ?? 0) + 1;
    }
  }
  const topIssues = Object.entries(issueFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {feeds.length > 0 && (
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedFeed}
            onChange={(e) => onFeedChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
          >
            {feeds.map((f) => (
              <option key={f.id} value={f.id}>{f.name || f.id}</option>
            ))}
          </select>
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState label="Select a feed to view product SEO scores." />
      ) : (
        <>
          {/* Score summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className={cn("text-3xl font-bold", scoreColor(avgScore))}>{avgScore}</p>
              <p className="text-xs text-gray-500 mt-1">Avg SEO Score</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-3xl font-bold text-green-600">{goodCount}</p>
              <p className="text-xs text-gray-500 mt-1">Good (≥70)</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-3xl font-bold text-yellow-600">{warningCount}</p>
              <p className="text-xs text-gray-500 mt-1">Needs Work (40–69)</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-3xl font-bold text-red-500">{criticalCount}</p>
              <p className="text-xs text-gray-500 mt-1">Critical (&lt;40)</p>
            </div>
          </div>

          {/* Top issues */}
          {topIssues.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Top SEO Issues</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {topIssues.map(([issue, count]) => (
                  <div key={issue} className="px-5 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">{issue}</span>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {count} products
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product score breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Product Scores</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {products.sort((a, b) => a.seoScore - b.seoScore).map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  {p.imageLink ? (
                    <img src={p.imageLink} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title || "Untitled"}</p>
                    {p.issues.length > 0 && (
                      <p className="text-xs text-red-500 truncate">{p.issues[0]}{p.issues.length > 1 ? ` +${p.issues.length - 1} more` : ""}</p>
                    )}
                  </div>
                  <span className={cn("text-sm font-bold w-10 text-right", scoreColor(p.seoScore))}>
                    {p.seoScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({ products, loading, feeds, selectedFeed, onFeedChange }: {
  products: Product[];
  loading: boolean;
  feeds: Feed[];
  selectedFeed: string;
  onFeedChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "score" | "status">("score");

  if (loading) return <LoadingState label="Loading products..." />;

  const filtered = products
    .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "score") return a.seoScore - b.seoScore;
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      return (a.status || "").localeCompare(b.status || "");
    });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {feeds.length > 0 && (
          <select
            value={selectedFeed}
            onChange={(e) => onFeedChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
          >
            {feeds.map((f) => (
              <option key={f.id} value={f.id}>{f.name || f.id}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
        >
          <option value="score">Sort: SEO Score</option>
          <option value="title">Sort: Title</option>
          <option value="status">Sort: Status</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} products</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState label={products.length === 0 ? "Select a feed to view products." : "No products match your search."} />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Brand</th>
                  <th className="px-4 py-3 text-left">Price</th>
                  <th className="px-4 py-3 text-left">Availability</th>
                  <th className="px-4 py-3 text-left">SEO Score</th>
                  <th className="px-4 py-3 text-left">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageLink ? (
                          <img src={p.imageLink} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{p.title || "Untitled"}</p>
                          {p.link && (
                            <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block max-w-[200px]">
                              {p.link}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.brand || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{p.price || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                        p.availability === "in stock" ? "bg-green-100 text-green-700" :
                        p.availability === "out of stock" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {p.availability || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-bold text-sm", scoreColor(p.seoScore))}>{p.seoScore}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.issues.length > 0 ? (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", scoreBg(p.seoScore))}>
                          {p.issues.length} issue{p.issues.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Product Groups Tab ───────────────────────────────────────────────────────

function GroupsTab({ groups, loading }: { groups: ProductGroup[]; loading: boolean }) {
  if (loading) return <LoadingState label="Loading product groups..." />;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-blue-700">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Product groups allow you to target specific products in Pinterest Ads campaigns.</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState label="No product groups found. Create groups in Pinterest Business Hub to target products with ads." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {groups.map((g, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{g.name || String(g.id)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Feed ID: {g.feedId || "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    g.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                    g.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  )}>
                    {g.status || "—"}
                  </span>
                  <a
                    href="https://ads.pinterest.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#e60023] hover:text-[#ad081b] transition-colors"
                  >
                    Promote with Ads
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Diagnostics Tab ─────────────────────────────────────────────────────────

function DiagnosticsTab({ data, products }: { data: OverviewData; products: Product[] }) {
  if (data.scopeError) return <ScopeErrorBanner />;

  const feeds = data.feeds ?? [];

  const feedIssues: { severity: "critical" | "warning"; category: string; message: string }[] = [];
  const distIssues: { severity: "critical" | "warning"; category: string; message: string }[] = [];

  for (const feed of feeds) {
    if (feed.status !== "ACTIVE") {
      feedIssues.push({ severity: "critical", category: "Feed Status", message: `Feed "${feed.name || feed.id}" is ${feed.status}` });
    }
    if ((feed.counts?.FAILED ?? 0) > 0) {
      feedIssues.push({ severity: "critical", category: "Ingest Errors", message: `${feed.counts!.FAILED} products failed to ingest in "${feed.name || feed.id}"` });
    }
    if ((feed.counts?.WARNINGS ?? 0) > 0) {
      feedIssues.push({ severity: "warning", category: "Ingest Warnings", message: `${feed.counts!.WARNINGS} products have ingest warnings in "${feed.name || feed.id}"` });
    }
    if ((feed.counts?.EXPIRED ?? 0) > 0) {
      feedIssues.push({ severity: "warning", category: "Expired Products", message: `${feed.counts!.EXPIRED} products expired in "${feed.name || feed.id}"` });
    }
  }

  if (products.length > 0) {
    const missingImage = products.filter(p => !p.imageLink).length;
    const missingLink = products.filter(p => !p.link).length;
    const missingCategory = products.filter(p => !p.googleProductCategory).length;
    if (missingImage > 0) distIssues.push({ severity: "critical", category: "Missing Images", message: `${missingImage} products have no image — they will not appear in Shopping ads` });
    if (missingLink > 0) distIssues.push({ severity: "critical", category: "Missing URLs", message: `${missingLink} products have no product URL` });
    if (missingCategory > 0) distIssues.push({ severity: "warning", category: "Missing Category", message: `${missingCategory} products have no Google Product Category — may reduce distribution` });
  }

  const allGood = feedIssues.length === 0 && distIssues.length === 0;

  return (
    <div className="space-y-5">
      {allGood ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-green-800">No issues detected</p>
          <p className="text-sm text-green-600 mt-1">Your catalog feed and product distribution look healthy.</p>
        </div>
      ) : (
        <>
          {feedIssues.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Feed Issues</h3>
                <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                  {feedIssues.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {feedIssues.map((issue, i) => (
                  <div key={i} className={cn("px-5 py-3 flex items-start gap-3 text-sm",
                    issue.severity === "critical" ? "bg-red-50/50" : "bg-yellow-50/50"
                  )}>
                    {issue.severity === "critical"
                      ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-medium text-gray-800 text-xs uppercase tracking-wide">{issue.category}</p>
                      <p className="text-gray-600">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {distIssues.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold text-gray-900">Distribution Issues</h3>
                <span className="ml-auto text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                  {distIssues.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {distIssues.map((issue, i) => (
                  <div key={i} className={cn("px-5 py-3 flex items-start gap-3 text-sm",
                    issue.severity === "critical" ? "bg-red-50/50" : "bg-yellow-50/50"
                  )}>
                    {issue.severity === "critical"
                      ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-medium text-gray-800 text-xs uppercase tracking-wide">{issue.category}</p>
                      <p className="text-gray-600">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-8 h-8 animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400 text-sm px-6">
      <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState("");

  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsFetched, setGroupsFetched] = useState(false);

  const feeds = overviewData?.feeds ?? [];

  // Load overview on mount
  useEffect(() => {
    setOverviewLoading(true);
    fetch("/api/pinterest-catalog")
      .then((r) => r.json())
      .then((d) => {
        setOverviewData(d);
        // Auto-select first feed
        if (d.feeds?.length) setSelectedFeedId(d.feeds[0].id);
      })
      .catch(() => setOverviewError("Failed to load catalog data"))
      .finally(() => setOverviewLoading(false));
  }, []);

  // Load products when feedId is known and products/seo/diagnostics tab opened
  const loadProducts = useCallback((feedId: string) => {
    if (!feedId) return;
    setProductsLoading(true);
    fetch(`/api/pinterest-catalog/products?feedId=${encodeURIComponent(feedId)}&pageSize=50`)
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, []);

  // When feed selection changes, reload products
  useEffect(() => {
    if (selectedFeedId && (activeTab === "products" || activeTab === "seo" || activeTab === "diagnostics")) {
      loadProducts(selectedFeedId);
    }
  }, [selectedFeedId, activeTab, loadProducts]);

  // Load product groups once when tab is opened
  useEffect(() => {
    if (activeTab === "groups" && !groupsFetched) {
      setGroupsLoading(true);
      fetch("/api/pinterest-catalog/product-groups")
        .then((r) => r.json())
        .then((d) => setGroups(d.groups ?? []))
        .catch(() => setGroups([]))
        .finally(() => { setGroupsLoading(false); setGroupsFetched(true); });
    }
  }, [activeTab, groupsFetched]);

  function handleFeedChange(feedId: string) {
    setSelectedFeedId(feedId);
    setProducts([]);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-[#e60023] rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pinterest Catalog</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">Manage and audit your product catalog for shopping ads</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 bg-white rounded-2xl border border-gray-100 p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
              activeTab === tab.id
                ? "bg-[#e60023] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && <ChevronRight className="w-3 h-3 opacity-60" />}
          </button>
        ))}
      </div>

      {/* Content */}
      {overviewLoading ? (
        <LoadingState label="Loading catalog..." />
      ) : overviewError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-sm">{overviewError}</div>
      ) : !overviewData ? null : (
        <>
          {activeTab === "overview" && <OverviewTab data={overviewData} />}
          {activeTab === "audit" && <AuditTab data={overviewData} />}
          {activeTab === "seo" && (
            <ProductSeoTab
              products={products}
              loading={productsLoading}
              feeds={feeds}
              selectedFeed={selectedFeedId}
              onFeedChange={handleFeedChange}
            />
          )}
          {activeTab === "products" && (
            <ProductsTab
              products={products}
              loading={productsLoading}
              feeds={feeds}
              selectedFeed={selectedFeedId}
              onFeedChange={handleFeedChange}
            />
          )}
          {activeTab === "groups" && (
            <GroupsTab groups={groups} loading={groupsLoading} />
          )}
          {activeTab === "diagnostics" && (
            <DiagnosticsTab data={overviewData} products={products} />
          )}
        </>
      )}
    </div>
  );
}
