"use client";
import { useState } from "react";
import { Clock, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";

const SPEEDS = [
  { label: "Slow Reader", wpm: 150 },
  { label: "Average", wpm: 238 },
  { label: "Fast Reader", wpm: 350 },
  { label: "Speed Reader", wpm: 600 },
];

function fmtTime(minutes: number) {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  return `${h}h ${m}m`;
}

export default function ReadingTimePage() {
  const [text, setText] = useState("");

  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Reading Time Estimator</h1>
      </div>
      <p className="text-slate-500 mb-8">Paste any text to see how long it takes to read at different speeds.</p>

      {/* Reading time grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {SPEEDS.map(({ label, wpm }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
            <p className="text-xl font-bold text-emerald-600">{words ? fmtTime(words / wpm) : "—"}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
            <p className="text-xs text-slate-400">{wpm} wpm</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 p-4 flex gap-6">
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-slate-900">{words.toLocaleString()}</p>
          <p className="text-xs text-slate-500">words</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-slate-900">{text.length.toLocaleString()}</p>
          <p className="text-xs text-slate-500">characters</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-2xl font-bold text-slate-900">
            {text.trim() ? (text.trim().match(/[.!?]+/g) ?? []).length || 1 : 0}
          </p>
          <p className="text-xs text-slate-500">sentences</p>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your article, blog post, or any text here…"
          className="w-full min-h-64 border border-slate-200 rounded-2xl p-5 text-slate-800 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-emerald-300 shadow-sm"
        />
        {text && (
          <button onClick={() => setText("")} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
