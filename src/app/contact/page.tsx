"use client";
import { useState } from "react";
import PublicNav from "@/components/PublicNav";
import PublicFooter from "@/components/PublicFooter";
import { Mail, MessageSquare, Clock, CheckCircle } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simulate sending (wire up to email/form service later)
    await new Promise((r) => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Contact Us</h1>
          <p className="text-base sm:text-lg text-gray-500">Have a question or need help? We&apos;d love to hear from you.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
          {/* Left: Info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Get in touch</h2>
              <p className="text-gray-500 leading-relaxed">
                Whether you have a question about features, pricing, your account, or anything else —
                our team is ready to answer all your questions.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#e60023]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-[#e60023]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-0.5">Email us</div>
                  <div className="text-sm text-gray-500">saiful.khank16@gmail.com</div>
                  <div className="text-xs text-gray-400 mt-0.5">We reply within 24 hours</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#e60023]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-[#e60023]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-0.5">Live chat</div>
                  <div className="text-sm text-gray-500">Available for Pro subscribers</div>
                  <div className="text-xs text-gray-400 mt-0.5">Mon–Fri, 9am–6pm EST</div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#e60023]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-[#e60023]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-0.5">Response time</div>
                  <div className="text-sm text-gray-500">Free: within 48 hours</div>
                  <div className="text-sm text-gray-500">Pro: within 24 hours</div>
                  <div className="text-sm text-gray-500">Agency: within 4 hours</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
              <div className="font-semibold text-gray-900 mb-3">Common questions</div>
              <ul className="space-y-2 text-sm text-[#e60023]">
                <li><a href="/pricing" className="hover:underline">How does pricing work?</a></li>
                <li><a href="/pricing#faq" className="hover:underline">Can I cancel anytime?</a></li>
                <li><a href="/signup" className="hover:underline">How do I connect my Pinterest?</a></li>
              </ul>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {sent ? (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Message sent!</h3>
                <p className="text-gray-500">Thanks for reaching out. We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Your name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Jane Smith"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="jane@example.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] bg-white"
                  >
                    <option value="">Select a topic…</option>
                    <option>General question</option>
                    <option>Billing & payments</option>
                    <option>Technical support</option>
                    <option>Feature request</option>
                    <option>Agency / partnership</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="How can we help you?"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#e60023] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#ad081b] transition-colors disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
