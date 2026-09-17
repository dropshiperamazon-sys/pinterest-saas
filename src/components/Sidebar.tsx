"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Calendar,
  Megaphone,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  Zap,
  BarChart2,
  ShieldCheck,
  LogIn,
  LogOut,
  ScanSearch,
  Telescope,
  Database,
  ShoppingBag,
  BookmarkCheck,
  Users,
  Plus,
  Check,
  Trash2,
} from "lucide-react";

interface PinterestAccountInfo {
  username: string;
  pinterestName: string;
  connectedAt: string;
  grantedScopes: string[];
}

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/keywords", icon: Search, label: "Keyword Research" },
  { href: "/track-keywords", icon: BookmarkCheck, label: "Track Keywords" },
  { href: "/seo-audit", icon: ScanSearch, label: "Pinterest SEO Audit" },
  { href: "/keyword-extractor", icon: Telescope, label: "Keyword Extractor" },
  { href: "/scheduler", icon: Calendar, label: "Pin Scheduler" },
  { href: "/account-audit", icon: ShieldCheck, label: "Account Audit" },
  { href: "/ads", icon: Megaphone, label: "Pinterest Ads" },
  { href: "/catalog", icon: ShoppingBag, label: "Pinterest Catalog" },
  { href: "/admin/keywords", icon: Database, label: "Keyword Admin" },
  { href: "/admin", icon: Users, label: "Admin Panel" },
];

const ADMIN_NAV_HREFS = new Set(["/admin/keywords", "/admin"]);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

  const [accounts, setAccounts] = useState<PinterestAccountInfo[]>([]);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [canAddMore, setCanAddMore] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "enterprise">("free");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    loadConnection();
  }, [session]);

  function loadConnection() {
    fetch("/api/pinterest-connection")
      .then((r) => r.json())
      .then((d) => {
        if (d.plan) setUserPlan(d.plan);
        if (d.connected) {
          setAccounts(d.accounts ?? []);
          setActiveUsername(d.activeUsername ?? null);
          setCanAddMore(d.canAddMore ?? true);
        } else {
          setAccounts([]);
          setActiveUsername(null);
          setCanAddMore(true);
        }
      })
      .catch(() => {});
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSwitch(username: string) {
    setDropdownOpen(false);
    const res = await fetch("/api/pinterest-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      setActiveUsername(username);
      loadConnection();
      router.refresh();
    }
  }

  async function handleDisconnect(username: string) {
    await fetch("/api/pinterest-oauth/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    loadConnection();
    router.refresh();
  }

  const activeAccount = accounts.find((a) => a.username === activeUsername) ?? accounts[0] ?? null;
  const connected = !!activeAccount;

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <img src="/rambforce-logo.png" alt="Rambforce" className="h-7 w-auto object-contain" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter(({ href }) => {
          if (!ADMIN_NAV_HREFS.has(href)) return true;
          return session?.user?.email === adminEmail && !!adminEmail;
        }).map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && href !== "/admin" && pathname.startsWith(href));
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

      {/* Pinterest Account(s) */}
      <div className="px-4 pb-2" ref={dropdownRef}>
        {connected ? (
          <div className="relative">
            {/* Active account row */}
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 hover:bg-green-100 transition-colors"
            >
              <div className="w-7 h-7 bg-[#e60023] rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {activeAccount.pinterestName || activeAccount.username}
                </p>
                <p className="text-xs text-green-600">
                  Connected · {accounts.length}/3
                </p>
              </div>
              <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", dropdownOpen && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                {/* All connected accounts */}
                {accounts.map((acc) => (
                  <div
                    key={acc.username}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 group"
                  >
                    <button
                      onClick={() => handleSwitch(acc.username)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <div className="w-6 h-6 bg-[#e60023] rounded-md flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">P</span>
                      </div>
                      <span className="text-xs font-medium text-gray-700 truncate flex-1">
                        {acc.pinterestName || acc.username}
                      </span>
                      {acc.username === activeUsername && (
                        <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDisconnect(acc.username)}
                      title="Disconnect"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    >
                      <Trash2 className="w-3 h-3 text-gray-300 hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                ))}

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Add account */}
                {canAddMore ? (
                  <a
                    href="/api/pinterest-oauth/start"
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                      <Plus className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-600">Add Pinterest account</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-400">
                    <Plus className="w-3 h-3" />
                    Account limit reached — upgrade to add more
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <a
            href="/api/pinterest-oauth/start"
            className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors"
          >
            <LogIn className="w-4 h-4 text-[#e60023]" />
            <span className="text-xs font-medium text-gray-700">Connect Pinterest</span>
          </a>
        )}
      </div>

      {/* Upgrade Banner */}
      {userPlan !== "enterprise" && (
        <div className="p-4">
          {userPlan === "free" ? (
            <div className="bg-gradient-to-br from-[#e60023] to-[#ad081b] rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-semibold">Upgrade to Pro</span>
              </div>
              <p className="text-xs opacity-80 mb-3">Unlock unlimited keywords, advanced competitor insights & more.</p>
              <Link href="/pricing" className="block w-full bg-white text-[#e60023] text-xs font-semibold py-2 rounded-lg hover:bg-red-50 transition-colors text-center">
                Get Pro Access
              </Link>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-semibold">Upgrade to Enterprise</span>
              </div>
              <p className="text-xs opacity-80 mb-3">Unlock Pinterest Ads, Catalog, unlimited accounts & priority support.</p>
              <Link href="/pricing" className="block w-full bg-white text-amber-600 text-xs font-semibold py-2 rounded-lg hover:bg-amber-50 transition-colors text-center">
                Get Enterprise Access
              </Link>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
