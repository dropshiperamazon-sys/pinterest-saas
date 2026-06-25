"use client";
import { useState } from "react";
import { Binary, ChevronLeft, Copy, Check, ArrowUpDown, AlertCircle } from "lucide-react";
import Link from "next/link";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function Base64Page() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const output = (() => {
    if (!input.trim()) return "";
    try {
      setError("");
      if (mode === "encode") return btoa(unescape(encodeURIComponent(input)));
      return decodeURIComponent(escape(atob(input.trim())));
    } catch {
      setError(mode === "decode" ? "Invalid Base64 string." : "Encoding error.");
      return "";
    }
  })();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
          <Binary className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Base64 Encoder / Decoder</h1>
      </div>
      <p className="text-slate-500 mb-8">Instantly encode or decode text to/from Base64 format.</p>

      {/* Mode toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {(["encode", "decode"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setInput(""); }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
              mode === m ? "bg-white shadow text-violet-700" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">
              {mode === "encode" ? "Plain text input" : "Base64 input"}
            </label>
            {input && <CopyBtn text={input} />}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Enter text to encode…" : "Paste Base64 to decode…"}
            className="w-full min-h-40 text-sm font-mono text-slate-800 resize-y focus:outline-none"
          />
        </div>

        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
            <ArrowUpDown className="w-4 h-4 text-violet-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">
              {mode === "encode" ? "Base64 output" : "Decoded text"}
            </label>
            {output && <CopyBtn text={output} />}
          </div>
          {error ? (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : (
            <p className={`text-sm font-mono break-all min-h-10 ${output ? "text-slate-800" : "text-slate-300"}`}>
              {output || "Output will appear here…"}
            </p>
          )}
        </div>
      </div>

      {/* URL safe note */}
      <div className="mt-8 bg-violet-50 rounded-2xl p-5 text-sm text-violet-800">
        <strong>URL-safe Base64:</strong> Replace <code>+</code> with <code>-</code> and <code>/</code> with <code>_</code> for use in URLs.
      </div>
    </div>
  );
}
