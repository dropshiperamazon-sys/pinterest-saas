"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  Plus, Calendar, Clock, Link2, Image as ImageIcon,
  CheckCircle2, Trash2, Edit2, X, ExternalLink,
  Sparkles, Zap, Tag, ChevronDown, ChevronUp,
  Copy, AlertCircle, LayoutGrid, ShoppingCart,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface PinDraft {
  id: string;
  title: string;
  description: string;
  board: string;
  boards: string[]; // multi-board selection
  link: string;
  date: string;
  time: string;
  status: "draft" | "scheduled" | "published";
  imageUrl: string;
  pinType: "promotional" | "inspirational" | "educational" | "";
  topics: string[];
  taggedProducts: { url: string; image?: string; title?: string }[];
}

interface ScheduledPin {
  id: string;
  title: string;
  board: string;
  scheduledAt: string;
  status: string;
  imageUrl: string;
  description?: string;
  link?: string;
}

const FALLBACK_BOARDS = [
  "Home Decor", "Food & Recipes", "Fitness", "Interior Design",
  "DIY & Crafts", "Fashion", "Travel", "Weddings", "Beauty",
  "Gardening", "Lifestyle", "Business Tips",
];

const BEST_TIMES: { label: string; level: "most" | "medium" | "low" }[] = [
  { label: "8:00 AM",  level: "most"   },
  { label: "12:00 PM", level: "most"   },
  { label: "2:00 PM",  level: "medium" },
  { label: "5:00 PM",  level: "most"   },
  { label: "8:00 PM",  level: "medium" },
  { label: "9:00 PM",  level: "low"    },
];

const TIME_LEVEL_STYLE: Record<"most" | "medium" | "low", string> = {
  most:   "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200",
  medium: "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200",
  low:    "bg-gray-100  text-gray-500  hover:bg-gray-200  border border-gray-200",
};

const TIME_LEVEL_DOT: Record<"most" | "medium" | "low", string> = {
  most:   "bg-green-500",
  medium: "bg-amber-400",
  low:    "bg-gray-400",
};

// ── AI Generation ──────────────────────────────────────────────────────────────

