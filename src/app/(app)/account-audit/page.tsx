"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, User, Search, ExternalLink, Loader2,
  Tag, LayoutGrid, TrendingUp, Hash, AlertCircle,
  ChevronRight, Copy, CheckCircle2, Globe,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Keyword {
  keyword: string;
  count: number;
  sources?: string[];
}

interface OwnAudit {
  profile: {
    username: string;
    displayName: string;
    about: string;
    followerCount: number;
    followingCount: number;
    pinCount: number;
    boardCount: number;
    profileImage: string;
    website: string;
  };
  boards: { id: string; name: string; description: string; pinCount: number }[];
  keywords: Keyword[];
  totalTextsAnalyzed: number;
}

interface ExternalAudit {
  username: string;
  displayName: string;
  about: string;
  followerInfo: string;
  keywords: Keyword[];
  textsAnalyzed: number;
}

// ── Keyword Badge ──────────────────────────────────────────────────────────────

function KeywordBadge({ kw, index }: { kw: Keyword; index: number }) {
  const [copied, setCopied] = useState(false);
  const colors = [
    "bg-[#e60023]/10 text-[#e60023] border-[#e60023]/20",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-green-100 text-green-700 border-green-200",
    "bg-orange-100 text-orange-700 border-orange-200",
    "bg-teal-100 text-teal-700 border-teal-200",
  ];
  const color = colors[index % colors.length];

  const copy = () => {
    navigator.clipboard.writeText(kw.keyword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      title={kw.sources?.join(" | ")}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:scale-105 active:scale-95",
        color
      )}
    >
      <Hash className="w-3 h-3 opacity-60" />
      {kw.keyword}
      {kw.count > 1 && <span className="opacity-50 text-[10px]">×{kw.count}</span>}
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-30" />}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AccountAuditPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"own" | "external">("own");

  // Own account state
  const [ownLoading, setOwnLoading] = useState(false);
  const [ownData, setOwnData] = useState<OwnAudit | null>(null);
  const [ownError, setOwnError] = useState("");
  const [connected, setConnected] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState("");

  // External account state
  const [extUrl, setExtUrl] = useState("");
  const [extLoading, setExtLoading] = useState(false);
  const [extData, setExtData] = useState<ExternalAudit | null>(null);
  const [extError, setExtError] = useState("");

  useEffect(() => {
    if (!session) return;
    fetch("/api/pinterest-connection")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => {});
  }, [session]);

  // Auto-load own account when tab opens and connected
  useEffect(() => {
    if (activeTab === "own" && connected && !ownData && !ownLoading) {
      loadOwn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, connected]);

  async function loadOwn() {
    setOwnLoading(true);
    setOwnError("");
    try {
      const res = await fetch("/api/account-audit");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setOwnData(data);
    } catch (e) {
      setOwnError((e as Error).message);
    } finally {
      setOwnLoading(false);
    }
  }

  async function analyzeExternal() {
    if (!extUrl.trim()) return;
    setExtLoading(true);
    setExtError("");
    setExtData(null);
    try {
      const res = await fetch("/api/account-audit/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to analyze");
      setExtData(data);
    } catch (e) {
      setExtError((e as Error).message);
    } finally {
      setExtLoading(false);
    }
  }

  const filteredKeywords = (ownData?.keywords ?? []).filter((k) =>
    k.keyword.toLowerCase().includes(keywordFilter.toLowerCase())
  );

  return (
    <div>
      <Header
        title="Account Audit"
        subtitle="Analyze keyword strategy for your account or any public Pinterest profile"
      />

      <div className="p-6 space-y-6">
        {/* Tab Switch */}
        <div className="flex bg-gray-100 rounded-2xl p-1 w-fit gap-1">
          {([
            { key: "own", label: "Your Account", icon: User },
            { key: "external", label: "Other Account", icon: Globe },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Your Account Tab ── */}
        {activeTab === "own" && (
          <div className="space-y-5">
            {!connected ? (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
                <ShieldCheck className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-800 mb-1">Pinterest not connected</p>
                <p className="text-sm text-gray-500 mb-4">Connect your Pinterest account to audit your keyword strategy.</p>
                <a href="/connect" className="inline-flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b]">
                  Connect Pinterest <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : ownLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-[#e60023] animate-spin" />
                <p className="text-sm text-gray-500">Scanning your boards and pins…</p>
              </div>
            ) : ownError ? (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-600 mb-3">{ownError}</p>
                <button onClick={loadOwn} className="text-sm font-semibold text-[#e60023] hover:underline">
                  Try again
                </button>
              </div>
            ) : ownData ? (
              <>
                {/* Profile Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                  {ownData.profile.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ownData.profile.profileImage} alt={ownData.profile.displayName} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#e60023] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                      {(ownData.profile.displayName || ownData.profile.username || "P")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-lg">{ownData.profile.displayName || ownData.profile.username}</div>
                    <div className="text-sm text-gray-500">@{ownData.profile.username}</div>
                    {ownData.profile.about && <p className="text-xs text-gray-400 mt-1 truncate">{ownData.profile.about}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-center flex-shrink-0">
                    {[
                      { label: "Followers", val: ownData.profile.followerCount },
                      { label: "Following", val: ownData.profile.followingCount },
                      { label: "Pins", val: ownData.profile.pinCount },
                      { label: "Boards", val: ownData.profile.boardCount },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div className="text-sm font-bold text-gray-900">{val?.toLocaleString() ?? "—"}</div>
                        <div className="text-xs text-gray-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={loadOwn} className="ml-2 text-xs text-gray-400 hover:text-[#e60023] transition-colors underline flex-shrink-0">
                    Refresh
                  </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: LayoutGrid, label: "Boards Analyzed", val: ownData.boards.length, color: "text-blue-600 bg-blue-50" },
                    { icon: Tag, label: "Keywords Detected", val: ownData.keywords.length, color: "text-[#e60023] bg-[#e60023]/10" },
                    { icon: TrendingUp, label: "Texts Scanned", val: ownData.totalTextsAnalyzed, color: "text-green-600 bg-green-50" },
                  ].map(({ icon: Icon, label, val, color }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-gray-900">{val}</div>
                        <div className="text-xs text-gray-500">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Boards */}
                {ownData.boards.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-800 text-sm">Your Boards ({ownData.boards.length})</span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-y divide-gray-50">
                      {ownData.boards.map((board) => (
                        <div key={board.id} className="p-3 flex items-center gap-2 group">
                          <div className="w-8 h-8 rounded-lg bg-[#e60023]/10 flex items-center justify-center flex-shrink-0">
                            <LayoutGrid className="w-3.5 h-3.5 text-[#e60023]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{board.name}</p>
                            <p className="text-xs text-gray-400">{board.pinCount ?? 0} pins</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Hash className="w-4 h-4 text-[#e60023]" />
                      <span className="font-semibold text-gray-800 text-sm">
                        Detected Keywords <span className="text-gray-400 font-normal">({filteredKeywords.length})</span>
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={keywordFilter}
                        onChange={(e) => setKeywordFilter(e.target.value)}
                        placeholder="Filter keywords…"
                        className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 w-44"
                      />
                    </div>
                  </div>
                  <div className="p-4">
                    {filteredKeywords.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No keywords found</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredKeywords.map((kw, i) => (
                          <KeywordBadge key={kw.keyword} kw={kw} index={i} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Click any keyword to copy it. Sorted by frequency.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── Other Account Tab ── */}
        {activeTab === "external" && (
          <div className="space-y-5">
            {/* URL Input */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-1">Pinterest Profile URL</label>
                <p className="text-xs text-gray-400 mb-3">Paste any public Pinterest profile link to extract their keyword strategy.</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={extUrl}
                      onChange={(e) => setExtUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && analyzeExternal()}
                      placeholder="https://pinterest.com/username or pinterest.com/username"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                  <button
                    onClick={analyzeExternal}
                    disabled={extLoading || !extUrl.trim()}
                    className="flex items-center gap-2 bg-[#e60023] text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {extLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    ) : (
                      <><Search className="w-4 h-4" /> Analyze</>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Only public Pinterest profiles can be analyzed. Keywords are extracted from the profile&apos;s visible boards, pin titles, and descriptions.
                </p>
              </div>
            </div>

            {/* Error */}
            {extError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-600">{extError}</p>
              </div>
            )}

            {/* Results */}
            {extData && (
              <div className="space-y-4">
                {/* Profile summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#e60023] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {(extData.displayName || extData.username || "P")[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{extData.displayName || extData.username}</div>
                    <div className="text-sm text-gray-500">@{extData.username}</div>
                    {extData.about && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{extData.about}</p>}
                    {extData.followerInfo && <p className="text-xs text-gray-400 mt-0.5">{extData.followerInfo}</p>}
                  </div>
                  <a
                    href={`https://pinterest.com/${extData.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#e60023] font-medium hover:underline flex-shrink-0"
                  >
                    View Profile <ChevronRight className="w-3 h-3" />
                  </a>
                </div>

                {/* Keyword count stat */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#e60023]/10 flex items-center justify-center">
                      <Hash className="w-5 h-5 text-[#e60023]" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{extData.keywords.length}</div>
                      <div className="text-xs text-gray-500">Keywords Detected</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{extData.textsAnalyzed}</div>
                      <div className="text-xs text-gray-500">Texts Scanned</div>
                    </div>
                  </div>
                </div>

                {/* Keywords */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-[#e60023]" />
                    <span className="font-semibold text-gray-800 text-sm">
                      Detected Keywords — <span className="text-gray-400 font-normal">@{extData.username}</span>
                    </span>
                  </div>
                  <div className="p-4">
                    {extData.keywords.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No keywords could be extracted from this profile.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {extData.keywords.map((kw, i) => (
                          <KeywordBadge key={kw.keyword} kw={kw} index={i} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Click any keyword to copy. Use these insights to improve your own content strategy.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
