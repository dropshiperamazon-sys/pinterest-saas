"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Loader2, XCircle, CheckCircle, AlertTriangle,
  ExternalLink, Edit2, Save, RefreshCw, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  scorePinSEO, classifyKeywordIntent,
  type PinSEOScore, type SEOCheckResult, type KeywordIntent, SCORING_WEIGHTS,
} from "@/lib/seo-audit-engine";
import type { AISEOSuggestions } from "@/lib/seo-audit-ai";

interface PinData {
  id: string;
  title: string;
  description: string;
  altText: string;
  link: string;
  pinUrl: string;
  thumbnailUrl: string;
  boardId: string;
  boardName: string;
  createdAt: string;
  creativeType: string;
}

// ── small UI helpers ─────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SEOCheckResult["status"] }) {
  if (status === "pass") return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === "warn") return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  if (status === "fail") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  return <span className="w-4 h-4 rounded-full bg-gray-200 shrink-0 inline-block" />;
}

function ImpactBadge({ impact }: { impact: SEOCheckResult["impact"] }) {
  const map = { high: "bg-red-50 text-red-600", medium: "bg-yellow-50 text-yellow-600", low: "bg-gray-100 text-gray-500" };
  return <span className={cn("text-xs rounded px-1 py-0.5", map[impact])}>{impact}</span>;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: "bg-green-100 text-green-700 border-green-200",
    B: "bg-blue-100 text-blue-700 border-blue-200",
    C: "bg-yellow-100 text-yellow-700 border-yellow-200",
    D: "bg-orange-100 text-orange-700 border-orange-200",
    F: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded border text-xl font-bold px-3 py-1", colors[grade] ?? "bg-gray-100 text-gray-700")}>
      {grade}
    </span>
  );
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? "#22c55e" : score >= 70 ? "#3b82f6" : score >= 55 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

const CATEGORY_LABELS: Record<keyof typeof SCORING_WEIGHTS, string> = {
  focusKeyword: "Focus Keyword",
  title: "Title",
  description: "Description",
  altText: "Alt Text",
  destinationUrl: "Destination URL",
  keywordRelevance: "Keyword Relevance",
  searchIntentAlignment: "Search Intent",
  boardRelevance: "Board Relevance",
};

const INTENT_COLORS: Record<KeywordIntent, string> = {
  Informational: "bg-blue-100 text-blue-700",
  Commercial: "bg-purple-100 text-purple-700",
  Transactional: "bg-green-100 text-green-700",
  Educational: "bg-indigo-100 text-indigo-700",
  Inspirational: "bg-pink-100 text-pink-700",
  Unknown: "bg-gray-100 text-gray-600",
};

// ── Main page ────────────────────────────────────────────────────────────────

