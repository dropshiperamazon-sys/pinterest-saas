"use client";
import Link from "next/link";
import { useState } from "react";
import { Zap, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/tools#image", label: "Image Tools" },
  { href: "/tools#text", label: "Text Tools" },
  { href: "/tools#developer", label: "Dev Tools" },
  { href: "/tools#calculator", label: "Calculators" },
];

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/tools" className="flex items-center gap-2 font-bold text-xl text-slate-900">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span>DevToolKit</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm font-medium text-slate-600 hover:text-violet-600 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-3 flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate-700 hover:text-violet-600"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold text-white text-lg">DevToolKit</span>
              </div>
              <p className="text-sm leading-relaxed">
                Free, fast, browser-based tools. No uploads, no sign-up, no limits.
                Everything runs locally in your browser.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Tools</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/tools/image-compressor" className="hover:text-violet-400 transition-colors">Image Compressor</Link></li>
                <li><Link href="/tools/word-counter" className="hover:text-violet-400 transition-colors">Word Counter</Link></li>
                <li><Link href="/tools/base64" className="hover:text-violet-400 transition-colors">Base64 Encoder</Link></li>
                <li><Link href="/tools/json-formatter" className="hover:text-violet-400 transition-colors">JSON Formatter</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">More</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/tools/age-calculator" className="hover:text-violet-400 transition-colors">Age Calculator</Link></li>
                <li><Link href="/tools/password-generator" className="hover:text-violet-400 transition-colors">Password Generator</Link></li>
                <li><Link href="/tools/color-converter" className="hover:text-violet-400 transition-colors">Color Converter</Link></li>
                <li><Link href="/tools/markdown-preview" className="hover:text-violet-400 transition-colors">Markdown Preview</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-sm text-center">
            © {new Date().getFullYear()} DevToolKit — All tools run 100% in your browser. Private &amp; secure.
          </div>
        </div>
      </footer>
    </div>
  );
}
