"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Search,
  Calendar,
  Megaphone,
  LayoutDashboard,
  ChevronRight,
  Zap,
  LineChart,
  LogIn,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/keywords", icon: Search, label: "Keyword Research" },
  { href: "/pin-analysis", icon: LineChart, label: "Pin Analysis" },
  { href: "/scheduler", icon: Calendar, label: "Pin Scheduler" },
  { href: "/ads", icon: Megaphone, label: "Pinterest Ads" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#e60023] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">My Pin Pro</span>
          <span className="text-xs bg-[#e60023] text-white px-1.5 py-0.5 rounded font-medium">PRO</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "bg-[#e60023] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Pinterest Account */}
      <div className="px-4 pb-2">
        {(session as { accessToken?: string } | null)?.accessToken ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <div className="w-7 h-7 bg-[#e60023] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{session?.user?.name}</p>
              <p className="text-xs text-green-600">Connected</p>
            </div>
            <button onClick={() => signOut()} title="Disconnect">
              <LogOut className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 transition-colors" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("pinterest", { callbackUrl: "/connect" })}
            className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors"
          >
            <LogIn className="w-4 h-4 text-[#e60023]" />
            <span className="text-xs font-medium text-gray-700">Connect Pinterest</span>
          </button>
        )}
      </div>

      {/* Upgrade Banner */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-[#e60023] to-[#ad081b] rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-semibold">Upgrade to Pro</span>
          </div>
          <p className="text-xs opacity-80 mb-3">Unlock unlimited keywords, advanced competitor insights & more.</p>
          <button className="w-full bg-white text-[#e60023] text-xs font-semibold py-2 rounded-lg hover:bg-red-50 transition-colors">
            Get Pro Access
          </button>
        </div>
      </div>
    </aside>
  );
}
