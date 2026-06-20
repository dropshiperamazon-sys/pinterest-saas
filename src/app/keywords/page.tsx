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

const COMPETITION_COLOR: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
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

  const handleSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setResults(generateKeywords(q));
      setLoading(false);
    }, 600);
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

  const sorted = [...results].sort((a, b) => {
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

  return (
    <div>
      <Header title="Keyword Research" subtitle="Discover high-volume Pinterest keywords by category or search term" />
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
          <div className="p-6 pb-4">
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
              <div className="flex items-center gap-2 mt-3">
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
          </div>

          {/* Results */}
          <div className="px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-[#e60023]/20 border-t-[#e60023] rounded-full animate-spin mb-4" />
                <p className="text-sm text-gray-500">Analyzing keyword data...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">{results.length} keywords found</span>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keyword</th>
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
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-1">Start your keyword research</h3>
                <p className="text-sm text-gray-400 max-w-sm">
                  Search for any topic or click a category on the left to discover high-volume Pinterest keywords.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
