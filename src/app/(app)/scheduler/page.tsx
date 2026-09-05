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
  altText: string;
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
    altText: "",
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

// ── Scheduled Pin Edit Modal ───────────────────────────────────────────────────

function ScheduledPinModal({
  pin,
  onClose,
  onSave,
  onDelete,
  onBackToDraft,
  onPinNow,
}: {
  pin: ScheduledPin;
  onClose: () => void;
  onSave: (updated: Partial<ScheduledPin>) => Promise<void>;
  onDelete: () => void;
  onBackToDraft: () => void;
  onPinNow: () => Promise<void>;
}) {
  const dt = pin.scheduledAt ? new Date(pin.scheduledAt) : new Date();
  const [title, setTitle] = useState(pin.title || "");
  const [description, setDescription] = useState(pin.description || "");
  const [date, setDate] = useState(dt.toISOString().split("T")[0]);
  const [time, setTime] = useState(dt.toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              {pin.imageUrl?.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pin.imageUrl} alt={pin.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm">📌</div>
              )}
            </div>
            <span className="text-sm font-semibold text-gray-800">Edit Scheduled Pin</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
              <input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={async () => { setSaving(true); await onSave({ title, description, scheduledAt: new Date(`${date}T${time}:00`).toISOString() }); setSaving(false); onClose(); }}
            disabled={saving}
            className="w-full bg-[#e60023] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Edit2 className="w-3.5 h-3.5" />}
            Save Changes
          </button>
          <button
            onClick={async () => { setPinning(true); await onPinNow(); setPinning(false); onClose(); }}
            disabled={pinning}
            className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pinning ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Pin Now
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { onBackToDraft(); onClose(); }}
              className="py-2 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Back to Draft
            </button>
            <button onClick={() => { onDelete(); onClose(); }}
              className="py-2 border border-red-200 rounded-xl text-sm text-red-500 font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
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

