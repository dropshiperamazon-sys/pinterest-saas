"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountSEOSummary, BoardSEOSummary } from "@/lib/seo-audit-engine";

type AccountData = AccountSEOSummary & {
  profile: {
    username: string;
    displayName: string;
    followerCount: number;
    pinCount: number;
    boardCount: number;
    profileImage: string;
  };
};

function GradeBadge({ grade, size = "md" }: { grade: string; size?: "sm" | "md" | "lg" }) {
  const colors: Record<string, string> = {
    A: "bg-green-100 text-green-700 border-green-200",
    B: "bg-blue-100 text-blue-700 border-blue-200",
    C: "bg-yellow-100 text-yellow-700 border-yellow-200",
    D: "bg-orange-100 text-orange-700 border-orange-200",
    F: "bg-red-100 text-red-700 border-red-200",
  };
  const sizes = { sm: "text-xs px-1.5 py-0.5", md: "text-sm px-2 py-1 font-semibold", lg: "text-2xl px-4 py-2 font-bold" };
  return (
    <span className={cn("inline-flex items-center rounded border", colors[grade] ?? "bg-gray-100 text-gray-700", sizes[size])}>
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
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export default function SEOAuditPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(bust = false) {
    setLoading(true);
    setError(null);
    try {
      const url = bust ? `/api/seo-audit/account?t=${Date.now()}` : "/api/seo-audit/account";
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json as AccountData);
    } catch {
      setError("Failed to load SEO audit data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pinterest SEO Audit</h1>
            <p className="text-sm text-gray-500">Account-wide analysis of your pins and boards</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-red-400" />
          <span className="ml-3 text-gray-500">Analyzing your Pinterest account…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          {error === "Pinterest not connected"
            ? "Connect your Pinterest account to run an SEO audit."
            : error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Score overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-6">
              <ScoreRing score={data.overallScore} size={90} />
              <div>
                <div className="text-sm text-gray-500 mb-1">Overall SEO Score</div>
                <GradeBadge grade={data.grade} size="lg" />
                <div className="text-xs text-gray-400 mt-1">{data.pinsAnalyzed} pins analyzed</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <XCircle className="w-4 h-4 text-red-500" /> Critical Issues
              </div>
              {data.criticalIssues.length === 0 ? (
                <p className="text-sm text-green-600">No critical issues found.</p>
              ) : (
                <ul className="space-y-1">
                  {data.criticalIssues.map((issue, i) => (
                    <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">•</span>{issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-500" /> Opportunities
              </div>
              {data.opportunities.length === 0 ? (
                <p className="text-sm text-gray-400">No opportunities detected.</p>
              ) : (
                <ul className="space-y-1">
                  {data.opportunities.slice(0, 4).map((op, i) => (
                    <li key={i} className="text-xs text-yellow-700 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">•</span>{op}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Boards */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
              <LayoutGrid className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-800">Boards ({data.boardSummaries.length})</h2>
              <span className="ml-auto text-xs text-gray-400">Click a board to see its pins</span>
            </div>

            {data.boardSummaries.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No boards found on your account.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.boardSummaries.map((board) => (
                  <BoardRow key={board.id} board={board} onClick={() => router.push(`/seo-audit/boards?id=${board.id}`)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BoardRow({ board, onClick }: { board: BoardSEOSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{board.name}</div>
        {board.description && (
          <div className="text-xs text-gray-400 truncate mt-0.5">{board.description}</div>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-xs text-gray-400">{board.pinCount} pins</div>

        <ScoreRing score={board.avgScore} size={44} />
        <GradeBadge grade={board.grade} size="sm" />

        {board.issueCount > 0 && (
          <span className="text-xs bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5">
            {board.issueCount} issues
          </span>
        )}

        {board.issueCount === 0 && (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}

        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </button>
  );
}
