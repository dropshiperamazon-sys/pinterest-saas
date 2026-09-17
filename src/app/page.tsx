"use client";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import PublicFooter from "@/components/PublicFooter";
import {
  Calendar, Search, Megaphone, TrendingUp, Zap, BarChart2,
  CheckCircle, ArrowRight, Star, Shield, Database, ScanSearch,
  BookmarkCheck, ShoppingBag, ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Keyword Research",
    desc: "Discover high-traffic keywords with search volume, competition scores, and country-level data. See what's trending before you pin.",
    color: "bg-blue-50 text-blue-600",
    badge: "Free & Pro",
  },
  {
    icon: Calendar,
    title: "Pin Scheduler",
    desc: "Schedule pins in bulk with AI-generated titles and descriptions. Smart spacing ensures you post at peak engagement times.",
    color: "bg-violet-50 text-violet-600",
    badge: "All Plans",
  },
  {
    icon: ScanSearch,
    title: "Pinterest SEO Audit",
    desc: "Audit your entire Pinterest account, individual pins, and boards for SEO gaps — with actionable recommendations to rank higher.",
    color: "bg-emerald-50 text-emerald-600",
    badge: "Pro & Enterprise",
  },
  {
    icon: BookmarkCheck,
    title: "Track Keywords",
    desc: "Monitor keywords over time, organize them into folders, and see ranking changes week over week so nothing slips through.",
    color: "bg-orange-50 text-orange-600",
    badge: "Pro & Enterprise",
  },
  {
    icon: BarChart2,
    title: "Analytics Dashboard",
    desc: "Account-wide impressions, clicks, and saves in one view. Compare organic vs. paid performance across 365 days of history.",
    color: "bg-pink-50 text-pink-600",
    badge: "Pro & Enterprise",
  },
  {
    icon: Database,
    title: "Account Audit",
    desc: "Find duplicate pins, broken descriptions, and missing links automatically. Clean up your account and fix issues at scale.",
    color: "bg-teal-50 text-teal-600",
    badge: "Pro & Enterprise",
  },
  {
    icon: Megaphone,
    title: "Pinterest Ads",
    desc: "Plan campaigns, analyze performance, and get creative optimization suggestions — all without leaving the dashboard.",
    color: "bg-red-50 text-red-600",
    badge: "Enterprise",
  },
  {
    icon: ShoppingBag,
    title: "Pinterest Catalog",
    desc: "Manage and SEO-audit your product catalog. Detect technical issues and get title & description suggestions for every item.",
    color: "bg-amber-50 text-amber-600",
    badge: "Enterprise",
  },
  {
    icon: Zap,
    title: "AI Content Generation",
    desc: "Generate compelling pin titles and descriptions instantly. Trained on Pinterest best practices so every word works harder.",
    color: "bg-indigo-50 text-indigo-600",
    badge: "All Plans",
  },
];

const TESTIMONIALS = [
  {
    name: "Sarah M.",
    role: "Home Decor Blogger",
    text: "Rambforce doubled my Pinterest traffic in 3 months. The keyword research tool alone is worth every cent.",
    stars: 5,
    avatar: "SM",
  },
  {
    name: "James T.",
    role: "E-commerce Owner",
    text: "The pin scheduler saves me hours every week. I can plan a whole month of content in one sitting.",
    stars: 5,
    avatar: "JT",
  },
  {
    name: "Priya K.",
    role: "Social Media Manager",
    text: "Managing three clients' Pinterest accounts is so much easier now. The SEO audit caught issues I'd been ignoring for months.",
    stars: 5,
    avatar: "PK",
  },
];

const STATS = [
  { value: "4.8M+", label: "Pins scheduled" },
  { value: "12K+", label: "Active users" },
  { value: "3.2×", label: "Avg. traffic lift" },
  { value: "9 tools", label: "In one platform" },
];