function getMonthDays(year: number, month: number): { dateStr: string; label: string }[] {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const firstDay = 1;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let d = firstDay; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().split("T")[0];
    if (dateStr < todayStr) continue; // skip past days
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

function SmartSchedulePanel({ onApply, scheduled, onEdit, slots, onSlotsChange }: {
  onApply: (date: string, time: string) => void;
  onEdit: (pin: ScheduledPin) => void;
  scheduled: { id: string; scheduledAt: string; imageUrl?: string; title: string; status: string; board: string; description?: string; link?: string }[];
  slots: { label: string; short: string }[];
  onSlotsChange: (slots: { label: string; short: string }[]) => void;
}) {
  const customSlots = slots;
  const setCustomSlots = onSlotsChange;
  const [addingSlot, setAddingSlot] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState("");
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = getMonthDays(viewYear, viewMonth);

  const allSlots = [
    ...DAILY_SLOTS,
    ...customSlots.map(s => ({ ...s, color: "bg-purple-100 hover:bg-purple-500", text: "text-purple-700 hover:text-white" })),
  ];

  // index scheduled pins by date string
  const pinsByDate: Record<string, { imageUrl?: string; title: string }[]> = {};
  for (const p of scheduled) {
    const d = p.scheduledAt.split("T")[0];
    if (!pinsByDate[d]) pinsByDate[d] = [];
    pinsByDate[d].push({ imageUrl: p.imageUrl, title: p.title });
  }

  const colCount = allSlots.length + 1;

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
      {/* Month header with navigation */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={goToPrev} className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronDown className="w-3 h-3 rotate-90" />
          </button>
          <span className="text-xs font-semibold text-gray-700">{monthLabel}</span>
          <button onClick={goToNext} className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronDown className="w-3 h-3 -rotate-90" />
          </button>
        </div>
        <span className="text-[10px] text-gray-400">Click to apply</span>
      </div>

      {/* Column labels + Add button */}
      <div className="px-3 pb-1">
        <div className="flex items-center gap-1">
          <div className="w-[76px] flex-shrink-0" />
          {allSlots.map((s) => (
            <div key={s.label} className="flex-1 text-[9px] font-semibold text-gray-400 text-center">{s.short}</div>
          ))}
          {/* + button to add custom slot */}
          {addingSlot ? (
            <div className="flex items-center gap-1">
              <input
                type="time"
                autoFocus
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
                className="text-[9px] border border-gray-200 rounded px-1 py-0.5 w-20 focus:outline-none focus:border-[#e60023]"
              />
              <button
                onClick={() => {
                  if (newSlotTime) {
                    const [h, m] = newSlotTime.split(":").map(Number);
                    const ampm = h >= 12 ? "PM" : "AM";
                    const h12 = h % 12 || 12;
                    const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
                    const short = `${h12}${ampm === "AM" ? "a" : "p"}`;
                    if (!customSlots.find(s => s.label === label))
                      setCustomSlots([...customSlots, { label, short }]);
                  }
                  setNewSlotTime("");
                  setAddingSlot(false);
                }}
                className="text-[9px] bg-[#e60023] text-white px-1.5 py-0.5 rounded font-medium"
              >✓</button>
              <button onClick={() => { setNewSlotTime(""); setAddingSlot(false); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSlot(true)}
              title="Add custom time slot"
              className="w-5 h-5 rounded border border-dashed border-gray-300 text-gray-400 hover:border-[#e60023] hover:text-[#e60023] flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Day rows */}
      <div className="px-3 pb-4 space-y-1.5">
        {days.map(({ dateStr, label }) => {
          const pins = pinsByDate[dateStr] ?? [];
          return (
            <div key={dateStr}>
              <div className="flex items-center gap-1">
                <div className="w-[76px] flex-shrink-0 text-[10px] text-gray-600 font-medium truncate pr-1 leading-tight">{label}</div>
                {allSlots.map((slot) => (
                  <button
                    key={slot.label}
                    onClick={() => onApply(dateStr, slotTo24h(slot.label))}
                    className={cn("flex-1 text-[9px] rounded-md py-1.5 font-semibold transition-colors text-center", slot.color, slot.text)}
                  >
                    {slot.short}
                  </button>
                ))}
                <div className="w-5 flex-shrink-0" />
              </div>
              {/* Scheduled thumbnails for this day */}
              {pins.length > 0 && (
                <div className="flex gap-1 mt-1 pl-[76px] flex-wrap">
                  {pins.map((p, i) => (
                    <button key={i} title={`Edit: ${p.title}`} onClick={() => onEdit(p as ScheduledPin)}
                      className="group/thumb w-7 h-7 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 hover:ring-2 hover:ring-[#e60023] transition-all relative">
                      {p.imageUrl && p.imageUrl.startsWith("http") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px]">📌</div>
                      )}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <Edit2 className="w-3 h-3 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* unused var suppression */ void colCount}
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
  const [topicOpen, setTopicOpen] = useState(false);
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
                  setTopicOpen(true);
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
                onBlur={() => setTimeout(() => setTopicOpen(false), 150)}
                placeholder="Search for a topic…"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            {/* Dropdown of Pinterest interests — only when focused */}
            {topicOpen && (interestsLoading || interests.length > 0) && (
              <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-sm max-h-36 overflow-y-auto z-10 relative">
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

          {/* Alt Text */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Alt Text <span className="font-normal text-gray-400">(optional)</span></label>
            <input
              type="text"
              placeholder="Describe your image for accessibility..."
              value={draft.altText}
              onChange={(e) => set("altText", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/30 focus:border-[#e60023] text-gray-700 placeholder-gray-400"
            />
          </div>

          {/* Schedule button */}
          <button
            onClick={onSchedule}
            disabled={!draft.title || !draft.imageUrl || isScheduling}
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

// ── Board Description AI Generator ────────────────────────────────────────────

function generateBoardDescription(keywords: string): string {
  const kws = keywords.split(",").map(k => k.trim()).filter(Boolean);
  const primary = kws[0] || "ideas";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const rest = kws.slice(1).map(cap).join(", ");
  const year = new Date().getFullYear();

  const templates = [
    `Your go-to board for all things ${primary}${rest ? `, ${rest},` : ""} and more. Curated with the best ideas, tips, and inspiration to spark your creativity. Follow along and save your favourites! ✨`,
    `A carefully curated collection of ${cap(primary)} ideas${rest ? ` featuring ${rest}` : ""}. Whether you're just starting out or looking for fresh inspiration, this board has everything you need. Updated regularly with the best pins of ${year}. 📌`,
    `Explore the world of ${cap(primary)}${rest ? ` — from ${rest} to everyday inspiration` : ""}. This board brings together the most beautiful, useful, and creative content to help you discover, plan, and create. Save your favourites and share with friends! 💡`,
    `Everything you love about ${cap(primary)} in one place.${rest ? ` Covers ${rest} and so much more.` : ""} Follow this board for weekly updates, handpicked tips, and endless inspiration you'll come back to again and again. 🌟`,
    `Dive into ${cap(primary)}${rest ? `, ${rest}` : ""} — curated content that informs, inspires, and delights. Perfect for anyone who wants to explore new ideas and stay ahead of the trends in ${year}. Follow for the latest picks! 🎯`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

// ── Manage Boards Modal ────────────────────────────────────────────────────────

type BoardSection = { id: string; name: string };
type ManagedBoard = { id: string; name: string; description: string; privacy: string; sections: BoardSection[] };

function ManageBoardsModal({ accessToken, onClose }: { accessToken: string; onClose: () => void }) {
  const [boards, setBoards] = useState<ManagedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<ManagedBoard | null>(null);
  const [view, setView] = useState<"list" | "board_detail" | "new_board">("list");

  // New board form
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [newBoardPrivacy, setNewBoardPrivacy] = useState("PUBLIC");

  // Edit board inline
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // New section
  const [newSectionName, setNewSectionName] = useState("");

  // Delete section confirmation
  const [deletingSection, setDeletingSection] = useState<BoardSection | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // AI description generator popup: "create" or "edit" or null
  const [aiDescTarget, setAiDescTarget] = useState<"create" | "edit" | null>(null);
  const [aiKeywords, setAiKeywords] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  useEffect(() => {
    fetch("/api/manage-boards", { headers: authHeaders })
      .then(r => r.json())
      .then(d => { setBoards(d.boards ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load boards"); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBoard() {
    if (!newBoardName.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/manage-boards", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "create_board", name: newBoardName.trim(), description: newBoardDesc.trim(), privacy: newBoardPrivacy }),
      });
      const data = await res.json();
      if (!res.ok) { setError("Failed to create board"); return; }
      setBoards(b => [...b, data.board]);
      setNewBoardName(""); setNewBoardDesc(""); setNewBoardPrivacy("PUBLIC");
      setView("list");
    } finally { setSaving(false); }
  }

  async function saveBoard() {
    if (!selectedBoard) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/manage-boards", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ boardId: selectedBoard.id, name: editName.trim(), description: editDesc }),
      });
      const data = await res.json();
      if (!res.ok) { setError("Failed to update board"); return; }
      const updated = { ...selectedBoard, name: data.board.name, description: data.board.description };
      setBoards(b => b.map(x => x.id === updated.id ? updated : x));
      setSelectedBoard(updated);
    } finally { setSaving(false); }
  }

  async function addSection() {
    if (!selectedBoard || !newSectionName.trim()) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/manage-boards", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "create_section", boardId: selectedBoard.id, name: newSectionName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError("Failed to add section"); return; }
      const updated = { ...selectedBoard, sections: [...selectedBoard.sections, data.section] };
      setBoards(b => b.map(x => x.id === updated.id ? updated : x));
      setSelectedBoard(updated);
      setNewSectionName("");
    } finally { setSaving(false); }
  }

  async function confirmDeleteSection() {
    if (!selectedBoard || !deletingSection) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/manage-boards", {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ boardId: selectedBoard.id, sectionId: deletingSection.id }),
      });
      if (!res.ok) { setError("Failed to delete section"); return; }
      const updated = { ...selectedBoard, sections: selectedBoard.sections.filter(s => s.id !== deletingSection.id) };
      setBoards(b => b.map(x => x.id === updated.id ? updated : x));
      setSelectedBoard(updated);
      setDeletingSection(null);
      setDeleteConfirmText("");
    } finally { setSaving(false); }
  }

  function openBoard(board: ManagedBoard) {
    setSelectedBoard(board);
    setEditName(board.name);
    setEditDesc(board.description);
    setNewSectionName("");
    setView("board_detail");
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {view !== "list" && (
              <button onClick={() => setView("list")} className="text-white/70 hover:text-white mr-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">
                {view === "list" && "Manage Boards"}
                {view === "new_board" && "Create New Board"}
                {view === "board_detail" && selectedBoard?.name}
              </h2>
              <p className="text-purple-200 text-xs">
                {view === "list" && `${boards.length} board${boards.length !== 1 ? "s" : ""} on your Pinterest`}
                {view === "new_board" && "Add a new board to your Pinterest account"}
                {view === "board_detail" && "Edit board details and manage sections"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {error && <div className="bg-red-50 border-b border-red-100 px-6 py-2 text-xs text-red-600">{error}</div>}

        <div className="overflow-y-auto flex-1">
          {/* ── Board List ── */}
          {view === "list" && (
            <div className="p-5 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">Loading boards…</div>
              ) : boards.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No boards found. Create your first one!</div>
              ) : (
                boards.map(board => (
                  <button key={board.id} onClick={() => openBoard(board)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left group">
                    <div>
                      <div className="font-semibold text-sm text-gray-800 group-hover:text-purple-700">{board.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {board.sections.length > 0 ? `${board.sections.length} section${board.sections.length !== 1 ? "s" : ""}` : "No sections"}
                        {board.privacy === "SECRET" && <span className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">Secret</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))
              )}
              <button onClick={() => setView("new_board")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors mt-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create New Board
              </button>
            </div>
          )}

          {/* ── New Board Form ── */}
          {view === "new_board" && (
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Board Name *</label>
                <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)}
                  placeholder="e.g. Home Decor Ideas"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-500">Description <span className="font-normal text-gray-400">(optional)</span></label>
                  <button onClick={() => { setAiDescTarget("create"); setAiKeywords(""); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    AI Generate
                  </button>
                </div>
                <textarea value={newBoardDesc} onChange={e => setNewBoardDesc(e.target.value)}
                  placeholder="What is this board about?"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Privacy</label>
                <div className="flex gap-3">
                  {["PUBLIC", "SECRET"].map(p => (
                    <button key={p} onClick={() => setNewBoardPrivacy(p)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${newBoardPrivacy === p ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:border-purple-300"}`}>
                      {p === "PUBLIC" ? "Public" : "Secret"}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={createBoard} disabled={!newBoardName.trim() || saving}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-40">
                {saving ? "Creating…" : "Create Board on Pinterest"}
              </button>
            </div>
          )}

          {/* ── Board Detail ── */}
          {view === "board_detail" && selectedBoard && (
            <div className="p-5 space-y-5">
              {/* Edit name & description */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Board Details</p>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Board Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 bg-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-500">Description</label>
                    <button onClick={() => { setAiDescTarget("edit"); setAiKeywords(""); }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      AI Generate
                    </button>
                  </div>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 resize-none bg-white" />
                </div>
                <button onClick={saveBoard} disabled={saving || (editName.trim() === selectedBoard.name && editDesc === selectedBoard.description)}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-40">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>

              {/* Sections */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sections</p>
                {selectedBoard.sections.length === 0 ? (
                  <p className="text-xs text-gray-400 mb-3">No sections yet. Add one below.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {selectedBoard.sections.map(sec => (
                      <div key={sec.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-sm text-gray-700">{sec.name}</span>
                        <button onClick={() => { setDeletingSection(sec); setDeleteConfirmText(""); }} disabled={saving}
                          className="text-gray-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add section */}
                <div className="flex gap-2">
                  <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addSection()}
                    placeholder="New section name…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400" />
                  <button onClick={addSection} disabled={!newSectionName.trim() || saving}
                    className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-40">
                    {saving ? "…" : "+ Add"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── AI Description Generator overlay ── */}
        {aiDescTarget && (
          <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center p-6 z-10">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">AI Board Description</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Enter keywords to generate a compelling description</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                  Keywords <span className="font-normal text-gray-400">(separate with commas)</span>
                </label>
                <input
                  autoFocus
                  value={aiKeywords}
                  onChange={e => setAiKeywords(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && aiKeywords.trim()) {
                      setAiGenerating(true);
                      setTimeout(() => {
                        const desc = generateBoardDescription(aiKeywords);
                        if (aiDescTarget === "create") setNewBoardDesc(desc);
                        else setEditDesc(desc);
                        setAiGenerating(false);
                        setAiDescTarget(null);
                        setAiKeywords("");
                      }, 800);
                    }
                  }}
                  placeholder="e.g. home decor, minimalist, cozy living"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">Add one or more keywords that describe your board topic</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAiDescTarget(null); setAiKeywords(""); }}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!aiKeywords.trim() || aiGenerating}
                  onClick={() => {
                    setAiGenerating(true);
                    setTimeout(() => {
                      const desc = generateBoardDescription(aiKeywords);
                      if (aiDescTarget === "create") setNewBoardDesc(desc);
                      else setEditDesc(desc);
                      setAiGenerating(false);
                      setAiDescTarget(null);
                      setAiKeywords("");
                    }, 800);
                  }}
                  className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {aiGenerating ? (
                    <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Generating…</>
                  ) : "Generate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Section Confirmation overlay ── */}
        {deletingSection && (
          <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center p-6 z-10">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Delete Section</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This will permanently delete <span className="font-semibold text-gray-700">&quot;{deletingSection.name}&quot;</span> from Pinterest.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                  Type <span className="font-bold text-red-600 tracking-widest">DELETE</span> to confirm
                </label>
                <input
                  autoFocus
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && deleteConfirmText === "DELETE" && confirmDeleteSection()}
                  placeholder="DELETE"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-400 tracking-widest"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeletingSection(null); setDeleteConfirmText(""); }}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSection}
                  disabled={deleteConfirmText !== "DELETE" || saving}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Deleting…" : "Delete Section"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
  const [activeTab, setActiveTab] = useState<"schedule" | "published">("schedule");
  const [pubFilter, setPubFilter] = useState<"today" | "week" | "month" | "custom">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pinSpacing, setPinSpacing] = useState(2);
  const [spacingLocked, setSpacingLocked] = useState(false);
  const [shuffleMsg, setShuffleMsg] = useState("");
  const [spacingOpen, setSpacingOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [boardsModalOpen, setBoardsModalOpen] = useState(false);
  const [smartSlots, setSmartSlots] = useState<{ label: string; short: string }[]>([]);
  const [aiTarget, setAiTarget] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [successPopup, setSuccessPopup] = useState(false);
  const [editingPin, setEditingPin] = useState<ScheduledPin | null>(null);
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
          (window as Window & { __pinterestToken?: string }).__pinterestToken = data.accessToken;
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

  // Build the ordered list of active time slots (DAILY_SLOTS + custom), converted to "HH:MM"
  function activeSlotTimes(): string[] {
    const base = DAILY_SLOTS.map(s => slotTo24h(s.label));
    const custom = smartSlots.map(s => slotTo24h(s.label));
    return [...base, ...custom].sort();
  }

  // Returns next available scheduledAt from the slot calendar, or falls back to next round hour.
  // `usedSoFar` is a set of ISO strings already claimed by earlier drafts in the same batch.
  function nextSlotMs(date: string, time: string, usedSoFar: Set<string>): number {
    if (date && time) return new Date(`${date}T${time}:00`).getTime();
    const slotTimes = activeSlotTimes();
    if (slotTimes.length === 0) {
      // No slots defined — fall back to next round hour
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      return now.getTime();
    }
    // Walk forward day by day from today, slot by slot, until we find an unclaimed slot in the future
    const now = new Date();
    for (let dayOffset = 0; dayOffset <= 365; dayOffset++) {
      const day = new Date(now);
      day.setDate(day.getDate() + dayOffset);
      day.setSeconds(0, 0);
      const dateStr = day.toISOString().split("T")[0];
      for (const t of slotTimes) {
        const candidate = new Date(`${dateStr}T${t}:00`);
        if (candidate <= now) continue; // slot already passed today
        const iso = candidate.toISOString();
        if (!usedSoFar.has(iso) && !scheduled.some(p => p.scheduledAt === iso)) {
          usedSoFar.add(iso);
          return candidate.getTime();
        }
      }
    }
    // Absolute fallback
    const fb = new Date();
    fb.setMinutes(0, 0, 0);
    fb.setHours(fb.getHours() + 1);
    return fb.getTime();
  }

  // Schedule a single draft — one slot per board, serial across the slot calendar
  const scheduleSingle = async (draftId: string) => {
    const d = drafts.find((dr) => dr.id === draftId);
    if (!d || !d.title || !d.imageUrl) return;
    setSchedulingId(draftId);
    const boardList = d.boards?.length ? d.boards : [d.board || ""];
    const usedSoFar = new Set<string>();
    const saved: ScheduledPin[] = [];
    for (let i = 0; i < boardList.length; i++) {
      const ms = (d.date && d.time && i === 0)
        ? new Date(`${d.date}T${d.time}:00`).getTime()
        : nextSlotMs(i === 0 ? d.date : "", i === 0 ? d.time : "", usedSoFar);
      const scheduledAt = new Date(ms).toISOString();
      usedSoFar.add(scheduledAt);
      const pin = await postPin({ title: d.title, description: d.description, imageUrl: d.imageUrl, board: boardList[i], link: d.link, pinType: d.pinType, taggedProducts: d.taggedProducts, altText: d.altText, scheduledAt });
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

  // Schedule all valid drafts serially through the slot calendar
  const scheduleAll = async () => {
    const valid = drafts.filter((d) => d.title && d.imageUrl);
    if (valid.length === 0) return;
    const usedSoFar = new Set<string>();
    const saved: ScheduledPin[] = [];
    for (const d of valid) {
      const boardList = d.boards?.length ? d.boards : [d.board || ""];
      for (let i = 0; i < boardList.length; i++) {
        const ms = (d.date && d.time && i === 0)
          ? new Date(`${d.date}T${d.time}:00`).getTime()
          : nextSlotMs(i === 0 ? d.date : "", i === 0 ? d.time : "", usedSoFar);
        const scheduledAt = new Date(ms).toISOString();
        usedSoFar.add(scheduledAt);
        const pin = await postPin({ title: d.title, description: d.description, imageUrl: d.imageUrl, board: boardList[i], link: d.link, pinType: d.pinType, taggedProducts: d.taggedProducts, altText: d.altText, scheduledAt });
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

  const filtered = (() => {
    if (activeTab !== "published") return scheduled.filter(p => p.status === "scheduled");
    const published = scheduled.filter(p => p.status === "published");
    const now = new Date();
    if (pubFilter === "today") {
      const start = new Date(now); start.setHours(0,0,0,0);
      return published.filter(p => new Date(p.scheduledAt) >= start);
    }
    if (pubFilter === "week") {
      const start = new Date(now); start.setDate(now.getDate() - 7);
      return published.filter(p => new Date(p.scheduledAt) >= start);
    }
    if (pubFilter === "month") {
      const start = new Date(now); start.setDate(now.getDate() - 30);
      return published.filter(p => new Date(p.scheduledAt) >= start);
    }
    if (pubFilter === "custom" && customFrom) {
      const from = new Date(customFrom);
      const to = customTo ? new Date(customTo) : now;
      to.setHours(23,59,59,999);
      return published.filter(p => { const d = new Date(p.scheduledAt); return d >= from && d <= to; });
    }
    return published;
  })();
  const validDrafts = drafts.filter((d) => d.title && d.imageUrl).length;

  // Shuffle: spread drafts with dates across remaining days of the current month
  function shufflePins() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const futureDays: string[] = [];
    for (let d = now.getDate(); d <= lastDay; d++) {
      const dt = new Date(year, month, d);
      futureDays.push(dt.toISOString().split("T")[0]);
    }
    if (futureDays.length === 0) return;
    // shuffle the future days array
    const shuffled = [...futureDays].sort(() => Math.random() - 0.5);
    const times = ["08:00", "12:00", "14:00", "17:00"];
    setDrafts(prev => prev.map((d, i) => ({
      ...d,
      date: shuffled[i % shuffled.length],
      time: times[i % times.length],
    })));
    setShuffleMsg("Pins reshuffled across the month!");
    setTimeout(() => setShuffleMsg(""), 3000);
  }

  // Apply pin spacing: for drafts sharing the same link, enforce minimum gap (days)
  function applyPinSpacing() {
    const spacing = pinSpacing;
    if (spacing < 1) return;
    const updated = [...drafts];
    // group by link
    const byLink: Record<string, number[]> = {};
    updated.forEach((d, i) => { if (d.link) { (byLink[d.link] ||= []).push(i); } });
    Object.values(byLink).forEach(indices => {
      if (indices.length < 2) return;
      // sort by current date
      indices.sort((a, b) => (updated[a].date || "").localeCompare(updated[b].date || ""));
      for (let k = 1; k < indices.length; k++) {
        const prev = updated[indices[k - 1]];
        const curr = updated[indices[k]];
        if (!prev.date) continue;
        const prevDate = new Date(prev.date);
        const currDate = curr.date ? new Date(curr.date) : new Date(prevDate);
        const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;
        if (diffDays < spacing) {
          const newDate = new Date(prevDate);
          newDate.setDate(prevDate.getDate() + spacing);
          updated[indices[k]] = { ...curr, date: newDate.toISOString().split("T")[0] };
        }
      }
    });
    setDrafts(updated);
    setShuffleMsg(`Pin spacing of ${spacing}d applied!`);
    setTimeout(() => setShuffleMsg(""), 3000);
  }

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
      {editingPin && (
        <ScheduledPinModal
          pin={editingPin}
          onClose={() => setEditingPin(null)}
          onSave={async (updates) => {
            const res = await fetch("/api/schedule-pin", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pinId: editingPin.id, ...updates }),
            });
            if (res.ok) {
              const { pin: updated } = await res.json();
              setScheduled(s => s.map(p => p.id === editingPin.id ? { ...p, ...updated } : p));
            }
          }}
          onDelete={() => deleteScheduled(editingPin.id)}
          onBackToDraft={() => {
            setDrafts(d => [...d, {
              ...newDraft(),
              title: editingPin.title,
              description: editingPin.description || "",
              imageUrl: editingPin.imageUrl || "",
              board: editingPin.board || "",
              link: editingPin.link || "",
            }]);
            deleteScheduled(editingPin.id);
          }}
          onPinNow={async () => {
            await fetch("/api/publish-pin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pinId: editingPin.id }),
            });
            setScheduled(s => s.map(p => p.id === editingPin.id ? { ...p, status: "published" } : p));
          }}
        />
      )}

      {/* ── Manage Boards Modal ── */}
      {boardsModalOpen && (
        <ManageBoardsModal
          accessToken={typeof window !== "undefined" ? ((window as Window & { __pinterestToken?: string }).__pinterestToken ?? "") : ""}
          onClose={() => {
            setBoardsModalOpen(false);
            // Refresh boards list after edits
            fetch("/api/manage-boards").then(r => r.json()).then(data => {
              if (data.boards?.length) {
                const list = data.boards.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }));
                setBoards(list);
              }
            }).catch(() => {});
          }}
        />
      )}

      {/* ── CSV Import Modal ── */}
      {csvModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCsvModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Copy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Import Pins via CSV</h2>
                  <p className="text-green-100 text-xs">Upload your spreadsheet to bulk-schedule pins</p>
                </div>
              </div>
              <button onClick={() => setCsvModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Column guide */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Required CSV Columns</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { col: "media_url", desc: "Direct image URL (JPG/PNG/WEBP)" },
                    { col: "title", desc: "Pin title (max 100 chars)" },
                    { col: "description", desc: "Pin description / caption" },
                    { col: "board_name", desc: "Name of your Pinterest board" },
                    { col: "destination_link", desc: "URL viewers land on" },
                    { col: "alt_text", desc: "Accessibility description" },
                    { col: "scheduled_time", desc: "e.g. 2025-09-10T09:00" },
                  ].map(({ col, desc }) => (
                    <div key={col} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <code className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded mt-0.5 shrink-0">{col}</code>
                      <span className="text-[11px] text-gray-500 leading-tight">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700">Tips</p>
                <ul className="text-[11px] text-blue-600 space-y-1 list-disc list-inside">
                  <li>First row must be the column headers exactly as shown above</li>
                  <li>Wrap fields containing commas in double quotes</li>
                  <li><code className="bg-blue-100 px-1 rounded">scheduled_time</code> format: <code className="bg-blue-100 px-1 rounded">YYYY-MM-DDTHH:MM</code></li>
                  <li>Leave optional columns blank — don't remove them</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const headers = ["media_url", "title", "description", "board_name", "destination_link", "alt_text", "scheduled_time"];
                    const example = ["https://example.com/image.jpg", "My Pin Title", "A great pin description", "My Board", "https://mywebsite.com", "A beautiful image", "2025-09-10T09:00"];
                    const csv = [headers.join(","), example.join(",")].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "mypinpro_template.csv"; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-green-600 text-green-700 font-semibold text-sm hover:bg-green-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Template
                </button>
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors cursor-pointer">
                  <Copy className="w-4 h-4" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        const lines = text.split(/\r?\n/).filter(Boolean);
                        if (lines.length < 2) return;
                        const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
                        const col = (row: string[], key: string) => {
                          const idx = header.findIndex((h) => h.includes(key));
                          return idx >= 0 ? (row[idx] ?? "").trim().replace(/^"|"$/g, "") : "";
                        };
                        const newDrafts = lines.slice(1).map((line) => {
                          const row = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,))/g) ?? line.split(",");
                          const sched = col(row, "scheduled");
                          return {
                            ...newDraft(),
                            imageUrl: col(row, "media") || col(row, "image"),
                            link: col(row, "destination") || col(row, "link") || col(row, "url"),
                            title: col(row, "title"),
                            description: col(row, "description") || col(row, "desc"),
                            altText: col(row, "alt"),
                            date: sched ? sched.split("T")[0] : "",
                            time: sched?.includes("T") ? (sched.split("T")[1]?.slice(0, 5) ?? "") : "",
                          };
                        }).filter((d) => d.title || d.imageUrl || d.link);
                        if (newDrafts.length) setDrafts((prev) => [...prev, ...newDrafts]);
                        setCsvModalOpen(false);
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
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

        {/* ── Bulk Import bar ── */}
        <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm">
          {/* Upload Bulk */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer">
            <ImageIcon className="w-3.5 h-3.5" />
            Upload Bulk
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (!files.length) return;
                // Read all files first, then fill empty slots before appending
                const readers = files.map((file) => new Promise<string>((resolve) => {
                  const r = new FileReader();
                  r.onload = (ev) => resolve(ev.target?.result as string);
                  r.readAsDataURL(file);
                }));
                Promise.all(readers).then((urls) => {
                  setDrafts((prev) => {
                    const updated = [...prev];
                    let urlIdx = 0;
                    // Fill drafts that have no image first (top to bottom)
                    for (let i = 0; i < updated.length && urlIdx < urls.length; i++) {
                      if (!updated[i].imageUrl) {
                        updated[i] = { ...updated[i], imageUrl: urls[urlIdx++] };
                      }
                    }
                    // Append remaining as new drafts
                    while (urlIdx < urls.length) {
                      updated.push({ ...newDraft(), imageUrl: urls[urlIdx++] });
                    }
                    return updated;
                  });
                });
                e.target.value = "";
              }}
            />
          </label>

          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Import CSV */}
          <button
            onClick={() => setCsvModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Manage Boards */}
          <button
            onClick={() => setBoardsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Manage Boards
          </button>

        </div>

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
              {/* Scheduling Tools */}
              <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 flex items-center gap-2">
                {/* Shuffle Pins — direct action */}
                <div className="flex-1">
                  <button onClick={() => { shufflePins(); setSpacingOpen(false); }}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-white text-gray-600 border-gray-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors active:bg-purple-100">
                    <Zap className="w-3 h-3" />Shuffle Pins
                  </button>
                </div>
                {/* Pin Spacing */}
                <div className="relative flex-1">
                  <button onClick={() => { setSpacingOpen(o => !o); }}
                    className={cn("w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                      spacingOpen ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600")}>
                    <Calendar className="w-3 h-3" />Pin Spacing
                    {spacingLocked && <span className="ml-1 text-[10px] bg-blue-200 text-blue-800 px-1 rounded">{pinSpacing}d</span>}
                    <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", spacingOpen && "rotate-180")} />
                  </button>
                  {spacingOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 flex flex-col gap-2">
                      <p className="text-[10px] text-gray-400">Min gap between pins sharing the same link.</p>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setPinSpacing(s => Math.max(1, s - 1))}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm flex items-center justify-center font-bold">−</button>
                        <span className="w-10 text-center text-sm font-semibold text-gray-800">{pinSpacing} day{pinSpacing !== 1 ? "s" : ""}</span>
                        <button onClick={() => setPinSpacing(s => Math.min(30, s + 1))}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm flex items-center justify-center font-bold">+</button>
                      </div>
                      {spacingLocked ? (
                        <button onClick={() => { setSpacingLocked(false); }}
                          className="w-full py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex items-center justify-center gap-1">
                          <Edit2 className="w-3 h-3" />Edit
                        </button>
                      ) : (
                        <button onClick={() => { applyPinSpacing(); setSpacingLocked(true); setSpacingOpen(false); }}
                          className="w-full py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                          Apply
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {shuffleMsg && (
                <div className="px-3 py-1.5 border-b border-gray-100">
                  <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />{shuffleMsg}
                  </p>
                </div>
              )}
              {/* Tab toggle */}
              <div className="p-3 border-b border-gray-100 flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  {(["schedule", "published"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-1",
                        activeTab === tab ? "bg-[#e60023] text-white" : "text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {tab === "schedule" ? "SmartSchedule" : "Published"}
                      {tab === "published" && (
                        <span className="ml-1 opacity-70">({scheduled.filter(p => p.status === "published").length})</span>
                      )}
                    </button>
                  ))}
                </div>
                {activeTab === "published" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1 flex-wrap">
                      {([
                        { key: "today", label: "Today" },
                        { key: "week",  label: "Last 7 days" },
                        { key: "month", label: "Last 30 days" },
                        { key: "custom", label: "Custom" },
                      ] as const).map(({ key, label }) => (
                        <button key={key} onClick={() => setPubFilter(key)}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                            pubFilter === key
                              ? "bg-[#e60023] text-white border-[#e60023]"
                              : "bg-white text-gray-500 border-gray-200 hover:border-[#e60023] hover:text-[#e60023]"
                          )}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {pubFilter === "custom" && (
                      <div className="flex gap-1 items-center">
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                          className="flex-1 text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:border-[#e60023]" />
                        <span className="text-[10px] text-gray-400">–</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                          className="flex-1 text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:border-[#e60023]" />
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400">{filtered.length} pin{filtered.length !== 1 ? "s" : ""} published</p>
                  </div>
                )}
              </div>

              {activeTab === "schedule" ? (
                <SmartSchedulePanel
                  scheduled={scheduled.filter(p => p.status === "scheduled" && new Date(p.scheduledAt) >= new Date())}
                  onApply={(date, time) => {
                    const emptyDraft = drafts.find(d => !d.date && !d.time);
                    if (emptyDraft) updateDraft(emptyDraft.id, { ...emptyDraft, date, time });
                  }}
                  onEdit={setEditingPin}
                  slots={smartSlots}
                  onSlotsChange={setSmartSlots}
                />
              ) : (
                /* Thumbnail list */
                <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
                  {filtered.length === 0 ? (
                    <div className="p-8 text-center">
                      <Calendar className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No published pins for this period</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filtered.map((pin) => (
                        <div key={pin.id} className="p-3 hover:bg-gray-50/80 flex gap-2.5 group relative cursor-pointer" onClick={() => pin.status === "scheduled" && setEditingPin(pin)}>
                          <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 relative">
                            {pin.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={pin.imageUrl} alt={pin.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl">📌</div>
                            )}
                            {pin.status === "scheduled" && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit2 className="w-4 h-4 text-white" />
                              </div>
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
