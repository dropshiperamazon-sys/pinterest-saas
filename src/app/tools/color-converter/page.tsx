"use client";
import { useState, useEffect } from "react";
import { Palette, ChevronLeft, Copy, Check } from "lucide-react";
import Link from "next/link";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return [0, 0, 0, 100];
  return [
    Math.round(((1 - rn - k) / (1 - k)) * 100),
    Math.round(((1 - gn - k) / (1 - k)) * 100),
    Math.round(((1 - bn - k) / (1 - k)) * 100),
    Math.round(k * 100),
  ];
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 text-slate-400 hover:text-violet-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const PRESETS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0f172a", "#ffffff"];

export default function ColorConverterPage() {
  const [hex, setHex] = useState("#3b82f6");
  const [hexInput, setHexInput] = useState("#3b82f6");

  const rgb = hexToRgb(hex);
  const [h, s, l] = rgb ? rgbToHsl(...rgb) : [0, 0, 0];
  const [c, m, y, k] = rgb ? rgbToCmyk(...rgb) : [0, 0, 0, 0];

  const applyHex = (v: string) => {
    const clean = v.startsWith("#") ? v : `#${v}`;
    if (/^#[0-9a-f]{6}$/i.test(clean)) setHex(clean);
    setHexInput(v);
  };

  const outputs = rgb ? [
    { label: "HEX", value: hex.toUpperCase(), copy: hex.toUpperCase() },
    { label: "RGB", value: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, copy: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` },
    { label: "HSL", value: `hsl(${h}, ${s}%, ${l}%)`, copy: `hsl(${h}, ${s}%, ${l}%)` },
    { label: "CMYK", value: `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`, copy: `cmyk(${c}%, ${m}%, ${y}%, ${k}%)` },
    { label: "CSS Variable", value: `--color: ${hex.toUpperCase()};`, copy: `--color: ${hex.toUpperCase()};` },
  ] : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
          <Palette className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Color Converter</h1>
      </div>
      <p className="text-slate-500 mb-8">Convert between HEX, RGB, HSL and CMYK color formats.</p>

      {/* Color preview + picker */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="h-36 transition-colors" style={{ backgroundColor: hex }} />
        <div className="p-5 flex items-center gap-4">
          <input
            type="color"
            value={hex}
            onChange={(e) => { setHex(e.target.value); setHexInput(e.target.value); }}
            className="w-12 h-12 rounded-xl border-0 cursor-pointer p-0"
          />
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">HEX value</label>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => applyHex(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="#3b82f6"
            />
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => { setHex(p); setHexInput(p); }}
            className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: p, borderColor: p === hex ? "#7c3aed" : "transparent" }}
            title={p}
          />
        ))}
      </div>

      {/* Outputs */}
      {outputs.length > 0 && (
        <div className="space-y-3">
          {outputs.map(({ label, value, copy }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 px-5 py-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-violet-600 mb-1">{label}</p>
                <p className="font-mono text-sm text-slate-800">{value}</p>
              </div>
              <CopyBtn text={copy} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