const BADGE_COLORS: Record<string, string> = {
  "Free & Pro": "bg-blue-50 text-blue-600",
  "All Plans": "bg-emerald-50 text-emerald-600",
  "Pro & Enterprise": "bg-violet-50 text-violet-600",
  "Enterprise": "bg-orange-50 text-orange-600",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#e60023]/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-24 pb-12 sm:pb-20 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#e60023]/8 text-[#e60023] border border-[#e60023]/20 px-4 py-1.5 rounded-full text-sm font-semibold mb-7 hover:bg-[#e60023]/12 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            New: Pinterest Catalog SEO Audit is live
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-5 sm:mb-6" style={{ textWrap: "balance" }}>
            The Pinterest toolkit<br />
            <span className="text-[#e60023]">serious creators</span> rely on
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed" style={{ textWrap: "balance" }}>
            Keyword research, pin scheduling, SEO audits, account analytics, and ads management —
            all in one platform built for Pinterest growth.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              href="/signup"
              className="w-full sm:w-auto bg-[#e60023] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#ad081b] transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              Start for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-50 transition-colors text-center"
            >
              See pricing
            </Link>
          </div>

          <p className="text-sm text-gray-400 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            No credit card · Free plan available · Cancel anytime
          </p>

          {/* Mock dashboard */}
          <div className="mt-12 sm:mt-16 rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-900 max-w-4xl mx-auto">
            {/* Window chrome */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-gray-700 rounded-md px-4 py-1 text-xs text-gray-400 font-mono">
                  rambforce.app/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="bg-gray-900 p-5 sm:p-8">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Impressions", value: "4.83M", change: "+12%", up: true },
                  { label: "Saves", value: "38.2K", change: "+19%", up: true },
                  { label: "Link Clicks", value: "9,140", change: "+8%", up: true },
                  { label: "Pins Scheduled", value: "36", change: "This month", up: true },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                    <div className="text-xl font-bold text-white">{s.value}</div>
                    <div className="text-xs text-emerald-400 font-medium mt-0.5">{s.change}</div>
                  </div>
                ))}
              </div>

              {/* Keywords table preview */}
              <div className="bg-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-300">Keyword Research</span>
                  <span className="text-xs text-gray-500">Showing 5 of 248</span>
                </div>
                <div className="divide-y divide-gray-700/60">
                  {[
                    { kw: "home decor ideas 2024", vol: "2.4M", comp: "Low", trend: "↑ 34%" },
                    { kw: "minimalist bedroom aesthetic", vol: "890K", comp: "Med", trend: "↑ 18%" },
                    { kw: "boho living room diy", vol: "620K", comp: "Low", trend: "↑ 41%" },
                    { kw: "kitchen organization hacks", vol: "1.1M", comp: "High", trend: "↑ 9%" },
                  ].map((row) => (
                    <div key={row.kw} className="grid grid-cols-4 px-4 py-2.5 text-xs">
                      <span className="text-gray-300 col-span-2 truncate">{row.kw}</span>
                      <span className="text-gray-400">{row.vol}</span>
                      <span className="text-emerald-400 font-medium">{row.trend}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-gray-100 bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">{value}</div>
                <div className="text-sm text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight" style={{ textWrap: "balance" }}>
              Everything you need to dominate Pinterest
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base sm:text-lg">
              Nine professional tools in one dashboard. No juggling tabs, no switching apps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color, badge }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_COLORS[badge] ?? "bg-gray-100 text-gray-500"}`}>
                        {badge}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-gray-50 py-16 sm:py-24 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Get results in three steps</h2>
            <p className="text-gray-500 max-w-lg mx-auto">From zero to a fully optimized Pinterest presence in minutes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {[
              {
                num: "01",
                title: "Connect Pinterest",
                desc: "Link your Pinterest account with one click. We support up to 3 accounts per Rambforce account.",
                color: "text-[#e60023]",
              },
              {
                num: "02",
                title: "Research & Plan",
                desc: "Find high-volume keywords, audit your account for gaps, and build your content calendar in the scheduler.",
                color: "text-violet-600",
              },
              {
                num: "03",
                title: "Publish & Grow",
                desc: "Schedule your pins, track rankings, and watch your impressions climb with data-driven decisions.",
                color: "text-emerald-600",
              },
            ].map(({ num, title, desc, color }) => (
              <div key={num} className="flex flex-col items-start">
                <span className={`text-5xl font-extrabold ${color} mb-4 leading-none`}>{num}</span>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Loved by Pinterest marketers</h2>
            <p className="text-gray-500">Real results from real creators.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ name, role, text, stars, avatar }) => (
              <div key={name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">&ldquo;{text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#e60023]/10 text-[#e60023] font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{name}</div>
                    <div className="text-xs text-gray-400">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section className="bg-gray-50 py-16 sm:py-24 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Simple, transparent pricing</h2>
          <p className="text-gray-500 mb-10 text-base sm:text-lg">Start free, upgrade when you&apos;re ready. No hidden fees.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8 text-left">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                features: ["10 Pin Schedules / month", "3 Keyword Searches / day", "5 AI Writing Credits", "1 Pinterest Account"],
                cta: "Get Started Free",
                href: "/signup",
                primary: false,
              },
              {
                name: "Pro",
                price: "$29.99",
                annualPrice: "$17.99",
                period: "/mo",
                features: ["1,000 Pin Schedules / month", "Unlimited Keywords", "200 AI Credits / month", "2 Pinterest Accounts"],
                cta: "Start Pro",
                href: "/signup?plan=pro",
                primary: true,
                badge: "Most Popular",
              },
              {
                name: "Enterprise",
                price: "$69.99",
                annualPrice: "$41.99",
                period: "/mo",
                features: ["2,000 Pin Schedules / month", "Unlimited Keywords", "500 AI Credits / month", "3 Pinterest Accounts + Ads & Catalog"],
                cta: "Start Enterprise",
                href: "/signup?plan=enterprise",
                primary: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl p-6 border ${
                  p.primary
                    ? "bg-gray-900 border-gray-800 shadow-xl"
                    : "bg-white border-gray-200"
                }`}
              >
                {p.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#e60023] text-white mb-3 inline-block">
                    {p.badge}
                  </span>
                )}
                <div className={`text-sm font-semibold mb-1 ${p.primary ? "text-gray-400" : "text-gray-500"}`}>{p.name}</div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className={`text-3xl font-extrabold ${p.primary ? "text-white" : "text-gray-900"}`}>{p.price}</span>
                  <span className={`text-sm ${p.primary ? "text-gray-500" : "text-gray-400"}`}>{p.period}</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {p.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${p.primary ? "text-gray-300" : "text-gray-600"}`}>
                      <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${p.primary ? "text-emerald-400" : "text-emerald-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    p.primary
                      ? "bg-[#e60023] text-white hover:bg-[#c0001e]"
                      : "bg-gray-900 text-white hover:bg-gray-700"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            See full feature comparison <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight" style={{ textWrap: "balance" }}>
            Ready to grow your Pinterest?
          </h2>
          <p className="text-gray-500 mb-8 text-base sm:text-lg">
            Join thousands of creators and brands using Rambforce to drive real traffic from Pinterest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto bg-[#e60023] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#ad081b] transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
            >
              Get started for free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-50 transition-colors text-center"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            No credit card required
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
