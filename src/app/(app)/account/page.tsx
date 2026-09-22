"use client";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { User, CreditCard, Bell, Shield, LogOut, Crown, CheckCircle, ExternalLink, Loader2 } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  free: "Free Plan",
  pro: "Pro Plan",
  enterprise: "Enterprise Plan",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: "Limited features",
  pro: "Full access to Pro features",
  enterprise: "Full access + Ads, Catalog & priority support",
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["5 scheduled pins/month", "Basic keyword research", "30-day analytics", "1 Pinterest account"],
  pro: ["Unlimited scheduled pins", "Advanced keyword research", "Full analytics history", "Pinterest Ads manager", "AI content generation", "Up to 3 Pinterest accounts", "Priority support"],
  enterprise: ["Everything in Pro", "Pinterest Ads & Catalog", "Unlimited Pinterest accounts", "Dedicated account manager", "White-glove onboarding"],
};

export default function AccountPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [pinterest, setPinterest] = useState<{ connected: boolean; pinterestName?: string; pinterestUsername?: string } | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/pinterest-connection").then(r => r.json()).then(setPinterest).catch(() => {});
    fetch("/api/plan").then(r => r.json()).then(d => setPlan(d.plan ?? "free")).catch(() => setPlan("free"));
  }, []);

  async function handleDisconnect() {
    await fetch("/api/pinterest-oauth/disconnect", { method: "POST" });
    setPinterest({ connected: false });
    router.refresh();
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    setPortalLoading(false);
    if (data.url) window.location.href = data.url;
  }

  const isPaid = plan === "pro" || plan === "enterprise";
  const features = PLAN_FEATURES[plan ?? "free"] ?? PLAN_FEATURES.free;

  return (
    <div>
      <Header title="Account" subtitle="Manage your account settings and subscription" />
      <div className="p-4 sm:p-6 max-w-3xl space-y-6">

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {plan === null ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading plan…
            </div>
          ) : (
            <>
              {/* Current plan card */}
              <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${
                isPaid ? "bg-gradient-to-r from-[#e60023]/5 to-[#e60023]/10 border border-[#e60023]/20" : "bg-gray-50 border border-gray-200"
              }`}>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {isPaid && <Crown className="w-4 h-4 text-yellow-500" />}
                    {PLAN_LABELS[plan] ?? plan}
                  </div>
                  <div className="text-sm text-gray-500">{PLAN_DESCRIPTIONS[plan] ?? ""}</div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  isPaid ? "bg-[#e60023] text-white" : "bg-gray-200 text-gray-600"
                }`}>Current Plan</span>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-5">
                {features.map((f) => (
                  <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Upgrade CTA for free users */}
              {!isPaid && (
                <div className="bg-gradient-to-r from-[#e60023] to-[#c0001e] rounded-xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4" />
                    <span className="font-semibold">Upgrade to Pro — $29.99/month</span>
                  </div>
                  <p className="text-sm text-white/80 mb-4">Unlock unlimited pins, keyword research, analytics and more.</p>
                  <a href="/pricing" className="inline-block bg-white text-[#e60023] px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">
                    View Plans
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Billing & Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <CreditCard className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Billing & Payment</h2>
          </div>

          {isPaid ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Manage your payment methods, view invoices, or cancel your subscription through the Stripe billing portal.
              </p>
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-60"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {portalLoading ? "Opening portal…" : "Manage Billing & Cancel Plan"}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-6 text-center">
              <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              No payment methods on file.<br />Upgrade to Pro to add a payment method.
            </div>
          )}
        </div>

        {/* Pinterest Connection */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-5 h-5 bg-[#e60023] rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <h2 className="font-semibold text-gray-900">Pinterest Account</h2>
          </div>
          {pinterest?.connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <div className="font-medium text-green-800 text-sm">Connected</div>
                  <div className="text-xs text-green-600">@{pinterest.pinterestUsername || pinterest.pinterestName}</div>
                </div>
              </div>
              <button onClick={handleDisconnect} className="text-xs text-red-600 hover:underline font-medium">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="text-sm text-gray-500">No Pinterest account connected</div>
              <a href="/api/pinterest-oauth/start" className="bg-[#e60023] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#ad081b] text-center">
                Connect
              </a>
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
            Sign out of Rambforce
          </button>
        </div>
      </div>
    </div>
  );
}
