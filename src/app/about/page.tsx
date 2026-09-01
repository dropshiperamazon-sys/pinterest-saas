import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import PublicFooter from "@/components/PublicFooter";
import { Target, Heart, Zap, Users } from "lucide-react";

const VALUES = [
  {
    icon: Target,
    title: "Built for results",
    desc: "Every feature is designed around one goal: helping you get more traffic from Pinterest.",
  },
  {
    icon: Heart,
    title: "Creator-first",
    desc: "We're built for bloggers, shop owners, and marketers — not enterprise teams.",
  },
  {
    icon: Zap,
    title: "Simple & powerful",
    desc: "Powerful analytics and scheduling tools without the complexity of enterprise software.",
  },
  {
    icon: Users,
    title: "Community driven",
    desc: "Our roadmap is shaped by feedback from our users. Your ideas become features.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 sm:pb-12 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">About My Pin Pro</h1>
        <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
          My Pin Pro was built by Pinterest marketers, for Pinterest marketers. We got tired of juggling
          spreadsheets, manual scheduling, and guessing which keywords would rank — so we built the tool we always wanted.
        </p>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="bg-gray-50 rounded-2xl p-8 text-gray-600 leading-relaxed space-y-4">
          <p>
            Pinterest drives <strong className="text-gray-900">billions of searches every month</strong>, yet most creators are
            flying blind — posting without strategy, missing peak times, and targeting the wrong keywords.
          </p>
          <p>
            My Pin Pro changes that. We give you the keyword research tools to find what people are actually searching for,
            the scheduler to post at the right time every time, and the analytics to understand what's actually driving traffic.
          </p>
          <p>
            Whether you're a blogger trying to grow your audience, an e-commerce store driving product sales, or a social
            media manager handling multiple clients — My Pin Pro is the Pinterest marketing suite you've been looking for.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8 sm:mb-10">What we believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="w-10 h-10 bg-[#e60023]/10 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#e60023]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
            {[
              { value: "10,000+", label: "Pins scheduled" },
              { value: "500+", label: "Active users" },
              { value: "4.8★", label: "Average rating" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-gray-50 rounded-2xl p-4 sm:p-8">
                <div className="text-2xl sm:text-4xl font-bold text-[#e60023] mb-2">{value}</div>
                <div className="text-gray-500 text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 text-center px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Join thousands of Pinterest marketers</h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link href="/signup" className="w-full sm:w-auto bg-[#e60023] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#ad081b] transition-colors text-center">
            Get started free
          </Link>
          <Link href="/contact" className="w-full sm:w-auto border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-center">
            Contact us
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