function generateAiContent(keywords: string, pinType: "promotional" | "inspirational" | "educational"): { title: string; description: string } {
  const kws = keywords.split(",").map((k) => k.trim()).filter(Boolean);
  const primary = kws[0] || "your topic";
  const secondary = kws[1] || "";
  const year = new Date().getFullYear();

  if (pinType === "promotional") {
    const promoTitles = [
      `Shop Our Best ${primary.charAt(0).toUpperCase() + primary.slice(1)} Collection — Limited Time!`,
      `${primary.charAt(0).toUpperCase() + primary.slice(1)} Deals You Can't Miss This Season`,
      `Upgrade Your ${primary} Today — Top Picks ${year}`,
      `Get the Best ${primary} for Less — Shop Now`,
      `${primary.charAt(0).toUpperCase() + primary.slice(1)} Essentials You Need Right Now`,
    ];
    const promoDescs = [
      `Discover our handpicked selection of ${primary}${secondary ? ` and ${secondary}` : ""}. Loved by thousands of happy customers. Limited stock available — grab yours before it sells out! Click to shop now and save big.`,
      `Looking for the best ${primary}? We've got you covered. ${secondary ? `From ${secondary} to` : "From starter picks to"} premium options — shop our curated collection now. Free shipping on orders over $50. Don't miss out!`,
      `Transform your everyday routine with our top-rated ${primary}. ${secondary ? `Pairs perfectly with ${secondary}.` : ""} Shop the collection that everyone is talking about. Use code PINTEREST10 for 10% off!`,
    ];
    return {
      title: promoTitles[Math.floor(Math.random() * promoTitles.length)],
      description: promoDescs[Math.floor(Math.random() * promoDescs.length)],
    };
  } else if (pinType === "educational") {
    const eduTitles = [
      `How to Master ${primary.charAt(0).toUpperCase() + primary.slice(1)} — Step by Step Guide`,
      `Everything You Need to Know About ${primary.charAt(0).toUpperCase() + primary.slice(1)} in ${year}`,
      `${primary.charAt(0).toUpperCase() + primary.slice(1)} 101: Beginner to Pro`,
      `Top ${primary.charAt(0).toUpperCase() + primary.slice(1)} Tips Experts Swear By`,
      `The Complete ${primary.charAt(0).toUpperCase() + primary.slice(1)} Tutorial for ${year}`,
    ];
    const eduDescs = [
      `Want to learn ${primary}${secondary ? ` and ${secondary}` : ""}? This step-by-step guide breaks it all down for you — from basics to advanced techniques. Save this pin and share it with anyone who wants to level up their skills! 📚\n\n#${primary.replace(/\s+/g, "")} #learnon${primary.replace(/\s+/g, "")} #education`,
      `Did you know these ${primary} tips could change everything? We break down the most important things to know so you can avoid common mistakes and get results faster. Bookmark this for your learning journey! 🎓${secondary ? `\n\n#${secondary.replace(/\s+/g, "")}` : ""} #${primary.replace(/\s+/g, "")} #howto`,
      `Learning ${primary} doesn't have to be hard. This easy-to-follow guide covers the essentials${secondary ? `, including ${secondary},` : ""} so you can start seeing results right away. Follow for more helpful tips! 💡\n\n#${primary.replace(/\s+/g, "")} #tutorial #tips${year}`,
    ];
    return {
      title: eduTitles[Math.floor(Math.random() * eduTitles.length)],
      description: eduDescs[Math.floor(Math.random() * eduDescs.length)],
    };
  } else {
    const insprTitles = [
      `${kws.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(" + ")} Ideas That Will Inspire You`,
      `Beautiful ${primary.charAt(0).toUpperCase() + primary.slice(1)} Inspiration for ${year}`,
      `The Ultimate ${primary.charAt(0).toUpperCase() + primary.slice(1)} Guide — Ideas & Tips`,
      `${primary.charAt(0).toUpperCase() + primary.slice(1)} Aesthetic That Will Transform Your Life`,
      `Creative ${primary.charAt(0).toUpperCase() + primary.slice(1)} Ideas You Haven't Seen Before`,
    ];
    const insprDescs = [
      `Feeling uninspired? These stunning ${primary} ideas will spark your creativity and help you reimagine what's possible. Save this pin for later and share with someone who needs a little inspiration today! ✨${secondary ? `\n\n#${secondary.replace(/\s+/g, "")} ` : ""}#${primary.replace(/\s+/g, "")} #inspiration #${year}`,
      `There's something magical about great ${primary}${secondary ? ` paired with ${secondary}` : ""}. We curated the most beautiful examples to help you find your perfect aesthetic. Which one speaks to you? Drop a comment below! 💕\n\n#${primary.replace(/\s+/g, "")} #aesthetic #inspo`,
      `Your dream ${primary} starts here. From beginner tips to advanced ideas, this guide covers everything you need to know. Bookmark this pin — you'll come back to it again and again. 🌟\n\n#${primary.replace(/\s+/g, "")} #howto #tips`,
    ];
    return {
      title: insprTitles[Math.floor(Math.random() * insprTitles.length)],
      description: insprDescs[Math.floor(Math.random() * insprDescs.length)],
    };
  }
}

function newDraft(): PinDraft {
  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: "",
    description: "",
    board: "",
    boards: [],
    link: "",
    date: "",
    time: "",
    status: "draft",
    imageUrl: "📌",
    pinType: "",
    topics: [],
    taggedProducts: [],
  };
}

const DRAFTS_STORAGE_KEY = "mypinpro_drafts";

// ── AI Modal ───────────────────────────────────────────────────────────────────

