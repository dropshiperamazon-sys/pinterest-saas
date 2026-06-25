"use client";
import { useState } from "react";
import { Type, ChevronLeft, Copy, Check, Trash2 } from "lucide-react";
import Link from "next/link";

const CONVERSIONS = [
  {
    id: "upper",
    label: "UPPERCASE",
    example: "HELLO WORLD",
    fn: (t: string) => t.toUpperCase(),
  },
  {
    id: "lower",
    label: "lowercase",
    example: "hello world",
    fn: (t: string) => t.toLowerCase(),
  },
  {
    id: "title",
    label: "Title Case",
    example: "Hello World",
    fn: (t: string) => t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
  },
  {
    id: "sentence",
    label: "Sentence case",
    example: "Hello world. How are you?",
    fn: (t: string) =>
      t
        .toLowerCase()
        .replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()),
  },
  {
    id: "camel",
    label: "camelCase",
    example: "helloWorld",
    fn: (t: string) =>
      t
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()),
  },
  {
    id: "pascal",
    label: "PascalCase",
    example: "HelloWorld",
    fn: (t: string) => {
      const camel = t.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase());
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    },
  },
  {
    id: "snake",
    label: "snake_case",
    example: "hello_world",
    fn: (t: string) =>
      t
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, ""),
  },
  {
    id: "kebab",
    label: "kebab-case",
    example: "hello-world",
    fn: (t: string) =>
      t
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
  },
  {
    id: "alternating",
    label: "aLtErNaTiNg",
    example: "hElLo WoRlD",
    fn: (t: string) =>
      t
        .split("")
        .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
        .join(""),
  },
  {
    id: "reverse",
    label: "esreveR",
    example: "dlrow olleh",
    fn: (t: string) => t.split("").reverse().join(""),
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} className="p-1.5 text-slate-400 hover:text-violet-600 transition-colors">
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export default function CaseConverterPage() {
  const [input, setInput] = useState("");

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <Type className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Case Converter</h1>
      </div>
      <p className="text-slate-500 mb-8">Convert text between 10 different case formats instantly.</p>

      <div className="relative mb-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste your text here…"
          className="w-full min-h-36 border border-slate-200 rounded-2xl p-5 text-slate-800 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
        />
        {input && (
          <button onClick={() => setInput("")} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONVERSIONS.map(({ id, label, fn }) => {
          const output = input ? fn(input) : "";
          return (
            <div key={id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">{label}</span>
                {output && <CopyButton text={output} />}
              </div>
              <p className={`text-sm text-slate-700 min-h-8 break-all ${!output ? "text-slate-300" : ""}`}>
                {output || "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