export default function PinSEOAuditPage() {
  const router = useRouter();
  const params = useSearchParams();
  const pinId = params.get("id");
  const boardId = params.get("boardId") ?? "";

  const [pin, setPin] = useState<PinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [editLink, setEditLink] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Live score (recalculates on every field change)
  const [liveScore, setLiveScore] = useState<PinSEOScore | null>(null);

  // AI suggestions
  const [aiSuggestions, setAISuggestions] = useState<AISEOSuggestions | null>(null);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);

  // Load pin data
  useEffect(() => {
    if (!pinId) { setError("No pin selected."); setLoading(false); return; }
    fetch(`/api/seo-audit/pin?pinId=${pinId}&boardId=${boardId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setPin(data.pin);
        setEditTitle(data.pin.title ?? "");
        setEditDescription(data.pin.description ?? "");
        setEditAltText(data.pin.altText ?? "");
        setEditLink(data.pin.link ?? "");
        setLiveScore(data.seoScore);
      })
      .catch(() => setError("Failed to load pin data."))
      .finally(() => setLoading(false));
  }, [pinId, boardId]);

  // Recalculate score on any edit
  const recalculate = useCallback(() => {
    if (!pin) return;
    const score = scorePinSEO({
      id: pin.id,
      title: editTitle,
      description: editDescription,
      altText: editAltText,
      link: editLink,
      boardName: pin.boardName,
      boardDescription: "",
      focusKeyword,
    });
    setLiveScore(score);
  }, [pin, editTitle, editDescription, editAltText, editLink, focusKeyword]);

  useEffect(() => { recalculate(); }, [recalculate]);

  async function handleSave() {
    if (!pin) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch("/api/seo-audit/pin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pinId: pin.id,
        title: editTitle,
        description: editDescription,
        altText: editAltText,
        link: editLink,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      setSaveMsg(`Save failed: ${data.error}`);
    } else {
      setSaveMsg("Saved to Pinterest successfully.");
      setEditing(false);
    }
    setTimeout(() => setSaveMsg(null), 4000);
  }

  async function generateAI() {
    if (!pin) return;
    setAILoading(true);
    setAIError(null);
    setShowAI(true);
    const res = await fetch("/api/seo-audit/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pin.id,
        title: editTitle,
        description: editDescription,
        altText: editAltText,
        link: editLink,
        boardName: pin.boardName,
        focusKeyword,
      }),
    });
    const data = await res.json();
    setAILoading(false);
    if (data.error) setAIError(data.error);
    else setAISuggestions(data as AISEOSuggestions);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-red-400" />
        <span className="ml-3 text-gray-500">Loading pin SEO audit…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 flex items-center gap-3">
          <XCircle className="w-5 h-5" /> {error}
        </div>
      </div>
    );
  }

  if (!pin || !liveScore) return null;

  const intent = classifyKeywordIntent(focusKeyword || `${editTitle} ${editDescription}`);
  const groupedChecks = Object.keys(SCORING_WEIGHTS).reduce((acc, cat) => {
    acc[cat] = liveScore.checks.filter((c) => c.category === cat);
    return acc;
  }, {} as Record<string, SEOCheckResult[]>);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Nav */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <button onClick={() => router.push("/seo-audit")} className="hover:text-gray-600">Account Audit</button>
        <span>/</span>
        {boardId && (
          <>
            <button onClick={() => router.push(`/seo-audit/boards?id=${boardId}`)} className="hover:text-gray-600">
              {pin.boardName || "Board"}
            </button>
            <span>/</span>
          </>
        )}
        <span className="text-gray-700 truncate max-w-48">{pin.title || pin.id}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — pin info + fields */}
        <div className="lg:col-span-2 space-y-4">

          {/* Pin preview */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4">
            {pin.thumbnailUrl ? (
              <img src={pin.thumbnailUrl} alt={pin.title} className="w-24 h-24 object-cover rounded-lg shrink-0" />
            ) : (
              <div className="w-24 h-24 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center text-gray-300 text-2xl">📌</div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-lg leading-tight truncate">{pin.title || "(No title)"}</h1>
              <p className="text-xs text-gray-400 mt-1">{pin.creativeType} · Board: {pin.boardName || "unknown"}</p>
              {pin.pinUrl && (
                <a href={pin.pinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline mt-2">
                  <ExternalLink className="w-3 h-3" /> View on Pinterest
                </a>
              )}
            </div>
          </div>

          {/* Focus Keyword */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Focus Keyword</label>
            <input
              type="text"
              value={focusKeyword}
              onChange={(e) => setFocusKeyword(e.target.value)}
              placeholder="e.g. minimalist home decor ideas"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            {focusKeyword && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">Search intent:</span>
                <span className={cn("text-xs rounded px-2 py-0.5 font-medium", INTENT_COLORS[intent])}>{intent}</span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">Entering a keyword unlocks targeted SEO analysis. The score updates live as you type.</p>
          </div>

          {/* Editable fields */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Pin Fields</h2>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={() => { setEditing(false); setEditTitle(pin.title); setEditDescription(pin.description); setEditAltText(pin.altText); setEditLink(pin.link); }}
                      className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 text-xs text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg disabled:opacity-60">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save to Pinterest
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
            </div>

            {saveMsg && (
              <div className={cn("text-xs mb-4 rounded-lg px-3 py-2", saveMsg.startsWith("Save failed") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700")}>
                {saveMsg}
              </div>
            )}

            <div className="space-y-4">
              <Field label="Title" hint="20–100 chars · Focus keyword near start">
                {editing ? (
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                ) : (
                  <FieldValue value={editTitle} missing="No title set" />
                )}
                <CharCount value={editTitle} min={20} max={100} />
              </Field>

              <Field label="Description" hint="50–200 words · Include keyword + call-to-action">
                {editing ? (
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
                ) : (
                  <FieldValue value={editDescription} missing="No description set" />
                )}
                <span className="text-xs text-gray-400 mt-1">{editDescription.trim().split(/\s+/).filter(Boolean).length} words</span>
              </Field>

              <Field label="Alt Text" hint="50–200 chars · Describes the image">
                {editing ? (
                  <input value={editAltText} onChange={(e) => setEditAltText(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                ) : (
                  <FieldValue value={editAltText} missing="No alt text set" />
                )}
                <CharCount value={editAltText} min={50} max={200} />
              </Field>

              <Field label="Destination URL" hint="Should be HTTPS · Relevant to keyword">
                {editing ? (
                  <input value={editLink} onChange={(e) => setEditLink(e.target.value)} type="url"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                ) : (
                  <FieldValue value={editLink} missing="No link set" isUrl />
                )}
              </Field>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => { if (!aiSuggestions) generateAI(); else setShowAI((v) => !v); }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-gray-800 text-sm">AI SEO Suggestions</span>
                {aiLoading && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
              </div>
              {aiSuggestions && (showAI ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
              {!aiSuggestions && !aiLoading && <span className="text-xs text-purple-600 font-medium">Generate →</span>}
            </button>

            {aiError && (
              <div className="px-5 pb-4 text-xs text-red-600">{aiError}</div>
            )}

            {aiSuggestions && showAI && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                <AISection title="Title Suggestions" items={aiSuggestions.titles}
                  onApply={(t) => { setEditTitle(t); setEditing(true); }} />
                <AISection title="Description Suggestions" items={aiSuggestions.descriptions}
                  onApply={(d) => { setEditDescription(d); setEditing(true); }} isBlock />
                <AISection title="Alt Text Suggestions" items={aiSuggestions.altTextSuggestions}
                  onApply={(a) => { setEditAltText(a); setEditing(true); }} />
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Related Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.keywordSuggestions.map((kw, i) => (
                      <button key={i} onClick={() => setFocusKeyword(kw)}
                        className="text-xs bg-purple-50 text-purple-700 border border-purple-100 rounded-full px-2.5 py-1 hover:bg-purple-100">
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={generateAI} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right col — score + checklist */}
        <div className="space-y-4">
          {/* Score card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3">
            <ScoreRing score={liveScore.overall} size={96} />
            <GradeBadge grade={liveScore.grade} />
            <p className="text-xs text-gray-400 text-center">
              {liveScore.overall >= 85
                ? "Excellent — strong SEO optimization"
                : liveScore.overall >= 70
                ? "Good — a few improvements possible"
                : liveScore.overall >= 55
                ? "Fair — several issues to address"
                : "Poor — significant improvements needed"}
            </p>
            <p className="text-xs text-gray-300">Score updates as you edit</p>
          </div>

          {/* Breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Breakdown</h3>
            <div className="space-y-2">
              {(Object.entries(SCORING_WEIGHTS) as [keyof typeof SCORING_WEIGHTS, number][]).map(([cat, weight]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-28 shrink-0">{CATEGORY_LABELS[cat]}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", liveScore.breakdown[cat] >= 80 ? "bg-green-400" : liveScore.breakdown[cat] >= 60 ? "bg-yellow-400" : "bg-red-400")}
                      style={{ width: `${liveScore.breakdown[cat]}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-right">{liveScore.breakdown[cat]}</span>
                  <span className="text-xs text-gray-300 w-8">×{(weight * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* SEO Checklist */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">SEO Checklist</h3>
            {(Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[]).map((cat) => {
              const checks = groupedChecks[cat] ?? [];
              if (checks.length === 0) return null;
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{CATEGORY_LABELS[cat]}</p>
                  <div className="space-y-1.5">
                    {checks.map((check, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <StatusIcon status={check.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 leading-snug">{check.message}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <ImpactBadge impact={check.impact} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-300 text-center px-2">
            SEO score is a guide — it does not guarantee search rankings or traffic.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Field components ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-400">{hint}</span>
      </div>
      {children}
    </div>
  );
}

function FieldValue({ value, missing, isUrl = false }: { value: string; missing: string; isUrl?: boolean }) {
  if (!value) return <p className="text-sm text-gray-300 italic">{missing}</p>;
  if (isUrl) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 break-all">
        {value} <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }
  return <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>;
}

function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length;
  const ok = len >= min && len <= max;
  return (
    <span className={cn("text-xs mt-1", ok ? "text-green-600" : "text-gray-400")}>
      {len} / {max} chars
    </span>
  );
}

function AISection({
  title, items, onApply, isBlock = false,
}: { title: string; items: string[]; onApply: (v: string) => void; isBlock?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 flex gap-2">
            <p className={cn("text-xs text-gray-700 flex-1", isBlock ? "whitespace-pre-wrap" : "truncate")}>{item}</p>
            <button onClick={() => onApply(item)} className="text-xs text-purple-600 hover:text-purple-800 font-medium shrink-0">Use</button>
          </div>
        ))}
      </div>
    </div>
  );
}
