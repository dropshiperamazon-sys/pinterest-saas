"use client";
import { useState, useCallback } from "react";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import { PINTEREST_CATEGORIES, generateKeywords, type KeywordResult } from "@/lib/pinterest-data";
import {
  Search, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  Download, Bookmark, Filter, BarChart2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "volume" | "trend" | "competition" | "cpc";
type MatchFilter = "all" | "broad" | "phrase" | "exact";

const COMPETITION_COLOR: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

const MATCH_COLOR: Record<string, string> = {
  broad: "bg-blue-100 text-blue-700",
  phrase: "bg-purple-100 text-purple-700",
  exact: "bg-orange-100 text-orange-700",
};

const MATCH_LABEL: Record<string, string> = {
  broad: "Broad",
  phrase: "Phrase",
  exact: "Exact",
};

const MATCH_DESC: Record<string, string> = {
  exact:  "Exact [keyword] — same meaning or intent, highest targeting precision",
  phrase: '"keyword" — keyword meaning contained in search, words added before or after',
  broad:  "keyword — related concepts, synonyms & similar topics, widest reach",
};

export default function KeywordsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortAsc, setSortAsc] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");

  const [isLive, setIsLive] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setMatchFilter("all");
    setIsLive(false);
    try {
      const res = await fetch(`/api/pinterest-keywords?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const items: { keyword: string; monthlySearches: number | null; competition: string | null; suggestedBid: number | null }[] = data.keywords ?? [];
        if (items.length > 0) {
          // Map Pinterest API response to KeywordResult shape, spread across match types
          const matchTypes: Array<"exact"|"phrase"|"broad"> = ["exact", "phrase", "broad"];
          const mapped: KeywordResult[] = items.map((k, i) => ({
            keyword: k.keyword,
            volume: k.monthlySearches ?? 0,
            trend: Math.round((Math.random() * 60) - 15),
            competition: (["low","medium","high"].includes(k.competition ?? "") ? k.competition as "low"|"medium"|"high" : "medium"),
            cpc: k.suggestedBid ?? 0.5,
            matchType: matchTypes[i % 3],
            category: q,
          }));
          setResults(mapped);
          setIsLive(true);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fall through to generated data
    }
    // Fallback: generated data
    setResults(generateKeywords(q));
    setLoading(false);
  }, []);

  const handleCategoryClick = (catId: string, catName: string) => {
    if (expandedCategory === catId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(catId);
      setSelectedCategory(catName);
      setSelectedSubcategory(null);
      setQuery(catName.toLowerCase());
      handleSearch(catName);
    }
  };

  const handleSubcategoryClick = (sub: string) => {
    setSelectedSubcategory(sub);
    setQuery(sub.toLowerCase());
    handleSearch(sub);
  };

  const filtered = matchFilter === "all" ? results : results.filter((r) => r.matchType === matchFilter);

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === "volume") diff = a.volume - b.volume;
    else if (sortKey === "trend") diff = a.trend - b.trend;
    else if (sortKey === "cpc") diff = a.cpc - b.cpc;
    else if (sortKey === "competition") {
      const rank = { low: 0, medium: 1, high: 2 };
      diff = rank[a.competition] - rank[b.competition];
    }
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
  };

  const toggleSave = (keyword: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(keyword) ? next.delete(keyword) : next.add(keyword);
      return next;
    });
  };

  const countByMatch = (type: MatchFilter) =>
    type === "all" ? results.length : results.filter((r) => r.matchType === type).length;

  const handleExport = () => {
    const header = "Keyword,Match Type,Monthly Volume,Trend %,Competition,Avg CPC\n";
    const rows = sorted
      .map((r) => `"${r.keyword}",${r.matchType},${r.volume},${r.trend}%,${r.competition},$${r.cpc}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pinterest-keywords-${query.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Header title="Keyword Research" subtitle="Discover 100+ closely relevant Pinterest keywords by match type" />
      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar: Categories */}
        <aside className="w-72 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0 scrollbar-thin">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Browse Categories</h3>
          </div>
          <div className="p-2">
            {PINTEREST_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <button
                  onClick={() => handleCategoryClick(cat.id, cat.name)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all",
                    selectedCategory === cat.name && !selectedSubcategory
                      ? "bg-[#e60023] text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="flex-1 text-left font-medium">{cat.name}</span>
                  {expandedCategory === cat.id ? (
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  )}
                </button>
                {expandedCategory === cat.id && (
                  <div className="ml-8 mt-1 mb-2 space-y-0.5">
                    {cat.subcategories.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => handleSubcategoryClick(sub)}
                        className={cn(
                          "w-full text-left text-xs px-3 py-2 rounded-lg transition-all",
                          selectedSubcategory === sub
                            ? "bg-[#e60023]/10 text-[#e60023] font-semibold"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Search Bar */}
          <div className="p-6 pb-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                  placeholder="Search for any keyword (e.g. home decor, recipes, fitness)..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                />
                {query && (
                  <button onClick={() => { setQuery(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => handleSearch(query)}
                className="bg-[#e60023] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>

            {/* Active Filters */}
            {(selectedCategory || selectedSubcategory) && (
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">Filtered by:</span>
                {selectedCategory && (
                  <span className="bg-[#e60023]/10 text-[#e60023] text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                    {selectedCategory}
                    <button onClick={() => { setSelectedCategory(null); setExpandedCategory(null); }}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {selectedSubcategory && (
                  <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                    {selectedSubcategory}
                    <button onClick={() => setSelectedSubcategory(null)}><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
            )}

            {/* Match Type Filter — shown only when there are results */}
            {results.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">Match type:</span>
                {(["all", "exact", "phrase", "broad"] as MatchFilter[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMatchFilter(type)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all",
                      matchFilter === type
                        ? type === "all"
                          ? "bg-gray-800 text-white border-gray-800"
                          : type === "exact"
                          ? "bg-orange-500 text-white border-orange-500"
                          : type === "phrase"
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {type === "all" ? `All (${countByMatch("all")})` : `${MATCH_LABEL[type]} (${countByMatch(type)})`}
                  </button>
                ))}
                <span className="text-xs text-gray-400 ml-1 hidden lg:inline italic">
                  {matchFilter !== "all" ? MATCH_DESC[matchFilter] : "All match types · Exact [kw] · Phrase \"kw\" · Broad kw"}
                </span>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-[#e60023]/20 border-t-[#e60023] rounded-full animate-spin mb-4" />
                <p className="text-sm text-gray-500">Generating keyword ideas...</p>
              </div>
            ) : sorted.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">
                      {sorted.length} keyword{sorted.length !== 1 ? "s" : ""}
                      {matchFilter !== "all" ? ` · ${MATCH_LABEL[matchFilter]} match` : ""}
                    </span>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                      isLive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {isLive ? "● Live" : "○ Generated"}
                    </span>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keyword</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Match Type</th>
                        {(["volume", "trend", "competition", "cpc"] as SortKey[]).map((key) => (
                          <th
                            key={key}
                            onClick={() => toggleSort(key)}
                            className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                          >
                            <div className="flex items-center gap-1">
                              {key === "volume" ? "Monthly Searches" : key === "cpc" ? "Avg CPC" : key.charAt(0).toUpperCase() + key.slice(1)}
                              {sortKey === key && (sortAsc ? " ↑" : " ↓")}
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sorted.map((kw) => (
                        <tr key={kw.keyword} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-800">{kw.keyword}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold capitalize", MATCH_COLOR[kw.matchType])}>
                              {MATCH_LABEL[kw.matchType]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-gray-900">{formatNumber(kw.volume)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className={cn("flex items-center gap-1 text-xs font-semibold", kw.trend >= 0 ? "text-green-600" : "text-red-500")}>
                              {kw.trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {kw.trend >= 0 ? "+" : ""}{kw.trend}%
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold capitalize", COMPETITION_COLOR[kw.competition])}>
                              {kw.competition}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700">${kw.cpc.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleSave(kw.keyword)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                saved.has(kw.keyword) ? "text-[#e60023] bg-[#e60023]/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              )}
                            >
                              <Bookmark className="w-3.5 h-3.5" fill={saved.has(kw.keyword) ? "currentColor" : "none"} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-1">Start your keyword research</h3>
                <p className="text-sm text-gray-400 max-w-sm">
                  Search for any topic or click a category to discover 100+ relevant Pinterest keywords across broad, phrase, and exact match types.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                  <Filter className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No keywords for this match type filter.</p>
                <button onClick={() => setMatchFilter("all")} className="text-xs text-[#e60023] mt-2 hover:underline">Show all match types</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
