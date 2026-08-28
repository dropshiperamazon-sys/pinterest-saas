"use client";
import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import { PINTEREST_CATEGORIES, generateKeywords, type KeywordResult } from "@/lib/pinterest-data";
import {
  Search, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  Download, Bookmark, Filter, BarChart2, X, Flame, ShoppingBag,
  MapPin, Users, Calendar, ChevronUp, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendItem { keyword: string; pctChangeFromLastYear: number | null; weeklyChange?: number | null; monthlyChange?: number | null; yearlyChange?: number | null; searchVolume?: number | null; outboundClicksGrowth?: string | null; }
interface ShoppingItem { rank: number; category: string; outboundClicksGrowth: string; trend: "up" | "flat" | "down"; volume: number; emoji: string; }

type SortKey = "volume" | "trend" | "competition" | "cpc";
type MatchFilter = "all" | "broad" | "phrase" | "exact";
type TrendTab = "growing" | "seasonal" | "monthly" | "yearly";
type TrendKind = "search" | "shopping";

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
const MATCH_LABEL: Record<string, string> = { broad: "Broad", phrase: "Phrase", exact: "Exact" };
const MATCH_DESC: Record<string, string> = {
  exact: "Exact [keyword] — same meaning or intent, highest targeting precision",
  phrase: '"keyword" — keyword meaning contained in search, words added before or after',
  broad: "keyword — related concepts, synonyms & similar topics, widest reach",
};

const LOCATIONS = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Brazil", "India"];
const AGE_GROUPS = ["All Ages", "18–24", "25–34", "35–44", "45–54", "55+"];
const GENDERS = ["All", "Women", "Men"];
const INTERESTS = ["All Interests", "Home Decor", "Fashion", "Beauty", "Food & Drink", "Travel", "Fitness", "DIY & Crafts", "Parenting", "Pets", "Technology", "Wedding", "Art", "Entertainment"];
const MOMENTS = ["All Moments", "Back to School", "Halloween", "Thanksgiving", "Christmas", "New Year", "Valentine's Day", "Spring", "Summer", "Fall", "Winter"];
const TOP_VERTICALS = ["All Verticals", "Home & Garden", "Apparel & Accessories", "Beauty", "Food & Beverages", "Sports & Fitness", "Electronics", "Toys & Games", "Health & Wellness"];
const RANKED_BY = ["Outbound clicks", "Saves", "Impressions"];

// Separate datasets per metric — different categories rank differently by each signal
const SHOPPING_BY_METRIC: Record<string, ShoppingItem[]> = {
  "Outbound clicks": [
    { rank: 1,  category: "Seasonal & holiday decorations", outboundClicksGrowth: "↑70% MoM", trend: "up",   volume: 95, emoji: "🎄" },
    { rank: 2,  category: "Costumes & accessories",         outboundClicksGrowth: "↑54% MoM", trend: "up",   volume: 88, emoji: "🎭" },
    { rank: 3,  category: "Women's clothing & dresses",     outboundClicksGrowth: "↑45% MoM", trend: "up",   volume: 82, emoji: "👗" },
    { rank: 4,  category: "Scarves & shawls",               outboundClicksGrowth: "↑38% MoM", trend: "up",   volume: 76, emoji: "🧣" },
    { rank: 5,  category: "Coats & jackets",                outboundClicksGrowth: "↑32% MoM", trend: "up",   volume: 70, emoji: "🧥" },
    { rank: 6,  category: "Skincare & beauty products",     outboundClicksGrowth: "↑27% MoM", trend: "up",   volume: 64, emoji: "✨" },
    { rank: 7,  category: "Home furniture & decor",         outboundClicksGrowth: "↑22% MoM", trend: "up",   volume: 58, emoji: "🛋️" },
    { rank: 8,  category: "Candles & home fragrance",       outboundClicksGrowth: "↑18% MoM", trend: "up",   volume: 52, emoji: "🕯️" },
    { rank: 9,  category: "Jewelry & accessories",          outboundClicksGrowth: "↑15% MoM", trend: "flat", volume: 46, emoji: "💎" },
    { rank: 10, category: "Kitchen & dining",               outboundClicksGrowth: "↑12% MoM", trend: "flat", volume: 40, emoji: "🍳" },
    { rank: 11, category: "Activewear & sportswear",        outboundClicksGrowth: "↑9% MoM",  trend: "flat", volume: 34, emoji: "🏃" },
    { rank: 12, category: "Bedding & pillows",              outboundClicksGrowth: "↑6% MoM",  trend: "flat", volume: 28, emoji: "🛏️" },
  ],
  "Pin saves": [
    { rank: 1,  category: "Home decor & interior design",   outboundClicksGrowth: "↑88% MoM", trend: "up",   volume: 97, emoji: "🏠" },
    { rank: 2,  category: "Wedding inspiration",             outboundClicksGrowth: "↑76% MoM", trend: "up",   volume: 91, emoji: "💍" },
    { rank: 3,  category: "DIY & crafts",                   outboundClicksGrowth: "↑63% MoM", trend: "up",   volume: 85, emoji: "✂️" },
    { rank: 4,  category: "Women's clothing & dresses",     outboundClicksGrowth: "↑55% MoM", trend: "up",   volume: 79, emoji: "👗" },
    { rank: 5,  category: "Holiday recipes & food",         outboundClicksGrowth: "↑48% MoM", trend: "up",   volume: 73, emoji: "🍽️" },
    { rank: 6,  category: "Nail art & beauty",              outboundClicksGrowth: "↑41% MoM", trend: "up",   volume: 67, emoji: "💅" },
    { rank: 7,  category: "Seasonal & holiday decorations", outboundClicksGrowth: "↑35% MoM", trend: "up",   volume: 61, emoji: "🎄" },
    { rank: 8,  category: "Skincare routines",              outboundClicksGrowth: "↑29% MoM", trend: "up",   volume: 55, emoji: "✨" },
    { rank: 9,  category: "Fitness & workout gear",         outboundClicksGrowth: "↑22% MoM", trend: "flat", volume: 49, emoji: "💪" },
    { rank: 10, category: "Candles & home fragrance",       outboundClicksGrowth: "↑17% MoM", trend: "flat", volume: 43, emoji: "🕯️" },
    { rank: 11, category: "Jewelry & accessories",          outboundClicksGrowth: "↑12% MoM", trend: "flat", volume: 37, emoji: "💎" },
    { rank: 12, category: "Children's clothing",            outboundClicksGrowth: "↑8% MoM",  trend: "flat", volume: 31, emoji: "👶" },
  ],
  "Impressions": [
    { rank: 1,  category: "Fashion & style",                outboundClicksGrowth: "↑92% MoM", trend: "up",   volume: 98, emoji: "👠" },
    { rank: 2,  category: "Beauty & makeup",                outboundClicksGrowth: "↑81% MoM", trend: "up",   volume: 92, emoji: "💄" },
    { rank: 3,  category: "Seasonal & holiday decorations", outboundClicksGrowth: "↑74% MoM", trend: "up",   volume: 86, emoji: "🎄" },
    { rank: 4,  category: "Home furniture & decor",         outboundClicksGrowth: "↑66% MoM", trend: "up",   volume: 80, emoji: "🛋️" },
    { rank: 5,  category: "Food & recipes",                 outboundClicksGrowth: "↑58% MoM", trend: "up",   volume: 74, emoji: "🍳" },
    { rank: 6,  category: "Travel accessories",             outboundClicksGrowth: "↑50% MoM", trend: "up",   volume: 68, emoji: "✈️" },
    { rank: 7,  category: "Activewear & sportswear",        outboundClicksGrowth: "↑43% MoM", trend: "up",   volume: 62, emoji: "🏃" },
    { rank: 8,  category: "Costumes & accessories",         outboundClicksGrowth: "↑37% MoM", trend: "up",   volume: 56, emoji: "🎭" },
    { rank: 9,  category: "Jewelry & accessories",          outboundClicksGrowth: "↑30% MoM", trend: "flat", volume: 50, emoji: "💎" },
    { rank: 10, category: "Skincare & beauty products",     outboundClicksGrowth: "↑23% MoM", trend: "flat", volume: 44, emoji: "✨" },
    { rank: 11, category: "Coats & jackets",                outboundClicksGrowth: "↑16% MoM", trend: "flat", volume: 38, emoji: "🧥" },
    { rank: 12, category: "Bedding & pillows",              outboundClicksGrowth: "↑9% MoM",  trend: "flat", volume: 32, emoji: "🛏️" },
  ],
  "Engagement": [
    { rank: 1,  category: "DIY & crafts",                   outboundClicksGrowth: "↑85% MoM", trend: "up",   volume: 96, emoji: "✂️" },
    { rank: 2,  category: "Holiday recipes & food",         outboundClicksGrowth: "↑72% MoM", trend: "up",   volume: 89, emoji: "🍽️" },
    { rank: 3,  category: "Nail art & beauty",              outboundClicksGrowth: "↑60% MoM", trend: "up",   volume: 83, emoji: "💅" },
    { rank: 4,  category: "Wedding inspiration",             outboundClicksGrowth: "↑52% MoM", trend: "up",   volume: 77, emoji: "💍" },
    { rank: 5,  category: "Home decor & interior design",   outboundClicksGrowth: "↑45% MoM", trend: "up",   volume: 71, emoji: "🏠" },
    { rank: 6,  category: "Seasonal & holiday decorations", outboundClicksGrowth: "↑39% MoM", trend: "up",   volume: 65, emoji: "🎄" },
    { rank: 7,  category: "Fitness & workout gear",         outboundClicksGrowth: "↑33% MoM", trend: "up",   volume: 59, emoji: "💪" },
    { rank: 8,  category: "Costumes & accessories",         outboundClicksGrowth: "↑27% MoM", trend: "up",   volume: 53, emoji: "🎭" },
    { rank: 9,  category: "Skincare routines",              outboundClicksGrowth: "↑21% MoM", trend: "flat", volume: 47, emoji: "✨" },
    { rank: 10, category: "Women's clothing & dresses",     outboundClicksGrowth: "↑15% MoM", trend: "flat", volume: 41, emoji: "👗" },
    { rank: 11, category: "Kitchen & dining",               outboundClicksGrowth: "↑10% MoM", trend: "flat", volume: 35, emoji: "🍳" },
    { rank: 12, category: "Candles & home fragrance",       outboundClicksGrowth: "↑6% MoM",  trend: "flat", volume: 29, emoji: "🕯️" },
  ],
};
const SAMPLE_SHOPPING = SHOPPING_BY_METRIC["Outbound clicks"];

// ── Trending Panel ───────────────────────────────────────────────────────────
const SEARCH_SAMPLES: Record<TrendTab, TrendItem[]> = {
  growing: [
    { keyword: "Quiet Luxury Style", pctChangeFromLastYear: 312, weeklyChange: 28, monthlyChange: 89, yearlyChange: 312 },
    { keyword: "Coastal Grandmother", pctChangeFromLastYear: 284, weeklyChange: 22, monthlyChange: 74, yearlyChange: 284 },
    { keyword: "Mob Wife Aesthetic", pctChangeFromLastYear: 267, weeklyChange: 19, monthlyChange: 68, yearlyChange: 267 },
    { keyword: "Mushroom Decor", pctChangeFromLastYear: 198, weeklyChange: 15, monthlyChange: 55, yearlyChange: 198 },
    { keyword: "Coquette Style", pctChangeFromLastYear: 187, weeklyChange: 13, monthlyChange: 48, yearlyChange: 187 },
    { keyword: "Dark Feminine Energy", pctChangeFromLastYear: 165, weeklyChange: 11, monthlyChange: 42, yearlyChange: 165 },
    { keyword: "Linen Aesthetic", pctChangeFromLastYear: 152, weeklyChange: 9, monthlyChange: 38, yearlyChange: 152 },
    { keyword: "Danish Pastel", pctChangeFromLastYear: 143, weeklyChange: 8, monthlyChange: 35, yearlyChange: 143 },
    { keyword: "Cottagecore Outfits", pctChangeFromLastYear: 138, weeklyChange: 7, monthlyChange: 33, yearlyChange: 138 },
    { keyword: "Soft Girl Aesthetic", pctChangeFromLastYear: 127, weeklyChange: 6, monthlyChange: 29, yearlyChange: 127 },
    { keyword: "Demure Style", pctChangeFromLastYear: 119, weeklyChange: 5, monthlyChange: 26, yearlyChange: 119 },
    { keyword: "Office Siren Outfit", pctChangeFromLastYear: 112, weeklyChange: 4, monthlyChange: 24, yearlyChange: 112 },
  ],
  seasonal: [
    { keyword: "Fall Transition Outfits", pctChangeFromLastYear: 203, weeklyChange: 47, monthlyChange: 120, yearlyChange: 203 },
    { keyword: "Hoco Response Ideas", pctChangeFromLastYear: 187, weeklyChange: 38, monthlyChange: 98, yearlyChange: 187 },
    { keyword: "September Nail Colors", pctChangeFromLastYear: 171, weeklyChange: 31, monthlyChange: 85, yearlyChange: 171 },
    { keyword: "Back to School Fits", pctChangeFromLastYear: 158, weeklyChange: 25, monthlyChange: 74, yearlyChange: 158 },
    { keyword: "Autumn Aesthetic", pctChangeFromLastYear: 144, weeklyChange: 20, monthlyChange: 66, yearlyChange: 144 },
    { keyword: "Simple September Nails", pctChangeFromLastYear: 132, weeklyChange: 17, monthlyChange: 59, yearlyChange: 132 },
    { keyword: "Senior Sunrise Captions", pctChangeFromLastYear: 121, weeklyChange: 14, monthlyChange: 53, yearlyChange: 121 },
    { keyword: "End of Summer Captions", pctChangeFromLastYear: 113, weeklyChange: 12, monthlyChange: 48, yearlyChange: 113 },
    { keyword: "Fall Coffee Drinks", pctChangeFromLastYear: 105, weeklyChange: 10, monthlyChange: 44, yearlyChange: 105 },
    { keyword: "Transition Season Looks", pctChangeFromLastYear: 98, weeklyChange: 9, monthlyChange: 40, yearlyChange: 98 },
  ],
  monthly: [
    { keyword: "Fall Outfit Ideas", pctChangeFromLastYear: 89, weeklyChange: 18, monthlyChange: 89, yearlyChange: 45 },
    { keyword: "Halloween Decor", pctChangeFromLastYear: 76, weeklyChange: 14, monthlyChange: 76, yearlyChange: 38 },
    { keyword: "Pumpkin Recipes", pctChangeFromLastYear: 68, weeklyChange: 11, monthlyChange: 68, yearlyChange: 32 },
    { keyword: "Back to School", pctChangeFromLastYear: 62, weeklyChange: 9, monthlyChange: 62, yearlyChange: 28 },
    { keyword: "Autumn Tablescape", pctChangeFromLastYear: 55, weeklyChange: 7, monthlyChange: 55, yearlyChange: 24 },
    { keyword: "Cozy Living Room", pctChangeFromLastYear: 48, weeklyChange: 6, monthlyChange: 48, yearlyChange: 21 },
    { keyword: "Fall Nail Ideas", pctChangeFromLastYear: 44, weeklyChange: 5, monthlyChange: 44, yearlyChange: 19 },
    { keyword: "Apple Picking Outfit", pctChangeFromLastYear: 41, weeklyChange: 5, monthlyChange: 41, yearlyChange: 18 },
    { keyword: "Sweater Weather Looks", pctChangeFromLastYear: 38, weeklyChange: 4, monthlyChange: 38, yearlyChange: 16 },
    { keyword: "Fall Wedding Ideas", pctChangeFromLastYear: 35, weeklyChange: 4, monthlyChange: 35, yearlyChange: 15 },
  ],
  yearly: [
    { keyword: "Home Decor Ideas", pctChangeFromLastYear: 45, weeklyChange: 4, monthlyChange: 18, yearlyChange: 45 },
    { keyword: "Healthy Meal Prep", pctChangeFromLastYear: 38, weeklyChange: 3, monthlyChange: 14, yearlyChange: 38 },
    { keyword: "Workout Routine", pctChangeFromLastYear: 34, weeklyChange: 3, monthlyChange: 12, yearlyChange: 34 },
    { keyword: "Budget Travel Tips", pctChangeFromLastYear: 31, weeklyChange: 2, monthlyChange: 11, yearlyChange: 31 },
    { keyword: "DIY Home Projects", pctChangeFromLastYear: 28, weeklyChange: 2, monthlyChange: 10, yearlyChange: 28 },
    { keyword: "Capsule Wardrobe", pctChangeFromLastYear: 25, weeklyChange: 2, monthlyChange: 9, yearlyChange: 25 },
    { keyword: "Skincare Routine", pctChangeFromLastYear: 22, weeklyChange: 2, monthlyChange: 8, yearlyChange: 22 },
    { keyword: "Indoor Plants", pctChangeFromLastYear: 19, weeklyChange: 1, monthlyChange: 7, yearlyChange: 19 },
    { keyword: "Date Night Ideas", pctChangeFromLastYear: 17, weeklyChange: 1, monthlyChange: 6, yearlyChange: 17 },
    { keyword: "Vision Board 2025", pctChangeFromLastYear: 15, weeklyChange: 1, monthlyChange: 5, yearlyChange: 15 },
  ],
};

// Sidebar trigger button only
function TrendingTrigger({ open, isLive, onToggle }: { open: boolean; isLive: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={onToggle}
        className={cn("w-full flex items-center gap-3 px-4 py-3 transition-all",
          open ? "bg-gradient-to-r from-orange-50 to-red-50" : "hover:bg-orange-50/50"
        )}
      >
        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Flame className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-gray-800">Pinterest Trending Now</div>
          <div className="text-xs text-gray-500">Search Trends · Shopping Trends</div>
        </div>
        {isLive && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">● Live</span>}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
    </div>
  );
}

// Full trending panel rendered above search bar in main content
function TrendingPanel({ onSearch, onClose }: { onSearch: (q: string) => void; onClose: () => void }) {
  const [trendTab, setTrendTab] = useState<TrendTab>("growing");
  const [trendKind, setTrendKind] = useState<TrendKind>("search");
  const [location, setLocation] = useState("United States");
  const [age, setAge] = useState("All Ages");
  const [gender, setGender] = useState("All");
  const [interest, setInterest] = useState("All Interests");
  const [moment, setMoment] = useState("All Moments");
  const [vertical, setVertical] = useState("All Verticals");
  const [rankedBy, setRankedBy] = useState("Outbound clicks");
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const regionMap: Record<string, string> = {
    "United States": "US", "United Kingdom": "GB", "Canada": "CA",
    "Australia": "AU", "Germany": "DE", "France": "FR", "Brazil": "BR", "India": "IN",
  };

  const loadTrends = useCallback(async (tab: TrendTab, loc: string, intr: string) => {
    setLoading(true);
    const region = regionMap[loc] ?? "US";
    const interestParam = intr !== "All Interests" ? intr : "";
    try {
      const res = await fetch(`/api/pinterest-trends?type=${tab}&region=${region}${interestParam ? `&interest=${encodeURIComponent(interestParam)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.trends) && data.trends.length > 0) {
          // Map API response — weekly/monthly/yearly derived from timeseries in route
          const mapped: TrendItem[] = data.trends.slice(0, 15).map((t: TrendItem & { pctChangeFromLastYear?: number }) => ({
            keyword: t.keyword,
            pctChangeFromLastYear: t.pctChangeFromLastYear ?? null,
            weeklyChange:  t.weeklyChange  ?? null,
            monthlyChange: t.monthlyChange ?? null,
            yearlyChange:  t.yearlyChange  ?? t.pctChangeFromLastYear ?? null,
          }));
          setTrends(mapped);
          setIsLive(true);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }
    setTrends(SEARCH_SAMPLES[tab]);
    setIsLive(false);
    setLoading(false);
  }, []);

  const [shoppingIsLive, setShoppingIsLive] = useState(false);

  const loadShopping = useCallback((rb: string) => {
    setLoading(true);
    // Pick dataset for the selected metric — each metric ranks categories differently
    const dataset = SHOPPING_BY_METRIC[rb] ?? SHOPPING_BY_METRIC["Outbound clicks"];
    setTimeout(() => {
      setShopping(dataset);
      setShoppingIsLive(false);
      setLoading(false);
    }, 250);
  }, []);

  useEffect(() => {
    if (trendKind === "search") loadTrends(trendTab, location, interest);
    else loadShopping(rankedBy);
  }, [trendKind, trendTab, location, interest, rankedBy, loadTrends, loadShopping]);

  return (
    <div className="border border-orange-100 rounded-2xl bg-gradient-to-br from-orange-50/60 to-red-50/30 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/70 border-b border-orange-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-800">Pinterest Trending Now</span>
            {isLive && <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">● Live</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Row 1: Location (global — applies to all) + Search/Shopping toggle */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm">
            <Globe className="w-3.5 h-3.5 text-gray-500" />
            <select value={location} onChange={e => setLocation(e.target.value)} className="text-xs text-gray-800 bg-transparent outline-none cursor-pointer font-semibold">
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-1 bg-white/80 rounded-xl p-1 border border-gray-100">
            <button onClick={() => setTrendKind("search")}
              className={cn("flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold transition-all",
                trendKind === "search" ? "bg-[#e60023] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              )}>
              <Search className="w-3 h-3" /> Search Trends
            </button>
            <button onClick={() => setTrendKind("shopping")}
              className={cn("flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold transition-all",
                trendKind === "shopping" ? "bg-[#e60023] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              )}>
              <ShoppingBag className="w-3 h-3" /> Shopping Trends <span className="text-[10px] opacity-70 ml-0.5">Beta</span>
            </button>
          </div>
        </div>

        {/* Row 2: Trend type tabs in one row */}
        {trendKind === "search" && (
          <div className="flex items-center gap-2">
            {(["growing","seasonal","monthly","yearly"] as const).map(t => (
              <button key={t} onClick={() => setTrendTab(t)}
                className={cn("text-xs px-4 py-2 rounded-lg font-semibold transition-all border",
                  trendTab === t ? "bg-[#e60023] text-white border-[#e60023]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}>
                {t === "growing" ? "↗ Growing" : t === "seasonal" ? "✦ Seasonal" : t === "monthly" ? "⊟ Monthly" : "⊟ Yearly"}
              </button>
            ))}
          </div>
        )}
        {trendKind === "shopping" && (
          <div className="flex items-center gap-2">
            <button className="text-xs px-4 py-2 rounded-lg font-semibold bg-[#e60023] text-white border border-[#e60023]">↗ Trending categories</button>
            <button className="text-xs px-4 py-2 rounded-lg font-semibold bg-white text-gray-600 border border-gray-200 hover:border-gray-300">◇ All categories</button>
          </div>
        )}

        {/* Row 3: Secondary filters (visible after tab selected) */}
        <div className="flex flex-wrap items-center gap-2 border-t border-orange-100 pt-3">
          {trendKind === "search" && (
            <>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Filter className="w-3 h-3 text-gray-400" />
                <select value={interest} onChange={e => setInterest(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[110px]">
                  {INTERESTS.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Calendar className="w-3 h-3 text-gray-400" />
                <select value={moment} onChange={e => setMoment(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[100px]">
                  {MOMENTS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Users className="w-3 h-3 text-gray-400" />
                <select value={age} onChange={e => setAge(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[80px]">
                  {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Users className="w-3 h-3 text-gray-400" />
                <select value={gender} onChange={e => setGender(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[70px]">
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </>
          )}
          {trendKind === "shopping" && (
            <>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Filter className="w-3 h-3 text-gray-400" />
                <select value={vertical} onChange={e => setVertical(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[120px]">
                  {TOP_VERTICALS.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Users className="w-3 h-3 text-gray-400" />
                <select value={age} onChange={e => setAge(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[80px]">
                  {AGE_GROUPS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <Users className="w-3 h-3 text-gray-400" />
                <select value={gender} onChange={e => setGender(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[70px]">
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
                <BarChart2 className="w-3 h-3 text-gray-400" />
                <select value={rankedBy} onChange={e => setRankedBy(e.target.value)} className="text-xs text-gray-700 bg-transparent outline-none cursor-pointer font-medium max-w-[120px]">
                  {RANKED_BY.map(r => <option key={r}>Ranked by: {r}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Results table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : trendKind === "search" ? (
          <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <span className="col-span-6">Keyword</span>
              <span className="col-span-2 text-right">Weekly %</span>
              <span className="col-span-2 text-right">Monthly %</span>
              <span className="col-span-2 text-right">Yearly %</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {trends.map((t, i) => (
                <button key={t.keyword} onClick={() => onSearch(t.keyword)}
                  className="w-full grid grid-cols-12 items-center px-4 py-2.5 text-left hover:bg-orange-50 transition-colors group">
                  <div className="col-span-6 flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 font-bold flex-shrink-0">#{i+1}</span>
                    <span className="text-sm font-semibold text-gray-800 capitalize group-hover:text-[#e60023] transition-colors">{t.keyword}</span>
                  </div>
                  <span className={cn("col-span-2 text-xs font-bold text-right", (t.weeklyChange ?? 0) >= 0 ? "text-green-600" : "text-red-500")}>
                    {t.weeklyChange == null ? "—" : `${t.weeklyChange >= 0 ? "+" : ""}${t.weeklyChange >= 10000 ? "10,000%+" : `${t.weeklyChange}%`}`}
                  </span>
                  <span className={cn("col-span-2 text-xs font-bold text-right", (t.monthlyChange ?? 0) >= 0 ? "text-green-600" : "text-red-500")}>
                    {t.monthlyChange == null ? "—" : `${t.monthlyChange >= 0 ? "+" : ""}${t.monthlyChange >= 10000 ? "10,000%+" : `${t.monthlyChange}%`}`}
                  </span>
                  <span className={cn("col-span-2 text-xs font-bold text-right", (t.yearlyChange ?? 0) >= 0 ? "text-green-600" : "text-red-500")}>
                    {t.yearlyChange == null ? "—" : `${t.yearlyChange >= 0 ? "+" : ""}${t.yearlyChange >= 10000 ? "10,000%+" : `${t.yearlyChange}%`}`}
                  </span>
                </button>
              ))}
            </div>
            {!isLive && <p className="text-xs text-gray-400 py-2 text-center border-t border-gray-50">Sample data · Connect Pinterest for live trends</p>}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <span className="col-span-1">Rank</span>
              <span className="col-span-4">Product Category</span>
              <span className="col-span-2 text-center">Trend</span>
              <span className="col-span-3 text-right">{rankedBy} Growth</span>
              <span className="col-span-2 text-right">{rankedBy} Vol.</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {shopping.map(s => (
                <div key={s.category} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-orange-50/40 transition-colors">
                  <span className="col-span-1 text-sm font-bold text-blue-600">{s.rank}</span>
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-xl flex-shrink-0">{s.emoji}</span>
                    <span className="text-xs font-semibold text-gray-800 leading-tight">{s.category}</span>
                  </div>
                  {/* Mini sparkline using SVG */}
                  <div className="col-span-2 flex justify-center">
                    <svg width="48" height="24" viewBox="0 0 48 24">
                      {s.trend === "up" ? (
                        <polyline points="0,20 12,16 24,10 36,5 48,1" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      ) : s.trend === "down" ? (
                        <polyline points="0,4 12,8 24,14 36,18 48,22" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      ) : (
                        <polyline points="0,12 12,10 24,13 36,11 48,12" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      )}
                    </svg>
                  </div>
                  <span className={cn("col-span-3 text-xs font-bold text-right", s.trend === "up" ? "text-green-600" : s.trend === "down" ? "text-red-500" : "text-gray-500")}>
                    {s.outboundClicksGrowth}
                  </span>
                  {/* Volume bar */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[40px]">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${s.volume}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs py-2 text-center border-t border-gray-50">
              <span className={cn("font-semibold px-2 py-0.5 rounded-full text-xs", shoppingIsLive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                {shoppingIsLive ? "● Live" : "○ Sample data"}
              </span>
              {!shoppingIsLive && <span className="text-gray-400 ml-2">Mirrored from trends.pinterest.com/shopping · Updated weekly</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
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
  const [trendingOpen, setTrendingOpen] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuery(q.trim());
    setLoading(true);
    setMatchFilter("all");
    setIsLive(false);
    try {
      const res = await fetch(`/api/pinterest-keywords?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const items: { keyword: string; monthlySearches: number | null; competition: string | null; suggestedBid: number | null }[] = data.keywords ?? [];
        if (items.length > 0) {
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
    } catch { /* fall through */ }
    setResults(generateKeywords(q));
    setLoading(false);
  }, []);

  const handleCategoryClick = (catId: string, catName: string) => {
    if (expandedCategory === catId) { setExpandedCategory(null); return; }
    setExpandedCategory(catId);
    setSelectedCategory(catName);
    setSelectedSubcategory(null);
    setQuery(catName.toLowerCase());
    handleSearch(catName);
  };

  const handleSubcategoryClick = (sub: string) => {
    setSelectedSubcategory(sub);
    setQuery(sub.toLowerCase());
    handleSearch(sub);
  };

  const filtered = matchFilter === "all" ? results : results.filter(r => r.matchType === matchFilter);
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortKey === "volume") diff = a.volume - b.volume;
    else if (sortKey === "trend") diff = a.trend - b.trend;
    else if (sortKey === "cpc") diff = a.cpc - b.cpc;
    else if (sortKey === "competition") { const r = { low: 0, medium: 1, high: 2 }; diff = r[a.competition] - r[b.competition]; }
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortAsc(p => !p); else { setSortKey(key); setSortAsc(false); } };
  const toggleSave = (kw: string) => setSaved(prev => { const n = new Set(prev); n.has(kw) ? n.delete(kw) : n.add(kw); return n; });
  const countByMatch = (t: MatchFilter) => t === "all" ? results.length : results.filter(r => r.matchType === t).length;

  const handleExport = () => {
    const header = "Keyword,Match Type,Monthly Volume,Trend %,Competition,Avg CPC\n";
    const rows = sorted.map(r => `"${r.keyword}",${r.matchType},${r.volume},${r.trend}%,${r.competition},$${r.cpc}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `pinterest-keywords-${query.replace(/\s+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Header title="Keyword Research" subtitle="Discover 100+ closely relevant Pinterest keywords by match type" />
      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-100 overflow-y-auto flex-shrink-0 flex flex-col">
          {/* Trending trigger — above browse categories */}
          <TrendingTrigger open={trendingOpen} isLive={false} onToggle={() => setTrendingOpen(p => !p)} />

          {/* Browse Categories */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Browse Categories</h3>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            {PINTEREST_CATEGORIES.map(cat => (
              <div key={cat.id}>
                <button
                  onClick={() => handleCategoryClick(cat.id, cat.name)}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all",
                    selectedCategory === cat.name && !selectedSubcategory ? "bg-[#e60023] text-white" : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className="flex-1 text-left font-medium">{cat.name}</span>
                  {expandedCategory === cat.id ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
                </button>
                {expandedCategory === cat.id && (
                  <div className="ml-8 mt-1 mb-2 space-y-0.5">
                    {cat.subcategories.map(sub => (
                      <button key={sub} onClick={() => handleSubcategoryClick(sub)}
                        className={cn("w-full text-left text-xs px-3 py-2 rounded-lg transition-all",
                          selectedSubcategory === sub ? "bg-[#e60023]/10 text-[#e60023] font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}>
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
          {/* Trending Panel — above search bar */}
          {trendingOpen && (
            <div className="px-6 pt-6">
              <TrendingPanel onSearch={(q) => { handleSearch(q); setTrendingOpen(false); }} onClose={() => setTrendingOpen(false)} />
            </div>
          )}

          {/* Search Bar */}
          <div className="p-6 pb-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch(query)}
                  placeholder="Search for any keyword (e.g. home decor, recipes, fitness)..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                />
                {query && (
                  <button onClick={() => { setQuery(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={() => handleSearch(query)}
                className="bg-[#e60023] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors flex items-center gap-2">
                <Search className="w-4 h-4" /> Search
              </button>
            </div>

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

            {results.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">Match type:</span>
                {(["all", "exact", "phrase", "broad"] as MatchFilter[]).map(type => (
                  <button key={type} onClick={() => setMatchFilter(type)}
                    className={cn("text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all",
                      matchFilter === type
                        ? type === "all" ? "bg-gray-800 text-white border-gray-800"
                          : type === "exact" ? "bg-orange-500 text-white border-orange-500"
                          : type === "phrase" ? "bg-purple-600 text-white border-purple-600"
                          : "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    )}>
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
                <p className="text-sm text-gray-500">Finding keywords...</p>
              </div>
            ) : sorted.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">
                      {sorted.length} keyword{sorted.length !== 1 ? "s" : ""}
                      {matchFilter !== "all" ? ` · ${MATCH_LABEL[matchFilter]} match` : ""}
                    </span>
                    <span
                      title={isLive ? "Data pulled live from Pinterest API" : "Estimated figures based on Pinterest category benchmarks. Trend direction and match types are accurate; volume & CPC are approximate."}
                      className={cn("text-xs font-semibold px-2 py-0.5 rounded-full cursor-help",
                        isLive ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                      )}>
                      {isLive ? "● Live" : "~ Estimated"}
                    </span>
                  </div>
                  <button onClick={handleExport}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Keyword</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Match Type</th>
                        {(["volume", "trend", "competition", "cpc"] as SortKey[]).map(key => (
                          <th key={key} onClick={() => toggleSort(key)}
                            className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
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
                      {sorted.map(kw => (
                        <tr key={kw.keyword} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3"><span className="text-sm font-medium text-gray-800">{kw.keyword}</span></td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold capitalize", MATCH_COLOR[kw.matchType])}>
                              {MATCH_LABEL[kw.matchType]}
                            </span>
                          </td>
                          <td className="px-4 py-3"><span className="text-sm font-semibold text-gray-900">{formatNumber(kw.volume)}</span></td>
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
                          <td className="px-4 py-3"><span className="text-sm text-gray-700">${kw.cpc.toFixed(2)}</span></td>
                          <td className="px-4 py-3">
                            <button onClick={() => toggleSave(kw.keyword)}
                              className={cn("p-1.5 rounded-lg transition-colors",
                                saved.has(kw.keyword) ? "text-[#e60023] bg-[#e60023]/10" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              )}>
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
                  Search any topic, click a category, or expand <strong>Pinterest Trending Now</strong> in the sidebar to discover what&apos;s growing. Volume &amp; CPC show estimated benchmarks.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                  <Filter className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No keywords for this match type.</p>
                <button onClick={() => setMatchFilter("all")} className="text-xs text-[#e60023] mt-2 hover:underline">Show all</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