function AiModal({
  onApply,
  onClose,
}: {
  onApply: (title: string, description: string, pinType: "promotional" | "inspirational" | "educational") => void;
  onClose: () => void;
}) {
  const [keywords, setKeywords] = useState("");
  const [pinType, setPinType] = useState<"promotional" | "inspirational" | "educational" | "">("");
  const [generated, setGenerated] = useState<{ title: string; description: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = () => {
    if (!keywords.trim()) { setError("Please enter at least one keyword."); return; }
    if (!pinType) { setError("Please select a pin type."); return; }
    setError("");
    setGenerating(true);
    setTimeout(() => {
      setGenerated(generateAiContent(keywords, pinType as "promotional" | "inspirational" | "educational"));
      setGenerating(false);
    }, 1200);
  };

  const handleRegenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerated(generateAiContent(keywords, pinType as "promotional" | "inspirational" | "educational"));
      setGenerating(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">AI Generator</div>
              <div className="text-xs text-gray-400">Generate title & description with AI</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: Pin Type */}
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">
              Step 1 — Pin Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {([
                {
                  key: "promotional",
                  label: "🛍️ Promotional",
                  desc: "Sell products, drive traffic, promote offers",
                  color: "border-orange-300 bg-orange-50",
                  selected: "border-orange-500 bg-orange-50 ring-2 ring-orange-200",
                },
                {
                  key: "inspirational",
                  label: "✨ Inspirational",
                  desc: "Inspire, build brand awareness",
                  color: "border-purple-300 bg-purple-50",
                  selected: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
                },
                {
                  key: "educational",
                  label: "📚 Educational",
                  desc: "Teach, guide, share knowledge",
                  color: "border-blue-300 bg-blue-50",
                  selected: "border-blue-500 bg-blue-50 ring-2 ring-blue-200",
                },
              ] as const).map(({ key, label, desc, color, selected }) => (
                <button
                  key={key}
                  onClick={() => setPinType(key)}
                  className={cn(
                    "text-left p-4 border-2 rounded-xl transition-all",
                    pinType === key ? selected : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="text-sm font-semibold text-gray-800 mb-1">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Keywords */}
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">
              Step 2 — Target Keywords
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. minimalist bedroom, home decor, cozy aesthetic"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Separate multiple keywords with commas</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </>
            )}
          </button>

          {/* Generated Output */}
          {generated && !generating && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated Content</span>
                <button
                  onClick={handleRegenerate}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  Regenerate
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Pin Title</label>
                <div className="bg-gray-50 rounded-xl p-3 text-sm font-medium text-gray-800 border border-gray-100">
                  {generated.title}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Pin Description</label>
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 border border-gray-100 whitespace-pre-wrap leading-relaxed">
                  {generated.description}
                </div>
              </div>

              <button
                onClick={() => onApply(generated.title, generated.description, pinType as "promotional" | "inspirational")}
                className="w-full bg-[#e60023] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Use This Content
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SmartSchedule Panel ────────────────────────────────────────────────────────

const DAILY_SLOTS: { label: string; short: string; color: string; text: string }[] = [
  { label: "8:00 AM",  short: "8a",  color: "bg-green-100 hover:bg-green-500", text: "text-green-700 hover:text-white" },
  { label: "12:00 PM", short: "12p", color: "bg-green-100 hover:bg-green-500", text: "text-green-700 hover:text-white" },
  { label: "2:00 PM",  short: "2p",  color: "bg-amber-100 hover:bg-amber-500", text: "text-amber-700 hover:text-white" },
  { label: "5:00 PM",  short: "5p",  color: "bg-green-100 hover:bg-green-500", text: "text-green-700 hover:text-white" },
];

function getMonthDays(): { dateStr: string; label: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let d = today; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    days.push({ dateStr, label });
  }
  return days;
}

function slotTo24h(slot: string): string {
  const [time, mer] = slot.split(" ");
  const [h, m] = time.split(":").map(Number);
  let h24 = h % 12;
  if (mer === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function SmartSchedulePanel({ onApply, scheduled }: {
  onApply: (date: string, time: string) => void;
  scheduled: { id: string; scheduledAt: string; imageUrl?: string; title: string }[];
}) {
  const days = getMonthDays();
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // index scheduled pins by date string
  const pinsByDate: Record<string, { imageUrl?: string; title: string }[]> = {};
  for (const p of scheduled) {
    const d = p.scheduledAt.split("T")[0];
    if (!pinsByDate[d]) pinsByDate[d] = [];
    pinsByDate[d].push({ imageUrl: p.imageUrl, title: p.title });
  }

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
      {/* Month header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{monthLabel}</span>
        <span className="text-[10px] text-gray-400">Click to apply</span>
      </div>

      {/* Column labels */}
      <div className="px-3 pb-1">
        <div className="grid grid-cols-[76px_1fr_1fr_1fr_1fr] gap-1">
          <div />
          {DAILY_SLOTS.map((s) => (
            <div key={s.label} className="text-[9px] font-semibold text-gray-400 text-center">{s.short}</div>
          ))}
        </div>
      </div>

      {/* Day rows */}
      <div className="px-3 pb-4 space-y-1.5">
        {days.map(({ dateStr, label }) => {
          const pins = pinsByDate[dateStr] ?? [];
          return (
            <div key={dateStr}>
              <div className="grid grid-cols-[76px_1fr_1fr_1fr_1fr] gap-1 items-center">
                <div className="text-[10px] text-gray-600 font-medium truncate pr-1 leading-tight">{label}</div>
                {DAILY_SLOTS.map((slot) => (
                  <button
                    key={slot.label}
                    onClick={() => onApply(dateStr, slotTo24h(slot.label))}
                    className={cn("text-[9px] rounded-md py-1.5 font-semibold transition-colors text-center", slot.color, slot.text)}
                  >
                    {slot.short}
                  </button>
                ))}
              </div>
              {/* Scheduled thumbnails for this day */}
              {pins.length > 0 && (
                <div className="flex gap-1 mt-1 pl-[76px] flex-wrap">
                  {pins.map((p, i) => (
                    <div key={i} title={p.title} className="w-7 h-7 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                      {p.imageUrl && p.imageUrl.startsWith("http") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px]">📌</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Single Draft Card ──────────────────────────────────────────────────────────

function DraftCard({
  draft,
  index,
  onChange,
  onRemove,
  onAiOpen,
  onSchedule,
  isScheduling = false,
  isOnly,
  boards,
  boardsLoading,
}: {
  draft: PinDraft;
  index: number;
  onChange: (updated: PinDraft) => void;
  onRemove: () => void;
  onAiOpen: () => void;
  onSchedule: () => void;
  isScheduling?: boolean;
  isOnly: boolean;
  boards: { id: string; name: string }[];
  boardsLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [boardOpen, setBoardOpen] = useState(false);
  const [customSlots, setCustomSlots] = useState<string[]>([]);
  const [addingSlot, setAddingSlot] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState("");
  const [interests, setInterests] = useState<{ id: string; name: string; isCategory?: boolean; parent?: string }[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [interestsFetched, setInterestsFetched] = useState(false);
  const [topicFilter, setTopicFilter] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<{ id: string; title: string; imageUrl: string; link: string }[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productMode, setProductMode] = useState<"search" | "link">("search");
  const [productLinkInput, setProductLinkInput] = useState("");
  const [linkPreview, setLinkPreview] = useState<{ image: string | null; title: string } | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const set = (field: keyof PinDraft, value: string) =>
    onChange({ ...draft, [field]: value });

  const toggleBoard = (name: string) => {
    const current = draft.boards ?? [];
    const next = current.includes(name) ? current.filter((b) => b !== name) : [...current, name];
    onChange({ ...draft, boards: next, board: next[0] ?? "" });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) setBoardOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const timeToInput = (label: string) => {
    const match = label.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return "";
    let h = parseInt(match[1]);
    const pm = match[3].toUpperCase() === "PM";
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${match[2]}`;
  };

  return (
    <div className={cn(
      "bg-white rounded-2xl border shadow-sm transition-all",
      draft.pinType === "promotional" ? "border-orange-200" : draft.pinType === "inspirational" ? "border-purple-200" : "border-gray-100"
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-50">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0",
          draft.pinType === "promotional" ? "bg-orange-100 text-orange-600" :
          draft.pinType === "inspirational" ? "bg-purple-100 text-purple-600" :
          "bg-gray-100 text-gray-500"
        )}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">
            {draft.title || <span className="text-gray-400 font-normal">Untitled Pin</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {draft.pinType && (
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                draft.pinType === "promotional" ? "bg-orange-100 text-orange-600" : draft.pinType === "educational" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
              )}>
                {draft.pinType === "promotional" ? "🛍️ Promotional" : draft.pinType === "educational" ? "📚 Educational" : "✨ Inspirational"}
              </span>
            )}
            {draft.date && draft.time && (
              <span className="text-xs text-gray-400">
                {format(new Date(`${draft.date}T${draft.time}`), "MMM d · h:mm a")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onAiOpen}
            title="Generate with AI"
            className="p-1.5 rounded-lg bg-gradient-to-r from-violet-100 to-purple-100 text-purple-600 hover:from-violet-200 hover:to-purple-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {!isOnly && (
            <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Image Upload — first so users pick the image before filling details */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Pin Image</label>
            {draft.imageUrl && draft.imageUrl.startsWith("data:") ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 w-4/5 mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.imageUrl} alt="Pin preview" className="w-full h-auto object-contain max-h-72" />
                <button
                  onClick={() => set("imageUrl", "")}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-[#e60023]/40 hover:bg-[#e60023]/5 transition-colors cursor-pointer">
                <ImageIcon className="w-6 h-6 text-gray-300" />
                <span className="text-xs text-gray-400">Drop image or click to upload</span>
                <span className="text-xs text-gray-300">PNG, JPG, WEBP up to 10MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (ev.target?.result) set("imageUrl", ev.target.result as string);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            )}
          </div>

          {/* Pin Type — only shown after AI Generate sets it */}
          {draft.pinType && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Pin Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(["promotional", "inspirational", "educational"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => set("pinType", draft.pinType === type ? "" : type)}
                    className={cn(
                      "py-2 px-2 rounded-xl border text-xs font-semibold transition-all",
                      draft.pinType === type
                        ? type === "promotional"
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : type === "educational"
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-purple-400 bg-purple-50 text-purple-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    {type === "promotional" ? "🛍️ Promo" : type === "educational" ? "📚 Edu" : "✨ Inspo"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500">Pin Title *</label>
              <button
                onClick={onAiOpen}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                <Sparkles className="w-3 h-3" />
                AI Generate
              </button>
            </div>
            <input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Enter a compelling pin title..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Description</label>
            <textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe what this pin is about... (keywords help with reach)"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Board — multi-select dropdown */}
            <div ref={boardRef} className="relative">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Board{(draft.boards?.length ?? 0) > 1 && (
                  <span className="ml-1 text-[#e60023]">({draft.boards.length} boards · 2-week interval)</span>
                )}
              </label>
              <button
                type="button"
                onClick={() => setBoardOpen((o) => !o)}
                disabled={boardsLoading}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-left flex items-center justify-between disabled:opacity-60 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              >
                <span className="truncate text-gray-700">
                  {boardsLoading ? "Loading..." : (draft.boards?.length ? draft.boards.join(", ") : "Select boards…")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
              </button>
              {boardOpen && !boardsLoading && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {boards.map((b) => {
                    const checked = draft.boards?.includes(b.name);
                    return (
                      <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!checked}
                          onChange={() => toggleBoard(b.name)}
                          className="accent-[#e60023] w-3.5 h-3.5"
                        />
                        <span className="text-sm text-gray-700">{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* URL */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Destination URL</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  value={draft.link}
                  onChange={(e) => set("link", e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                />
              </div>
            </div>
          </div>

          {/* Topics — from Pinterest interests via OAuth */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500">
                Topics <span className="text-gray-300 font-normal">({draft.topics.length}/10)</span>
              </label>
              <span className="text-[10px] text-gray-400">Hidden from viewers</span>
            </div>
            {/* Selected topic chips */}
            {draft.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {draft.topics.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                    {t}
                    <button onClick={() => onChange({ ...draft, topics: draft.topics.filter((x) => x !== t) })} className="hover:text-blue-900">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Search + load interests */}
            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                value={topicFilter}
                onChange={(e) => {
                  setTopicFilter(e.target.value);
                  if (!interestsFetched) {
                    setInterestsLoading(true);
                    setInterestsFetched(true);
                    fetch("/api/pinterest-interests")
                      .then(r => r.json())
                      .then(d => setInterests(d.interests ?? []))
                      .catch(() => {})
                      .finally(() => setInterestsLoading(false));
                  }
                }}
                onFocus={() => {
                  if (!interestsFetched) {
                    setInterestsLoading(true);
                    setInterestsFetched(true);
                    fetch("/api/pinterest-interests")
                      .then(r => r.json())
                      .then(d => setInterests(d.interests ?? []))
                      .catch(() => {})
                      .finally(() => setInterestsLoading(false));
                  }
                }}
                placeholder="Search for a topic…"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            {/* Dropdown of Pinterest interests */}
            {(interestsLoading || interests.length > 0) && (
              <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-sm max-h-36 overflow-y-auto">
                {interestsLoading ? (
                  <div className="px-3 py-3 text-xs text-gray-400 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-[#e60023] rounded-full animate-spin" />
                    Loading from Pinterest…
                  </div>
                ) : (() => {
                  const filtered = interests.filter(i =>
                    i.name.toLowerCase().includes(topicFilter.toLowerCase()) && !draft.topics.includes(i.name)
                  );
                  // When searching, show flat list; when not, show grouped with category headers
                  if (topicFilter.trim()) {
                    return filtered.slice(0, 30).map(i => (
                      <button
                        key={i.id}
                        onClick={() => {
                          if (draft.topics.length < 10) {
                            onChange({ ...draft, topics: [...draft.topics, i.name] });
                            setTopicFilter("");
                          }
                        }}
                        disabled={draft.topics.length >= 10}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-40"
                      >
                        {i.isCategory ? <span className="font-semibold">{i.name}</span> : <span className="pl-1 text-gray-600">{i.name}</span>}
                      </button>
                    ));
                  }
                  return interests
                    .filter(i => !draft.topics.includes(i.name))
                    .map(i => i.isCategory ? (
                      <div key={i.id} className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 sticky top-0">
                        {i.name}
                      </div>
                    ) : (
                      <button
                        key={i.id}
                        onClick={() => {
                          if (draft.topics.length < 10) {
                            onChange({ ...draft, topics: [...draft.topics, i.name] });
                            setTopicFilter("");
                          }
                        }}
                        disabled={draft.topics.length >= 10}
                        className="w-full text-left pl-5 pr-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-40"
                      >
                        {i.name}
                      </button>
                    ));
                })()}
              </div>
            )}
          </div>

          {/* Tag Products — Pinterest product search */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Tag Products</label>
            {/* Tagged products chips */}
            {draft.taggedProducts.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {draft.taggedProducts.map((p) => (
                  <div key={p.url} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-2 py-1.5">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.title || ""} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-orange-100" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                    )}
                    <span className="text-xs text-orange-700 font-medium truncate flex-1">{p.title || p.url}</span>
                    <button onClick={() => onChange({ ...draft, taggedProducts: draft.taggedProducts.filter((x) => x.url !== p.url) })} className="hover:text-orange-900 flex-shrink-0">
                      <X className="w-3 h-3 text-orange-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input
                    value={productLinkInput}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setProductLinkInput(val);
                      setLinkPreview(null);
                      const trimmed = val.trim();
                      if (trimmed.startsWith("http")) {
                        setLinkPreviewLoading(true);
                        try {
                          const res = await fetch(`/api/fetch-link-preview?url=${encodeURIComponent(trimmed)}`);
                          const data = await res.json();
                          if (data.image || data.title) setLinkPreview({ image: data.image, title: data.title });
                        } catch { /* ignore */ } finally {
                          setLinkPreviewLoading(false);
                        }
                      }
                    }}
                    placeholder="Paste product URL…"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                  />
                  <button
                    onClick={() => {
                      const url = productLinkInput.trim();
                      if (url && !draft.taggedProducts.find((x) => x.url === url)) {
                        onChange({ ...draft, taggedProducts: [...draft.taggedProducts, { url, image: linkPreview?.image ?? undefined, title: linkPreview?.title || undefined }] });
                      }
                      setProductLinkInput("");
                      setLinkPreview(null);
                    }}
                    disabled={!productLinkInput.trim()}
                    className="px-3 py-2 bg-[#e60023] text-white text-xs font-semibold rounded-xl hover:bg-[#ad081b] disabled:opacity-40 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                {linkPreviewLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Fetching product…
                  </div>
                )}
                {linkPreview && !linkPreviewLoading && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2">
                    {linkPreview.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={linkPreview.image} alt="product" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                    )}
                    <span className="text-xs text-gray-700 line-clamp-2 flex-1">{linkPreview.title}</span>
                  </div>
                )}
                <p className="text-xs text-gray-400 px-1">You can add multiple product links — paste each URL and click Add.</p>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Date *</label>
              <input
                type="date"
                value={draft.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => set("date", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            {/* Time */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Time *</label>
              <input
                type="time"
                value={draft.time}
                min={draft.date === new Date().toISOString().split("T")[0] ? new Date().toTimeString().slice(0, 5) : undefined}
                onChange={(e) => set("time", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
          </div>

          {/* Schedule button */}
          <button
            onClick={onSchedule}
            disabled={!draft.title || !draft.date || !draft.time || isScheduling}
            className="w-full flex items-center justify-center gap-2 bg-[#e60023] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isScheduling ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scheduling…
              </>
            ) : (
              <>
                <Calendar className="w-3.5 h-3.5" />
                Schedule
              </>
            )}
          </button>

        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SchedulerPage() {
  const [scheduled, setScheduled] = useState<ScheduledPin[]>([]);
  const [drafts, setDrafts] = useState<PinDraft[]>(() => {
    if (typeof window === "undefined") return [newDraft(), newDraft(), newDraft()];
    try {
      const saved = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (saved) {
        const parsed: PinDraft[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [newDraft(), newDraft(), newDraft()];
  });
  const [activeTab, setActiveTab] = useState<"schedule" | "upcoming" | "published">("schedule");
  const [aiTarget, setAiTarget] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [successPopup, setSuccessPopup] = useState(false);
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [pinterestName, setPinterestName] = useState("");
  const { data: session } = useSession();

  useEffect(() => {
    // Load real Pinterest connection + boards + scheduled pins
    fetch("/api/pinterest-connection")
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected);
        setPinterestName(data.pinterestName || data.pinterestUsername || "");
        if (data.connected && data.accessToken) {
          return fetch("/api/pinterest-boards", {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          }).then((r) => r.json());
        }
        return fetch("/api/pinterest-boards").then((r) => r.json());
      })
      .then((data) => {
        if (!data) return;
        const list: { id: string; name: string }[] = data.boards?.length
          ? data.boards
          : FALLBACK_BOARDS.map((name) => ({ id: name, name }));
        setBoards(list);
        setDrafts((d) => d.map((dr) => (!dr.board && !dr.boards?.length) ? { ...dr, board: list[0].name } : dr));
      })
      .catch(() => {
        const list = FALLBACK_BOARDS.map((name) => ({ id: name, name }));
        setBoards(list);
        setDrafts((d) => d.map((dr) => (!dr.board && !dr.boards?.length) ? { ...dr, board: list[0].name } : dr));
      })
      .finally(() => setBoardsLoading(false));

    // Load real scheduled pins
    fetch("/api/schedule-pin")
      .then((r) => r.json())
      .then((data) => {
        if (data.pins) setScheduled(data.pins);
      })
      .catch(() => {});
  }, [session]);

  // Auto-save drafts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch { /* ignore quota errors */ }
  }, [drafts]);

  const addDraft = () => setDrafts((d) => [...d, newDraft()]);

  const updateDraft = (id: string, updated: PinDraft) =>
    setDrafts((d) => d.map((dr) => (dr.id === id ? updated : dr)));

  const removeDraft = (id: string) =>
    setDrafts((d) => d.filter((dr) => dr.id !== id));

  const applyAi = (title: string, description: string, pinType: "promotional" | "inspirational" | "educational") => {
    if (!aiTarget) return;
    setDrafts((d) =>
      d.map((dr) => dr.id === aiTarget ? { ...dr, title, description, pinType } : dr)
    );
    setAiTarget(null);
  };

  async function postPin(payload: object): Promise<ScheduledPin | null> {
    try {
      const res = await fetch("/api/schedule-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      return json.pin ?? null;
    } catch { return null; }
  }

  // Schedule a single draft — one POST per selected board, each 2 weeks apart
  const scheduleSingle = async (draftId: string) => {
    const d = drafts.find((dr) => dr.id === draftId);
    if (!d || !d.title || !d.date || !d.time) return;
    setSchedulingId(draftId);
    const boardList = d.boards?.length ? d.boards : [d.board || ""];
    const baseMs = new Date(`${d.date}T${d.time}:00`).getTime();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const saved: ScheduledPin[] = [];
    for (let i = 0; i < boardList.length; i++) {
      const scheduledAt = new Date(baseMs + i * TWO_WEEKS_MS).toISOString();
      const pin = await postPin({ title: d.title, description: d.description, imageUrl: d.imageUrl, board: boardList[i], link: d.link, pinType: d.pinType, taggedProducts: d.taggedProducts, scheduledAt });
      if (pin) saved.push(pin);
    }
    setSchedulingId(null);
    if (saved.length) {
      setScheduled((s) => [...saved, ...s]);
      setDrafts((prev) => prev.map((dr) => dr.id === draftId ? newDraft() : dr));
      setSuccessPopup(true);
      setTimeout(() => setSuccessPopup(false), 3000);
    }
  };

  // Schedule all valid drafts, expanding multi-board selections with 2-week intervals
  const scheduleAll = async () => {
    const valid = drafts.filter((d) => d.title && d.date && d.time);
    if (valid.length === 0) return;
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const saved: ScheduledPin[] = [];
    for (const d of valid) {
      const boardList = d.boards?.length ? d.boards : [d.board || ""];
      const baseMs = new Date(`${d.date}T${d.time}:00`).getTime();
      for (let i = 0; i < boardList.length; i++) {
        const scheduledAt = new Date(baseMs + i * TWO_WEEKS_MS).toISOString();
        const pin = await postPin({ title: d.title, description: d.description, imageUrl: d.imageUrl, board: boardList[i], link: d.link, pinType: d.pinType, taggedProducts: d.taggedProducts, scheduledAt });
        if (pin) saved.push(pin);
      }
    }
    setScheduled((s) => [...saved, ...s]);
    setDrafts([newDraft(), newDraft(), newDraft()]);
  };

  const deleteScheduled = async (id: string) => {
    setScheduled((s) => s.filter((p) => p.id !== id));
    try {
      await fetch("/api/schedule-pin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId: id }),
      });
    } catch { /* non-fatal */ }
  };

  const filtered = scheduled.filter((p) =>
    activeTab === "published" ? p.status === "published" : p.status === "scheduled"
  );
  const validDrafts = drafts.filter((d) => d.title && d.date && d.time).length;

  return (
    <div>
      {/* Success popup */}
      {successPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-green-200 px-8 py-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-lg font-bold text-gray-900">Scheduled!</div>
            <div className="text-sm text-gray-500 text-center">Your pin has been scheduled successfully.</div>
          </div>
        </div>
      )}
      {aiTarget && (
        <AiModal
          onApply={applyAi}
          onClose={() => setAiTarget(null)}
        />
      )}

      <Header title="Pin Scheduler" subtitle="Create and schedule multiple pins at once with AI-powered content generation" />

      <div className="p-6 space-y-5">
        {/* Connect Banner */}
        {!connected ? (
          <div className="bg-gradient-to-r from-[#e60023]/5 to-[#e60023]/10 border border-[#e60023]/20 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#e60023] rounded-xl flex items-center justify-center text-white text-xl font-bold">P</div>
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  Connect your Pinterest account
                  <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Required</span>
                </div>
                <div className="text-sm text-gray-500">Authorize My Pin Pro to publish and schedule pins on your behalf.</div>
              </div>
            </div>
            <a
              href="/connect"
              className="bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Connect with Pinterest
            </a>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-green-800">Pinterest connected!</span>
            <span className="text-sm text-green-600">{pinterestName ? `@${pinterestName}` : "Your account"} is linked and ready.</span>
            <a href="/connect" className="ml-auto text-green-600 hover:text-green-800 text-xs underline">Manage</a>
          </div>
        )}

        {/* ── Main layout: queue left, sidebar right ── */}
        <div className="flex gap-5 items-start">

          {/* ── Left: Pin Composer ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">
                  {drafts.length} Pin{drafts.length !== 1 ? "s" : ""} in Queue
                </span>
                {validDrafts > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {validDrafts} ready
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addDraft}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Pin
                </button>
                <button
                  onClick={scheduleAll}
                  disabled={validDrafts === 0}
                  className="flex items-center gap-1.5 text-sm bg-[#e60023] text-white px-4 py-2 rounded-xl hover:bg-[#ad081b] transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule {validDrafts > 0 ? `${validDrafts} Pin${validDrafts !== 1 ? "s" : ""}` : "All"}
                </button>
              </div>
            </div>

            {/* Draft Cards — 3 columns */}
            <div className="grid grid-cols-3 gap-4">
              {drafts.map((draft, i) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  index={i}
                  onChange={(updated) => updateDraft(draft.id, updated)}
                  onRemove={() => removeDraft(draft.id)}
                  onAiOpen={() => setAiTarget(draft.id)}
                  onSchedule={() => scheduleSingle(draft.id)}
                  isScheduling={schedulingId === draft.id}
                  isOnly={drafts.length === 1}
                  boards={boards}
                  boardsLoading={boardsLoading}
                />
              ))}
            </div>

            {/* Add more */}
            <button
              onClick={addDraft}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-[#e60023]/40 hover:text-[#e60023] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Pin
            </button>

            {/* Pro tip */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <strong>Pro tip:</strong> Schedule 3–5 pins per day for consistent reach. Mix promotional and inspirational content at a 20/80 ratio for best engagement.
              </div>
            </div>
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-20">
              {/* Tab toggle */}
              <div className="p-3 border-b border-gray-100 flex items-center gap-1">
                {(["schedule", "upcoming", "published"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-1",
                      activeTab === tab ? "bg-[#e60023] text-white" : "text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    {tab === "schedule" ? "SmartSchedule" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab !== "schedule" && (
                      <span className="ml-1 opacity-70">
                        ({scheduled.filter((p) => tab === "upcoming" ? p.status === "scheduled" : p.status === "published").length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === "schedule" ? (
                <SmartSchedulePanel
                  scheduled={scheduled}
                  onApply={(date, time) => {
                    const emptyDraft = drafts.find(d => !d.date && !d.time);
                    if (emptyDraft) updateDraft(emptyDraft.id, { ...emptyDraft, date, time });
                  }}
                />
              ) : (
                /* Thumbnail list */
                <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
                  {filtered.length === 0 ? (
                    <div className="p-8 text-center">
                      <Calendar className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No {activeTab} pins yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filtered.map((pin) => (
                        <div key={pin.id} className="p-3 hover:bg-gray-50/80 flex gap-2.5 group relative">
                          <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                            {pin.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={pin.imageUrl} alt={pin.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl">📌</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="text-xs font-medium text-gray-900 truncate leading-tight">{pin.title}</div>
                            <div>
                              <div className="text-xs text-gray-400 truncate">{pin.board}</div>
                              <div className="text-xs text-gray-400">{format(parseISO(pin.scheduledAt), "MMM d · h:mm a")}</div>
                              {pin.status === "scheduled" ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />Scheduled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full font-medium mt-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" />Published
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteScheduled(pin.id)}
                            className="absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
