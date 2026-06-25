"use client";
import { useState, useCallback } from "react";
import { KeyRound, ChevronLeft, Copy, Check, RefreshCw } from "lucide-react";
import Link from "next/link";

const CHARSETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
};

function strengthLabel(score: number) {
  if (score < 30) return { label: "Weak", color: "bg-red-500", text: "text-red-600" };
  if (score < 60) return { label: "Fair", color: "bg-amber-400", text: "text-amber-600" };
  if (score < 80) return { label: "Strong", color: "bg-emerald-400", text: "text-emerald-600" };
  return { label: "Very Strong", color: "bg-emerald-600", text: "text-emerald-700" };
}

function calcStrength(pw: string) {
  let score = 0;
  score += Math.min(pw.length * 2, 40);
  if (/[A-Z]/.test(pw)) score += 10;
  if (/[a-z]/.test(pw)) score += 10;
  if (/[0-9]/.test(pw)) score += 10;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  if (new Set(pw).size > pw.length * 0.6) score += 15;
  return Math.min(score, 100);
}

export default function PasswordGeneratorPage() {
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: false });
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(1);
  const [bulk, setBulk] = useState<string[]>([]);

  const generate = useCallback((len = length, options = opts) => {
    let charset = "";
    if (options.upper) charset += CHARSETS.upper;
    if (options.lower) charset += CHARSETS.lower;
    if (options.digits) charset += CHARSETS.digits;
    if (options.symbols) charset += CHARSETS.symbols;
    if (!charset) charset = CHARSETS.lower;
    return Array.from(crypto.getRandomValues(new Uint32Array(len)))
      .map((n) => charset[n % charset.length])
      .join("");
  }, [length, opts]);

  const handleGenerate = () => {
    const pw = generate();
    setPassword(pw);
    setBulk([]);
  };

  const handleBulk = () => {
    setBulk(Array.from({ length: count }, () => generate()));
    setPassword("");
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const strength = password ? calcStrength(password) : 0;
  const { label: sLabel, color: sColor, text: sText } = strengthLabel(strength);

  const toggle = (key: keyof typeof opts) => setOpts((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Password Generator</h1>
      </div>
      <p className="text-slate-500 mb-8">Generate cryptographically secure passwords using your browser's built-in crypto API.</p>

      {/* Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Length</label>
            <span className="text-violet-600 font-bold">{length}</span>
          </div>
          <input type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-full accent-violet-600" />
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>8</span><span>64</span></div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">Character types</p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(opts) as (keyof typeof opts)[]).map((key) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={opts[key]} onChange={() => toggle(key)} className="w-4 h-4 accent-violet-600 rounded" />
                <span className="text-sm text-slate-700 capitalize">
                  {key === "upper" ? "Uppercase (A–Z)" : key === "lower" ? "Lowercase (a–z)" : key === "digits" ? "Numbers (0–9)" : "Symbols (!@#…)"}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Generate */}
      <button
        onClick={handleGenerate}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3.5 rounded-xl transition-colors mb-6"
      >
        <RefreshCw className="w-4 h-4" /> Generate Password
      </button>

      {/* Result */}
      {password && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-700">Generated Password</p>
            <button onClick={() => copy(password)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 font-mono text-base text-slate-900 break-all mb-4 border border-slate-100">
            {password}
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500">Strength</span>
              <span className={`font-semibold ${sText}`}>{sLabel}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${sColor} rounded-full transition-all`} style={{ width: `${strength}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Bulk generation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Bulk Generate</h2>
        <div className="flex items-center gap-3 mb-3">
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value))))}
            className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          <span className="text-sm text-slate-600">passwords</span>
          <button onClick={handleBulk} className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            Generate
          </button>
        </div>
        {bulk.length > 0 && (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {bulk.map((pw, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-mono text-sm text-slate-800 truncate">{pw}</span>
                <button onClick={() => copy(pw)} className="ml-2 shrink-0 p-1 text-slate-400 hover:text-violet-600">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
