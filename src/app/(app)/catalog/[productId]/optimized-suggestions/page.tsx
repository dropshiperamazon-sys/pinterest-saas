"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Sparkles, RefreshCw, Copy, Check, Edit2, ShoppingBag,
  CheckCircle, AlertTriangle, Loader2, TrendingUp, Tag, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OptimizedSuggestionsResponse } from "@/app/api/pinterest-catalog/optimized-suggestions/route";

function scoreColor(s: number) {
  if (s >= 70) return "text-green-600";
  if (s >= 40) return "text-yellow-600";
  return "text-red-500";
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#f3f4f6" strokeWidth={7} />
        <circle
          cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x={36} y={40} textAnchor="middle" fontSize={14} fontWeight="700" fill={color}>{score}</text>
      </svg>
      <span className="text-xs text-gray-500 font-medium">{label}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

interface EditableFieldProps {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}

function EditableField({ value, onChange, multiline, placeholder }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <div className="space-y-2">
        {multiline ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            className="w-full text-sm border border-[#e60023]/40 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 resize-none"
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full text-sm border border-[#e60023]/40 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={() => { onChange(draft); setEditing(false); }}
            className="text-xs px-3 py-1.5 bg-[#e60023] text-white rounded-lg hover:bg-[#c0001d] transition-colors"
          >Save</button>
          <button
            onClick={() => { setDraft(value); setEditing(false); }}
            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <p className={cn("text-sm text-gray-800 leading-relaxed", !value && "text-gray-400 italic")}>
        {value || placeholder || "—"}
      </p>
      <button
        onClick={() => setEditing(true)}
        className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Edit2 className="w-3 h-3" /> Edit
      </button>
    </div>
  );
}

export default function OptimizedSuggestionsPage() {
  const { productId } = useParams() as { productId: string };
  const searchParams = useSearchParams();
  const feedId = searchParams.get("feedId") ?? undefined;
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OptimizedSuggestionsResponse | null>(null);
  const [focusKeyword, setFocusKeyword] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  const [applying, setApplying] = useState<"title" | "description" | "both" | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<"title" | "description" | "both" | null>(null);

  // Loading step indicator
  const [loadingStep, setLoadingStep] = useState(0);
  const STEPS = [
    "Fetching product information…",
    "Analyzing product attributes…",
    "Checking Pinterest keyword data…",
    "Generating optimized title…",
    "Generating optimized description…",
    "Calculating projected SEO score…",
  ];

  const generate = useCallback(async (kw?: string) => {
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    setApplySuccess(null);
    setApplyError(null);

    // Animate steps
    const stepTimer = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }, 700);

    try {
      const res = await fetch("/api/pinterest-catalog/optimized-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: decodeURIComponent(productId), feedId, focusKeyword: kw ?? focusKeyword }),
      });
      const json = await res.json() as OptimizedSuggestionsResponse & { error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to generate suggestions");
      } else {
        setData(json);
        setEditedTitle(json.suggested.title);
        setEditedDescription(json.suggested.description);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  }, [productId, feedId, focusKeyword]);

  useEffect(() => { generate(); }, []);

  async function applyToShopify(which: "title" | "description" | "both") {
    setApplying(which);
    setApplyError(null);
    setApplySuccess(null);
    try {
      const body: Record<string, string> = { productId: decodeURIComponent(productId) };
      if (which !== "description") body.title = editedTitle;
      if (which !== "title") body.description = editedDescription;

      const res = await fetch("/api/pinterest-catalog/apply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setApplyError(json.error ?? "Failed to apply changes");
      } else {
        const label = which === "title" ? "title" : which === "description" ? "description" : "title and description";
        setApplySuccess(`Successfully applied ${label} to your Pinterest catalog.`);
        // Re-generate to refresh projected score
        await generate(focusKeyword);
      }
    } catch {
      setApplyError("Network error — please try again");
    } finally {
      setApplying(null);
      setShowConfirm(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Product SEO
        </button>

        {/* Page title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#e60023]/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#e60023]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pinterest Optimization Suggestions</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI-powered title & description optimization for Pinterest discovery</p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-[#e60023] animate-spin" />
              <span className="text-sm font-semibold text-gray-700">Analyzing product…</span>
            </div>
            <div className="space-y-2.5">
              {STEPS.map((step, i) => (
                <div key={step} className={cn(
                  "flex items-center gap-2.5 text-sm transition-all",
                  i < loadingStep ? "text-green-600" : i === loadingStep ? "text-gray-700 font-medium" : "text-gray-300"
                )}>
                  {i < loadingStep ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : i === loadingStep ? (
                    <Loader2 className="w-4 h-4 text-[#e60023] animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" />
                  )}
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Unable to generate suggestions</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
              <button
                onClick={() => generate()}
                className="mt-3 text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >Try again</button>
            </div>
          </div>
        )}

        {/* Main content */}
        {!loading && data && (
          <>
            {/* Product overview card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
              {data.current.imageLink ? (
                <img src={data.current.imageLink} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-base leading-snug">{data.current.title || "Untitled product"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {data.current.price && <span className="text-sm text-gray-700 font-medium">{data.current.price}</span>}
                  {data.current.availability && (
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                      data.current.availability.toLowerCase().includes("in") ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {data.current.availability}
                    </span>
                  )}
                  {data.current.brand && <span className="text-xs text-gray-500">{data.current.brand}</span>}
                </div>
                {data.current.link && (
                  <a href={data.current.link} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#e60023] hover:underline mt-1 inline-block truncate max-w-full">
                    {data.current.link}
                  </a>
                )}
              </div>
            </div>

            {/* Score comparison */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Pinterest SEO Score</h2>
              <div className="flex items-center justify-center gap-8">
                <ScoreRing score={data.current.score} label="Current" />
                <div className="flex flex-col items-center gap-1">
                  <TrendingUp className={cn("w-6 h-6", data.suggested.projectedScore > data.current.score ? "text-green-500" : "text-gray-400")} />
                  {data.suggested.projectedScore > data.current.score && (
                    <span className="text-xs font-semibold text-green-600">+{data.suggested.projectedScore - data.current.score} pts</span>
                  )}
                </div>
                <ScoreRing score={data.suggested.projectedScore} label="Projected" />
              </div>
            </div>

            {/* Apply success / error banner */}
            {applySuccess && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700">{applySuccess}</p>
              </div>
            )}
            {applyError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{applyError}</p>
              </div>
            )}

            {/* Title section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Title</h2>
              </div>
              <div className="divide-y divide-gray-50">
                <div className="px-5 py-4">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Current Title</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{data.current.title || <span className="text-gray-400 italic">No title</span>}</p>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#e60023] uppercase tracking-wide">Optimized Title</p>
                    <CopyButton text={editedTitle} />
                  </div>
                  <EditableField value={editedTitle} onChange={setEditedTitle} placeholder="No suggestion generated" />
                  {editedTitle && (
                    <button
                      onClick={() => setShowConfirm("title")}
                      disabled={applying !== null}
                      className="mt-3 text-xs px-3 py-1.5 bg-[#e60023] text-white rounded-lg hover:bg-[#c0001d] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {applying === "title" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Apply Title
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Description section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Description</h2>
              </div>
              <div className="divide-y divide-gray-50">
                <div className="px-5 py-4">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Current Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                    {data.current.description || <span className="text-gray-400 italic">No description</span>}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#e60023] uppercase tracking-wide">Optimized Description</p>
                    <CopyButton text={editedDescription} />
                  </div>
                  <EditableField value={editedDescription} onChange={setEditedDescription} multiline placeholder="No suggestion generated" />
                  {editedDescription && (
                    <button
                      onClick={() => setShowConfirm("description")}
                      disabled={applying !== null}
                      className="mt-3 text-xs px-3 py-1.5 bg-[#e60023] text-white rounded-lg hover:bg-[#c0001d] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {applying === "description" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Apply Description
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Analysis: improvements & issues */}
            {(data.improvements.length > 0 || data.issues.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">Why this is better</h2>
                {data.improvements.length > 0 && (
                  <div className="space-y-2">
                    {data.improvements.map((imp, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {imp}
                      </div>
                    ))}
                  </div>
                )}
                {data.issues.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current issues detected</p>
                    {data.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm text-amber-700">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Keywords */}
            {(data.keywords.primary.length > 0 || data.keywords.secondary.length > 0 || data.keywords.related.length > 0) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">Keyword Coverage</h2>
                {data.keywords.primary.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Primary</p>
                    <div className="flex flex-wrap gap-2">
                      {data.keywords.primary.map(k => (
                        <span key={k} className="text-xs bg-[#e60023]/10 text-[#e60023] font-medium px-2.5 py-1 rounded-full">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {data.keywords.secondary.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Secondary</p>
                    <div className="flex flex-wrap gap-2">
                      {data.keywords.secondary.map(k => (
                        <span key={k} className="text-xs bg-blue-50 text-blue-700 font-medium px-2.5 py-1 rounded-full">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {data.keywords.related.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Related</p>
                    <div className="flex flex-wrap gap-2">
                      {data.keywords.related.map(k => (
                        <span key={k} className="text-xs bg-gray-100 text-gray-600 font-medium px-2.5 py-1 rounded-full">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Regenerate */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Regenerate Suggestions</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={e => setFocusKeyword(e.target.value)}
                  placeholder="Optional focus keyword (e.g. sterling silver necklace)"
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e60023]/20"
                  onKeyDown={e => { if (e.key === "Enter") generate(); }}
                />
                <button
                  onClick={() => generate()}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            </div>

            {/* Apply both CTA */}
            {editedTitle && editedDescription && (
              <button
                onClick={() => setShowConfirm("both")}
                disabled={applying !== null}
                className="w-full py-3 bg-[#e60023] text-white font-semibold rounded-2xl hover:bg-[#c0001d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {applying === "both" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Apply to Pinterest Catalog
              </button>
            )}
          </>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Apply optimized content?</h3>
            <p className="text-sm text-gray-500">This will update the product in your Pinterest catalog.</p>
            {showConfirm !== "description" && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Title</p>
                <p className="text-sm text-gray-800">{editedTitle}</p>
              </div>
            )}
            {showConfirm !== "title" && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-800 line-clamp-3">{editedDescription}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => applyToShopify(showConfirm)}
                disabled={applying !== null}
                className="flex-1 py-2.5 bg-[#e60023] text-white text-sm font-semibold rounded-xl hover:bg-[#c0001d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
