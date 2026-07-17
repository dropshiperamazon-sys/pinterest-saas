"use client";
import { useState, useRef, useEffect } from "react";
import { Bell, Settings, User, Crown, CreditCard, LogOut, ChevronDown, Shield } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initial = session?.user?.name?.[0]?.toUpperCase() || "U";

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#e60023] rounded-full" />
        </button>
        <Link href="/account" className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
          <Settings className="w-4 h-4" />
        </Link>

        {/* Profile dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-[#e60023] flex items-center justify-center text-white font-bold text-sm">
              {initial}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="font-semibold text-gray-900 text-sm truncate">{session?.user?.name || "User"}</div>
                <div className="text-xs text-gray-400 truncate">{session?.user?.email || ""}</div>
                <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Free Plan</span>
              </div>

              <div className="py-1">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  Account Info
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Account Settings
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Crown className="w-4 h-4 text-yellow-500" />
                  Membership
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  Billing & Payment
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Shield className="w-4 h-4 text-gray-400" />
                  Security
                </Link>
              </div>

              <div className="border-t border-gray-100 pt-1">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <div className="w-4 h-4 bg-[#e60023] rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">P</span>
                  </div>
                  Connect Pinterest
                </Link>
                <button
                  onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
