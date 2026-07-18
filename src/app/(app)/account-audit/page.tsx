"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, User, Search, ExternalLink, Loader2,
  Tag, LayoutGrid, TrendingUp, Hash, AlertCircle,
  ChevronLeft, ChevronRight, Copy, CheckCircle2, Globe,
  XCircle, Link2, Copy as CopyIcon, Filter,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Keyword { keyword: string; count: number; sources?: string[] }

interface PinKeyword {
  keyword: string;
  inTitle: boolean;
  inDescription: boolean;
  type: "short" | "long";
}

interface BoardPin {
  id: string;
  title: string;
  description: string;
  link: string;
  thumbnail: string;
  altText: string;
  keywords: PinKeyword[];
  createdAt: string;
}

interface OwnAudit {
  profile: {
    username: string; displayName: string; about: string;
    followerCount: number; followingCount: number; pinCount: number;
    boardCount: number; profileImage: string; website: string;
  };
  boards: { id: string; name: string; description: string; pinCount: number; url: string }[];
  keywords: Keyword[];
  totalTextsAnalyzed: number;
}

interface ExternalPin {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  pinUrl: string;
  keywords: PinKeyword[];
}

interface ExternalAudit {
  username: string; displayName: string; about: string;
  followerInfo: string; keywords: Keyword[]; textsAnalyzed: number;
  pins: ExternalPin[];
}

