"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  XCircle,
  ChevronRight,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scorePinSEO, gradeFromScore } from "@/lib/seo-audit-engine";

interface BoardInfo {
  id: string;
  name: string;
  description: string;
  pinCount: number;
}

interface PinRow {
  id: string;
  title: string;
  description: string;
  altText: string;
  link: string;
  thumbnailUrl: string;
  createdAt: string;
  creativeType: string;
  score: number;
  grade: string;
}

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: "bg-green-100 text-green-700",
    B: "bg-blue-100 text-blue-700",
    C: "bg-yellow-100 text-yellow-700",
    D: "bg-orange-100 text-orange-700",
    F: "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold", colors[grade] ?? "bg-gray-100 text-gray-600")}>
      {grade}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? "bg-green-500" : score >= 70 ? "bg-blue-500" : score >= 55 ? "bg-yellow-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-7">{score}</span>
    </div>
  );
}

export default function BoardsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 className="w-7 h-7 animate-spin text-red-400" /></div>}>
      <BoardsContent />
    </Suspense>
  );
}

function BoardsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const boardId = params.get("id");

  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [pins, setPins] = useState<PinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId) {
      setError("No board selected.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/seo-audit/boards?boardId=${boardId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setBoard(data.board);
        const scored: PinRow[] = (data.pins ?? []).map((p: {
          id: string; title: string; description: string; altText: string;
          link: string; thumbnailUrl: string; createdAt: string; creativeType: string;
        }) => {
          const result = scorePinSEO({
            id: p.id, title: p.title, description: p.description,
            altText: p.altText, link: p.link,
            boardName: data.board?.name ?? "",
            boardDescription: data.board?.description ?? "",
            focusKeyword: "",
          });
          return { ...p, score: result.overall, grade: gradeFromScore(result.overall) };
        });
        setPins(scored.sort((a, b) => a.score - b.score));
      })
      .catch(() => setError("Failed to load board data."))
      .finally(() => setLoading(false));
  }, [boardId]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button
        onClick={() => router.push("/seo-audit")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Account Audit
      </button>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-red-400" />
          <span className="ml-3 text-gray-500">Loading board pins…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 flex items-center gap-3">
          <XCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {board && !loading && (
        <>
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-gray-900">{board.name}</h1>
            {board.description && <p className="text-sm text-gray-500 mt-1">{board.description}</p>}
            <p className="text-xs text-gray-400 mt-1">{pins.length} pins · sorted by SEO score (lowest first)</p>
          </div>

          {pins.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
              No pins found in this board.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-12"></th>
                    <th className="px-4 py-3 text-left">Pin</th>
                    <th className="px-4 py-3 text-left">SEO Score</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Issues</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Type</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pins.map((pin) => (
                    <PinTableRow
                      key={pin.id}
                      pin={pin}
                      boardId={boardId!}
                      onClick={() => router.push(`/seo-audit/pin?id=${pin.id}&boardId=${boardId}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PinTableRow({
  pin,
  boardId,
  onClick,
}: {
  pin: PinRow;
  boardId: string;
  onClick: () => void;
}) {
  const missingFields = [
    !pin.title && "title",
    !pin.description && "description",
    !pin.altText && "alt text",
    !pin.link && "link",
  ].filter(Boolean);

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        {pin.thumbnailUrl ? (
          <img
            src={pin.thumbnailUrl}
            alt={pin.title || "Pin thumbnail"}
            className="w-10 h-10 object-cover rounded"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-gray-300" />
          </div>
        )}
      </td>

      <td className="px-4 py-3 max-w-xs">
        <div className="font-medium text-gray-900 truncate">{pin.title || <span className="text-gray-400 italic">No title</span>}</div>
        {pin.description && (
          <div className="text-xs text-gray-400 truncate mt-0.5">{pin.description.slice(0, 80)}</div>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ScoreBar score={pin.score} />
          <GradeBadge grade={pin.grade} />
        </div>
      </td>

      <td className="px-4 py-3 hidden md:table-cell">
        {missingFields.length > 0 ? (
          <span className="text-xs text-red-600">Missing: {missingFields.join(", ")}</span>
        ) : (
          <span className="text-xs text-green-600">All fields present</span>
        )}
      </td>

      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-gray-400">{pin.creativeType}</span>
      </td>

      <td className="px-4 py-3">
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </td>
    </tr>
  );
}
