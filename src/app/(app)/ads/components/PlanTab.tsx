"use client";
import { useState } from "react";
import { formatNumber, cn } from "@/lib/utils";
import { KEYWORD_PLAN, MOCK_AUDIENCES, TREND_DATA, SEASONAL_CALENDAR } from "@/lib/ads-data";
import {
  Users, Search, DollarSign, TrendingUp, Target, Calendar,
  ChevronRight, Info, Lightbulb, BarChart2, Globe, Sparkles,
} from "lucide-react";

type PlanSection = "audience" | "keywords" | "budget" | "creative" | "market";

const SECTIONS = [
  { key: "audience", label: "Audience Planning", icon: Users },
  { key: "keywords", label: "Keyword Planning", icon: Search },
  { key: "budget", label: "Budget Planning", icon: DollarSign },
  { key: "creative", label: "Creative Planning", icon: Sparkles },
  { key: "market", label: "Market Research", icon: Globe },
] as const;

const COMP_COLOR: Record<string, string> = {
  low: "text-green-600 bg-green-50",
  medium: "text-yellow-600 bg-yellow-50",
  high: "text-red-500 bg-red-50",
};

function DifficultyBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", score < 40 ? "bg-green-500" : score < 65 ? "bg-yellow-500" : "bg-red-500")}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{score}</span>
    </div>
  );
}

const NICHE_DATA: Record<string, { broad: string; targeted: string; highIntent: string }> = {
  "home decor":      { broad: "22.1M", targeted: "5.4M",  highIntent: "1.1M"  },
  "fitness":         { broad: "18.7M", targeted: "4.8M",  highIntent: "960K"  },
  "wedding":         { broad: "14.2M", targeted: "3.6M",  highIntent: "720K"  },
  "fashion":         { broad: "31.4M", targeted: "7.9M",  highIntent: "1.6M"  },
  "food":            { broad: "27.8M", targeted: "6.9M",  highIntent: "1.4M"  },
  "recipes":         { broad: "25.3M", targeted: "6.3M",  highIntent: "1.2M"  },
  "travel":          { broad: "19.5M", targeted: "4.9M",  highIntent: "980K"  },
  "beauty":          { broad: "24.6M", targeted: "6.1M",  highIntent: "1.2M"  },
  "skincare":        { broad: "16.3M", targeted: "4.1M",  highIntent: "820K"  },
  "diy":             { broad: "13.8M", targeted: "3.4M",  highIntent: "680K"  },
  "gardening":       { broad: "11.2M", targeted: "2.8M",  highIntent: "560K"  },
  "baby":            { broad: "12.4M", targeted: "3.1M",  highIntent: "620K"  },
  "parenting":       { broad: "10.9M", targeted: "2.7M",  highIntent: "540K"  },
  "health":          { broad: "20.1M", targeted: "5.0M",  highIntent: "1.0M"  },
  "education":       { broad: "9.6M",  targeted: "2.4M",  highIntent: "480K"  },
  "business":        { broad: "8.3M",  targeted: "2.1M",  highIntent: "420K"  },
  "pets":            { broad: "15.7M", targeted: "3.9M",  highIntent: "780K"  },
  "kids":            { broad: "13.1M", targeted: "3.3M",  highIntent: "660K"  },
};

interface AudienceRow { id: string; name: string; type: "interest"|"demographic"|"keyword"|"lookalike"|"retargeting"; size: number; ctr: number; convRate: number; spend: number; }

