"use client";
import { useState, useMemo } from "react";
import { BookOpen, ChevronLeft, Eye, Edit3, Copy, Check } from "lucide-react";
import Link from "next/link";

const SAMPLE = `# Welcome to Markdown Preview

Write **bold**, *italic*, or \`inline code\` text.

## Lists

- Item one
- Item two
  - Nested item

1. First
2. Second
3. Third

## Code Block

\`\`\`js
const greet = (name) => \`Hello, \${name}!\`;
console.log(greet("World"));
\`\`\`

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

## Table

| Feature | Supported |
|---------|-----------|
| Bold    | ✅        |
| Tables  | ✅        |
| Code    | ✅        |

[Visit DevToolKit](/tools)
`;

function parseMarkdown(md: string): string {
  let html = md
    // Escape
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-slate-800 text-emerald-300 rounded-xl p-4 overflow-x-auto text-sm my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-violet-700 rounded px-1.5 py-0.5 text-sm font-mono">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-slate-900 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-slate-900 mt-6 mb-3 border-b border-slate-200 pb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-extrabold text-slate-900 mt-4 mb-4">$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-violet-400 pl-4 my-3 text-slate-600 italic">$1</blockquote>')
    // HR
    .replace(/^---$/gm, '<hr class="my-6 border-slate-200" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-600 underline hover:text-violet-800">$1</a>')
    // Lists (simple)
    .replace(/^\d+\. (.+)$/gm, '<li class="list-decimal ml-5 my-0.5 text-slate-700">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="list-disc ml-10 my-0.5 text-slate-600 text-sm">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="list-disc ml-5 my-0.5 text-slate-700">$1</li>')
    // Table (basic)
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, header, rows) => {
      const ths = header.split("|").filter(Boolean).map((h: string) => `<th class="border border-slate-200 px-3 py-2 bg-slate-50 font-semibold text-slate-800 text-left">${h.trim()}</th>`).join("");
      const trs = rows.trim().split("\n").map((row: string) => {
        const tds = row.split("|").filter(Boolean).map((c: string) => `<td class="border border-slate-200 px-3 py-2 text-slate-700">${c.trim()}</td>`).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      return `<table class="border-collapse w-full my-4 text-sm"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    })
    // Paragraphs (lines that aren't already tags)
    .replace(/^([^<\n].+)$/gm, '<p class="text-slate-700 my-2 leading-relaxed">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p class="[^"]*"><\/p>/g, "");

  return html;
}

export default function MarkdownPreviewPage() {
  const [input, setInput] = useState(SAMPLE);
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => parseMarkdown(input), [input]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Markdown Preview</h1>
            <p className="text-slate-500 text-sm">Live Markdown editor with instant HTML preview.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {([["split", "Split"], ["edit", "Edit"], ["preview", "Preview"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === v ? "bg-white shadow text-violet-700" : "text-slate-500 hover:text-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(input); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-xl hover:border-violet-300 text-slate-600 hover:text-violet-600 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy MD"}
          </button>
        </div>
      </div>

      <div className={`grid gap-5 ${view === "split" ? "grid-cols-2" : "grid-cols-1"}`}>
        {view !== "preview" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Markdown</span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full min-h-[70vh] p-5 font-mono text-sm text-slate-800 resize-none focus:outline-none leading-relaxed"
            />
          </div>
        )}

        {view !== "edit" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Preview</span>
            </div>
            <div
              className="p-6 min-h-[70vh] overflow-y-auto prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
