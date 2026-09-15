"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X, Zap, Crown, Building2, ArrowRight, Sparkles } from "lucide-react";
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
    ctaVariant: "outline" as const,
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
    ctaVariant: "primary" as const,
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
    ctaVariant: "outline" as const,
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
    <div className="pricing-page min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <style>{`
        :root {
          --bg: #F7F5F1;
          --bg-card: #FFFFFF;
          --bg-card-pro: #0D1117;
          --bg-card-pro-hover: #161B24;
          --text: #111318;
          --text-muted: #6B7280;
          --text-pro: #F0EEE9;
          --text-pro-muted: #9CA3AF;
          --accent: #E60023;
          --accent-hover: #C0001E;
          --border: #E2DDD7;
          --border-pro: #252B35;
          --check: #10B981;
          --cross: #D1D5DB;
          --amber: #F59E0B;
          --amber-bg: #FEF3C7;
          --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05);
          --shadow-pro: 0 8px 40px rgba(13,17,23,0.18);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) {
            --bg: #0D1117;
            --bg-card: #161B24;
            --bg-card-pro: #E60023;
            --bg-card-pro-hover: #C0001E;
            --text: #F0EEE9;
            --text-muted: #9CA3AF;
            --text-pro: #FFFFFF;
            --text-pro-muted: rgba(255,255,255,0.7);
            --border: #252B35;
            --border-pro: rgba(255,255,255,0.15);
            --cross: #374151;
            --amber-bg: rgba(245,158,11,0.15);
            --shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.25);
            --shadow-pro: 0 8px 40px rgba(230,0,35,0.25);
          }
        }
        [data-theme="dark"] {
          --bg: #0D1117;
          --bg-card: #161B24;
          --bg-card-pro: #E60023;
          --bg-card-pro-hover: #C0001E;
          --text: #F0EEE9;
          --text-muted: #9CA3AF;
          --text-pro: #FFFFFF;
          --text-pro-muted: rgba(255,255,255,0.7);
          --border: #252B35;
          --border-pro: rgba(255,255,255,0.15);
          --cross: #374151;
          --amber-bg: rgba(245,158,11,0.15);
          --shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.25);
          --shadow-pro: 0 8px 40px rgba(230,0,35,0.25);
        }

        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400;12..96,75..100,600;12..96,75..100,700;12..96,75..100,800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        .pricing-page * { box-sizing: border-box; }
        .pricing-page { font-family: 'DM Sans', system-ui, sans-serif; }
        .display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; }

        .toggle-pill {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 100px;
          padding: 4px;
          display: inline-flex;
          gap: 2px;
        }
        .toggle-btn {
          padding: 6px 20px;
          border-radius: 100px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s ease;
          background: transparent;
          color: var(--text-muted);
        }
        .toggle-btn.active {
          background: var(--text);
          color: var(--bg);
        }

        .plan-card {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: var(--shadow-card);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          position: relative;
        }
        .plan-card:hover { transform: translateY(-2px); }
        .plan-card.pro {
          background: var(--bg-card-pro);
          border-color: var(--border-pro);
          box-shadow: var(--shadow-pro);
          transform: scale(1.03);
        }
        .plan-card.pro:hover { transform: scale(1.03) translateY(-3px); }

        .badge {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 100px;
          background: var(--accent);
          color: #fff;
          display: inline-block;
          width: fit-content;
        }

        .price-num {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 52px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .cta-btn {
          width: 100%;
          padding: 13px 24px;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1.5px solid transparent;
          text-decoration: none;
        }
        .cta-btn.primary {
          background: var(--accent);
          color: #fff;
        }
        .cta-btn.primary:hover { background: var(--accent-hover); }
        .cta-btn.outline-dark {
          background: transparent;
          border-color: var(--border);
          color: var(--text);
        }
        .cta-btn.outline-dark:hover { background: var(--border); }
        .cta-btn.outline-light {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.25);
          color: #fff;
        }
        .cta-btn.outline-light:hover { background: rgba(255,255,255,0.2); }

        .feature-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-muted);
        }
        .feature-row.pro { color: var(--text-pro-muted); }
        .feature-icon { flex-shrink: 0; margin-top: 2px; }

        .limit-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text);
        }
        .limit-pill.pro {
          border-color: var(--border-pro);
          color: var(--text-pro);
        }
        .limit-pill:last-child { border-bottom: none; }

        .matrix-table {
          width: 100%;
          border-collapse: collapse;
        }
        .matrix-table th {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          padding: 10px 16px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .matrix-table th.feature-col { text-align: left; }
        .matrix-table td {
          padding: 11px 16px;
          font-size: 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          text-align: center;
          vertical-align: middle;
        }
        .matrix-table td.feature-col { text-align: left; }
        .matrix-table tr:last-child td { border-bottom: none; }
        .matrix-table .cat-row td {
          font-family: 'DM Sans', sans-serif;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text-muted);
          background: var(--border);
          padding: 8px 16px;
          border-bottom: none;
        }
        .matrix-table .cat-row td { color: var(--text); }
        .matrix-table tr:hover:not(.cat-row) td { background: rgba(0,0,0,0.02); }

        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .matrix-table tr:hover:not(.cat-row) td {
            background: rgba(255,255,255,0.03);
          }
          :root:not([data-theme="light"]) .matrix-table .cat-row td {
            color: var(--text-muted);
          }
        }

        @media (max-width: 768px) {
          .plans-grid { grid-template-columns: 1fr !important; }
          .plan-card.pro { transform: none; }
          .plan-card.pro:hover { transform: translateY(-2px); }
          .matrix-wrap { overflow-x: auto; }
          .matrix-table { min-width: 540px; }
        }
      `}</style>

      {/* Hero */}
      <div className="text-center px-6 pt-12 pb-4">
        <div className="inline-flex items-center gap-2 bg-[var(--amber-bg)] text-[var(--amber)] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Simple, transparent pricing
        </div>
        <h1 className="display text-4xl md:text-5xl font-800 tracking-tight text-[var(--text)] mb-4" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, textWrap: "balance" }}>
          Grow on Pinterest.<br />Pick your plan.
        </h1>
        <p className="text-[var(--text-muted)] text-lg max-w-lg mx-auto mb-8" style={{ textWrap: "balance" }}>
          Everything from keyword research to scheduling, ads, and catalog — one platform, no fluff.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="toggle-pill">
            <button className={`toggle-btn ${!annual ? "active" : ""}`} onClick={() => setAnnual(false)}>Monthly</button>
            <button className={`toggle-btn ${annual ? "active" : ""}`} onClick={() => setAnnual(true)}>Annual</button>
          </div>
          {annual && (
            <div className="inline-flex items-center gap-1.5 bg-[var(--amber-bg)] text-[var(--amber)] text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              Save 40%
            </div>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", alignItems: "start" }}>
          {PLANS.map((plan) => {
            const isPro = plan.key === "pro";
            const isEnt = plan.key === "enterprise";
            const price = plan.monthlyPrice === 0 ? 0 : annual ? plan.annualPrice : plan.monthlyPrice;
            const IconComp = plan.icon;

            return (
              <div key={plan.key} className={cn("plan-card", isPro && "pro")}>
                {/* Badge */}
                {plan.badge && <div className="badge">{plan.badge}</div>}

                {/* Header */}
                <div>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                    isPro ? "bg-white/15" : "bg-[var(--border)]"
                  )}>
                    <IconComp className={cn("w-5 h-5", isPro ? "text-white" : "text-[var(--text)]")} />
                  </div>
                  <h2 className="display text-xl font-700 mb-1" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, color: isPro ? "var(--text-pro)" : "var(--text)" }}>
                    {plan.name}
                  </h2>
                  <p className="text-sm" style={{ color: isPro ? "var(--text-pro-muted)" : "var(--text-muted)" }}>
                    {plan.tagline}
                  </p>
                </div>

                {/* Price */}
                <div className="flex items-end gap-2">
                  <span className="price-num" style={{ color: isPro ? "var(--text-pro)" : "var(--text)" }}>
                    {price === 0 ? "Free" : `$${price}`}
                  </span>
                  {price > 0 && (
                    <div className="pb-2">
                      <span className="text-sm" style={{ color: isPro ? "var(--text-pro-muted)" : "var(--text-muted)" }}>/mo</span>
                      {annual && (
                        <p className="text-xs" style={{ color: isPro ? "var(--text-pro-muted)" : "var(--text-muted)" }}>
                          billed annually
                        </p>
                      )}
                      {!annual && plan.monthlyPrice > 0 && (
                        <p className="text-xs text-[var(--amber)]">
                          Save 40% annually
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <Link
                  href={plan.ctaHref}
                  className={cn(
                    "cta-btn",
                    isPro ? "primary" : isEnt ? "outline-dark" : "outline-dark"
                  )}
                  style={isPro ? {} : {}}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {/* Limits */}
                <div>
                  <p className="text-xs font-600 uppercase tracking-widest mb-3" style={{ color: isPro ? "var(--text-pro-muted)" : "var(--text-muted)", fontWeight: 600 }}>
                    Included
                  </p>
                  <div>
                    {plan.limits.map((l) => (
                      <div key={l} className={cn("limit-pill", isPro && "pro")}>
                        <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isPro ? "rgba(255,255,255,0.6)" : "var(--check)" }} />
                        <span style={{ fontSize: 13.5 }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature matrix */}
      <div className="px-6 pb-16 max-w-5xl mx-auto">
        <h2 className="display text-2xl font-700 mb-8 text-[var(--text)]" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700 }}>
          What&apos;s included
        </h2>
        <div className="matrix-wrap rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
          <table className="matrix-table">
            <thead>
              <tr>
                <th className="feature-col">Feature</th>
                <th>Free</th>
                <th style={{ color: "var(--accent)", fontWeight: 700 }}>Pro</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((section) => {
                const proHas = PLANS[1].featureAccess[section.category as keyof typeof PLANS[1]["featureAccess"]];
                const entHas = PLANS[2].featureAccess[section.category as keyof typeof PLANS[2]["featureAccess"]];
                const freeHas = PLANS[0].featureAccess[section.category as keyof typeof PLANS[0]["featureAccess"]];

                return (
                  <>
                    <tr key={`cat-${section.category}`} className="cat-row">
                      <td colSpan={4}>{section.category}</td>
                    </tr>
                    {section.items.map((item) => (
                      <tr key={item}>
                        <td className="feature-col" style={{ paddingLeft: 24 }}>{item}</td>
                        <td>
                          {freeHas
                            ? <Check className="w-4 h-4 mx-auto" style={{ color: "var(--check)" }} />
                            : <X className="w-4 h-4 mx-auto" style={{ color: "var(--cross)" }} />}
                        </td>
                        <td>
                          {proHas
                            ? <Check className="w-4 h-4 mx-auto" style={{ color: "var(--check)" }} />
                            : <X className="w-4 h-4 mx-auto" style={{ color: "var(--cross)" }} />}
                        </td>
                        <td>
                          {entHas
                            ? <Check className="w-4 h-4 mx-auto" style={{ color: "var(--check)" }} />
                            : <X className="w-4 h-4 mx-auto" style={{ color: "var(--cross)" }} />}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Free trial notice */}
      <div className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex-1">
            <h3 className="display text-xl font-700 text-[var(--text)] mb-2" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700 }}>
              Free 3-Day Trial on Paid Plans
            </h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Try any paid plan free for 3 days — no credit card required upfront. After your trial, choose a plan that fits. Free accounts can create up to 3 accounts per device. Keyword results are limited to 15 on the free plan; upgrade to unlock all results.
            </p>
          </div>
          <Link
            href="/signup"
            className="cta-btn primary whitespace-nowrap"
            style={{ width: "auto", padding: "12px 24px" }}
          >
            Start Free Trial
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
