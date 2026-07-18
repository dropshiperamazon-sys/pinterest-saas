"use client";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Search, ExternalLink, BookmarkPlus, Trash2, Tag,
  Filter, X, Heart, Share2, Eye, Globe, Hash,
  ChevronDown, Bookmark, BookmarkCheck, AlertCircle,
  ArrowUpRight, LayoutGrid, List, SlidersHorizontal,
  TrendingUp, Building2, MousePointerClick, Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdCard {
  id: string;
  brand: string;
  domain: string;
  niche: string;
  format: "standard" | "video" | "carousel" | "idea";
  title: string;
  description: string;
  cta: string;
  imageColor: string; // gradient fallback
  imageEmoji: string;
  likes: number;
  shares: number;
  views: string;
  country: string;
  lastSeen: string;
  adUrl: string;
  tags: string[];
}

// ── Mock ad database ──────────────────────────────────────────────────────────

const MOCK_ADS: AdCard[] = [
  { id:"m1", brand:"Article Furniture", domain:"article.com", niche:"Home Decor", format:"standard", title:"Elevate Your Living Room This Season", description:"Scandinavian-inspired sofas & chairs. Free shipping on orders over $999. Shop the new collection.", cta:"Shop Now", imageColor:"from-amber-100 to-orange-200", imageEmoji:"🛋️", likes:4820, shares:1240, views:"2.1M", country:"United States", lastSeen:"2 days ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["sofa","furniture","minimalist"] },
  { id:"m2", brand:"Ritual Vitamins", domain:"ritual.com", niche:"Health", format:"video", title:"The Only Multivitamin You'll Ever Need", description:"Traceable ingredients. Vegan-friendly. No questionable extras. Start your ritual today — first month 40% off.", cta:"Get 40% Off", imageColor:"from-yellow-100 to-yellow-300", imageEmoji:"💊", likes:3100, shares:890, views:"1.4M", country:"United States", lastSeen:"1 day ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["vitamins","wellness","health"] },
  { id:"m3", brand:"Mejuri", domain:"mejuri.com", niche:"Fashion", format:"carousel", title:"Fine Jewelry for Everyday Moments", description:"Solid gold. Sterling silver. Made to be worn daily. Discover this season's new arrivals.", cta:"Shop Jewelry", imageColor:"from-rose-100 to-pink-200", imageEmoji:"💍", likes:6700, shares:2100, views:"3.8M", country:"Canada", lastSeen:"3 days ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["jewelry","fashion","gold"] },
  { id:"m4", brand:"Headspace", domain:"headspace.com", niche:"Health", format:"standard", title:"Find Calm in Just 10 Minutes a Day", description:"Guided meditations for stress, sleep & focus. Try Headspace free for 30 days — no credit card needed.", cta:"Try Free", imageColor:"from-orange-200 to-red-200", imageEmoji:"🧘", likes:5400, shares:1800, views:"4.2M", country:"United States", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["meditation","mindfulness","wellness"] },
  { id:"m5", brand:"West Elm", domain:"westelm.com", niche:"Home Decor", format:"carousel", title:"New Arrivals: Modern & Sustainable", description:"Shop our fall collection — sustainably sourced materials, thoughtfully designed for modern living.", cta:"See New Arrivals", imageColor:"from-stone-200 to-stone-300", imageEmoji:"🪑", likes:8200, shares:3400, views:"5.1M", country:"United States", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["furniture","sustainable","modern"] },
  { id:"m6", brand:"Fenty Beauty", domain:"fentybeauty.com", niche:"Beauty", format:"video", title:"Your Shade Exists. We Promise.", description:"40 shades of Pro Filt'r foundation for every skin tone. Long-wear, buildable coverage. Shop now.", cta:"Find Your Shade", imageColor:"from-purple-100 to-pink-200", imageEmoji:"💄", likes:12400, shares:5600, views:"8.7M", country:"United States", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["makeup","foundation","beauty"] },
  { id:"m7", brand:"Airbnb", domain:"airbnb.com", niche:"Travel", format:"standard", title:"Don't Just Visit — Live Like a Local", description:"Unique stays in 220 countries. From cozy cabins to designer lofts. Book with free cancellation.", cta:"Explore Stays", imageColor:"from-rose-200 to-red-200", imageEmoji:"🏡", likes:9800, shares:4200, views:"6.3M", country:"United Kingdom", lastSeen:"2 days ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["travel","vacation","airbnb"] },
  { id:"m8", brand:"HelloFresh", domain:"hellofresh.com", niche:"Food & Recipes", format:"carousel", title:"Get Dinner on the Table in 30 Minutes", description:"Fresh pre-portioned ingredients + chef-designed recipes. First box 50% off. Skip or cancel anytime.", cta:"Claim 50% Off", imageColor:"from-green-100 to-emerald-200", imageEmoji:"🥗", likes:7300, shares:2900, views:"4.8M", country:"United States", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["mealkit","food","cooking"] },
  { id:"m9", brand:"Peloton", domain:"onepeloton.com", niche:"Fitness", format:"video", title:"The Best Workout Is the One You'll Do", description:"Live & on-demand classes. Cycling, running, yoga, strength. Try Peloton free for 30 days.", cta:"Start Free Trial", imageColor:"from-gray-800 to-gray-900", imageEmoji:"🚴", likes:5200, shares:1700, views:"3.1M", country:"United States", lastSeen:"3 days ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["fitness","cycling","workout"] },
  { id:"m10", brand:"Canva", domain:"canva.com", niche:"Education", format:"idea", title:"Design Anything. Publish Everywhere.", description:"Create stunning graphics, presentations & social media content in minutes. Free forever plan available.", cta:"Design Free", imageColor:"from-cyan-100 to-blue-200", imageEmoji:"🎨", likes:14200, shares:7800, views:"11.2M", country:"Australia", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["design","tools","creative"] },
  { id:"m11", brand:"Lush Cosmetics", domain:"lush.com", niche:"Beauty", format:"standard", title:"Fresh. Handmade. Ethical Beauty.", description:"Bath bombs, face masks & skincare made fresh with ethically sourced ingredients. Zero plastic packaging.", cta:"Shop Lush", imageColor:"from-purple-200 to-violet-300", imageEmoji:"🛁", likes:6800, shares:3100, views:"4.4M", country:"United Kingdom", lastSeen:"1 day ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["skincare","ethical","bath"] },
  { id:"m12", brand:"VRBO", domain:"vrbo.com", niche:"Travel", format:"carousel", title:"Your Whole Group. One Amazing Place.", description:"Vacation rentals for groups & families. Entire homes — not just rooms. Space to spread out.", cta:"Find Your Home", imageColor:"from-blue-100 to-sky-200", imageEmoji:"🏖️", likes:4100, shares:1600, views:"2.9M", country:"United States", lastSeen:"4 days ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["vacation","family","rental"] },
  { id:"m13", brand:"Gymshark", domain:"gymshark.com", niche:"Fitness", format:"video", title:"For the Love of Training", description:"Performance activewear designed by athletes. New season collection — engineered to move with you.", cta:"Shop Collection", imageColor:"from-black to-gray-800", imageEmoji:"💪", likes:18700, shares:8900, views:"13.4M", country:"United Kingdom", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["activewear","gym","fitness"] },
  { id:"m14", brand:"Duolingo", domain:"duolingo.com", niche:"Education", format:"standard", title:"Learn a Language in 10 Minutes a Day", description:"The world's #1 language learning app. Free lessons. Science-based method. 40+ languages available.", cta:"Start for Free", imageColor:"from-green-300 to-emerald-400", imageEmoji:"🦉", likes:9400, shares:4600, views:"7.2M", country:"United States", lastSeen:"2 days ago", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["language","learning","app"] },
  { id:"m15", brand:"Anthropologie", domain:"anthropologie.com", niche:"Fashion", format:"carousel", title:"Curated for the Free-Spirited", description:"Bohemian clothing, unique home decor & gifts. New arrivals weekly. Free shipping on orders $150+.", cta:"Shop New Arrivals", imageColor:"from-rose-100 to-amber-100", imageEmoji:"🌸", likes:7600, shares:2800, views:"5.0M", country:"United States", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["boho","fashion","clothing"] },
  { id:"m16", brand:"IKEA", domain:"ikea.com", niche:"Home Decor", format:"idea", title:"Small Space? Big Possibilities.", description:"Smart storage solutions and multifunctional furniture for every room — without breaking the bank.", cta:"Get Inspired", imageColor:"from-yellow-200 to-yellow-400", imageEmoji:"🏠", likes:22000, shares:11000, views:"18.6M", country:"United States", lastSeen:"Today", adUrl:"https://ads.pinterest.com/ads-repository/", tags:["storage","smallspace","affordable"] },
];

const NICHES = ["All", "Home Decor", "Fashion", "Beauty", "Food & Recipes", "Fitness", "Travel", "Education", "Health"];
const FORMATS = ["All", "standard", "video", "carousel", "idea"];
const COUNTRIES = ["All", "United States", "United Kingdom", "Canada", "Australia"];
const SORT_OPTIONS = ["Most Liked", "Most Shared", "Most Viewed", "Most Recent"];
const STORAGE_KEY = "mypinpro_swipe_file";

const FORMAT_LABEL: Record<string, string> = { standard: "Standard", video: "Video", carousel: "Carousel", idea: "Idea Pin" };
const FORMAT_COLOR: Record<string, string> = {
  standard: "bg-blue-100 text-blue-700",
  video: "bg-purple-100 text-purple-700",
  carousel: "bg-orange-100 text-orange-700",
  idea: "bg-pink-100 text-pink-700",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function AdDetailModal({ ad, onClose, swipeIds, onSwipe }: {
  ad: AdCard; onClose: () => void;
  swipeIds: Set<string>; onSwipe: (id: string) => void;
}) {
  const saved = swipeIds.has(ad.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Image */}
        <div className={`bg-gradient-to-br ${ad.imageColor} h-52 flex items-center justify-center relative`}>
          <span className="text-7xl">{ad.imageEmoji}</span>
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", FORMAT_COLOR[ad.format])}>{FORMAT_LABEL[ad.format]}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/80 text-gray-700">📌 Promoted</span>
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center hover:bg-white">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-[#e60023] uppercase tracking-wide mb-0.5">{ad.brand} · {ad.domain}</p>
              <h3 className="text-base font-bold text-gray-900 leading-snug">{ad.title}</h3>
            </div>
            <button
              onClick={() => onSwipe(ad.id)}
              className={cn("flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all", saved ? "bg-green-100 text-green-700" : "bg-[#e60023] text-white hover:bg-[#ad081b]")}
            >
              {saved ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{ad.description}</p>
          <div className="flex items-center gap-3">
            <span className="bg-[#e60023] text-white text-xs font-bold px-4 py-2 rounded-full">{ad.cta}</span>
            <a href={ad.adUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#e60023] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> View in Ads Library
            </a>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            {[
              { icon: Heart, label: "Likes", val: ad.likes.toLocaleString() },
              { icon: Share2, label: "Shares", val: ad.shares.toLocaleString() },
              { icon: Eye, label: "Views", val: ad.views },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{val}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
            <span>🌍 {ad.country} · Last seen: {ad.lastSeen}</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {ad.tags.map(t => <span key={t} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdResearchTab() {
  const [tab, setTab] = useState<"explore" | "swipe" | "lookup">("explore");
  const [searchQ, setSearchQ] = useState("");
  const [niche, setNiche] = useState("All");
  const [format, setFormat] = useState("All");
  const [country, setCountry] = useState("All");
  const [sort, setSort] = useState("Most Liked");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAd, setSelectedAd] = useState<AdCard | null>(null);
  const [swipeIds, setSwipeIds] = useState<Set<string>>(new Set());

  // Lookup tab
  const [lookupQ, setLookupQ] = useState("");
  const [lookupCountry, setLookupCountry] = useState("GB");

  const LOOKUP_COUNTRIES: { label: string; code: string }[] = [
    { label: "United Kingdom", code: "GB" },
    { label: "Canada", code: "CA" },
    { label: "Australia", code: "AU" },
    { label: "Germany", code: "DE" },
    { label: "France", code: "FR" },
    { label: "India", code: "IN" },
    { label: "Brazil", code: "BR" },
  ];

  const openLookup = (advertiser?: string) => {
    const params = new URLSearchParams();
    params.set("country", lookupCountry);
    if (advertiser) params.set("advertiserName", encodeURIComponent(advertiser));
    window.open(`https://ads.pinterest.com/ads-repository/?${params.toString()}`, "_blank", "noopener noreferrer");
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSwipeIds(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  function toggleSwipe(id: string) {
    setSwipeIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Filter + sort
  const filtered = MOCK_ADS
    .filter(a => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || a.brand.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.niche.toLowerCase().includes(q) || a.tags.some(t => t.includes(q));
      const matchNiche = niche === "All" || a.niche === niche;
      const matchFormat = format === "All" || a.format === format;
      const matchCountry = country === "All" || a.country === country;
      return matchQ && matchNiche && matchFormat && matchCountry;
    })
    .sort((a, b) => {
      if (sort === "Most Liked") return b.likes - a.likes;
      if (sort === "Most Shared") return b.shares - a.shares;
      if (sort === "Most Viewed") return parseFloat(b.views) - parseFloat(a.views);
      return 0;
    });

  const swipeAds = MOCK_ADS.filter(a => swipeIds.has(a.id));
  const activeFilters = [niche !== "All" && niche, format !== "All" && FORMAT_LABEL[format], country !== "All" && country].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-2xl p-1 w-fit gap-1">
        {([
          { key: "explore", label: "Explore Ads", icon: LayoutGrid },
          { key: "swipe", label: `Swipe File${swipeIds.size ? ` (${swipeIds.size})` : ""}`, icon: Bookmark },
          { key: "lookup", label: "Advertiser Lookup", icon: Building2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── EXPLORE TAB ── */}
      {tab === "explore" && (
        <div className="space-y-4">
          {/* Demo banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <strong>Sample Ad Intelligence Database</strong> — These are realistic example ads for research & inspiration. For live ads, use the <a href="https://ads.pinterest.com/ads-repository/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Pinterest Ads Library</a>.
            </p>
          </div>

          {/* Search + controls */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search brand, keyword, niche…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                showFilters ? "bg-[#e60023] text-white border-[#e60023]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}>
              <SlidersHorizontal className="w-4 h-4" />
              Filters {activeFilters.length > 0 && <span className="bg-white/30 text-xs px-1.5 py-0.5 rounded-full">{activeFilters.length}</span>}
            </button>
            {/* Sort */}
            <div className="relative">
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 cursor-pointer">
                {SORT_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setViewMode("grid")} className={cn("px-3 py-2.5 transition-colors", viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("px-3 py-2.5 transition-colors", viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-3 gap-4">
              {[
                { label: "Niche", options: NICHES, value: niche, onChange: setNiche },
                { label: "Ad Format", options: FORMATS, value: format, onChange: setFormat },
                { label: "Country", options: COUNTRIES, value: country, onChange: setCountry },
              ].map(({ label, options, value, onChange }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map(o => (
                      <button key={o} onClick={() => onChange(o)}
                        className={cn("text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                          value === o ? "bg-[#e60023] text-white border-[#e60023]" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                        )}>
                        {o === "standard" ? "Standard" : o === "video" ? "Video" : o === "carousel" ? "Carousel" : o === "idea" ? "Idea Pin" : o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Active:</span>
              {activeFilters.map(f => (
                <span key={f} className="flex items-center gap-1 bg-[#e60023]/10 text-[#e60023] text-xs px-2.5 py-1 rounded-full font-medium">
                  {f} <button onClick={() => { if (NICHES.includes(f)) setNiche("All"); if (Object.values(FORMAT_LABEL).includes(f)) setFormat("All"); if (COUNTRIES.includes(f)) setCountry("All"); }}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <button onClick={() => { setNiche("All"); setFormat("All"); setCountry("All"); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear all</button>
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{filtered.length} ads found</p>
            <a href="https://ads.pinterest.com/ads-repository/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#e60023] font-semibold hover:underline">
              <ExternalLink className="w-3 h-3" /> Search live ads on Pinterest →
            </a>
          </div>

          {/* Grid view */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map(ad => {
                const saved = swipeIds.has(ad.id);
                return (
                  <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
                    onClick={() => setSelectedAd(ad)}>
                    {/* Image */}
                    <div className={`bg-gradient-to-br ${ad.imageColor} h-40 flex items-center justify-center relative`}>
                      <span className="text-5xl">{ad.imageEmoji}</span>
                      <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", FORMAT_COLOR[ad.format])}>{FORMAT_LABEL[ad.format]}</span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); toggleSwipe(ad.id); }}
                        className={cn("absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center shadow transition-all",
                          saved ? "bg-[#e60023] text-white" : "bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100"
                        )}>
                        {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="absolute bottom-2 right-2.5 text-[9px] bg-white/70 text-gray-600 font-semibold px-1.5 py-0.5 rounded">📌 Promoted</span>
                    </div>
                    {/* Content */}
                    <div className="p-3.5">
                      <p className="text-[10px] font-bold text-[#e60023] uppercase tracking-wide mb-0.5">{ad.brand}</p>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{ad.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{ad.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="bg-[#e60023]/10 text-[#e60023] text-[10px] font-bold px-2.5 py-1 rounded-full">{ad.cta}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{(ad.likes/1000).toFixed(1)}k</span>
                          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{ad.views}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List view */}
          {viewMode === "list" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Ad", "Format", "Niche", "CTA", "Likes", "Views", "Country", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(ad => {
                    const saved = swipeIds.has(ad.id);
                    return (
                      <tr key={ad.id} className="hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={() => setSelectedAd(ad)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ad.imageColor} flex items-center justify-center text-xl flex-shrink-0`}>{ad.imageEmoji}</div>
                            <div>
                              <p className="text-xs font-bold text-[#e60023]">{ad.brand}</p>
                              <p className="text-sm font-medium text-gray-800 line-clamp-1 max-w-48">{ad.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", FORMAT_COLOR[ad.format])}>{FORMAT_LABEL[ad.format]}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-600">{ad.niche}</td>
                        <td className="px-4 py-3"><span className="text-xs bg-[#e60023]/10 text-[#e60023] font-semibold px-2.5 py-1 rounded-full">{ad.cta}</span></td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">{ad.likes.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{ad.views}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">🌍 {ad.country}</td>
                        <td className="px-4 py-3">
                          <button onClick={e => { e.stopPropagation(); toggleSwipe(ad.id); }}
                            className={cn("p-1.5 rounded-lg transition-colors", saved ? "text-[#e60023]" : "text-gray-300 hover:text-[#e60023]")}>
                            {saved ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
              <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No ads match your filters. Try adjusting your search.</p>
            </div>
          )}
        </div>
      )}

      {/* ── SWIPE FILE TAB ── */}
      {tab === "swipe" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Your Swipe File</h3>
              <p className="text-sm text-gray-400">{swipeIds.size} saved ad{swipeIds.size !== 1 ? "s" : ""} — click the bookmark icon on any ad to save it here</p>
            </div>
            {swipeIds.size > 0 && (
              <button onClick={() => { setSwipeIds(new Set()); localStorage.removeItem(STORAGE_KEY); }}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-medium">
                <Trash2 className="w-3.5 h-3.5" /> Clear all
              </button>
            )}
          </div>

          {swipeAds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
              <Bookmark className="w-12 h-12 text-gray-200 mb-4" />
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Your swipe file is empty</h4>
              <p className="text-xs text-gray-400 max-w-xs">Go to Explore Ads and click the bookmark icon on any ad you want to save for inspiration.</p>
              <button onClick={() => setTab("explore")} className="mt-4 flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors">
                <LayoutGrid className="w-4 h-4" /> Browse Ads
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {swipeAds.map(ad => (
                <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-all"
                  onClick={() => setSelectedAd(ad)}>
                  <div className={`bg-gradient-to-br ${ad.imageColor} h-40 flex items-center justify-center relative`}>
                    <span className="text-5xl">{ad.imageEmoji}</span>
                    <button onClick={e => { e.stopPropagation(); toggleSwipe(ad.id); }}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className={cn("absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full", FORMAT_COLOR[ad.format])}>{FORMAT_LABEL[ad.format]}</span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[10px] font-bold text-[#e60023] uppercase tracking-wide mb-0.5">{ad.brand}</p>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-2">{ad.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="bg-[#e60023]/10 text-[#e60023] text-[10px] font-bold px-2.5 py-1 rounded-full">{ad.cta}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{(ad.likes/1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADVERTISER LOOKUP TAB ── */}
      {tab === "lookup" && (
        <div className="space-y-5">

          {/* USA notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-xl flex-shrink-0">🇺🇸</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Targeting the USA market?</p>
              <p className="text-xs text-amber-700 mt-0.5 mb-2">Pinterest&apos;s Ads Repository does <strong>not</strong> include the United States — it only covers EU &amp; select countries. For US ads, use the Pinterest search below to find promoted pins directly.</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  id="us-search-input"
                  placeholder="Search US promoted pins (e.g. home decor)"
                  className="flex-1 min-w-[180px] border border-amber-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) window.open(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(val)}&rs=typed`, "_blank", "noopener noreferrer");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById("us-search-input") as HTMLInputElement;
                    if (el?.value.trim()) window.open(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(el.value.trim())}&rs=typed`, "_blank", "noopener noreferrer");
                  }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Search Pinterest
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-1.5">Tip: look for the <strong>&quot;Promoted&quot;</strong> label on pins — those are paid ads from US advertisers.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Advertiser Lookup <span className="text-xs font-normal text-gray-400 ml-1">(EU &amp; other countries)</span></h3>
              <p className="text-sm text-gray-500">Enter a brand name to see their active Pinterest ads in the official Ads Repository.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={lookupCountry}
                onChange={e => setLookupCountry(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] bg-white">
                {LOOKUP_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div className="relative flex-1 min-w-[180px]">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={lookupQ} onChange={e => setLookupQ(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && lookupQ.trim()) openLookup(lookupQ.trim()); }}
                  placeholder="e.g. IKEA, Nike, Sephora, westelm.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
              </div>
              <button
                onClick={() => { if (lookupQ.trim()) openLookup(lookupQ.trim()); }}
                disabled={!lookupQ.trim()}
                className="flex items-center gap-2 bg-[#e60023] text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40">
                <ExternalLink className="w-4 h-4" /> Look Up
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Opens Pinterest&apos;s official Ads Repository filtered by advertiser &amp; country — 100% legal.</p>
            </div>
          </div>

          {/* Quick competitor suggestions based on mock data */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#e60023]" />
              Top Active Advertisers in Our Database
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {MOCK_ADS.slice(0, 8).map(ad => (
                <button key={ad.id}
                  onClick={() => openLookup(ad.brand)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#e60023]/30 hover:bg-[#e60023]/5 transition-all text-left group">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ad.imageColor} flex items-center justify-center text-lg flex-shrink-0`}>{ad.imageEmoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{ad.brand}</p>
                    <p className="text-xs text-gray-400 truncate">{ad.domain} · {ad.niche}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#e60023] flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Stats on what to look for */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-[#e60023]" />
              What to Analyse in Competitor Ads
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: "🎯", label: "CTA Copy", tip: "What words do they use? Shop, Get, Try, Discover, Save?" },
                { emoji: "🖼️", label: "Image Style", tip: "Lifestyle photos vs product shots vs text overlays?" },
                { emoji: "📝", label: "Headline Formula", tip: "Benefit-led, question-based, or urgency-driven?" },
                { emoji: "🎨", label: "Color Palette", tip: "Brand colours vs contrast for stopping power?" },
                { emoji: "📦", label: "Offer Type", tip: "Discount, free trial, free shipping, or content?" },
                { emoji: "🔁", label: "Ad Frequency", tip: "Are they running 1 ad or dozens? High volume = working." },
              ].map(({ emoji, label, tip }) => (
                <div key={label} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                  <span className="text-xl flex-shrink-0">{emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ad detail modal */}
      {selectedAd && (
        <AdDetailModal ad={selectedAd} onClose={() => setSelectedAd(null)} swipeIds={swipeIds} onSwipe={toggleSwipe} />
      )}
    </div>
  );
}
