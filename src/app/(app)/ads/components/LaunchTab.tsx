"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight, ChevronLeft, Target, DollarSign, Users, Image as ImageIcon,
  CheckCircle2, AlertCircle, Link2, Sparkles, LayoutGrid, Copy, Zap,
} from "lucide-react";

const OBJECTIVES = [
  { id: "awareness", label: "Brand Awareness", icon: "👁️", desc: "Reach more people and increase brand recognition", kpi: "CPM" },
  { id: "traffic", label: "Traffic", icon: "🌐", desc: "Drive visitors to your website or landing page", kpi: "CPC" },
  { id: "conversions", label: "Conversions", icon: "🎯", desc: "Get more purchases, sign-ups, or leads", kpi: "CPA" },
  { id: "video_views", label: "Video Views", icon: "▶️", desc: "Maximise views on your video content", kpi: "CPV" },
  { id: "catalog", label: "Catalog Sales", icon: "🛍️", desc: "Show ads from your product catalog dynamically", kpi: "ROAS" },
  { id: "app", label: "App Installs", icon: "📱", desc: "Drive downloads of your mobile application", kpi: "CPI" },
];

const TEMPLATES = [
  { id: "t1", name: "Product Launch", emoji: "🚀", desc: "Drive awareness and conversions for a new product" },
  { id: "t2", name: "Seasonal Sale", emoji: "🏷️", desc: "Promote limited-time offers and discounts" },
  { id: "t3", name: "Brand Story", emoji: "✨", desc: "Build brand affinity through inspirational content" },
  { id: "t4", name: "Retargeting", emoji: "🔁", desc: "Re-engage visitors who didn't convert" },
  { id: "t5", name: "Lead Generation", emoji: "📋", desc: "Capture emails and leads from Pinterest" },
  { id: "t6", name: "Event Promotion", emoji: "🎉", desc: "Drive registrations for events or webinars" },
];

const STEPS = ["Objective", "Setup", "Audience", "Creatives", "Review"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1 last:flex-initial">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0",
            i < step ? "bg-[#e60023] text-white" :
            i === step ? "bg-[#e60023] text-white ring-4 ring-[#e60023]/20" :
            "bg-gray-100 text-gray-400"
          )}>
            {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span className={cn("text-xs font-medium hidden sm:block", i === step ? "text-gray-900" : "text-gray-400")}>{label}</span>
          {i < STEPS.length - 1 && (
            <div className={cn("flex-1 h-0.5 mx-2", i < step ? "bg-[#e60023]" : "bg-gray-100")} />
          )}
        </div>
      ))}
    </div>
  );
}

function ObjectiveStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">What's your campaign goal?</h3>
        <p className="text-sm text-gray-500">Your objective determines how Pinterest optimises your ads and which KPIs to track.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {OBJECTIVES.map((obj) => (
          <button
            key={obj.id}
            onClick={() => onChange(obj.id)}
            className={cn(
              "text-left p-4 rounded-xl border-2 transition-all",
              value === obj.id ? "border-[#e60023] bg-[#e60023]/5" : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="text-2xl mb-2">{obj.icon}</div>
            <div className="text-sm font-semibold text-gray-800">{obj.label}</div>
            <div className="text-xs text-gray-500 mt-1">{obj.desc}</div>
            <div className="mt-2 text-xs font-bold text-[#e60023]">Primary KPI: {obj.kpi}</div>
          </button>
        ))}
      </div>

      {/* Templates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-700">Or start from a template</h4>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="text-left p-3 rounded-xl border border-gray-200 hover:border-[#e60023]/40 hover:bg-[#e60023]/5 transition-all group">
              <div className="text-lg mb-1">{t.emoji}</div>
              <div className="text-xs font-semibold text-gray-800">{t.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SetupStep({ data, onChange }: { data: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const [genLoading, setGenLoading] = useState(false);
  const [genName, setGenName] = useState("");

  const generateName = () => {
    setGenLoading(true);
    setTimeout(() => {
      const names = [
        "US-Women25-34-HomeDecor-Conv-Jun26",
        "RetargetingVisitors30d-Traffic-Jun26",
        "BrandAwareness-Broad-Q2-2026",
        "SummerCollection-ConvOpt-HighBudget",
      ];
      onChange("name", names[Math.floor(Math.random() * names.length)]);
      setGenLoading(false);
    }, 700);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Campaign Setup</h3>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-600">Campaign Name</label>
          <button onClick={generateName} disabled={genLoading} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
            <Zap className="w-3 h-3" />
            {genLoading ? "Generating..." : "Auto-name"}
          </button>
        </div>
        <input
          value={data.name || ""}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="e.g. US-Women25-34-HomeDecor-Conversions"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
        />
        <p className="text-xs text-gray-400 mt-1">Tip: Include target audience, objective, and date for easy filtering.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Daily Budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" value={data.budget || ""} onChange={(e) => onChange("budget", e.target.value)} placeholder="50.00" className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Bid Strategy</label>
          <select value={data.bidStrategy || ""} onChange={(e) => onChange("bidStrategy", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]">
            <option value="">Select strategy</option>
            <option>Automatic (Recommended)</option>
            <option>Manual CPC</option>
            <option>Target CPA</option>
            <option>Target ROAS</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Start Date</label>
          <input type="date" value={data.startDate || ""} onChange={(e) => onChange("startDate", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">End Date <span className="text-gray-400">(optional)</span></label>
          <input type="date" value={data.endDate || ""} onChange={(e) => onChange("endDate", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1.5">Landing Page URL</label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={data.url || ""} onChange={(e) => onChange("url", e.target.value)} placeholder="https://yourwebsite.com/landing" className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]" />
        </div>
        <div className="mt-2 space-y-1">
          {[
            { ok: true, label: "Pinterest Pixel detected" },
            { ok: true, label: "Landing page loads in < 3s" },
            { ok: false, label: "Conversion event not firing — check pixel setup" },
          ].map(({ ok, label }) => (
            <div key={label} className={cn("flex items-center gap-2 text-xs", ok ? "text-green-600" : "text-red-500")}>
              {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AudienceStep() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const savedAudiences = [
    { id: "sa1", name: "Website Visitors 30d", size: "24K", type: "Retargeting" },
    { id: "sa2", name: "Cart Abandoners 14d", size: "8.2K", type: "Retargeting" },
    { id: "sa3", name: "Email List Upload", size: "42K", type: "Customer List" },
    { id: "sa4", name: "Lookalike — Top Buyers 1%", size: "2.1M", type: "Lookalike" },
    { id: "sa5", name: "Home Decor Enthusiasts", size: "4.2M", type: "Interest" },
    { id: "sa6", name: "Women 25–44 USA", size: "12M", type: "Demographic" },
  ];

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-gray-900">Audience Setup</h3>
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Saved Audiences</h4>
        <div className="grid grid-cols-2 gap-2">
          {savedAudiences.map((aud) => (
            <button
              key={aud.id}
              onClick={() => toggle(aud.id)}
              className={cn(
                "text-left p-3.5 rounded-xl border-2 transition-all",
                selected.includes(aud.id) ? "border-[#e60023] bg-[#e60023]/5" : "border-gray-200 hover:border-gray-300"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{aud.name}</span>
                {selected.includes(aud.id) && <CheckCircle2 className="w-4 h-4 text-[#e60023]" />}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                  aud.type === "Retargeting" ? "bg-orange-100 text-orange-700" :
                  aud.type === "Lookalike" ? "bg-purple-100 text-purple-700" :
                  aud.type === "Interest" ? "bg-green-100 text-green-700" :
                  "bg-blue-100 text-blue-700"
                )}>{aud.type}</span>
                <span className="text-xs text-gray-500">{aud.size}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-purple-800 mb-1">AI Audience Suggestion</div>
            <p className="text-xs text-purple-600">Based on your objective and past performance, we recommend combining <strong>Website Visitors 30d</strong> + <strong>Lookalike 1%</strong> for a retargeting + expansion strategy. Estimated combined reach: <strong>2.1M</strong>.</p>
            <button className="mt-2 text-xs text-purple-700 font-semibold hover:underline">Apply suggestion →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreativesStep() {
  const [aiGen, setAiGen] = useState<{ title: string; desc: string } | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const generateCreative = () => {
    setGenLoading(true);
    setTimeout(() => {
      setAiGen({
        title: "Transform Your Home This Summer — Shop Now",
        desc: "Discover our curated collection of summer home decor essentials. From coastal living to minimalist chic — find your perfect style. Free shipping on orders over $50. Shop the edit →",
      });
      setGenLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-gray-900">Ad Creatives</h3>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">AI Creative Generator</span>
          <button onClick={generateCreative} disabled={genLoading} className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity">
            <Sparkles className="w-3.5 h-3.5" />
            {genLoading ? "Generating..." : "Generate"}
          </button>
        </div>

        {aiGen ? (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Generated Title</label>
              <div className="bg-gray-50 rounded-xl p-3 text-sm font-medium text-gray-800">{aiGen.title}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Generated Description</label>
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">{aiGen.desc}</div>
            </div>
            <button onClick={generateCreative} className="text-xs text-purple-600 hover:underline font-medium">↻ Regenerate</button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Click Generate to create AI-powered titles and descriptions for your ads.</p>
        )}
      </div>

      {/* Image Upload */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#e60023]/40 transition-colors cursor-pointer">
        <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">Upload pin image or video</p>
        <p className="text-xs text-gray-400">Recommended: 2:3 ratio (1000×1500px) for best performance</p>
        <p className="text-xs text-gray-400 mt-1">Supports: JPG, PNG, MP4 · Max 32MB</p>
      </div>
    </div>
  );
}

function ReviewStep({ objective, data }: { objective: string; data: Record<string, string> }) {
  const obj = OBJECTIVES.find((o) => o.id === objective);
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Review & Launch</h3>
      <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
        {[
          { label: "Objective", value: obj?.label || "—" },
          { label: "Campaign Name", value: data.name || "—" },
          { label: "Daily Budget", value: data.budget ? `$${data.budget}/day` : "—" },
          { label: "Bid Strategy", value: data.bidStrategy || "—" },
          { label: "Start Date", value: data.startDate || "—" },
          { label: "Landing Page", value: data.url || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-semibold text-gray-800 truncate max-w-[240px]">{value}</span>
          </div>
        ))}
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-700">
          Your campaign is ready to launch. Pinterest will review your ad within <strong>24 hours</strong> before it goes live.
        </div>
      </div>
    </div>
  );
}

