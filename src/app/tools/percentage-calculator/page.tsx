"use client";
import { useState } from "react";
import { AlignLeft, ChevronLeft } from "lucide-react";
import Link from "next/link";

function Row({ label, result }: { label: string; result: string }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="font-bold text-violet-700 text-lg">{result}</span>
    </div>
  );
}

export default function PercentageCalculatorPage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [d, setD] = useState("");

  const pct = (x: string, y: string) => {
    const xn = parseFloat(x), yn = parseFloat(y);
    if (isNaN(xn) || isNaN(yn) || yn === 0) return "—";
    return `${((xn / yn) * 100).toFixed(4).replace(/\.?0+$/, "")}%`;
  };

  const ofPct = (p: string, total: string) => {
    const pn = parseFloat(p), tn = parseFloat(total);
    if (isNaN(pn) || isNaN(tn)) return "—";
    return `${((pn / 100) * tn).toFixed(4).replace(/\.?0+$/, "")}`;
  };

  const change = (from: string, to: string) => {
    const fn = parseFloat(from), tn = parseFloat(to);
    if (isNaN(fn) || isNaN(tn) || fn === 0) return "—";
    const pct = ((tn - fn) / Math.abs(fn)) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(4).replace(/\.?0+$/, "")}%`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <AlignLeft className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Percentage Calculator</h1>
      </div>
      <p className="text-slate-500 mb-8">Solve the three most common percentage problems instantly.</p>

      <div className="space-y-8">
        {/* What % of */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">What is <em>X</em>% of <em>Y</em>?</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={a} onChange={(e) => setA(e.target.value)} placeholder="X" type="number"
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <span className="text-slate-500 text-sm">% of</span>
            <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Y" type="number"
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <span className="text-slate-500 text-sm">= </span>
          </div>
          <Row label={`${a || "X"}% of ${b || "Y"}`} result={ofPct(a, b)} />
        </div>

        {/* X is what % of Y */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900"><em>X</em> is what percent of <em>Y</em>?</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input value={c} onChange={(e) => setC(e.target.value)} placeholder="X" type="number"
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <span className="text-slate-500 text-sm">is what % of</span>
            <input value={d} onChange={(e) => setD(e.target.value)} placeholder="Y" type="number"
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <Row label={`${c || "X"} / ${d || "Y"} × 100`} result={pct(c, d)} />
        </div>

        {/* Percentage change */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Percentage Change (from → to)</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-sm">From</span>
            <input value={a && c ? "" : a} onChange={(e) => setA(e.target.value)} placeholder="From" type="number"
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <span className="text-slate-500 text-sm">to</span>
            <input value={b && d ? "" : b} onChange={(e) => setB(e.target.value)} placeholder="To" type="number"
              className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <Row label={`Change from ${a || "—"} to ${b || "—"}`} result={change(a, b)} />
        </div>
      </div>
    </div>
  );
}