const NICHE_AUDIENCES: Record<string, AudienceRow[]> = {
  "wedding": [
    { id:"w1", name:"Brides & Wedding Planners", type:"interest", size:3800000, ctr:3.4, convRate:2.8, spend:720 },
    { id:"w2", name:"Women 25–34 Engaged", type:"demographic", size:2100000, ctr:2.9, convRate:3.2, spend:580 },
    { id:"w3", name:"Wedding Keyword Searchers", type:"keyword", size:1400000, ctr:2.6, convRate:2.1, spend:340 },
    { id:"w4", name:"Lookalike — Past Buyers", type:"lookalike", size:1800000, ctr:3.1, convRate:2.6, spend:410 },
    { id:"w5", name:"Website Visitors (30d)", type:"retargeting", size:18000, ctr:5.2, convRate:6.1, spend:190 },
  ],
  "home decor": [
    { id:"h1", name:"Home Decor Enthusiasts", type:"interest", size:4200000, ctr:2.8, convRate:1.9, spend:890 },
    { id:"h2", name:"Women 25–34 USA", type:"demographic", size:8100000, ctr:2.1, convRate:2.4, spend:640 },
    { id:"h3", name:"Website Visitors (30d)", type:"retargeting", size:24000, ctr:4.2, convRate:5.8, spend:320 },
    { id:"h4", name:"Lookalike — Top Buyers", type:"lookalike", size:2100000, ctr:3.1, convRate:3.2, spend:480 },
    { id:"h5", name:"Interior Design Keywords", type:"keyword", size:1800000, ctr:2.4, convRate:1.7, spend:210 },
  ],
  "fitness": [
    { id:"f1", name:"Fitness & Workout Fans", type:"interest", size:5100000, ctr:2.6, convRate:2.0, spend:760 },
    { id:"f2", name:"Women 18–34 Health Focus", type:"demographic", size:6200000, ctr:2.3, convRate:2.6, spend:580 },
    { id:"f3", name:"Gym & Activewear Keywords", type:"keyword", size:2200000, ctr:2.1, convRate:1.8, spend:290 },
    { id:"f4", name:"Lookalike — Active Buyers", type:"lookalike", size:2800000, ctr:2.9, convRate:2.4, spend:440 },
    { id:"f5", name:"App Visitors Retargeting", type:"retargeting", size:31000, ctr:4.8, convRate:5.4, spend:270 },
  ],
  "fashion": [
    { id:"fa1", name:"Fashion & Style Lovers", type:"interest", size:7400000, ctr:2.9, convRate:1.7, spend:920 },
    { id:"fa2", name:"Women 18–29 Trend Seekers", type:"demographic", size:9100000, ctr:2.4, convRate:2.0, spend:710 },
    { id:"fa3", name:"Clothing & Apparel Keywords", type:"keyword", size:3100000, ctr:2.2, convRate:1.5, spend:380 },
    { id:"fa4", name:"Lookalike — Fashion Buyers", type:"lookalike", size:3600000, ctr:2.7, convRate:2.2, spend:530 },
    { id:"fa5", name:"Cart Abandoners (14d)", type:"retargeting", size:42000, ctr:5.6, convRate:7.2, spend:310 },
  ],
  "beauty": [
    { id:"b1", name:"Beauty & Skincare Fans", type:"interest", size:5800000, ctr:3.0, convRate:2.1, spend:840 },
    { id:"b2", name:"Women 20–39 Beauty Buyers", type:"demographic", size:7200000, ctr:2.5, convRate:2.7, spend:660 },
    { id:"b3", name:"Makeup & Skincare Keywords", type:"keyword", size:2600000, ctr:2.3, convRate:1.9, spend:320 },
    { id:"b4", name:"Lookalike — Repeat Buyers", type:"lookalike", size:2400000, ctr:3.2, convRate:3.4, spend:490 },
    { id:"b5", name:"Product Page Visitors (7d)", type:"retargeting", size:28000, ctr:5.8, convRate:6.8, spend:240 },
  ],
  "food": [
    { id:"fo1", name:"Food & Recipe Enthusiasts", type:"interest", size:6300000, ctr:2.2, convRate:1.4, spend:590 },
    { id:"fo2", name:"Home Cooks 25–44", type:"demographic", size:8400000, ctr:1.9, convRate:1.6, spend:470 },
    { id:"fo3", name:"Recipe & Cooking Keywords", type:"keyword", size:3800000, ctr:1.8, convRate:1.2, spend:280 },
    { id:"fo4", name:"Lookalike — Engaged Savers", type:"lookalike", size:3100000, ctr:2.4, convRate:1.8, spend:360 },
    { id:"fo5", name:"Blog Visitors (30d)", type:"retargeting", size:52000, ctr:3.9, convRate:4.2, spend:180 },
  ],
  "travel": [
    { id:"t1", name:"Travel Planners & Dreamers", type:"interest", size:4600000, ctr:2.5, convRate:1.6, spend:680 },
    { id:"t2", name:"Adults 25–44 Frequent Travelers", type:"demographic", size:5900000, ctr:2.0, convRate:1.9, spend:520 },
    { id:"t3", name:"Destination & Travel Keywords", type:"keyword", size:2100000, ctr:1.9, convRate:1.4, spend:310 },
    { id:"t4", name:"Lookalike — Bookers", type:"lookalike", size:2600000, ctr:2.7, convRate:2.2, spend:420 },
    { id:"t5", name:"Landing Page Visitors (14d)", type:"retargeting", size:19000, ctr:4.6, convRate:5.0, spend:220 },
  ],
};