export default function LaunchTab() {
  const [step, setStep] = useState(0);
  const [objective, setObjective] = useState("");
  const [setupData, setSetupData] = useState<Record<string, string>>({});
  const [launched, setLaunched] = useState(false);

  const updateSetup = (k: string, v: string) => setSetupData((d) => ({ ...d, [k]: v }));

  if (launched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">🎉</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Campaign Submitted!</h3>
        <p className="text-sm text-gray-500 max-w-sm">Your campaign is under review. Pinterest will approve it within 24 hours and it'll go live automatically.</p>
        <button onClick={() => { setLaunched(false); setStep(0); setObjective(""); setSetupData({}); }} className="mt-6 bg-[#e60023] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors">
          Create Another Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ProgressBar step={step} />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[400px]">
        {step === 0 && <ObjectiveStep value={objective} onChange={setObjective} />}
        {step === 1 && <SetupStep data={setupData} onChange={updateSetup} />}
        {step === 2 && <AudienceStep />}
        {step === 3 && <CreativesStep />}
        {step === 4 && <ReviewStep objective={objective} data={setupData} />}

        <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 text-sm text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !objective}
              className="flex items-center gap-2 bg-[#e60023] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#ad081b] transition-colors disabled:opacity-40"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setLaunched(true)}
              className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors"
            >
              <Zap className="w-4 h-4" /> Launch Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