// ── Keyword Badge (clickable copy) ─────────────────────────────────────────────

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
  const copy = () => {
    navigator.clipboard.writeText(kw.keyword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:scale-105 active:scale-95", colors[index % colors.length])}>
      <Hash className="w-3 h-3 opacity-60" />
      {kw.keyword}
      {kw.count > 1 && <span className="opacity-50 text-[10px]">×{kw.count}</span>}
      {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-30" />}
    </button>
  );
}

// ── Pin Keyword chip for the board table ───────────────────────────────────────

function PinKwChip({ kw }: { kw: PinKeyword }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(kw.keyword); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  let cls = "bg-gray-100 text-gray-500 border-gray-200";
  let dot = "bg-gray-300";
  let title = "Not found in title or description";
  if (kw.inTitle && kw.inDescription) { cls = "bg-green-100 text-green-700 border-green-300"; dot = "bg-green-500"; title = "Found in title & description"; }
  else if (kw.inTitle) { cls = "bg-blue-100 text-blue-700 border-blue-300"; dot = "bg-blue-500"; title = "Found in title"; }
  else if (kw.inDescription) { cls = "bg-purple-100 text-purple-700 border-purple-300"; dot = "bg-purple-500"; title = "Found in description"; }

  return (
    <button onClick={copy} title={title} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all hover:scale-105 whitespace-nowrap", cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
      {kw.type === "long" && <span className="opacity-50">L·</span>}
      {kw.keyword}
      {copied && <CheckCircle2 className="w-2.5 h-2.5 ml-0.5" />}
    </button>
  );
}

// ── Duplicate detection helpers ────────────────────────────────────────────────

function buildDuplicateMap(pins: BoardPin[]): Map<string, string[]> {
  // Group pins by each duplicate signal; a pin is a duplicate if it shares
  // title, description, OR thumbnail with at least one other pin.
  const byTitle = new Map<string, string[]>();
  const byDesc  = new Map<string, string[]>();
  const byThumb = new Map<string, string[]>();

  for (const p of pins) {
    const t = p.title.trim().toLowerCase();
    const d = p.description.trim().toLowerCase();
    const th = p.thumbnail;
    if (t) { if (!byTitle.has(t)) byTitle.set(t, []); byTitle.get(t)!.push(p.id); }
    if (d) { if (!byDesc.has(d))  byDesc.set(d, []);  byDesc.get(d)!.push(p.id); }
    if (th){ if (!byThumb.has(th))byThumb.set(th,[]);  byThumb.get(th)!.push(p.id); }
  }

  // pinId → set of pinIds it's a duplicate of
  const dupSets = new Map<string, Set<string>>();
  const link = (ids: string[]) => {
    if (ids.length < 2) return;
    for (const id of ids) {
      if (!dupSets.has(id)) dupSets.set(id, new Set());
      for (const other of ids) { if (other !== id) dupSets.get(id)!.add(other); }
    }
  };
  for (const ids of byTitle.values()) link(ids);
  for (const ids of byDesc.values())  link(ids);
  for (const ids of byThumb.values()) link(ids);

  // Return pinId → sorted list of duplicate pinIds
  const result = new Map<string, string[]>();
  for (const [id, others] of dupSets) result.set(id, Array.from(others));
  return result;
}

// ── Board Detail View ──────────────────────────────────────────────────────────

function BoardDetail({
  board,
  onBack,
}: {
  board: { id: string; name: string; pinCount: number; description?: string; url?: string };
  onBack: () => void;
}) {
  const [pins, setPins] = useState<BoardPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showDupsOnly, setShowDupsOnly] = useState(false);

  useEffect(() => {
    fetch(`/api/account-audit/board?boardId=${board.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPins(d.pins ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [board.id]);

  const dupMap = buildDuplicateMap(pins);
  const dupPinCount = dupMap.size; // total pins that have at least one duplicate

  const filtered = pins.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchDup = !showDupsOnly || dupMap.has(p.id);
    return matchSearch && matchDup;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" />
          All Boards
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        {board.url ? (
          <a
            href={board.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-[#e60023] transition-colors group"
            title="Open board on Pinterest"
          >
            {board.name}
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          </a>
        ) : (
          <span className="text-sm font-semibold text-gray-800">{board.name}</span>
        )}
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{board.pinCount} pins</span>

        {/* Board description badge */}
        {board.description?.trim() ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-200">
            <CheckCircle2 className="w-3 h-3" />
            Board description found
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
            <XCircle className="w-3 h-3" />
            No board description
          </span>
        )}

        {/* Duplicate summary badge */}
        {!loading && dupPinCount > 0 && (
          <button
            onClick={() => setShowDupsOnly((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
              showDupsOnly
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
            )}
          >
            <CopyIcon className="w-3 h-3" />
            {dupPinCount} duplicate pin{dupPinCount !== 1 ? "s" : ""} detected
            {showDupsOnly ? " — showing only" : " — click to filter"}
          </button>
        )}
        {!loading && dupPinCount === 0 && pins.length > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-200">
            <CheckCircle2 className="w-3 h-3" />
            No duplicates found
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">Keyword legend:</span>
        {[
          { dot: "bg-green-500", label: "In title & description" },
          { dot: "bg-blue-500", label: "In title only" },
          { dot: "bg-purple-500", label: "In description only" },
          { dot: "bg-gray-300", label: "Not found" },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", dot)} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="opacity-50 font-mono">L·</span> = long-tail keyword
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pins by title or description…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-[#e60023] animate-spin" />
          <p className="text-sm text-gray-500">Loading pins from {board.name}…</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Pins</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-52">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-64">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Link</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Keywords</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-gray-400">No pins found</td>
                  </tr>
                ) : filtered.map((pin) => { const isDup = dupMap.has(pin.id); return (
                  <tr key={pin.id} className={cn("transition-colors align-top", isDup ? "bg-orange-50/40 hover:bg-orange-50/70" : "hover:bg-gray-50/60")}>
                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                      <a
                        href={`https://pinterest.com/pin/${pin.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open pin on Pinterest"
                        className="block relative group w-12 h-12 flex-shrink-0"
                      >
                        {pin.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pin.thumbnail} alt={pin.title || "pin"} className="w-12 h-12 object-cover rounded-lg border border-gray-100 group-hover:opacity-80 transition-opacity" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 group-hover:bg-gray-200 transition-colors">
                            <Tag className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                          <ExternalLink className="w-3.5 h-3.5 text-white" />
                        </div>
                      </a>
                      {isDup && (
                        <span className="text-[9px] font-bold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          DUP ×{(dupMap.get(pin.id)?.length ?? 0) + 1}
                        </span>
                      )}
                      </div>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {pin.title.trim() ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                          {pin.title.trim() || <span className="text-gray-300 italic">No title</span>}
                        </span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {pin.description.trim() ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                          {pin.description.trim() || <span className="text-gray-300 italic">No description</span>}
                        </span>
                      </div>
                    </td>

                    {/* Link */}
                    <td className="px-4 py-3">
                      {pin.link ? (
                        <a
                          href={pin.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[#e60023] hover:underline text-xs font-medium max-w-[120px] truncate"
                          title={pin.link}
                        >
                          <Link2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{pin.link.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-gray-300 italic">No link</span>
                        </span>
                      )}
                    </td>

                    {/* Keywords */}
                    <td className="px-4 py-3">
                      {pin.keywords.length === 0 ? (
                        <span className="text-xs text-gray-300 italic">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {pin.keywords.map((kw) => (
                            <PinKwChip key={kw.keyword} kw={kw} />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>
                Showing {filtered.length} of {pins.length} pins
                {dupPinCount > 0 && (
                  <span className="ml-2 text-orange-500 font-semibold">· {dupPinCount} duplicates</span>
                )}
              </span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Click any keyword to copy</span>
            </div>
          )}
        </div>
      )}
    </div>
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
  const [selectedBoard, setSelectedBoard] = useState<{ id: string; name: string; pinCount: number; description?: string; url?: string } | null>(null);

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

  useEffect(() => {
    if (activeTab === "own" && connected && !ownData && !ownLoading) loadOwn();
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
    } catch (e) { setOwnError((e as Error).message); }
    finally { setOwnLoading(false); }
  }

  async function analyzeExternal() {
    if (!extUrl.trim()) return;
    setExtLoading(true); setExtError(""); setExtData(null);
    try {
      const res = await fetch("/api/account-audit/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to analyze");
      setExtData(data);
    } catch (e) { setExtError((e as Error).message); }
    finally { setExtLoading(false); }
  }

  const filteredKeywords = (ownData?.keywords ?? []).filter((k) =>
    k.keyword.toLowerCase().includes(keywordFilter.toLowerCase())
  );

  return (
    <div>
      <Header title="Account Audit" subtitle="Analyze keyword strategy for your account or any public Pinterest profile" />

      <div className="p-6 space-y-6">
        {/* Tab Switch */}
        <div className="flex bg-gray-100 rounded-2xl p-1 w-fit gap-1">
          {([
            { key: "own", label: "Your Account", icon: User },
            { key: "external", label: "Other Account", icon: Globe },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSelectedBoard(null); }}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
                <button onClick={loadOwn} className="text-sm font-semibold text-[#e60023] hover:underline">Try again</button>
              </div>
            ) : ownData ? (
              selectedBoard ? (
                <BoardDetail board={selectedBoard} onBack={() => setSelectedBoard(null)} />
              ) : (
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
                    <button onClick={loadOwn} className="ml-2 text-xs text-gray-400 hover:text-[#e60023] transition-colors underline flex-shrink-0">Refresh</button>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: LayoutGrid, label: "Boards", val: ownData.boards.length, color: "text-blue-600 bg-blue-50" },
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

                  {/* Boards — clickable */}
                  {ownData.boards.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-800 text-sm">Your Boards ({ownData.boards.length})</span>
                        <span className="ml-auto text-xs text-gray-400">Click a board to audit its pins</span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-y divide-gray-50">
                        {ownData.boards.map((board) => (
                          <button
                            key={board.id}
                            onClick={() => setSelectedBoard({ id: board.id, name: board.name, pinCount: board.pinCount, description: board.description, url: board.url })}
                            className="p-3 flex items-center gap-2 group hover:bg-[#e60023]/5 transition-colors text-left w-full"
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#e60023]/10 group-hover:bg-[#e60023]/20 flex items-center justify-center flex-shrink-0 transition-colors">
                              <LayoutGrid className="w-3.5 h-3.5 text-[#e60023]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-[#e60023] transition-colors">{board.name}</p>
                              <p className="text-xs text-gray-400">{board.pinCount ?? 0} pins</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#e60023] flex-shrink-0 transition-colors" />
                          </button>
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
                          {filteredKeywords.map((kw, i) => <KeywordBadge key={kw.keyword} kw={kw} index={i} />)}
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-3">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Click any keyword to copy. Sorted by frequency.
                      </p>
                    </div>
                  </div>
                </>
              )
            ) : null}
          </div>
        )}

        {/* ── Other Account Tab ── */}
        {activeTab === "external" && (
          <div className="space-y-5">
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
                    {extLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Search className="w-4 h-4" /> Analyze</>}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Only public Pinterest profiles can be analyzed. Keywords are extracted from the profile&apos;s visible boards, pin titles, and descriptions.</p>
              </div>
            </div>

            {extError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-600">{extError}</p>
              </div>
            )}

            {extData && (
              <div className="space-y-4">
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
                  <a href={`https://pinterest.com/${extData.username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#e60023] font-medium hover:underline flex-shrink-0">
                    View Profile <ChevronRight className="w-3 h-3" />
                  </a>
                </div>

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
                        {extData.keywords.map((kw, i) => <KeywordBadge key={kw.keyword} kw={kw} index={i} />)}
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Click any keyword to copy. Use these insights to improve your own content strategy.
                    </p>
                  </div>
                </div>

                {/* Pin list table */}
                {(
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[#e60023]" />
                        <span className="font-semibold text-gray-800 text-sm">
                          Pins Detected <span className="text-gray-400 font-normal">({extData.pins.length})</span>
                        </span>
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {[
                          { dot: "bg-green-500", label: "Title & desc" },
                          { dot: "bg-blue-500", label: "Title only" },
                          { dot: "bg-purple-500", label: "Desc only" },
                          { dot: "bg-gray-300", label: "Not found" },
                        ].map(({ dot, label }) => (
                          <span key={label} className="flex items-center gap-1">
                            <span className={cn("w-2 h-2 rounded-full", dot)} />
                            {label}
                          </span>
                        ))}
                        <span className="text-gray-300 font-mono">L·</span>
                        <span>= long-tail</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Pin</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-52">Title</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-64">Description</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Keywords</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {extData.pins.map((pin) => (
                            <tr key={pin.id} className="hover:bg-gray-50/60 transition-colors align-top">
                              {/* Thumbnail */}
                              <td className="px-4 py-3">
                                <a href={pin.pinUrl} target="_blank" rel="noopener noreferrer" title="Open on Pinterest" className="block relative group w-12 h-12">
                                  {pin.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={pin.thumbnail} alt={pin.title} className="w-12 h-12 object-cover rounded-lg border border-gray-100 group-hover:opacity-80 transition-opacity" />
                                  ) : (
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 group-hover:bg-gray-200">
                                      <Tag className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                                  </div>
                                </a>
                              </td>
                              {/* Title */}
                              <td className="px-4 py-3">
                                <div className="flex items-start gap-2">
                                  {pin.title ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                  )}
                                  <span className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                                    {pin.title || <span className="text-gray-300 italic">No title</span>}
                                  </span>
                                </div>
                              </td>
                              {/* Description */}
                              <td className="px-4 py-3">
                                <div className="flex items-start gap-2">
                                  {pin.description ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                  )}
                                  <span className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                                    {pin.description || <span className="text-gray-300 italic">No description</span>}
                                  </span>
                                </div>
                              </td>
                              {/* Keywords */}
                              <td className="px-4 py-3">
                                {pin.keywords.length === 0 ? (
                                  <span className="text-xs text-gray-300 italic">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {pin.keywords.map((kw) => <PinKwChip key={kw.keyword} kw={kw} />)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {extData.pins.length === 0 && (
                      <div className="py-10 text-center text-sm text-gray-400">
                        <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No pins could be extracted from this profile.</p>
                        <p className="text-xs mt-1 text-gray-300">Pinterest renders pins via JavaScript — only data embedded in the initial HTML is available.</p>
                      </div>
                    )}
                    <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Pin data is extracted from the public profile page — count may be limited to what Pinterest embeds on load.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
