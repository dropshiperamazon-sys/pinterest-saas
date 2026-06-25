"use client";
import { useState } from "react";
import { Braces, ChevronLeft, Copy, Check, AlertCircle, Minimize2, Maximize2 } from "lucide-react";
import Link from "next/link";

export default function JsonFormatterPage() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState("");

  const format = (minify = false) => {
    try {
      const parsed = JSON.parse(input);
      setError("");
      return minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      setError(msg);
      return "";
    }
  };

  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const run = (minify = false) => {
    const result = format(minify);
    if (result) setOutput(result);
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tryParse = () => {
    try {
      JSON.parse(input);
      setError("");
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      setError(msg);
      return false;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
          <Braces className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">JSON Formatter & Validator</h1>
      </div>
      <p className="text-slate-500 mb-8">Paste messy JSON and format, validate, or minify it instantly.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Input */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">Input JSON</span>
            <button onClick={() => { setInput(""); setOutput(""); setError(""); }} className="text-xs text-slate-400 hover:text-red-500">Clear</button>
          </div>
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setOutput(""); setError(""); tryParse(); }}
            placeholder={'{\n  "hello": "world"\n}'}
            className="w-full min-h-72 p-5 text-sm font-mono text-slate-800 resize-y focus:outline-none"
          />
        </div>

        {/* Output */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">Formatted Output</span>
            {output && (
              <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
          <pre className={`p-5 text-sm font-mono min-h-72 whitespace-pre-wrap break-all ${output ? "text-emerald-700" : "text-slate-300"}`}>
            {output || "Formatted JSON will appear here…"}
          </pre>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Indent:</label>
          {[2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setIndent(n)}
              className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                indent === n ? "border-violet-400 text-violet-700 bg-violet-50" : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {n} spaces
            </button>
          ))}
        </div>
        <button
          onClick={() => run(false)}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Maximize2 className="w-4 h-4" /> Format
        </button>
        <button
          onClick={() => run(true)}
          className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Minimize2 className="w-4 h-4" /> Minify
        </button>
      </div>
    </div>
  );
}
