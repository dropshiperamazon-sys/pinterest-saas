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
  reason?: string;
  message?: string;
  catalogs?: Catalog[];
  feeds?: Feed[];
  summary?: {
    totalCatalogs: number;
    totalFeeds: number;
    totalProducts: number | null;
    totalIngested: number | null;
    totalErrors: number | null;
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
  description?: string;
  status: string;
  feedId: string;
  filterV2: unknown;
  createdAt?: string;
  updatedAt?: string;
}

interface GroupProduct {
  id: unknown;
  itemId: string;
  itemGroupId: string;
  title: string;
  description: string;
  imageLink: string;
  link: string;
  price: string;
  salePrice: string;
  currency: string;
  availability: string;
  brand: string;
  condition: string;
  googleProductCategory: string;
  productType: string;
  status: string;
  seoScore: number;
  issues: string[];
}

interface GroupProductsDebug {
  groupEndpoint?: string;
  groupStatus?: number;
  productsEndpoint: string;
  productsStatus: number;
  productsApiError?: { status: number; body: string } | null;
  note?: string | null;
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

function healthScore(feed: Feed): number | null {
  if (feed.counts == null) return null;
  const total = feed.counts?.TOTAL ?? 0;
  if (total === 0) return null;
  const ingested = feed.counts?.INGESTED ?? 0;
  const failed = feed.counts?.FAILED ?? 0;
  const warnings = feed.counts?.WARNINGS ?? 0;
  const score = Math.round(((ingested - warnings * 0.5 - failed) / total) * 100);
  return Math.max(0, Math.min(100, score));
}

// ─── Scope Error Banner ───────────────────────────────────────────────────────

function ScopeErrorBanner({ reason, message }: { reason?: string; message?: string }) {
  const isBusinessAccess = reason === "business_access";
  const isTokenExpired = reason === "token_expired";

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {isBusinessAccess ? "Catalog Business Access Required" : isTokenExpired ? "Pinterest Session Expired" : "Catalog Permissions Required"}
      </h2>
      <p className="text-gray-500 max-w-md mb-6">
        {message ?? (
          <>
            Accessing your Pinterest Catalog requires reconnecting your Pinterest account with
            catalog permissions (<code className="bg-gray-100 px-1 rounded text-xs">catalogs:read</code>).
          </>
        )}
      </p>
      {!isBusinessAccess && (
        <a
          href="/api/pinterest-oauth/start"
          className="inline-flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors"
        >
          Reconnect Pinterest
          <ArrowUpRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

// ─── Pin Analytics Drawer ─────────────────────────────────────────────────────

interface PinDailyRow {
  date: string;
  impression: number;
  save: number;
  pinClick: number;
  outboundClick: number;
  engagement: number;
}

interface PinAnalyticsResult {
  pinId: string;
  pin: { title: string; description: string; link: string; imageUrl: string } | null;
  period: { startDate: string; endDate: string; days: number };
  daily: PinDailyRow[];
  totals: { impression: number; save: number; pinClick: number; outboundClick: number; engagement: number };
}

const PIN_CHART_METRICS = [
  { key: "impression" as const, label: "Impressions", color: "#6366f1" },
  { key: "save" as const, label: "Saves", color: "#10b981" },
  { key: "pinClick" as const, label: "Pin Clicks", color: "#f59e0b" },
  { key: "outboundClick" as const, label: "Outbound Clicks", color: "#e60023" },
  { key: "engagement" as const, label: "Engagement", color: "#8b5cf6" },
];

function MiniBarChart({ data, metricKey, color }: { data: PinDailyRow[]; metricKey: keyof PinDailyRow; color: string }) {
  const values = data.map((d) => Number(d[metricKey]));
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.85 }} title={`${data[i]?.date}: ${v.toLocaleString()}`} />
      ))}
    </div>
  );
}