function getNicheAudiences(input: string): AudienceRow[] {
  const lower = input.toLowerCase();
  for (const [key, rows] of Object.entries(NICHE_AUDIENCES)) {
    if (lower.includes(key)) return rows;
  }
  // generic fallback
  return MOCK_AUDIENCES as unknown as AudienceRow[];
}

function getNicheEstimate(input: string) {
  const lower = input.toLowerCase();
  for (const [key, val] of Object.entries(NICHE_DATA)) {
    if (lower.includes(key)) return val;
  }
  // generic fallback based on string length for variety
  const seed = input.length % 5;
  const broadNums  = ["8.2M",  "11.4M", "14.7M", "17.9M", "21.3M"];
  const targetNums = ["2.0M",  "2.8M",  "3.7M",  "4.5M",  "5.3M" ];
  const highNums   = ["400K",  "560K",  "740K",  "900K",  "1.1M" ];
  return { broad: broadNums[seed], targeted: targetNums[seed], highIntent: highNums[seed] };
}

function AudiencePlanning() {
  const [niche, setNiche] = useState("");
  const [estimatedNiche, setEstimatedNiche] = useState<string | null>(null);

  const estimate = estimatedNiche ? getNicheEstimate(estimatedNiche) : null;

  return (
    <div className="space-y-5">
      {/* Audience Estimator */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Audience Size Estimator</h3>
        <p className="text-sm text-gray-500 mb-4">Enter your niche or interest to estimate reachable audience size on Pinterest.</p>
        <div className="flex gap-3">
          <input
            value={niche}
            onChange={(e) => { setNiche(e.target.value); setEstimatedNiche(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && niche.trim()) setEstimatedNiche(niche.trim()); }}
            placeholder="e.g. home decor, fitness, wedding planning..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
          />
          <button
            onClick={() => { if (niche.trim()) setEstimatedNiche(niche.trim()); }}
            disabled={!niche.trim()}
            className="bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Estimate
          </button>
        </div>
        {estimate && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-3">Estimated Pinterest audience for <strong className="text-gray-600">&quot;{estimatedNiche}&quot;</strong></p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Broad Audience", size: estimate.broad, desc: "Interest-based reach", color: "bg-blue-50 border-blue-100" },
                { label: "Targeted Audience", size: estimate.targeted, desc: "Keyword + interest match", color: "bg-purple-50 border-purple-100" },
                { label: "High-Intent Audience", size: estimate.highIntent, desc: "Retargeting + lookalike", color: "bg-green-50 border-green-100" },
              ].map(({ label, size, desc, color }) => (
                <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                  <div className="text-2xl font-bold text-gray-900">{size}</div>
                  <div className="text-sm font-semibold text-gray-700 mt-1">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Demographic Insights */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Demographic Insights</h3>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Age Distribution</div>
            {[
              { label: "18–24", pct: 28 }, { label: "25–34", pct: 38 }, { label: "35–44", pct: 19 },
              { label: "45–54", pct: 10 }, { label: "55+", pct: 5 },
            ].map(({ label, pct }) => (
              <div key={label} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-600 w-10">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-[#e60023] h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8">{pct}%</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Gender Split</div>
            <div className="space-y-3">
              {[
                { label: "Women", pct: 71, color: "bg-pink-400" },
                { label: "Men", pct: 22, color: "bg-blue-400" },
                { label: "Unspecified", pct: 7, color: "bg-gray-300" },
              ].map(({ label, pct, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8">{pct}%</span>
                </div>
              ))}
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-5">Top Locations</div>
            {["United States", "United Kingdom", "Canada", "Australia", "Germany"].map((loc, i) => (
              <div key={loc} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700">{loc}</span>
                </div>
                <span className="text-xs font-semibold text-gray-600">{[38, 14, 11, 8, 6][i]}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best Performing Audiences */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">
            Audience Segments
            {estimatedNiche && <span className="ml-2 text-xs font-normal text-gray-400">for &quot;{estimatedNiche}&quot;</span>}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Audience", "Type", "Size", "CTR", "Conv. Rate", "Spend"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(estimatedNiche ? getNicheAudiences(estimatedNiche) : MOCK_AUDIENCES as unknown as AudienceRow[]).map((aud) => (
                <tr key={aud.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-800">{aud.name}</td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                      aud.type === "retargeting" ? "bg-orange-100 text-orange-700" :
                      aud.type === "lookalike" ? "bg-purple-100 text-purple-700" :
                      aud.type === "demographic" ? "bg-blue-100 text-blue-700" :
                      aud.type === "interest" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    )}>{aud.type}</span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(aud.size)}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">{aud.ctr}%</td>
                  <td className="px-3 py-3 text-sm font-semibold text-green-600">{aud.convRate}%</td>
                  <td className="px-3 py-3 text-sm text-gray-700">${aud.spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KeywordPlanning() {
  const positive = KEYWORD_PLAN.filter((k) => !k.negative);
  const negative = KEYWORD_PLAN.filter((k) => k.negative);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Keyword Recommendations</h3>
            <p className="text-sm text-gray-500 mt-0.5">Sorted by search volume. Click to add to your campaign.</p>
          </div>
          <button className="text-sm text-[#e60023] font-medium border border-[#e60023]/30 px-3 py-1.5 rounded-lg hover:bg-[#e60023]/5 transition-colors">
            + Add All to Campaign
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Keyword", "Match", "Volume", "Difficulty", "Competition", "Suggested Bid", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {positive.map((kw) => (
                <tr key={kw.keyword} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-800">{kw.keyword}</td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold border",
                      kw.type === "exact" ? "bg-orange-100 text-orange-700 border-orange-200" :
                      kw.type === "phrase" ? "bg-purple-100 text-purple-700 border-purple-200" :
                      "bg-blue-100 text-blue-700 border-blue-200"
                    )}>{kw.type}</span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(kw.volume)}</td>
                  <td className="px-3 py-3"><DifficultyBar score={kw.difficulty} /></td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", COMP_COLOR[kw.competition])}>{kw.competition}</span>
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">${kw.suggestedBid.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button className="text-xs text-[#e60023] font-medium hover:underline">Add</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Negative Keywords */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Negative Keyword Recommendations</h3>
        <p className="text-sm text-gray-500 mb-4">Exclude these to avoid wasted spend on irrelevant searches.</p>
        <div className="flex flex-wrap gap-2">
          {negative.map((kw) => (
            <div key={kw.keyword} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs px-3 py-1.5 rounded-full font-medium">
              <span>− {kw.keyword}</span>
              <button className="text-red-400 hover:text-red-700">+</button>
            </div>
          ))}
          {["low quality", "how to make free", "tutorial only", "no budget", "renter"].map((kw) => (
            <div key={kw} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs px-3 py-1.5 rounded-full font-medium">
              <span>− {kw}</span>
              <button className="text-red-400 hover:text-red-700">+</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetPlanning() {
  const [daily, setDaily] = useState(50);

  const est = {
    impressions: Math.round(daily * 2400),
    clicks: Math.round(daily * 58),
    conversions: Math.round(daily * 3.2),
    cpc: (daily / (daily * 58)).toFixed(2),
    cpm: (daily / (daily * 2.4)).toFixed(2),
    roas: (Math.random() * 3 + 3.5).toFixed(1),
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Budget Forecaster</h3>
        <p className="text-sm text-gray-500 mb-5">Adjust your daily budget to see estimated performance outcomes.</p>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Daily Budget</label>
            <span className="text-2xl font-bold text-[#e60023]">${daily}</span>
          </div>
          <input
            type="range" min={5} max={500} step={5} value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
            className="w-full accent-[#e60023]"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>$5/day</span><span>$500/day</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Est. Impressions", value: formatNumber(est.impressions), sub: "per day", icon: "👁️" },
            { label: "Est. Clicks", value: formatNumber(est.clicks), sub: "per day", icon: "🖱️" },
            { label: "Est. Conversions", value: est.conversions.toString(), sub: "per day", icon: "🎯" },
          ].map(({ label, value, sub, icon }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              <div className="text-xs text-gray-400">{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Est. CPC", value: `$${est.cpc}` },
            { label: "Est. CPM", value: `$${est.cpm}` },
            { label: "Est. ROAS", value: `${est.roas}×` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3">
              <span className="text-sm text-gray-600">{label}</span>
              <span className="text-sm font-bold text-gray-900">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">For your niche (home decor), we recommend starting at <strong>$30–$75/day</strong> to gather statistically significant data within 7–14 days before optimising.</p>
        </div>
      </div>
    </div>
  );
}

function CreativePlanning() {
  const formats = [
    { type: "Standard Pin", icon: "🖼️", ctr: "1.8–2.6%", saves: "High", best: "Product showcasing, before/after, lifestyle" },
    { type: "Video Pin", icon: "🎬", ctr: "2.4–4.2%", saves: "Very High", best: "Tutorials, stories, product demos" },
    { type: "Carousel Pin", icon: "🎠", ctr: "2.1–3.8%", saves: "High", best: "Step-by-step guides, multiple products, collections" },
    { type: "Idea Pin", icon: "💡", ctr: "3.0–5.1%", saves: "Highest", best: "How-to content, recipes, educational series" },
  ];

  const ctas = ["Shop Now", "Learn More", "Get the Look", "Save This", "Try This", "See More", "Download Now", "Book Now"];
  const headlines = [
    "You Won't Believe This Transformation →",
    "The Only [Topic] Guide You'll Ever Need",
    "Stop Scrolling — This Is What You've Been Looking For",
    "How I [Result] in Just [Timeframe]",
    "[Number] [Topic] Ideas That Actually Work",
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Top-Performing Pin Formats</h3>
        <div className="grid grid-cols-2 gap-3">
          {formats.map((f) => (
            <div key={f.type} className="border border-gray-100 rounded-xl p-4 hover:border-[#e60023]/30 transition-colors">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-sm font-semibold text-gray-800">{f.type}</div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>CTR: <strong className="text-gray-800">{f.ctr}</strong></span>
                <span>Saves: <strong className="text-gray-800">{f.saves}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-2">{f.best}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3">AI Headline Templates</h3>
          <div className="space-y-2">
            {headlines.map((h) => (
              <div key={h} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-700">{h}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-3">CTA Recommendations</h3>
          <div className="flex flex-wrap gap-2">
            {ctas.map((cta) => (
              <span key={cta} className="bg-[#e60023]/10 text-[#e60023] text-xs px-3 py-1.5 rounded-full font-medium border border-[#e60023]/20">
                {cta}
              </span>
            ))}
          </div>
          <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
            <p className="text-xs text-yellow-800"><strong>Top tip:</strong> "Shop Now" drives 34% more clicks than "Learn More" for product-focused campaigns. Use "Save This" for content/inspiration pins to maximise saves.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketResearch() {
  const today = new Date();

  return (
    <div className="space-y-5">
      {/* Trending Searches */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Trending Pinterest Searches</h3>
        <div className="space-y-2">
          {TREND_DATA.map((t) => (
            <div key={t.keyword} className="flex items-center gap-3 py-2 border-b border-gray-50">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">{t.keyword}</div>
                <div className="text-xs text-gray-400">{t.category} · Peak: {t.peak}</div>
              </div>
              <div className="flex items-center gap-1 text-green-600 bg-green-50 text-xs font-bold px-2.5 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                +{t.change}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seasonal Calendar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Seasonal Opportunity Calendar</h3>
        <div className="grid grid-cols-3 gap-2">
          {SEASONAL_CALENDAR.map((m) => (
            <div
              key={m.month}
              className={cn(
                "rounded-xl p-3 border transition-all",
                m.score >= 90 ? "bg-red-50 border-red-200" :
                m.score >= 80 ? "bg-orange-50 border-orange-200" :
                m.score >= 70 ? "bg-yellow-50 border-yellow-100" :
                "bg-gray-50 border-gray-100"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-gray-800">{m.month}</span>
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded",
                  m.score >= 90 ? "text-red-700 bg-red-100" :
                  m.score >= 80 ? "text-orange-700 bg-orange-100" :
                  "text-gray-600 bg-gray-100"
                )}>{m.score}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{m.opportunity}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block" /> 90+ = Peak</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-200 inline-block" /> 80–89 = High</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-100 inline-block" /> 70–79 = Good</span>
        </div>
      </div>
    </div>
  );
}

export default function PlanTab() {
  const [section, setSection] = useState<PlanSection>("audience");

  return (
    <div className="flex gap-6">
      {/* Left nav */}
      <div className="w-52 flex-shrink-0 space-y-1">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
              section === key ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {section === "audience" && <AudiencePlanning />}
        {section === "keywords" && <KeywordPlanning />}
        {section === "budget" && <BudgetPlanning />}
        {section === "creative" && <CreativePlanning />}
        {section === "market" && <MarketResearch />}
      </div>
    </div>
  );
}
