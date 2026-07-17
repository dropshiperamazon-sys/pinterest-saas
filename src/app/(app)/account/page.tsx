"use client";
import { useSession, signOut } from "next-auth/react";
import Header from "@/components/Header";
import { User, CreditCard, Bell, Shield, LogOut, Crown, ExternalLink } from "lucide-react";
import Link from "next/link";

const PLAN_FEATURES = {
  free: ["5 scheduled pins/month", "Basic keyword research", "30-day analytics", "1 Pinterest account"],
  pro: ["Unlimited scheduled pins", "Advanced keyword research", "Full analytics history", "Pinterest Ads manager", "AI content generation", "Priority support"],
};

export default function AccountPage() {
  const { data: session } = useSession();

  return (
    <div>
      <Header title="Account" subtitle="Manage your account settings and subscription" />
      <div className="p-6 max-w-3xl space-y-6">

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <User className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Account Info</h2>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-[#e60023] rounded-2xl flex items-center justify-center text-white text-xl font-bold">
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-lg">{session?.user?.name || "User"}</div>
              <div className="text-gray-500 text-sm">{session?.user?.email || "—"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Full Name</label>
              <input
                defaultValue={session?.user?.name || ""}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Email Address</label>
              <input
                defaultValue={session?.user?.email || ""}
                disabled
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400"
              />
            </div>
          </div>
          <button className="mt-4 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
            Save Changes
          </button>
        </div>

        {/* Membership */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Crown className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Membership</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
            <div>
              <div className="font-semibold text-gray-900">Free Plan</div>
              <div className="text-sm text-gray-500">Limited features</div>
            </div>
            <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full font-medium">Current Plan</span>
          </div>
          <ul className="space-y-2 mb-5">
            {PLAN_FEATURES.free.map((f) => (
              <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {f}
              </li>
            ))}
          </ul>
          <div className="bg-gradient-to-r from-[#e60023] to-[#c0001e] rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4" />
              <span className="font-semibold">Upgrade to Pro — $19/month</span>
            </div>
            <p className="text-sm text-white/80 mb-4">Unlock unlimited pins, AI generation, ads manager and more.</p>
            <button className="bg-white text-[#e60023] px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
              Upgrade Now
            </button>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <CreditCard className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Billing & Payment</h2>
          </div>
          <div className="text-sm text-gray-500 py-6 text-center">
            <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No payment methods on file.<br />Upgrade to Pro to add a payment method.
          </div>
        </div>

        {/* Pinterest Connection */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-5 h-5 bg-[#e60023] rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <h2 className="font-semibold text-gray-900">Pinterest Account</h2>
          </div>
          {(session as { accessToken?: string })?.accessToken ? (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div>
                <div className="font-medium text-green-800 text-sm">Connected</div>
                <div className="text-xs text-green-600">{session?.user?.name}</div>
              </div>
              <Link href="/connect" className="text-xs text-green-700 underline flex items-center gap-1">
                Manage <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-500">No Pinterest account connected</div>
              <Link href="/connect" className="bg-[#e60023] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#ad081b]">
                Connect
              </Link>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Bell className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Notifications</h2>
          </div>
          {[
            { label: "Pin published successfully", desc: "When a scheduled pin goes live" },
            { label: "Weekly performance report", desc: "Summary of your Pinterest analytics" },
            { label: "Keyword trends alert", desc: "When tracked keywords spike in volume" },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#e60023]/30 rounded-full peer peer-checked:bg-[#e60023] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Security</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
              />
            </div>
            <button className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
              Update Password
            </button>
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-2xl border border-red-100 p-6">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 text-red-600 font-medium text-sm hover:text-red-800"
          >
            <LogOut className="w-4 h-4" />
            Sign out of My Pin Pro
          </button>
        </div>
      </div>
    </div>
  );
}
