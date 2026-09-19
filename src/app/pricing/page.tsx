"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Crown, Building2, ArrowRight, Sparkles } from "lucide-react";
import PublicNav from "@/components/PublicNav";
import PublicFooter from "@/components/PublicFooter";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    category: "Keyword Research",
    items: [
      "Trending keywords with search volume & competition",
      "Keyword suggestions and related terms",
      "Country-specific keyword data",
    ],
  },
  {
    category: "Track Keywords",
    items: [
      "Save and monitor keywords over time",
      "Organize into folders",
      "Track ranking changes",
    ],
  },
  {
    category: "Pinterest SEO Audit",
    items: [
      "Audit your Pinterest account for SEO gaps",
      "Analyze individual pins for keyword optimization",
      "Board-level SEO recommendations",
    ],
  },
  {
    category: "Keyword Extractor",
    items: [
      "Extract keywords from your website",
      "Identify keywords Pinterest matched to your pins",
    ],
  },
  {
    category: "Pin Scheduler",
    items: [
      "Schedule pins for future publishing",
      "Smart Schedule & Pin Spacing",
      "SEO Score & Keywords Suggestions",
      "AI Pin Title and Description Writing",
      "Calendar view for planned pins",
      "Board Management",
    ],
  },
  {
    category: "Account Audit",
    items: [
      "Find Duplicate Pins",
      "Find Broken Title, Description or Link",
      "Pin-level analytics",
      "Board-by-board pin analysis",
    ],
  },
  {
    category: "Pinterest Ads",
    items: [
      "Campaign Plan",
      "Campaign performance analysis",
      "Audience & budget insights",
      "Funnel Analysis",
      "Creative & keyword optimization suggestions",
      "Automated rules overview",
      "Dedicated Live Chat & Live Call Support",
    ],
    enterpriseOnly: true,
  },
  {
    category: "Pinterest Catalog",
    items: [
      "Browse and manage your Pinterest catalog",
      "Catalog SEO Audit",
      "Technical Issue Detector",
      "Product-level Title & Description Suggestions",
      "Pin-level analytics for catalog items",
    ],
    enterpriseOnly: true,
  },
  {
    category: "Analytics Dashboard",
    items: [
      "Account-wide impressions, clicks, saves & more",
      "Organic & Campaign Analytics in one dashboard",
      "365-day performance overview",
    ],
  },
];

