"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import {
  Users, Mail, ShieldCheck, Crown, CheckCircle, XCircle, PauseCircle,
  PlayCircle, Send, RefreshCw, AlertCircle, ChevronDown, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
  createdAt: string;
  trialStartDate?: string;
  trialEndDate?: string;
  trialStatus?: "active" | "ended" | "none";
  subscriptionStatus?: "active" | "paused" | "revoked" | "none";
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  pro: "bg-blue-100 text-blue-700",
  business: "bg-purple-100 text-purple-700",
};

function trialStatus(user: User): { label: string; color: string } {
  if (!user.trialStartDate) return { label: "No Trial", color: "text-gray-400" };
  const end = user.trialEndDate ? new Date(user.trialEndDate) : null;
  const now = new Date();
  if (end && now > end) return { label: "Trial Ended", color: "text-red-500" };
  return { label: "Trial Active", color: "text-green-600" };
}

function subStatus(user: User): { label: string; color: string } {
  const s = user.subscriptionStatus;
  if (!s || s === "none") return { label: "—", color: "text-gray-400" };
  if (s === "active") return { label: "Active", color: "text-green-600" };
  if (s === "paused") return { label: "Paused", color: "text-amber-500" };
  return { label: "Revoked", color: "text-red-500" };
}

function fmt(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminPage() {
  const { data: session } = useSession();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
  const isAdmin = session?.user?.email === adminEmail && !!adminEmail;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Email compose state
  const [emailMode, setEmailMode] = useState<"single" | "broadcast">("broadcast");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  // Subscription modal state
  const [subModal, setSubModal] = useState<{ user: User } | null>(null);
  const [subPlan, setSubPlan] = useState("pro");
  const [subAction, setSubAction] = useState<"grant" | "pause" | "revoke">("grant");
  const [subEndDate, setSubEndDate] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) setUsers(data.users.sort((a: User, b: User) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      showToast("Failed to load users", false);
    } finally {
      setLoading(false);
    }
  }

  async function applySubscription() {
    if (!subModal) return;
    setActionLoading(subModal.user.email);
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { plan: subAction === "revoke" ? "free" : subPlan };
    if (subAction === "grant") {
      payload.subscriptionStatus = "active";
      payload.subscriptionStartDate = now;
      payload.subscriptionEndDate = subEndDate || null;
    } else if (subAction === "pause") {
      payload.subscriptionStatus = "paused";
    } else {
      payload.subscriptionStatus = "revoked";
      payload.subscriptionEndDate = now;
    }
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(subModal.user.email)}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(`Subscription updated for ${subModal.user.name}`);
        setSubModal(null);
        loadUsers();
      } else {
        showToast("Failed to update subscription", false);
      }
    } catch {
      showToast("Error", false);
    } finally {
      setActionLoading(null);
    }
  }

  async function grantTrial(user: User) {
    setActionLoading(user.email + "_trial");
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 3);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.email)}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialStartDate: now.toISOString(),
          trialEndDate: end.toISOString(),
          trialStatus: "active",
        }),
      });
      if (res.ok) {
        showToast(`3-day trial granted to ${user.name}`);
        loadUsers();
      } else showToast("Failed", false);
    } catch { showToast("Error", false); }
    finally { setActionLoading(null); }
  }

  async function sendEmail() {
    if (!emailSubject || !emailBody) return;
    setEmailSending(true);
    setEmailResult(null);
    const to = emailMode === "broadcast" ? users.map((u) => u.email) : [emailTo];
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: emailSubject, body: emailBody, type: emailMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult(`✓ Sent to ${data.sent} user${data.sent !== 1 ? "s" : ""}${data.failed ? `, ${data.failed} failed` : ""}.`);
        setEmailSubject("");
        setEmailBody("");
        setEmailTo("");
      } else {
        setEmailResult(`✗ ${data.error || "Failed"}`);
      }
    } catch {
      setEmailResult("✗ Network error");
    } finally {
      setEmailSending(false);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <Header title="Admin" subtitle="" />
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5" />
            Access denied. Admin only.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Admin Panel" subtitle="Manage users, subscriptions, and email campaigns." />
      <div className="p-6 space-y-8">

        {/* Toast */}
        {toast && (
          <div className={cn(
            "fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2",
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          )}>
            {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Users Table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">Users</h2>
              <span className="text-sm text-gray-400">({users.length})</span>
            </div>
            <button
              onClick={loadUsers}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["Name / Email", "Joined", "Trial", "Plan", "Sub Status", "Sub Dates", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((user) => {
                      const trial = trialStatus(user);
                      const sub = subStatus(user);
                      return (
                        <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(user.createdAt)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-medium", trial.color)}>{trial.label}</span>
                            {user.trialEndDate && (
                              <div className="text-xs text-gray-400">until {fmt(user.trialEndDate)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", PLAN_COLORS[user.plan] ?? "bg-gray-100 text-gray-600")}>
                              {PLAN_LABELS[user.plan] ?? user.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-medium", sub.color)}>{sub.label}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {user.subscriptionStartDate ? (
                              <div>{fmt(user.subscriptionStartDate)} → {user.subscriptionEndDate ? fmt(user.subscriptionEndDate) : "∞"}</div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSubModal({ user });
                                  setSubPlan(user.plan === "free" ? "pro" : user.plan);
                                  setSubAction("grant");
                                  setSubEndDate("");
                                }}
                                title="Manage subscription"
                                className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                              >
                                <Crown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => grantTrial(user)}
                                disabled={actionLoading === user.email + "_trial"}
                                title="Grant 3-day trial"
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors disabled:opacity-40"
                              >
                                {actionLoading === user.email + "_trial"
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <PlayCircle className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => {
                                  setEmailMode("single");
                                  setEmailTo(user.email);
                                  document.getElementById("email-section")?.scrollIntoView({ behavior: "smooth" });
                                }}
                                title="Send email"
                                className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Email Automation */}
        <section id="email-section">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Email Automation</h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEmailMode("broadcast")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  emailMode === "broadcast" ? "bg-[#e60023] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Broadcast (all users)
              </button>
              <button
                onClick={() => setEmailMode("single")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  emailMode === "single" ? "bg-[#e60023] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Single user
              </button>
            </div>

            {emailMode === "single" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Recipient email</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/30"
                />
              </div>
            )}

            {emailMode === "broadcast" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                This will send to all {users.length} user{users.length !== 1 ? "s" : ""}. Double-check before sending.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="e.g. Exciting new features in My Pin Pro!"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
              <textarea
                rows={8}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Write your email here..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/30 resize-none"
              />
            </div>

            {emailResult && (
              <div className={cn(
                "text-sm px-4 py-2.5 rounded-xl border",
                emailResult.startsWith("✓")
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              )}>
                {emailResult}
              </div>
            )}

            <button
              onClick={sendEmail}
              disabled={emailSending || !emailSubject || !emailBody || (emailMode === "single" && !emailTo)}
              className="flex items-center gap-2 bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {emailMode === "broadcast" ? `Send to all ${users.length} users` : "Send Email"}
            </button>
          </div>
        </section>
      </div>

      {/* Subscription Modal */}
      {subModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Manage: <span className="text-[#e60023]">{subModal.user.name}</span>
              </h3>
              <button onClick={() => setSubModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Action</label>
                <div className="flex gap-2">
                  {(["grant", "pause", "revoke"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setSubAction(a)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors",
                        subAction === a
                          ? a === "grant" ? "bg-green-600 text-white" : a === "pause" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {a === "grant" ? <PlayCircle className="w-3.5 h-3.5 inline mr-1" /> : a === "pause" ? <PauseCircle className="w-3.5 h-3.5 inline mr-1" /> : <XCircle className="w-3.5 h-3.5 inline mr-1" />}
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {subAction === "grant" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Plan</label>
                    <select
                      value={subPlan}
                      onChange={(e) => setSubPlan(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                      <option value="free">Free</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">End date (optional)</label>
                    <input
                      type="date"
                      value={subEndDate}
                      onChange={(e) => setSubEndDate(e.target.value ? new Date(e.target.value).toISOString() : "")}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">Leave blank for no expiry.</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSubModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applySubscription}
                disabled={actionLoading === subModal.user.email}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50",
                  subAction === "grant" ? "bg-green-600 hover:bg-green-700" :
                  subAction === "pause" ? "bg-amber-500 hover:bg-amber-600" :
                  "bg-red-600 hover:bg-red-700"
                )}
              >
                {actionLoading === subModal.user.email
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : subAction === "grant" ? "Grant Access" : subAction === "pause" ? "Pause" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