function PinAnalyticsDrawer({ pinId, pinTitle, pinImage, onClose }: { pinId: string; pinTitle: string; pinImage: string; onClose: () => void }) {
  const [result, setResult] = useState<PinAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<keyof PinDailyRow>("impression");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pinterest-catalog/pin-analytics?pinId=${encodeURIComponent(pinId)}&days=30`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setResult(d);
      })
      .catch(() => setError("Failed to load pin analytics"))
      .finally(() => setLoading(false));
  }, [pinId]);

  const activeConfig = PIN_CHART_METRICS.find((m) => m.key === activeMetric) ?? PIN_CHART_METRICS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 rounded-t-3xl sm:rounded-t-2xl z-10">
          {pinImage ? (
            <img src={pinImage} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-gray-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{pinTitle || `Pin ${pinId}`}</p>
            <p className="text-xs text-gray-400">Last 30 days · pin-level analytics</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading pin analytics…
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-500">{error}</div>
          ) : result ? (
            <>
              {/* Totals row */}
              <div className="grid grid-cols-5 gap-3">
                {PIN_CHART_METRICS.map((m) => {
                  const val = result.totals[m.key as keyof typeof result.totals] ?? 0;
                  const isActive = activeMetric === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setActiveMetric(m.key as keyof PinDailyRow)}
                      className={cn("rounded-xl p-3 text-left border transition-all", isActive ? "border-2 shadow-sm" : "border-gray-100 hover:border-gray-200")}
                      style={isActive ? { borderColor: m.color, background: `${m.color}10` } : {}}
                    >
                      <p className="text-lg font-bold text-gray-900">{fmt(val)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{m.label}</p>
                    </button>
                  );
                })}
              </div>

              {/* Chart */}
              {result.daily.length > 0 ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-500 mb-3">{activeConfig.label} — daily trend</p>
                  <MiniBarChart data={result.daily} metricKey={activeMetric} color={activeConfig.color} />
                  <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                    <span>{result.daily[0]?.date}</span>
                    <span>{result.daily[result.daily.length - 1]?.date}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">No daily data available for this period</div>
              )}

              {/* Daily table */}
              {result.daily.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-2.5 text-left font-medium">Date</th>
                        <th className="px-3 py-2.5 text-right font-medium">Impressions</th>
                        <th className="px-3 py-2.5 text-right font-medium">Saves</th>
                        <th className="px-3 py-2.5 text-right font-medium">Pin Clicks</th>
                        <th className="px-3 py-2.5 text-right font-medium pr-4">Outbound</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...result.daily].reverse().map((row) => (
                        <tr key={row.date} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-gray-600">{row.date}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.impression.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.save.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{row.pinClick.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700 pr-4">{row.outboundClick.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

interface CatalogAnalytics {
  id: string;
  name: string;
  catalogType: string;
  impressions: number | null;
  saves: number | null;
  pinClicks: number | null;
  outboundClicks: number | null;
  engagement: number | null;
}

interface TopPin {
  id: unknown;
  title: string;
  imageUrl: string;
  link: string;
  impressions: number;
  saves: number;
  pinClicks: number;
  outboundClicks: number;
  engagement: number;
  type: string;
}

interface AnalyticsData {
  period: { startDate: string; endDate: string; days: number };
  type: string;
  catalogs: CatalogAnalytics[];
  topPins: TopPin[];
}

const SORT_METRICS = [
  { value: "impressions", label: "Impressions" },
  { value: "saves", label: "Saves" },
  { value: "pinClicks", label: "Pin Clicks" },
  { value: "outboundClicks", label: "Outbound Clicks" },
  { value: "engagement", label: "Engagement" },
] as const;
type SortMetric = (typeof SORT_METRICS)[number]["value"];

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function OverviewTab({ data }: { data: OverviewData }) {
  if (data.scopeError) return <ScopeErrorBanner reason={data.reason} message={data.message} />;

  const { summary, feeds = [], catalogs = [] } = data;

  const [analyticsType, setAnalyticsType] = useState<"ORGANIC" | "PAID" | "ALL">("ORGANIC");
  const [sortMetric, setSortMetric] = useState<SortMetric>("impressions");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<{ id: string; title: string; imageUrl: string } | null>(null);

  useEffect(() => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    fetch(`/api/pinterest-catalog/analytics?type=${analyticsType}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setAnalyticsError(d.error);
        else setAnalyticsData(d);
      })
      .catch(() => setAnalyticsError("Failed to load analytics"))
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsType]);

  const sortedPins = analyticsData
    ? [...analyticsData.topPins].sort((a, b) => (b[sortMetric] ?? 0) - (a[sortMetric] ?? 0))
    : [];

  const statCards = [
    { label: "Catalogs", value: summary?.totalCatalogs ?? 0, icon: ShoppingBag, color: "bg-purple-100 text-purple-600" },
    { label: "Feeds", value: summary?.totalFeeds ?? 0, icon: Layers, color: "bg-blue-100 text-blue-600" },
    { label: "Total Products", value: summary?.totalProducts != null ? summary.totalProducts.toLocaleString() : "—", icon: BarChart2, color: "bg-green-100 text-green-600" },
    { label: "Products with Errors", value: summary?.totalErrors != null ? summary.totalErrors.toLocaleString() : "—", icon: XCircle, color: "bg-red-100 text-red-600" },
  ];

  return (
    <>
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

      {/* ── Catalog Analytics ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900">Catalog Analytics</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {analyticsData ? `Last 30 days · ${analyticsData.period.startDate} → ${analyticsData.period.endDate}` : "Last 30 days"}
            </p>
          </div>
          <select
            value={analyticsType}
            onChange={(e) => setAnalyticsType(e.target.value as "ORGANIC" | "PAID" | "ALL")}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e60023]/30"
          >
            <option value="ORGANIC">Organic</option>
            <option value="PAID">Paid</option>
            <option value="ALL">All</option>
          </select>
        </div>

        {analyticsLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading analytics…
          </div>
        ) : analyticsError ? (
          <div className="py-8 text-center text-sm text-red-500">{analyticsError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Catalog</th>
                  <th className="px-4 py-3 text-right font-medium">Engagement</th>
                  <th className="px-4 py-3 text-right font-medium">Saves</th>
                  <th className="px-4 py-3 text-right font-medium">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium">Pin Clicks</th>
                  <th className="px-4 py-3 text-right font-medium pr-5">Outbound Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(analyticsData?.catalogs ?? catalogs.map((c) => ({
                  id: String(c.id), name: String(c.name || c.id), catalogType: String(c.catalog_type ?? ""),
                  impressions: null, saves: null, pinClicks: null, outboundClicks: null, engagement: null,
                }))).map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{cat.name}</p>
                          <p className="text-xs text-gray-400">{cat.catalogType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmt(cat.engagement)}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{fmt(cat.saves)}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{fmt(cat.impressions)}</td>
                    <td className="px-4 py-4 text-right text-gray-600">{fmt(cat.pinClicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-600 pr-5">{fmt(cat.outboundClicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analyticsData && analyticsData.catalogs.every((c) => c.impressions == null) && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-start gap-2 text-xs text-amber-700 bg-amber-50">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Pinterest doesn&apos;t expose per-catalog metrics in v5. Showing account-level data in Top Products below.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Top Converting Products ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-gray-900">Top Converting Products</h3>
            <p className="text-xs text-gray-400 mt-0.5">Click any row for daily pin-level analytics · ideal candidates for Shopping ads</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sortMetric}
              onChange={(e) => setSortMetric(e.target.value as SortMetric)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e60023]/30"
            >
              {SORT_METRICS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading products…
          </div>
        ) : sortedPins.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No product analytics data available for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-[#e60023]">
                    {SORT_METRICS.find((m) => m.value === sortMetric)?.label}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Impressions</th>
                  <th className="px-4 py-3 text-right font-medium">Saves</th>
                  <th className="px-4 py-3 text-right font-medium pr-5">Pin Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedPins.map((pin, i) => (
                  <tr
                    key={String(pin.id) + i}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPin({ id: String(pin.id), title: pin.title, imageUrl: pin.imageUrl })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {pin.imageUrl ? (
                          <img src={pin.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[220px]">{pin.title || "—"}</p>
                          {pin.link && (
                            <a href={pin.link} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-[#e60023] hover:underline truncate block max-w-[220px]">
                              {pin.link.replace(/^https?:\/\//, "").slice(0, 40)}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                        pin.type === "PAID" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
                      )}>
                        {pin.type === "PAID" ? "Paid" : "Organic"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#e60023]">{fmt(pin[sortMetric])}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(pin.impressions)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(pin.saves)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 pr-5">{fmt(pin.pinClicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    <PinAnalyticsDrawerPortal selectedPin={selectedPin} onClose={() => setSelectedPin(null)} />
    </>
  );
}

// ─── Feed Audit Tab ───────────────────────────────────────────────────────────

function AuditTab({ data, onRefresh }: { data: OverviewData; onRefresh: () => void }) {
  if (data.scopeError) return <ScopeErrorBanner reason={data.reason} message={data.message} />;
  const { feeds = [] } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-blue-700 flex-1">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Feed health is calculated from ingested, failed, and warning counts reported by Pinterest&apos;s feed processing pipeline.</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {feeds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400 text-sm">
          No feeds found. Connect a product feed in Pinterest Business Hub first.
        </div>
      ) : (
        feeds.map((feed) => {
          const countsAvailable = feed.counts != null;
          const total = feed.counts?.TOTAL ?? 0;
          const ingested = feed.counts?.INGESTED ?? 0;
          const failed = feed.counts?.FAILED ?? 0;
          const warnings = feed.counts?.WARNINGS ?? 0;
          const expired = feed.counts?.EXPIRED ?? 0;
          const hs = healthScore(feed);

          const issues: { type: "critical" | "warning" | "ok" | "info"; label: string; count?: number }[] = [];
          if (feed.status !== "ACTIVE") issues.push({ type: "critical", label: `Feed status: ${feed.status}` });
          if (countsAvailable) {
            if (failed > 0) issues.push({ type: "critical", label: "Products failed to ingest", count: failed });
            if (warnings > 0) issues.push({ type: "warning", label: "Products with warnings", count: warnings });
            if (expired > 0) issues.push({ type: "warning", label: "Expired products", count: expired });
          }
          if (!countsAvailable) issues.push({ type: "info", label: "Processing counts not yet available — feed may not have been processed yet" });
          else if (issues.length === 0) issues.push({ type: "ok", label: "No critical issues found" });

          return (
            <div key={feed.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{feed.name || feed.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{feed.format} · Last updated: {feed.updated_at ? new Date(feed.updated_at).toLocaleDateString() : "—"}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-bold", hs != null ? scoreColor(hs) : "text-gray-400")}>{hs != null ? `${hs}%` : "—"}</p>
                  <p className="text-xs text-gray-400">health score</p>
                </div>
              </div>

              {/* Progress bar */}
              {countsAvailable && (
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
              )}

              {/* Stats row */}
              <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                {[
                  { label: "Total", value: countsAvailable ? total.toLocaleString() : "—", color: "text-gray-900" },
                  { label: "Ingested", value: countsAvailable ? ingested.toLocaleString() : "—", color: "text-green-600" },
                  { label: "Failed", value: countsAvailable ? failed.toLocaleString() : "—", color: "text-red-500" },
                  { label: "Warnings", value: countsAvailable ? warnings.toLocaleString() : "—", color: "text-yellow-600" },
                ].map((stat) => (
                  <div key={stat.label} className="px-4 py-3 text-center">
                    <p className={cn("text-lg font-bold", stat.color)}>{stat.value}</p>
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
                    issue.type === "info" ? "bg-blue-50 text-blue-700" :
                    "bg-green-50 text-green-700"
                  )}>
                    {issue.type === "critical" ? <XCircle className="w-3.5 h-3.5 flex-shrink-0" /> :
                     issue.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> :
                     issue.type === "info" ? <Info className="w-3.5 h-3.5 flex-shrink-0" /> :
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

function PinAnalyticsDrawerPortal({ selectedPin, onClose }: { selectedPin: { id: string; title: string; imageUrl: string } | null; onClose: () => void }) {
  if (!selectedPin) return null;
  return <PinAnalyticsDrawer pinId={selectedPin.id} pinTitle={selectedPin.title} pinImage={selectedPin.imageUrl} onClose={onClose} />;
}

// ─── Product SEO Tab ──────────────────────────────────────────────────────────

function ProductSeoTab({ products, loading, feeds, selectedFeed, onFeedChange, apiError }: {
  products: Product[];
  loading: boolean;
  feeds: Feed[];
  selectedFeed: string;
  onFeedChange: (id: string) => void;
  apiError?: string | null;
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
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <ShoppingBag className="w-10 h-10 text-gray-300" />
          {apiError ? (
            <>
              <p className="text-sm font-semibold text-red-600">Error loading products</p>
              <p className="text-xs text-gray-500 max-w-sm">{apiError}</p>
            </>
          ) : feeds.length === 0 ? (
            <p className="text-sm text-gray-500">No feeds found.</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700">No products returned for this feed</p>
              <p className="text-xs text-gray-500 max-w-sm">
                Pinterest may not expose feed-level product listings via this API. Try the{" "}
                <span className="font-semibold text-[#e60023]">Product Groups</span> tab to browse
                and analyze products by group.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Score summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className={cn("text-3xl font-bold", scoreColor(avgScore))}>{avgScore}</p>
              <p className="text-xs text-gray-500 mt-1">My Pin Pro SEO Score</p>
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
        <EmptyState label={products.length === 0 ? "No products found in this feed." : "No products match your search."} />
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

function GroupProductDetailView({ product, onBack }: { product: GroupProduct; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        ← Back to products
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 flex gap-5 border-b border-gray-100">
          {product.imageLink ? (
            <img src={product.imageLink} alt="" className="w-28 h-28 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
          ) : (
            <div className="w-28 h-28 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-lg leading-snug">{product.title || "Untitled"}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {product.price && <span className="text-base font-semibold text-gray-900">{product.price}</span>}
              {product.salePrice && product.salePrice !== product.price && (
                <span className="text-sm text-red-500 font-medium">{product.salePrice} sale</span>
              )}
              {product.availability && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                  product.availability === "in stock" ? "bg-green-100 text-green-700" :
                  product.availability === "out of stock" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                )}>
                  {product.availability}
                </span>
              )}
            </div>
            {product.link && (
              <a href={product.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block truncate">
                {product.link}
              </a>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className={cn("text-2xl font-bold", scoreColor(product.seoScore))}>{product.seoScore}</p>
            <p className="text-xs text-gray-400 mt-0.5">My Pin Pro SEO Score</p>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {[
            { label: "Item ID", value: product.itemId },
            { label: "Item Group ID", value: product.itemGroupId },
            { label: "Brand", value: product.brand },
            { label: "Product Type", value: product.productType },
            { label: "Google Product Category", value: product.googleProductCategory },
            { label: "Condition", value: product.condition },
            { label: "Currency", value: product.currency },
            { label: "Pin Status", value: product.status },
          ].filter(r => r.value).map((row) => (
            <div key={row.label} className="px-5 py-2.5 flex justify-between text-sm gap-4">
              <span className="text-gray-500 flex-shrink-0">{row.label}</span>
              <span className="font-medium text-gray-900 text-right break-all">{row.value}</span>
            </div>
          ))}
        </div>

        {product.description && (
          <div className="px-5 py-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
          </div>
        )}
      </div>

      {product.issues.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">SEO Recommendations</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {product.issues.map((issue, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-gray-700">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsTab({ groups, loading, feeds }: { groups: ProductGroup[]; loading: boolean; feeds: Feed[] }) {
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<GroupProduct | null>(null);

  // Products for the open group
  const [groupProducts, setGroupProducts] = useState<GroupProduct[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [nextBookmark, setNextBookmark] = useState<string | null>(null);
  // bookmarkStack[i] = bookmark to fetch page i+1 (null = first page)
  const [bookmarkStack, setBookmarkStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [debug, setDebug] = useState<GroupProductsDebug | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const fetchGroupProducts = useCallback((group: ProductGroup, bookmark: string | null) => {
    setProductsLoading(true);
    setProductsError(null);
    const feedId = group.feedId || feeds[0]?.id || "";
    const params = new URLSearchParams({ productGroupId: String(group.id), pageSize: "25" });
    if (feedId) params.set("feedId", feedId);
    if (bookmark) params.set("bookmark", bookmark);

    fetch(`/api/pinterest-catalog/product-group-products?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setGroupProducts(d.products ?? []);
        setProductCount(d.productCount ?? null);
        setNextBookmark(d.bookmark ?? null);
        setDebug(d._debug ?? null);
        setUsedFallback(d.usedFallback ?? false);
        if (d._debug?.productsApiError) {
          setProductsError(`Pinterest API ${d._debug.productsApiError.status}: ${d._debug.productsApiError.body}`);
        }
      })
      .catch(() => setProductsError("Failed to load products from Pinterest"))
      .finally(() => setProductsLoading(false));
  }, [feeds]);

  function handleGroupSelect(group: ProductGroup) {
    setSelectedGroup(group);
    setSelectedProduct(null);
    setGroupProducts([]);
    setProductCount(null);
    setNextBookmark(null);
    setBookmarkStack([null]);
    setPageIndex(0);
    setSearch("");
    setDebug(null);
    setProductsError(null);
    fetchGroupProducts(group, null);
  }

  function handleNextPage() {
    if (!nextBookmark || !selectedGroup) return;
    const newStack = [...bookmarkStack, nextBookmark];
    setBookmarkStack(newStack);
    const newIndex = pageIndex + 1;
    setPageIndex(newIndex);
    setSearch("");
    fetchGroupProducts(selectedGroup, nextBookmark);
  }

  function handlePrevPage() {
    if (pageIndex === 0 || !selectedGroup) return;
    const newIndex = pageIndex - 1;
    setPageIndex(newIndex);
    setSearch("");
    fetchGroupProducts(selectedGroup, bookmarkStack[newIndex]);
  }

  if (loading) return <LoadingState label="Loading product groups..." />;

  // Product detail view
  if (selectedProduct) {
    return <GroupProductDetailView product={selectedProduct} onBack={() => setSelectedProduct(null)} />;
  }

  // Group detail view
  if (selectedGroup) {
    const filtered = search
      ? groupProducts.filter(p =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.brand.toLowerCase().includes(search.toLowerCase()) ||
          p.itemId.toLowerCase().includes(search.toLowerCase())
        )
      : groupProducts;

    const countMismatch =
      productCount !== null &&
      groupProducts.length === 0 &&
      !productsLoading &&
      !productsError &&
      productCount > 0;

    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedGroup(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back to groups
        </button>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-lg">{selectedGroup.name || String(selectedGroup.id)}</p>
              {selectedGroup.description && <p className="text-xs text-gray-500 mt-0.5">{selectedGroup.description}</p>}
            </div>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0",
              selectedGroup.status === "ACTIVE" ? "bg-green-100 text-green-700" :
              selectedGroup.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" :
              "bg-gray-100 text-gray-600"
            )}>
              {selectedGroup.status || "—"}
            </span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="px-5 py-3">
              <p className="text-xs text-gray-400">Feed</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{selectedGroup.feedId || "—"}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs text-gray-400">Products</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {productCount !== null ? productCount.toLocaleString() : productsLoading ? "…" : "—"}
              </p>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs text-gray-400">Last Updated</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {selectedGroup.updatedAt ? new Date(selectedGroup.updatedAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Promote CTA */}
        <div className="bg-gradient-to-r from-[#e60023]/5 to-purple-50 rounded-2xl border border-[#e60023]/10 px-5 py-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Promote with Pinterest Ads</p>
            <p className="text-xs text-gray-500 mt-0.5">Target this product group in a Shopping campaign.</p>
          </div>
          <a
            href="https://ads.pinterest.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 bg-[#e60023] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors flex-shrink-0"
          >
            Ads Manager
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Fallback notice */}
        {usedFallback && debug?.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Showing all feed products</p>
              <p className="text-xs text-amber-700 mt-1">{debug.note}</p>
            </div>
          </div>
        )}

        {/* API error */}
        {productsError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-800 text-sm">Pinterest API Error</p>
                <p className="text-xs text-red-700 mt-1 break-all">{productsError}</p>
                {debug && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer hover:underline">Debug endpoints</summary>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-mono text-red-700 break-all">Group: {debug.groupEndpoint} → {debug.groupStatus}</p>
                      <p className="text-xs font-mono text-red-700 break-all">Products: {debug.productsEndpoint} → {debug.productsStatus}</p>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Count vs results mismatch warning */}
        {countMismatch && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                Pinterest reports {productCount?.toLocaleString()} products but returned 0 items
              </p>
              <p className="text-xs text-amber-700 mt-1">
                This product group is defined by filters. Pinterest currently reports no matching catalog items via the API.
                The count and item list may not be in sync — this is a known Pinterest API behavior.
              </p>
              {debug && (
                <details className="mt-2">
                  <summary className="text-xs text-amber-600 cursor-pointer hover:underline">Debug info</summary>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-mono text-amber-700 break-all">Group: {debug.groupEndpoint} → {debug.groupStatus}</p>
                    <p className="text-xs font-mono text-amber-700 break-all">Products: {debug.productsEndpoint} → {debug.productsStatus}</p>
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Empty: productCount === 0 */}
        {productCount === 0 && !productsLoading && (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center px-6">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p className="font-semibold text-gray-700 text-sm">No products currently match this product group.</p>
            <p className="text-xs text-gray-400 mt-1">
              This product group is defined by filters. Pinterest currently reports no matching products.
            </p>
          </div>
        )}

        {/* Products section */}
        {(productsLoading || groupProducts.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <h3 className="font-semibold text-gray-900 flex-1">Products</h3>
              {productCount !== null && (
                <span className="text-xs text-gray-400">{productCount.toLocaleString()} total</span>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search this page..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 w-44"
                />
              </div>
            </div>

            {productsLoading ? (
              <div className="py-16 flex flex-col items-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                <p className="text-sm">Loading products…</p>
              </div>
            ) : filtered.length === 0 && search ? (
              <div className="py-12 text-center text-gray-400 text-sm">No products match &ldquo;{search}&rdquo; on this page.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-left">Item ID</th>
                        <th className="px-4 py-3 text-left">Brand</th>
                        <th className="px-4 py-3 text-left">Price</th>
                        <th className="px-4 py-3 text-left">Availability</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">SEO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((p, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedProduct(p)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {p.imageLink ? (
                                <img src={p.imageLink} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />
                              )}
                              <span className="font-medium text-gray-900 truncate max-w-[160px]">{p.title || "Untitled"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.itemId || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{p.brand || "—"}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium">{p.price || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              p.availability === "in stock" ? "bg-green-100 text-green-700" :
                              p.availability === "out of stock" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-600"
                            )}>
                              {p.availability || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[120px]">{p.productType || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("font-bold text-sm", scoreColor(p.seoScore))}>{p.seoScore}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Page {pageIndex + 1}
                    {productCount !== null ? ` · ${productCount.toLocaleString()} total products` : ""}
                    {search ? ` · ${filtered.length} match search` : ` · ${groupProducts.length} on this page`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={pageIndex === 0}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={!nextBookmark}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Group list view
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 text-sm text-blue-700">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Product groups allow you to target specific products in Pinterest Ads campaigns. Click a group to view its products.</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState label="No product groups found. Create groups in Pinterest Business Hub to target products with ads." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {groups.map((g, i) => (
              <button
                key={i}
                onClick={() => handleGroupSelect(g)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{g.name || String(g.id)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Feed: {g.feedId || "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                    g.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                    g.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-600"
                  )}>
                    {g.status || "—"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Diagnostics Tab ─────────────────────────────────────────────────────────

function DiagnosticsTab({ data, products }: { data: OverviewData; products: Product[] }) {
  if (data.scopeError) return <ScopeErrorBanner reason={data.reason} message={data.message} />;

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
  const [productsApiError, setProductsApiError] = useState<string | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState("");

  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsFetched, setGroupsFetched] = useState(false);

  const feeds = overviewData?.feeds ?? [];

  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    setOverviewError("");
    fetch("/api/pinterest-catalog")
      .then((r) => r.json())
      .then((d) => {
        setOverviewData(d);
        if (d.feeds?.length) setSelectedFeedId((prev) => prev || d.feeds[0].id);
      })
      .catch(() => setOverviewError("Failed to load catalog data"))
      .finally(() => setOverviewLoading(false));
  }, []);

  // Load overview on mount
  useEffect(() => { loadOverview(); }, [loadOverview]);

  // Load products when feedId is known and products/seo/diagnostics tab opened
  const loadProducts = useCallback((feedId: string) => {
    if (!feedId) return;
    setProductsLoading(true);
    setProductsApiError(null);
    fetch(`/api/pinterest-catalog/products?feedId=${encodeURIComponent(feedId)}&pageSize=100`)
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products ?? []);
        if (d.error) setProductsApiError(`${d.error}${d.status ? ` (${d.status})` : ""}`);
      })
      .catch(() => { setProducts([]); setProductsApiError("Failed to load products"); })
      .finally(() => setProductsLoading(false));
  }, []);

  // Load products whenever the selected feed changes (pre-fetch so data is ready on any tab)
  useEffect(() => {
    if (selectedFeedId) loadProducts(selectedFeedId);
  }, [selectedFeedId, loadProducts]);

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
          {activeTab === "audit" && <AuditTab data={overviewData} onRefresh={loadOverview} />}
          {activeTab === "seo" && (
            <ProductSeoTab
              products={products}
              loading={productsLoading}
              feeds={feeds}
              selectedFeed={selectedFeedId}
              onFeedChange={handleFeedChange}
              apiError={productsApiError}
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
            <GroupsTab groups={groups} loading={groupsLoading} feeds={feeds} />
          )}
          {activeTab === "diagnostics" && (
            <DiagnosticsTab data={overviewData} products={products} />
          )}
        </>
      )}
    </div>
  );
}
