"use client";
import { useState } from "react";
import Header from "@/components/Header";
import { formatNumber, cn } from "@/lib/utils";
import {
  getPinByUrl,
  searchPinsByKeyword,
  type PinData,
} from "@/lib/pinterest-data";
import type { LivePin } from "@/app/api/pin-search/route";
import {
  Search, Link2, Bookmark, Eye, MousePointerClick,
  Calendar, Tag, TrendingUp, ArrowUpRight,
  Hash, X, BarChart2, ImageIcon, Film, LayoutGrid, Lightbulb,
  ExternalLink, User, AlertCircle,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

type SearchMode = "url" | "keyword";


const FORMAT_ICON: Record<string, React.ElementType> = {
  standard: ImageIcon,
  video: Film,
  carousel: LayoutGrid,
  idea: Lightbulb,
};

const FORMAT_LABEL: Record<string, string> = {
  standard: "Standard Pin",
  video: "Video Pin",
  carousel: "Carousel Pin",
  idea: "Idea Pin",
};

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function PinCard({ pin, onClick, compact = false }: { pin: PinData; onClick?: () => void; compact?: boolean }) {
  const FormatIcon = FORMAT_ICON[pin.format];
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all",
        onClick && "cursor-pointer hover:border-[#e60023]/30",
        compact ? "p-4" : "overflow-hidden"
      )}
    >
      {!compact && (
        <div className="bg-gradient-to-br from-gray-100 to-gray-50 h-40 flex items-center justify-center text-5xl relative">
          {pin.imageEmoji}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 px-2 py-1 rounded-lg text-xs font-medium text-gray-600">
            <FormatIcon className="w-3 h-3" />
            {FORMAT_LABEL[pin.format]}
          </div>
        </div>
      )}
      <div className={compact ? "" : "p-4"}>
        <div className="flex items-start gap-3">
          {compact && (
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
              {pin.imageEmoji}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{pin.title}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{pin.creatorHandle}</span>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">{pin.boardName}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <div className="text-sm font-bold text-gray-900">{formatNumber(pin.saves)}</div>
            <div className="text-xs text-gray-400">Saves</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <div className="text-sm font-bold text-gray-900">{formatNumber(pin.clicks)}</div>
            <div className="text-xs text-gray-400">Clicks</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <div className="text-sm font-bold text-gray-900">{formatNumber(pin.impressions)}</div>
            <div className="text-xs text-gray-400">Impressions</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          {format(parseISO(pin.postedAt), "MMM d, yyyy")}
          <span className="text-gray-200">·</span>
          <span className="text-gray-400">{formatDistanceToNow(parseISO(pin.postedAt), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}

function PinDetail({ pin, onClose }: { pin: PinData; onClose: () => void }) {
  const FormatIcon = FORMAT_ICON[pin.format];

  return (
    <div className="space-y-5">
      {/* Pin Preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-gray-100 to-gray-50 h-52 flex items-center justify-center text-7xl relative">
          {pin.imageEmoji}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/95 shadow px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700">
            <FormatIcon className="w-3.5 h-3.5 text-[#e60023]" />
            {FORMAT_LABEL[pin.format]}
          </div>
        </div>
        <div className="p-5">
          <h2 className="text-lg font-bold text-gray-900 leading-snug">{pin.title}</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{pin.description}</p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-9 h-9 rounded-full bg-[#e60023]/10 text-[#e60023] flex items-center justify-center font-bold text-sm">
              {pin.creatorName.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{pin.creatorName}</div>
              <div className="text-xs text-gray-400">{pin.creatorHandle}</div>
            </div>
            <div className="ml-auto">
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-full font-medium">{pin.boardName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pin Saves" value={formatNumber(pin.saves)} icon={Bookmark} color="bg-[#e60023]/10 text-[#e60023]" />
        <StatCard label="Link Clicks" value={formatNumber(pin.clicks)} icon={MousePointerClick} color="bg-blue-50 text-blue-600" />
        <StatCard label="Impressions" value={formatNumber(pin.impressions)} icon={Eye} color="bg-purple-50 text-purple-600" />
        <StatCard label="Close-ups" value={formatNumber(pin.closeups)} icon={Search} color="bg-green-50 text-green-600" />
      </div>

      {/* Engagement + Date */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-gray-900 text-sm">Performance Overview</h3>
        <div className="flex items-center justify-between py-2 border-b border-gray-50">
          <span className="text-sm text-gray-500">Engagement Rate</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-green-600">{pin.engagementRate}%</span>
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-50">
          <span className="text-sm text-gray-500">Date Posted</span>
          <span className="text-sm font-semibold text-gray-800">
            {format(parseISO(pin.postedAt), "MMMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-50">
          <span className="text-sm text-gray-500">Time Since Posted</span>
          <span className="text-sm font-semibold text-gray-800">
            {formatDistanceToNow(parseISO(pin.postedAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-500">Category</span>
          <span className="text-sm font-semibold text-gray-800">{pin.category}</span>
        </div>
      </div>

      {/* Keywords Used */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900 text-sm">Keywords Used on This Pin</h3>
          <span className="ml-auto text-xs text-gray-400">{pin.keywords.length} keywords</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pin.keywords.map((k) => (
            <span key={k.keyword} className="text-xs px-2.5 py-1.5 rounded-lg border font-medium bg-gray-100 text-gray-700 border-gray-200">
              {k.keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Live pin card (real Pinterest API data) ───────────────────────────────────
const CREATIVE_ICON: Record<string, React.ElementType> = {
  VIDEO: Film, IDEA: Lightbulb, CAROUSEL: LayoutGrid,
  REGULAR: ImageIcon, SHOPPING: Tag,
};

function LivePinCard({ pin, selected, onClick }: { pin: LivePin; selected: boolean; onClick: () => void }) {
  const Icon = CREATIVE_ICON[pin.creativeType] ?? ImageIcon;
  const createdLabel = pin.createdAt
    ? formatDistanceToNow(new Date(pin.createdAt), { addSuffix: true })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border transition-all bg-white shadow-sm overflow-hidden",
        selected ? "border-[#e60023] shadow-md ring-1 ring-[#e60023]/20" : "border-gray-100 hover:border-gray-200 hover:shadow"
      )}
    >
      {pin.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pin.thumbnailUrl} alt={pin.altText || pin.title} className="w-full h-36 object-cover" />
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
          <Icon className="w-8 h-8 text-gray-300" />
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
          {pin.title || pin.description.slice(0, 80)}
        </p>
        {pin.pinnerUsername && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <User className="w-3 h-3" />
            @{pin.pinnerUsername}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
            <Icon className="w-2.5 h-2.5 inline mr-0.5" />
            {pin.creativeType.toLowerCase()}
          </span>
          {createdLabel && <span className="text-[10px] text-gray-400">{createdLabel}</span>}
        </div>
      </div>
    </button>
  );
}

function LivePinDetail({ pin }: { pin: LivePin }) {
  const Icon = CREATIVE_ICON[pin.creativeType] ?? ImageIcon;
  const createdLabel = pin.createdAt
    ? format(new Date(pin.createdAt), "MMMM d, yyyy")
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {pin.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin.thumbnailUrl} alt={pin.altText || pin.title} className="w-full h-64 object-cover" />
        ) : (
          <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
            <Icon className="w-14 h-14 text-gray-200" />
          </div>
        )}
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-bold text-gray-900 leading-snug">
            {pin.title || "(No title)"}
          </h2>
          {pin.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{pin.description}</p>
          )}
          {pin.pinnerUsername && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#e60023]/10 text-[#e60023] flex items-center justify-center font-bold text-sm">
                {pin.pinnerUsername.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-gray-800">@{pin.pinnerUsername}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Pin Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Format</span>
            <span className="flex items-center gap-1.5 font-semibold text-gray-800 capitalize">
              <Icon className="w-3.5 h-3.5 text-[#e60023]" />
              {pin.creativeType.toLowerCase().replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Media type</span>
            <span className="font-semibold text-gray-800 capitalize">{pin.mediaType}</span>
          </div>
          {createdLabel && (
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Created</span>
              <span className="font-semibold text-gray-800">{createdLabel}</span>
            </div>
          )}
          {pin.link && (
            <div className="flex items-start justify-between py-2 border-b border-gray-50 gap-3">
              <span className="text-gray-500 flex-shrink-0">Destination</span>
              <a href={pin.link} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs break-all flex items-center gap-1">
                {pin.link.slice(0, 50)}{pin.link.length > 50 ? "…" : ""}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
          {pin.altText && (
            <div className="flex items-start justify-between py-2 gap-3">
              <span className="text-gray-500 flex-shrink-0">Alt text</span>
              <span className="text-gray-700 text-xs text-right">{pin.altText}</span>
            </div>
          )}
        </div>
      </div>

      <a href={pin.pinUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#e60023] text-white text-sm font-semibold hover:bg-[#ad081b] transition-colors">
        View on Pinterest <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}

export default function PinAnalysisPage() {
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinResult, setPinResult] = useState<PinData | null>(null);
  const [keywordResults, setKeywordResults] = useState<PinData[]>([]);
  const [livePins, setLivePins] = useState<LivePin[]>([]);
  const [selectedLivePin, setSelectedLivePin] = useState<LivePin | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [searched, setSearched] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const isUrl = (val: string) =>
    val.startsWith("http") || val.startsWith("pinterest.com") || val.includes("/pin/");

  const handleSearch = async () => {
    const val = inputValue.trim();
    if (!val) return;

    const detectedMode: SearchMode = isUrl(val) ? "url" : "keyword";
    setMode(detectedMode);
    setLoading(true);
    setPinResult(null);
    setKeywordResults([]);
    setLivePins([]);
    setSelectedPin(null);
    setSelectedLivePin(null);
    setSearched(true);
    setLiveError(null);

    if (detectedMode === "url") {
      setTimeout(() => {
        const pin = getPinByUrl(val);
        setPinResult(pin);
        setSelectedPin(pin);
        setLoading(false);
      }, 800);
    } else {
      // Try real Pinterest API first
      try {
        const res = await fetch(`/api/pin-search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.pins && data.pins.length > 0) {
          setLivePins(data.pins);
          setSelectedLivePin(data.pins[0]);
          setLoading(false);
          return;
        }
        if (data.error && data.error !== "Pinterest not connected") {
          setLiveError(data.error);
        }
      } catch { /* fall through to mock */ }

      // Fallback to mock data
      const pins = searchPinsByKeyword(val);
      setKeywordResults(pins);
      if (pins.length > 0) setSelectedPin(pins[0]);
      setLoading(false);
    }
  };

  const EXAMPLE_PINS = ["pin_001", "pin_003", "pin_005"];
  const EXAMPLE_KEYWORDS = ["bedroom", "workout", "skin care", "wedding decor", "healthy recipes"];

  return (
    <div>
      <Header
        title="Pin Analysis"
        subtitle="Analyze any pin's performance metrics and keywords, or discover top-performing pins by keyword"
      />
      <div className="p-6 space-y-5">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-4">
            {([
              { key: "keyword", label: "🔍 Search by Keyword", desc: "Find top-performing pins" },
              { key: "url", label: "🔗 Analyze Pin URL", desc: "Inspect a specific pin" },
            ] as { key: SearchMode; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setInputValue(""); setSearched(false); setPinResult(null); setKeywordResults([]); setSelectedPin(null); }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  mode === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              {mode === "url" ? (
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              ) : (
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              )}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={
                  mode === "url"
                    ? "Paste a Pinterest pin URL (e.g. https://pinterest.com/pin/123456789)"
                    : "Enter a keyword to find top-performing pins (e.g. minimalist bedroom)"
                }
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
              {inputValue && (
                <button
                  onClick={() => { setInputValue(""); setSearched(false); setPinResult(null); setKeywordResults([]); setSelectedPin(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={!inputValue.trim()}
              className="bg-[#e60023] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {mode === "url" ? <BarChart2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {mode === "url" ? "Analyze Pin" : "Find Pins"}
            </button>
          </div>

          {/* Quick examples */}
          {!searched && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Try:</span>
              {mode === "keyword"
                ? EXAMPLE_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      onClick={() => { setInputValue(kw); }}
                      className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-[#e60023]/10 hover:text-[#e60023] transition-colors font-medium"
                    >
                      {kw}
                    </button>
                  ))
                : EXAMPLE_PINS.map((id) => (
                    <button
                      key={id}
                      onClick={() => { setInputValue(`https://pinterest.com/${id}`); }}
                      className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-[#e60023]/10 hover:text-[#e60023] transition-colors font-medium"
                    >
                      pinterest.com/{id}
                    </button>
                  ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#e60023]/20 border-t-[#e60023] rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-500">
              {mode === "url" ? "Fetching pin data..." : "Finding top-performing pins..."}
            </p>
          </div>
        )}

        {/* URL Mode — Single Pin Result */}
        {!loading && pinResult && mode === "url" && (
          <div className="max-w-2xl mx-auto">
            <PinDetail pin={pinResult} onClose={() => { setPinResult(null); setSearched(false); }} />
          </div>
        )}

        {/* Live Pins from Pinterest API */}
        {!loading && livePins.length > 0 && mode === "keyword" && (
          <div className="grid grid-cols-5 gap-5">
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {livePins.length} Pins Found
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">● Live</span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {livePins.map(pin => (
                  <LivePinCard
                    key={pin.id}
                    pin={pin}
                    selected={selectedLivePin?.id === pin.id}
                    onClick={() => setSelectedLivePin(pin)}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-3">
              {selectedLivePin && (
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-sm">Pin Details</h3>
                  </div>
                  <LivePinDetail pin={selectedLivePin} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live pin error banner */}
        {liveError && !loading && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{liveError}</span>
          </div>
        )}

        {/* Keyword Mode — List + Detail (mock fallback) */}
        {!loading && keywordResults.length > 0 && mode === "keyword" && livePins.length === 0 && (
          <div className="grid grid-cols-5 gap-5">
            {/* Left: Pin List */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Top {keywordResults.length} Performing Pins
                </h3>
                <span className="text-xs text-gray-400">sorted by saves</span>
              </div>
              {keywordResults.map((pin) => (
                <div
                  key={pin.id}
                  onClick={() => setSelectedPin(pin)}
                  className={cn(
                    "cursor-pointer rounded-2xl border transition-all bg-white shadow-sm p-4",
                    selectedPin?.id === pin.id
                      ? "border-[#e60023] shadow-md ring-1 ring-[#e60023]/20"
                      : "border-gray-100 hover:border-gray-200 hover:shadow"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {pin.imageEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{pin.title}</div>
                      <div className="text-xs text-gray-400 mt-1">{pin.creatorHandle} · {pin.boardName}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    <div className="text-center bg-gray-50 rounded-lg p-1.5">
                      <div className="text-xs font-bold text-gray-900">{formatNumber(pin.saves)}</div>
                      <div className="text-xs text-gray-400">Saves</div>
                    </div>
                    <div className="text-center bg-gray-50 rounded-lg p-1.5">
                      <div className="text-xs font-bold text-gray-900">{formatNumber(pin.clicks)}</div>
                      <div className="text-xs text-gray-400">Clicks</div>
                    </div>
                    <div className="text-center bg-gray-50 rounded-lg p-1.5">
                      <div className="text-xs font-bold text-gray-900">{formatNumber(pin.impressions)}</div>
                      <div className="text-xs text-gray-400">Impr.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(pin.postedAt), "MMM d, yyyy")}
                    <span className="ml-auto text-xs font-semibold text-green-600">
                      {pin.engagementRate}% ER
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Selected Pin Detail */}
            <div className="col-span-3">
              {selectedPin && (
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-sm">Pin Details</h3>
                    <a
                      href={selectedPin.pinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#e60023] hover:underline"
                    >
                      View on Pinterest <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                  <PinDetail pin={selectedPin} onClose={() => setSelectedPin(null)} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !searched && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center text-center px-6">
            <div className="w-16 h-16 bg-[#e60023]/8 rounded-2xl flex items-center justify-center mb-4">
              <BarChart2 className="w-7 h-7 text-[#e60023]" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">Analyze Any Pin or Keyword</h3>
            <p className="text-sm text-gray-400 max-w-md">
              Paste a Pinterest pin URL to see its full performance data and keywords, or search by keyword to discover the top-performing pins in any niche.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8 max-w-lg w-full">
              {[
                { icon: Link2, title: "Pin URL Analysis", desc: "See keywords used, saves, clicks, impressions, and post date for any specific pin.", color: "bg-orange-50 text-orange-600" },
                { icon: Hash, title: "Keyword Pin Search", desc: "Find the highest-performing pins for any keyword and study what makes them successful.", color: "bg-purple-50 text-purple-600" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="text-left bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">{title}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && searched && keywordResults.length === 0 && !pinResult && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-14 flex flex-col items-center text-center">
            <Search className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No pins found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different keyword or pin URL</p>
          </div>
        )}
      </div>
    </div>
  );
}