const PLANS = [
  {
    key: "free",
    name: "Free",
    icon: Zap,
    monthlyPrice: 0,
    annualPrice: 0,
    tagline: "Get started with the basics",
    cta: "Get Started Free",
    ctaHref: "/signup",
    limits: [
      "10 Pin Schedules / month",
      "3 Keyword Searches / day",
      "5 AI Writing Credits / month",
      "5 SEO Score Checks",
      "1 Pinterest Account",
    ],
    featureAccess: {
      "Keyword Research": true,
      "Track Keywords": false,
      "Pinterest SEO Audit": false,
      "Keyword Extractor": false,
      "Pin Scheduler": true,
      "Account Audit": false,
      "Pinterest Ads": false,
      "Pinterest Catalog": false,
      "Analytics Dashboard": false,
    },
  },
  {
    key: "pro",
    name: "Pro",
    icon: Crown,
    monthlyPrice: 29.99,
    annualPrice: 17.99,
    tagline: "For creators serious about Pinterest",
    cta: "Start Pro",
    ctaHref: "/signup?plan=pro",
    highlight: true,
    badge: "Most Popular",
    limits: [
      "1,000 Pin Schedules / month",
      "Unlimited Keyword Searches",
      "200 AI Writing Credits / month",
      "Unlimited SEO Score Checks",
      "2 Pinterest Accounts",
    ],
    featureAccess: {
      "Keyword Research": true,
      "Track Keywords": true,
      "Pinterest SEO Audit": true,
      "Keyword Extractor": true,
      "Pin Scheduler": true,
      "Account Audit": true,
      "Pinterest Ads": false,
      "Pinterest Catalog": false,
      "Analytics Dashboard": true,
    },
  },
  {
    key: "enterprise",
    name: "Enterprise",
    icon: Building2,
    monthlyPrice: 69.99,
    annualPrice: 41.99,
    tagline: "Full power for agencies & brands",
    cta: "Start Enterprise",
    ctaHref: "/signup?plan=enterprise",
    limits: [
      "2,000 Pin Schedules / month",
      "Unlimited Keyword Searches",
      "500 AI Writing Credits / month",
      "Unlimited SEO Score Checks",
      "3 Pinterest Accounts",
    ],
    featureAccess: {
      "Keyword Research": true,
      "Track Keywords": true,
      "Pinterest SEO Audit": true,
      "Keyword Extractor": true,
      "Pin Scheduler": true,
      "Account Audit": true,
      "Pinterest Ads": true,
      "Pinterest Catalog": true,
      "Analytics Dashboard": true,
    },
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5F1] dark:bg-[#0D1117]">
      <PublicNav />

      <main>
        {/* Hero */}
        <section className="text-center px-4 sm:px-6 pt-14 sm:pt-20 pb-8 sm:pb-12">
          <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-amber-100 dark:border-amber-800">
            <Sparkles className="w-3.5 h-3.5" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 mb-4 leading-tight" style={{ textWrap: "balance" }}>
            Grow on Pinterest.<br />Pick your plan.
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-lg mx-auto mb-10" style={{ textWrap: "balance" }}>
            Everything from keyword research to scheduling, ads, and catalog — one platform, no fluff.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 inline-flex gap-1">
              <button
                onClick={() => setAnnual(false)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold transition-all",
                  !annual
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-semibold transition-all",
                  annual
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Annual
              </button>
            </div>
            {annual && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm font-bold px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800">
                Save 40%
              </span>
            )}
          </div>
        </section>

        {/* Plan cards */}
        <section className="px-4 sm:px-6 pb-16 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan) => {
              const isPro = plan.key === "pro";
              const price = plan.monthlyPrice === 0 ? 0 : annual ? plan.annualPrice : plan.monthlyPrice;
              const IconComp = plan.icon;

              return (
                <div
                  key={plan.key}
                  className={cn(
                    "rounded-2xl p-8 flex flex-col gap-6 border transition-transform duration-200",
                    isPro
                      ? "bg-gray-900 border-gray-800 shadow-2xl sm:scale-[1.04] sm:-translate-y-1"
                      : "bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 shadow-sm hover:-translate-y-1"
                  )}
                >
                  {plan.badge && (
                    <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#e60023] text-white w-fit">
                      {plan.badge}
                    </span>
                  )}

                  {/* Header */}
                  <div>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                      isPro ? "bg-white/10" : "bg-gray-100 dark:bg-gray-700"
                    )}>
                      <IconComp className={cn("w-5 h-5", isPro ? "text-white" : "text-gray-600 dark:text-gray-300")} />
                    </div>
                    <h2 className={cn("text-xl font-bold mb-1", isPro ? "text-white" : "text-gray-900 dark:text-gray-100")}>
                      {plan.name}
                    </h2>
                    <p className={cn("text-sm", isPro ? "text-gray-400" : "text-gray-500 dark:text-gray-400")}>
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="flex items-end gap-2">
                    <span className={cn("text-5xl font-extrabold tracking-tight", isPro ? "text-white" : "text-gray-900 dark:text-gray-100")}>
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {price > 0 && (
                      <div className="pb-1.5">
                        <span className={cn("text-sm", isPro ? "text-gray-400" : "text-gray-400")}>/mo</span>
                        {annual && (
                          <p className={cn("text-xs", isPro ? "text-gray-500" : "text-gray-400 dark:text-gray-500")}>
                            billed annually
                          </p>
                        )}
                        {!annual && plan.monthlyPrice > 0 && (
                          <p className="text-xs text-amber-500 font-medium">Save 40% annually</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    href={plan.ctaHref}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold transition-colors",
                      isPro
                        ? "bg-[#e60023] text-white hover:bg-[#c0001e]"
                        : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white"
                    )}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  {/* Limits */}
                  <div>
                    <p className={cn("text-[11px] font-semibold uppercase tracking-widest mb-3", isPro ? "text-gray-500" : "text-gray-400 dark:text-gray-500")}>
                      Included
                    </p>
                    <div className="space-y-0">
                      {plan.limits.map((l) => (
                        <div
                          key={l}
                          className={cn(
                            "flex items-center gap-2.5 py-2.5 border-b text-sm font-medium",
                            isPro
                              ? "border-gray-800 text-gray-200"
                              : "border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300",
                            "last:border-b-0"
                          )}
                        >
                          <Check className={cn("w-3.5 h-3.5 flex-shrink-0", isPro ? "text-gray-500" : "text-emerald-500")} />
                          <span>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature comparison table */}
        <section className="px-4 sm:px-6 pb-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8">
            What&apos;s included
          </h2>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800/60 overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-1/2">Feature</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 text-center">Free</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-widest text-[#e60023] text-center">Pro</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((section) => {
                  const freeHas = PLANS[0].featureAccess[section.category as keyof typeof PLANS[0]["featureAccess"]];
                  const proHas = PLANS[1].featureAccess[section.category as keyof typeof PLANS[1]["featureAccess"]];
                  const entHas = PLANS[2].featureAccess[section.category as keyof typeof PLANS[2]["featureAccess"]];

                  return (
                    <>
                      <tr key={`cat-${section.category}`} className="bg-gray-50 dark:bg-gray-700/40">
                        <td colSpan={4} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                          {section.category}
                          {section.enterpriseOnly && (
                            <span className="ml-2 text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-semibold">Enterprise</span>
                          )}
                        </td>
                      </tr>
                      {section.items.map((item) => (
                        <tr key={item} className="border-b border-gray-100 dark:border-gray-700/60 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                          <td className="px-4 py-3 pl-6 text-sm text-gray-600 dark:text-gray-300">{item}</td>
                          <td className="px-4 py-3 text-center">
                            {freeHas
                              ? <Check className="w-4 h-4 mx-auto text-emerald-500" />
                              : <X className="w-4 h-4 mx-auto text-gray-200 dark:text-gray-600" />}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {proHas
                              ? <Check className="w-4 h-4 mx-auto text-emerald-500" />
                              : <X className="w-4 h-4 mx-auto text-gray-200 dark:text-gray-600" />}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entHas
                              ? <Check className="w-4 h-4 mx-auto text-emerald-500" />
                              : <X className="w-4 h-4 mx-auto text-gray-200 dark:text-gray-600" />}
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Free trial notice */}
        <section className="px-4 sm:px-6 pb-20 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Free 3-Day Trial on Paid Plans
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Try any paid plan free for 3 days — no credit card required. Free accounts support up to 3 active sessions per device. Keyword results are limited to 15 on the free plan; upgrade to unlock all results.
              </p>
            </div>
            <Link
              href="/signup"
              className="shrink-0 flex items-center gap-2 bg-[#e60023] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#c0001e] transition-colors"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
