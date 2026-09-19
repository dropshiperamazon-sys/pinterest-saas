"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle, Target, Users, TrendingUp, UserPlus } from "lucide-react";

type Goal = "brand_reach" | "website_visitors" | "website_sales" | "sign_ups";

const GOALS: { id: Goal; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "brand_reach", label: "Brand Reach", icon: <Users className="w-5 h-5" />, desc: "Grow awareness of your brand" },
  { id: "website_visitors", label: "Increase Website Visitors", icon: <TrendingUp className="w-5 h-5" />, desc: "Drive more traffic to your site" },
  { id: "website_sales", label: "Increase Website Sales", icon: <Target className="w-5 h-5" />, desc: "Convert visitors to customers" },
  { id: "sign_ups", label: "Increase Sign Ups", icon: <UserPlus className="w-5 h-5" />, desc: "Get more leads and registrations" },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showRetype, setShowRetype] = useState(false);

  // Step 2 fields
  const [businessName, setBusinessName] = useState("");

  // Step 3 fields
  const [goal, setGoal] = useState<Goal | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createAccount() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return false;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Account created. Please sign in.");
        router.push("/login");
        return false;
      }
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return false;
    }
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (password !== retypePassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setStep(2);
  }

  function handleStep2(skip = false) {
    setStep(3);
  }

  function handleStep3(skip = false) {
    setStep(4);
  }

  async function handleStep4(skip = false) {
    const ok = await createAccount();
    if (ok) {
      if (!skip) {
        router.push("/connect");
      } else {
        router.push("/dashboard");
      }
    }
  }

  const stepLabels = ["Account", "Business", "Goal", "Connect"];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center mb-4">
            <img src="/rambforce-logo.png" alt="Rambforce" className="h-9 w-auto object-contain" />
          </Link>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  done ? "bg-[#e60023] text-white" : active ? "bg-[#e60023] text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {done ? <CheckCircle className="w-4 h-4" /> : n}
                </div>
                <span className={`text-xs hidden sm:block ${active ? "text-gray-900 font-medium" : "text-gray-400"}`}>{label}</span>
                {i < stepLabels.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${n < step ? "bg-[#e60023]" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Create your account</h1>
              <p className="text-sm text-gray-500 mb-6">Start growing your Pinterest for free</p>

              <div className="flex gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-5">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">Free plan includes 5 scheduled pins/month, keyword research, and basic analytics.</p>
              </div>

              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Full name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                      required minLength={8} placeholder="Min. 8 characters"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] pr-10" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Retype password</label>
                  <div className="relative">
                    <input type={showRetype ? "text" : "password"} value={retypePassword} onChange={e => setRetypePassword(e.target.value)}
                      required minLength={8} placeholder="Confirm your password"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] pr-10" />
                    <button type="button" onClick={() => setShowRetype(!showRetype)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showRetype ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

                <button type="submit"
                  className="w-full bg-[#e60023] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#ad081b] transition-colors">
                  Continue →
                </button>

                <p className="text-xs text-gray-400 text-center">
                  By signing up you agree to our <Link href="/privacy" className="underline">Privacy Policy</Link>
                </p>
              </form>

              <div className="mt-4 text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-[#e60023] font-semibold hover:underline">Sign in</Link>
              </div>
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">What&apos;s your business name?</h1>
              <p className="text-sm text-gray-500 mb-6">This helps us personalise your experience.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Business name</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Shop"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
                </div>

                <button onClick={() => setStep(1)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
                ← Go back
              </button>

              <button onClick={() => handleStep2(false)} disabled={!businessName.trim()}
                  className="w-full bg-[#e60023] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#ad081b] transition-colors disabled:opacity-40">
                  Continue →
                </button>

                <button onClick={() => handleStep2(true)}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
                  Skip for now
                </button>
              </div>
            </>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">What&apos;s your main business goal?</h1>
              <p className="text-sm text-gray-500 mb-5">We&apos;ll tailor recommendations for you.</p>

              <div className="space-y-3 mb-5">
                {GOALS.map(g => (
                  <button key={g.id} onClick={() => setGoal(g.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      goal === g.id ? "border-[#e60023] bg-[#e60023]/5" : "border-gray-200 hover:border-gray-300"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      goal === g.id ? "bg-[#e60023]/10 text-[#e60023]" : "bg-gray-100 text-gray-500"
                    }`}>
                      {g.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{g.label}</div>
                      <div className="text-xs text-gray-500">{g.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={() => setStep(2)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors">
                ← Go back
              </button>

              <button onClick={() => handleStep3(false)} disabled={!goal}
                className="w-full bg-[#e60023] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#ad081b] transition-colors disabled:opacity-40">
                Continue →
              </button>

              <button onClick={() => handleStep3(true)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 mt-2 transition-colors">
                Skip for now
              </button>
            </>
          )}

          {/* ── Step 4 ── */}
          {step === 4 && (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Connect your Pinterest</h1>
              <p className="text-sm text-gray-500 mb-6">Link your account to start scheduling pins and viewing analytics.</p>

              <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Schedule pins to your boards
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> View impressions, clicks and saves
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> Keyword research &amp; SEO audit
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

              <button onClick={() => setStep(3)} disabled={loading}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors disabled:opacity-40">
                ← Go back
              </button>

              <button onClick={() => handleStep4(false)} disabled={loading}
                className="w-full bg-[#e60023] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#ad081b] transition-colors disabled:opacity-60">
                {loading ? "Creating account…" : "Connect Pinterest →"}
              </button>

              <button onClick={() => handleStep4(true)} disabled={loading}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 mt-2 transition-colors disabled:opacity-40">
                Skip — go to dashboard
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
