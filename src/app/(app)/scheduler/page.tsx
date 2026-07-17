"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  Plus, Calendar, Clock, Link2, Image as ImageIcon,
  CheckCircle2, Trash2, Edit2, X, ExternalLink,
  Sparkles, Zap, Tag, ChevronDown, ChevronUp,
  Copy, AlertCircle, LayoutGrid,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface PinDraft {
  id: string;
  title: string;
  description: string;
  board: string;
  link: string;
  date: string;
  time: string;
  status: "draft" | "scheduled" | "published";
  imageUrl: string;
  pinType: "promotional" | "inspirational" | "";
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

const BEST_TIMES = ["8:00 AM", "12:00 PM", "2:00 PM", "5:00 PM", "8:00 PM", "9:00 PM"];

// ── AI Generation ──────────────────────────────────────────────────────────────

function generateAiContent(keywords: string, pinType: "promotional" | "inspirational"): { title: string; description: string } {
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
    link: "",
    date: "",
    time: "",
    status: "draft",
    imageUrl: "📌",
    pinType: "",
  };
}

// ── AI Modal ───────────────────────────────────────────────────────────────────

function AiModal({
  onApply,
  onClose,
}: {
  onApply: (title: string, description: string, pinType: "promotional" | "inspirational") => void;
  onClose: () => void;
}) {
  const [keywords, setKeywords] = useState("");
  const [pinType, setPinType] = useState<"promotional" | "inspirational" | "">("");
  const [generated, setGenerated] = useState<{ title: string; description: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = () => {
    if (!keywords.trim()) { setError("Please enter at least one keyword."); return; }
    if (!pinType) { setError("Please select a pin type."); return; }
    setError("");
    setGenerating(true);
    setTimeout(() => {
      setGenerated(generateAiContent(keywords, pinType as "promotional" | "inspirational"));
      setGenerating(false);
    }, 1200);
  };

  const handleRegenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerated(generateAiContent(keywords, pinType as "promotional" | "inspirational"));
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
              <div className="font-semibold text-gray-900">AI Pin Generator</div>
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
            <div className="grid grid-cols-2 gap-3">
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
                  desc: "Inspire, educate, build brand awareness",
                  color: "border-purple-300 bg-purple-50",
                  selected: "border-purple-500 bg-purple-50 ring-2 ring-purple-200",
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

// ── Single Draft Card ──────────────────────────────────────────────────────────

function DraftCard({
  draft,
  index,
  onChange,
  onRemove,
  onAiOpen,
  isOnly,
  boards,
  boardsLoading,
}: {
  draft: PinDraft;
  index: number;
  onChange: (updated: PinDraft) => void;
  onRemove: () => void;
  onAiOpen: () => void;
  isOnly: boolean;
  boards: { id: string; name: string }[];
  boardsLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const set = (field: keyof PinDraft, value: string) =>
    onChange({ ...draft, [field]: value });

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
                draft.pinType === "promotional" ? "bg-orange-100 text-orange-600" : "bg-purple-100 text-purple-600"
              )}>
                {draft.pinType === "promotional" ? "🛍️ Promotional" : "✨ Inspirational"}
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

          {/* Pin Type */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Pin Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["promotional", "inspirational"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => set("pinType", draft.pinType === type ? "" : type)}
                  className={cn(
                    "py-2 px-3 rounded-xl border text-xs font-semibold transition-all",
                    draft.pinType === type
                      ? type === "promotional"
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {type === "promotional" ? "🛍️ Promotional" : "✨ Inspirational"}
                </button>
              ))}
            </div>
          </div>

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
            {/* Board */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Board</label>
              <select
                value={draft.board}
                onChange={(e) => set("board", e.target.value)}
                disabled={boardsLoading}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] bg-white disabled:opacity-60"
              >
                {boardsLoading
                  ? <option>Loading boards...</option>
                  : boards.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)
                }
              </select>
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

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Date *</label>
              <input
                type="date"
                value={draft.date}
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
                onChange={(e) => set("time", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
          </div>

          {/* Best Times */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Best Times to Post</label>
            <div className="flex flex-wrap gap-1.5">
              {BEST_TIMES.map((t) => (
                <button
                  key={t}
                  onClick={() => set("time", timeToInput(t))}
                  className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-[#e60023]/10 hover:text-[#e60023] transition-colors font-medium"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SchedulerPage() {
  const [scheduled, setScheduled] = useState<ScheduledPin[]>([]);
  const [drafts, setDrafts] = useState<PinDraft[]>([newDraft()]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "published">("upcoming");
  const [aiTarget, setAiTarget] = useState<string | null>(null);
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
        setDrafts((d) => d.map((dr) => dr.board === "" ? { ...dr, board: list[0].name } : dr));
      })
      .catch(() => {
        const list = FALLBACK_BOARDS.map((name) => ({ id: name, name }));
        setBoards(list);
        setDrafts((d) => d.map((dr) => dr.board === "" ? { ...dr, board: list[0].name } : dr));
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

  const addDraft = () => setDrafts((d) => [...d, newDraft()]);

  const updateDraft = (id: string, updated: PinDraft) =>
    setDrafts((d) => d.map((dr) => (dr.id === id ? updated : dr)));

  const removeDraft = (id: string) =>
    setDrafts((d) => d.filter((dr) => dr.id !== id));

  const applyAi = (title: string, description: string, pinType: "promotional" | "inspirational") => {
    if (!aiTarget) return;
    setDrafts((d) =>
      d.map((dr) => dr.id === aiTarget ? { ...dr, title, description, pinType } : dr)
    );
    setAiTarget(null);
  };

  const scheduleAll = async () => {
    const valid = drafts.filter((d) => d.title && d.date && d.time);
    if (valid.length === 0) return;
    const saved: ScheduledPin[] = [];
    for (const d of valid) {
      try {
        const res = await fetch("/api/schedule-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: d.title,
            description: d.description,
            imageUrl: d.imageUrl,
            board: d.board,
            link: d.link,
            pinType: d.pinType,
            scheduledAt: `${d.date}T${d.time}:00`,
          }),
        });
        const json = await res.json();
        if (json.pin) saved.push(json.pin);
      } catch { /* non-fatal */ }
    }
    setScheduled((s) => [...saved, ...s]);
    setDrafts([newDraft()]);
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
    activeTab === "upcoming" ? p.status === "scheduled" : p.status === "published"
  );
  const validDrafts = drafts.filter((d) => d.title && d.date && d.time).length;

  return (
    <div>
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

        <div className="space-y-6">
          {/* ── Pin Composer ── */}
          <div className="space-y-4">
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

          {/* ── Scheduled Pins Panel ── */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-1">
                {(["upcoming", "published"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize flex-1",
                      activeTab === tab ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {tab}
                    <span className="ml-1.5 text-xs opacity-70">
                      ({scheduled.filter((p) => tab === "upcoming" ? p.status === "scheduled" : p.status === "published").length})
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-px bg-gray-100 max-h-[400px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="col-span-3 p-10 text-center bg-white">
                    <Calendar className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No {activeTab} pins yet</p>
                  </div>
                ) : filtered.map((pin) => (
                  <div key={pin.id} className="p-4 bg-white hover:bg-gray-50/80 flex flex-col gap-2 group relative">
                    {pin.imageUrl && pin.imageUrl.startsWith("data:") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pin.imageUrl} alt={pin.title} className="w-full h-28 object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 rounded-lg flex items-center justify-center text-3xl">
                        {pin.imageUrl || "📌"}
                      </div>
                    )}
                    <div className="font-medium text-sm text-gray-900 truncate">{pin.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full truncate max-w-[90px]">{pin.board}</span>
                      <span className="text-xs text-gray-400">{format(parseISO(pin.scheduledAt), "MMM d · h:mm a")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {pin.status === "scheduled" ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                          <Clock className="w-3 h-3" />
                          Scheduled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Published
                        </span>
                      )}
                      <button onClick={() => deleteScheduled(pin.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
