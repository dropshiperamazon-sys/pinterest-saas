"use client";
import Header from "@/components/Header";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, Eye, MousePointerClick, DollarSign, ArrowUpRight, ArrowDownRight, Calendar, Search, Megaphone } from "lucide-react";
import Link from "next/link";

const STATS = [
  { label: "Total Impressions", value: 4820000, change: 12.4, icon: Eye, color: "bg-blue-50 text-blue-600" },
  { label: "Pin Clicks", value: 142300, change: 8.2, icon: MousePointerClick, color: "bg-green-50 text-green-600" },
  { label: "Keywords Tracked", value: 248, change: 15.0, icon: Search, color: "bg-purple-50 text-purple-600" },
  { label: "Ad Spend", value: 3240, change: -4.2, icon: DollarSign, color: "bg-orange-50 text-orange-600", isCurrency: true },
];

const QUICK_ACTIONS = [
  { href: "/keywords", icon: Search, label: "Research Keywords", desc: "Find trending Pinterest keywords", color: "from-blue-500 to-blue-600" },
  { href: "/scheduler", icon: Calendar, label: "Schedule a Pin", desc: "Plan your next pin publication", color: "from-purple-500 to-purple-600" },
  { href: "/ads", icon: Megaphone, label: "Manage Ads", desc: "Launch or optimize campaigns", color: "from-[#e60023] to-[#ad081b]" },
];

const TRENDING = [
  { keyword: "summer home decor", volume: 1240000, trend: 28 },
  { keyword: "aesthetic room ideas", volume: 980000, trend: 22 },
  { keyword: "healthy meal prep", volume: 1560000, trend: 19 },
  { keyword: "boho wedding decor", volume: 720000, trend: 16 },
  { keyword: "minimalist outfits", volume: 890000, trend: 14 },
];

export default function Dashboard() {
  return (
    <div>
      <Header title="Dashboard" subtitle="Welcome back! Here's your Pinterest overview." />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(({ label, value, change, icon: Icon, color, isCurrency }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 font-medium">{label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {isCurrency ? `$${formatNumber(value)}` : formatNumber(value)}
              </div>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
                {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(change)}% vs last month
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="col-span-1 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
            {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${color} text-white hover:shadow-md transition-all group`}
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs opacity-80">{desc}</div>
                </div>
                <ArrowUpRight className="w-4 h-4 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>

          {/* Trending Keywords */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Trending Keywords</h2>
              <Link href="/keywords" className="text-xs text-[#e60023] font-medium hover:underline">View all →</Link>
            </div>
            <div className="space-y-3">
              {TRENDING.map(({ keyword, volume, trend }, i) => (
                <div key={keyword} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{keyword}</div>
                    <div className="text-xs text-gray-400">{formatNumber(volume)} monthly searches</div>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 text-xs font-semibold bg-green-50 px-2 py-1 rounded-lg">
                    <TrendingUp className="w-3 h-3" />
                    +{trend}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pinterest Connect Banner */}
        <div className="bg-gradient-to-r from-[#e60023]/5 to-[#e60023]/10 border border-[#e60023]/20 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#e60023] rounded-xl flex items-center justify-center text-white text-xl font-bold">P</div>
            <div>
              <div className="font-semibold text-gray-900">Connect your Pinterest account</div>
              <div className="text-sm text-gray-500">Link your account to enable pin scheduling and ads management.</div>
            </div>
          </div>
          <button className="bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors whitespace-nowrap">
            Connect Pinterest
          </button>
        </div>
      </div>
    </div>
  );
}
