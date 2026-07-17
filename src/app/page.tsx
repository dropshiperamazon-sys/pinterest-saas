"use client";
import Link from "next/link";
import {
  Calendar, Search, Megaphone, TrendingUp, Zap, BarChart2,
  CheckCircle, ArrowRight, Star, Shield, Clock,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Keyword Research",
    desc: "Discover high-traffic Pinterest keywords and trending topics to maximize your pin reach.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Calendar,
    title: "Pin Scheduler",
    desc: "Schedule pins in bulk with AI-generated titles and descriptions. Post at peak times automatically.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Megaphone,
    title: "Pinterest Ads",
    desc: "Plan, launch, and optimize Pinterest ad campaigns with smart targeting and budget tools.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    icon: BarChart2,
    title: "Pin Analysis",
    desc: "Deep dive into your pin performance with engagement metrics, audience insights, and trends.",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: Zap,
    title: "AI Content Generation",
    desc: "Generate compelling pin titles and descriptions instantly with AI trained on Pinterest best practices.",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    icon: TrendingUp,
    title: "Growth Analytics",
    desc: "Track follower growth, impressions, and clicks over time to see what's working.",
    color: "bg-pink-50 text-pink-600",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for getting started",
    features: ["5 scheduled pins/month", "Basic keyword research", "Pin analysis (30 days)", "1 Pinterest account"],
    cta: "Get Started Free",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    desc: "For serious Pinterest marketers",
    features: ["Unlimited scheduled pins", "Advanced keyword research", "Full analytics history", "Pinterest Ads manager", "AI content generation", "Priority support"],
    cta: "Start Pro Trial",
    href: "/signup?plan=pro",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$49",
    period: "per month",
    desc: "Manage multiple clients",
    features: ["Everything in Pro", "Up to 10 Pinterest accounts", "Team collaboration", "White-label reports", "Dedicated account manager", "API access"],
    cta: "Contact Sales",
    href: "/signup?plan=agency",
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    name: "Sarah M.",
    role: "Home Decor Blogger",
    text: "My Pin Pro doubled my Pinterest traffic in 3 months. The keyword research tool is incredible.",
    stars: 5,
  },
  {
    name: "James T.",
    role: "E-commerce Owner",
    text: "The pin scheduler saves me hours every week. I can plan a whole month of content in one sitting.",
    stars: 5,
  },
  {
    name: "Priya K.",
    role: "Social Media Manager",
    text: "Managing 5 clients' Pinterest accounts is so much easier now. The analytics are top-notch.",
    stars: 5,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#e60023] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">My Pin Pro</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
            <Link
              href="/signup"
              className="bg-[#e60023] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#ad081b] transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#e60023]/10 text-[#e60023] px-3 py-1.5 rounded-full text-xs font-semibold mb-6">
          <Zap className="w-3 h-3" />
          AI-Powered Pinterest Marketing
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Grow your Pinterest<br />
          <span className="text-[#e60023]">10x faster</span> with My Pin Pro
        </h1>
        <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
          The all-in-one Pinterest marketing suite. Research keywords, schedule pins, manage ads,
          and analyze performance — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-[#e60023] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#ad081b] transition-colors flex items-center gap-2"
          >
            Start for free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4 flex items-center justify-center gap-1">
          <Shield className="w-3.5 h-3.5" />
          No credit card required · Free plan available
        </p>

        {/* App preview */}
        <div className="mt-14 bg-gray-900 rounded-2xl p-1 shadow-2xl max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="ml-4 bg-gray-700 rounded px-3 py-1 text-xs text-gray-400">pin-saas-5eb4.vercel.app/dashboard</div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total Impressions", value: "4.8M", change: "+12%" },
                { label: "Pin Clicks", value: "142K", change: "+8%" },
                { label: "Keywords Tracked", value: "248", change: "+15%" },
                { label: "Scheduled Pins", value: "36", change: "+24%" },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-700 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-green-400 font-medium">{stat.change}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to dominate Pinterest</h2>
            <p className="text-gray-500 max-w-xl mx-auto">From keyword research to ad optimization, My Pin Pro has every tool you need to grow your Pinterest presence.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Loved by Pinterest marketers</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, text, stars }) => (
              <div key={name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{text}"</p>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{name}</div>
                  <div className="text-xs text-gray-400">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">Start free, upgrade when you're ready.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {PLANS.map(({ name, price, period, desc, features, cta, href, highlight }) => (
              <div
                key={name}
                className={`rounded-2xl p-6 border ${highlight
                  ? "bg-[#e60023] border-[#e60023] text-white shadow-xl scale-105"
                  : "bg-white border-gray-100"
                }`}
              >
                <div className="mb-6">
                  <div className={`text-sm font-semibold mb-1 ${highlight ? "text-white/80" : "text-gray-500"}`}>{name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{price}</span>
                    <span className={`text-sm ${highlight ? "text-white/70" : "text-gray-400"}`}>/{period}</span>
                  </div>
                  <div className={`text-sm mt-1 ${highlight ? "text-white/80" : "text-gray-500"}`}>{desc}</div>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${highlight ? "text-white" : "text-green-500"}`} />
                      <span className={highlight ? "text-white/90" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${highlight
                    ? "bg-white text-[#e60023] hover:bg-gray-100"
                    : "bg-[#e60023] text-white hover:bg-[#ad081b]"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to grow your Pinterest?</h2>
          <p className="text-gray-500 mb-8">Join thousands of marketers using My Pin Pro to get more traffic from Pinterest.</p>
          <Link
            href="/signup"
            className="bg-[#e60023] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#ad081b] transition-colors inline-flex items-center gap-2"
          >
            Get started for free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#e60023] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <span>My Pin Pro</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/login" className="hover:text-gray-600">Sign In</Link>
            <Link href="/signup" className="hover:text-gray-600">Sign Up</Link>
          </div>
          <div>© {new Date().getFullYear()} My Pin Pro</div>
        </div>
      </footer>
    </div>
  );
}
