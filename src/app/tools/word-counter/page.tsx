"use client";
import { useMemo } from "react";
import { Hash, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function analyze(text: string) {
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, "").length;
  const sentences = trimmed === "" ? 0 : (trimmed.match(/[.!?]+/g) ?? []).length || (trimmed.length > 0 ? 1 : 0);
  const paragraphs = trimmed === "" ? 0 : trimmed.split(/\n\s*\n/).filter(Boolean).length || (trimmed.length > 0 ? 1 : 0);
  const readingMinutes = Math.ceil(words / 238);
  const speakingMinutes = Math.ceil(words / 130);
  return { words, chars, charsNoSpace, sentences, paragraphs, readingMinutes, speakingMinutes };
}

export default function WordCounterPage() {
  const [text, setText] = useState("");
  const stats = useMemo(() => analyze(text), [text]);

  const STATS = [
    { label: "Words", value: stats.words, color: "text-violet-600" },
    { label: "Characters", value: stats.chars, color: "text-indigo-600" },
    { label: "Chars (no spaces)", value: stats.charsNoSpace, color: "text-blue-600" },
    { label: "Sentences", value: stats.sentences, color: "text-emerald-600" },
    { label: "Paragraphs", value: stats.paragraphs, color: "text-teal-600" },
    { label: "Read time (min)", value: stats.readingMinutes, color: "text-amber-600" },
    { label: "Speak time (min)", value: stats.speakingMinutes, color: "text-orange-600" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <Hash className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Word & Character Counter</h1>
      </div>
      <p className="text-slate-500 mb-8">Real-time word, character, sentence, and reading-time analysis.</p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {STATS.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-1 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing or paste your text here…"
          className="w-full min-h-72 border border-slate-200 rounded-2xl p-5 text-slate-800 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm font-mono"
        />
        {text && (
          <button
            onClick={() => setText("")}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Keyword density */}
      {stats.words > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Top Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              text
                .toLowerCase()
                .replace(/[^a-z\s]/g, "")
                .split(/\s+/)
                .filter((w) => w.length > 3)
                .reduce<Record<string, number>>((acc, w) => { acc[w] = (acc[w] ?? 0) + 1; return acc; }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 15)
              .map(([word, count]) => (
                <span key={word} className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1 text-sm">
                  <span className="font-medium text-slate-800">{word}</span>
                  <span className="text-xs text-slate-500 bg-white rounded-full px-1.5 py-0.5">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
