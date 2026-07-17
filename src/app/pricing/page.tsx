import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import PublicFooter from "@/components/PublicFooter";
import { CheckCircle, X } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for getting started with Pinterest marketing",
    cta: "Get Started Free",
    href: "/signup",
    highlight: false,
    features: [
      { text: "5 scheduled pins per month", included: true },
      { text: "Basic keyword research (10 searches/day)", included: true },
      { text: "Pin analytics (30-day history)", included: true },
      { text: "1 Pinterest account", included: true },
      { text: "AI content generation", included: false },
      { text: "Pinterest Ads manager", included: false },
      { text: "Advanced keyword insights", included: false },
      { text: "Unlimited pins", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    desc: "For serious Pinterest marketers and content creators",
    cta: "Start 7-Day Free Trial",
    href: "/signup?plan=pro",
    highlight: true,
    badge: "Most Popular",
    features: [
      { text: "Unlimited scheduled pins", included: true },
      { text: "Unlimited keyword research", included: true },
      { text: "Full analytics history", included: true },
      { text: "1 Pinterest account", included: true },
      { text: "AI content generation", included: true },
      { text: "Pinterest Ads manager", included: true },
      { text: "Advanced keyword insights", included: true },
      { text: "Bulk pin scheduling", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    name: "Agency",
    price: "$49",
    period: "per month",
    desc: "For agencies and teams managing multiple Pinterest accounts",
    cta: "Contact Sales",
    href: "/contact",
    highlight: false,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Up to 10 Pinterest accounts", included: true },
      { text: "Team member access", included: true },
      { text: "White-label reports", included: true },
      { text: "API access", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "Custom onboarding", included: true },
      { text: "SLA guarantee", included: true },
      { text: "Custom integrations", included: true },
    ],
  },
];

const FAQS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes, you can cancel your subscription at any time. You'll keep access until the end of your billing period.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "Yes! Pro comes with a 7-day free trial. No credit card required to start.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards (Visa, Mastercard, Amex) and PayPal.",
  },
  {
    q: "Can I connect my real Pinterest account?",
    a: "Absolutely. My Pin Pro connects to your Pinterest account via OAuth so you can schedule and publish pins directly.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 30-day money-back guarantee if you're not satisfied with Pro.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Start free, upgrade when you need more. No hidden fees, no surprises.
        </p>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-3 gap-6 items-start">
          {PLANS.map(({ name, price, period, desc, cta, href, highlight, badge, features }) => (
            <div
              key={name}
              className={`rounded-2xl border p-7 relative ${
                highlight ? "bg-[#e60023] border-[#e60023] text-white shadow-2xl" : "bg-white border-gray-200"
              }`}
            >
              {badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                  {badge}
                </div>
              )}
              <div className="mb-6">
                <div className={`font-semibold text-sm mb-1 ${highlight ? "text-white/80" : "text-gray-500"}`}>{name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold">{price}</span>
                  <span className={`text-sm ${highlight ? "text-white/70" : "text-gray-400"}`}>/{period}</span>
                </div>
                <p className={`text-sm ${highlight ? "text-white/75" : "text-gray-500"}`}>{desc}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {features.map(({ text, included }) => (
                  <li key={text} className="flex items-start gap-2.5 text-sm">
                    {included ? (
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${highlight ? "text-white" : "text-green-500"}`} />
                    ) : (
                      <X className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-300" />
                    )}
                    <span className={included ? (highlight ? "text-white/90" : "text-gray-700") : "text-gray-400"}>{text}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={href}
                className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                  highlight
                    ? "bg-white text-[#e60023] hover:bg-gray-100"
                    : "bg-[#e60023] text-white hover:bg-[#ad081b]"
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="font-semibold text-gray-900 mb-2">{q}</div>
                <div className="text-sm text-gray-500">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to grow your Pinterest?</h2>
        <Link href="/signup" className="bg-[#e60023] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#ad081b] transition-colors inline-block">
          Get started free
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
}
