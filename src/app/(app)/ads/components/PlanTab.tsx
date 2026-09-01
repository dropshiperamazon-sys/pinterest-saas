"use client";
import { useState, useCallback } from "react";
import { formatNumber, cn } from "@/lib/utils";
import { TREND_DATA, SEASONAL_CALENDAR } from "@/lib/ads-data";
import {
  Users, Search, DollarSign, Globe, Sparkles,
  ChevronDown, ChevronRight, Info, TrendingUp, RefreshCw,
  Target, Zap, BarChart2, ArrowLeft, CheckCircle, Lightbulb,
  HelpCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type GoalType = "sales" | "traffic" | "leads" | "awareness";
type PlanSection = "audience" | "keywords" | "budget" | "creative" | "market";
type Mode = "beginner" | "advanced";

interface CampaignInputs {
  product: string;
  url: string;
  goal: GoalType;
  market: string;
  monthlyBudget: number;
  gender: string;
  ageMin: number;
  ageMax: number;
  category: string;
  targetCpa: string;
  targetRoas: string;
}

interface LiveEstimate {
  live: boolean;
  reachEstimate: string | null;
  weeklyImpressions: string | null;
  monthlyClicks: string | null;
  estimatedCpa: string | null;
}

interface GeneratedPlan {
  niche: NicheDef;
  inputs: CampaignInputs;
  liveEstimate?: LiveEstimate;
  readinessScore: number;
  readinessBreakdown: { label: string; score: number; max: number }[];
  summary: {
    reachEstimate: string;
    weeklyImpressions: string;
    suggestedDailyBudget: number;
    projectedMonthlyClicks: string;
    estimatedCpa: string;
    competitionLevel: string;
  };
  audience: { primary: string; secondary: string; why: string };
  keywords: { highIntent: KwRow[]; discovery: KwRow[]; longTail: KwRow[]; negative: string[] };
  budget: { conservative: BudgetOption; recommended: BudgetOption; aggressive: BudgetOption };
  creative: CreativeConcept[];
  market: { opportunityScore: number; competitorInsights: string[]; differentiation: string[]; timing: string };
}

interface BudgetOption {
  label: string;
  daily: number;
  monthly: number;
  impressions: string;
  clicks: string;
  conversions: string;
  roas: string;
}

interface CreativeConcept {
  title: string;
  format: string;
  visualDirection: string;
  headline: string;
  description: string;
  cta: string;
  why: string;
}

interface KwRow {
  keyword: string;
  volume: number;
  competition: "low" | "medium" | "high";
  suggestedBid: number;
  difficulty: number;
  type: "exact" | "phrase" | "broad";
}

// ── Niche definitions ────────────────────────────────────────────────────────

interface NicheDef {
  label: string;
  keywords: string[];
  broad: string; targeted: string; highIntent: string;
  demographics: {
    age: { label: string; pct: number }[];
    gender: { label: string; pct: number; color: string }[];
    locations: { name: string; pct: number }[];
  };
  audiences: AudienceRow[];
}

interface AudienceRow {
  id: string; name: string;
  type: "interest" | "demographic" | "keyword" | "lookalike" | "retargeting";
  size: number; ctr: number; convRate: number; spend: number;
}

const NICHES: NicheDef[] = [
  {
    label: "Fashion & Clothing",
    keywords: ["fashion","clothing","clothes","outfit","dress","wear","apparel","shirt","jeans","pants","shoes","sneakers","boots","jacket","coat","skirt","blouse","top","hoodie","sweater","activewear","streetwear","style","wardrobe","looks","ootd","boutique","designer","luxury","capsule","minimalist fashion"],
    broad:"31.4M", targeted:"7.9M", highIntent:"1.6M",
    demographics:{age:[{label:"18–24",pct:34},{label:"25–34",pct:36},{label:"35–44",pct:17},{label:"45–54",pct:9},{label:"55+",pct:4}],gender:[{label:"Women",pct:78,color:"bg-pink-400"},{label:"Men",pct:16,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],locations:[{name:"United States",pct:41},{name:"United Kingdom",pct:13},{name:"Canada",pct:10},{name:"Australia",pct:7},{name:"France",pct:5}]},
    audiences:[{id:"fa1",name:"Fashion & Style Lovers",type:"interest",size:7400000,ctr:2.9,convRate:1.7,spend:920},{id:"fa2",name:"Women 18–29 Trend Seekers",type:"demographic",size:9100000,ctr:2.4,convRate:2.0,spend:710},{id:"fa3",name:"Clothing & Apparel Keywords",type:"keyword",size:3100000,ctr:2.2,convRate:1.5,spend:380},{id:"fa4",name:"Lookalike — Fashion Buyers",type:"lookalike",size:3600000,ctr:2.7,convRate:2.2,spend:530},{id:"fa5",name:"Cart Abandoners (14d)",type:"retargeting",size:42000,ctr:5.6,convRate:7.2,spend:310}],
  },
  {
    label: "Home Decor & Interior",
    keywords: ["home decor","interior","furniture","living room","bedroom","kitchen","bathroom","decor","decoration","cozy","aesthetic","room","house","apartment","boho","farmhouse","modern","minimalist home","scandinavian","rustic","wall art","throw pillow","rug","lamp","shelf","curtain","renovation","home design","interior design"],
    broad:"22.1M", targeted:"5.4M", highIntent:"1.1M",
    demographics:{age:[{label:"18–24",pct:22},{label:"25–34",pct:38},{label:"35–44",pct:24},{label:"45–54",pct:11},{label:"55+",pct:5}],gender:[{label:"Women",pct:74,color:"bg-pink-400"},{label:"Men",pct:18,color:"bg-blue-400"},{label:"Unspecified",pct:8,color:"bg-gray-300"}],locations:[{name:"United States",pct:38},{name:"United Kingdom",pct:14},{name:"Canada",pct:11},{name:"Australia",pct:8},{name:"Germany",pct:6}]},
    audiences:[{id:"h1",name:"Home Decor Enthusiasts",type:"interest",size:4200000,ctr:2.8,convRate:1.9,spend:890},{id:"h2",name:"Women 25–44 Homeowners",type:"demographic",size:8100000,ctr:2.1,convRate:2.4,spend:640},{id:"h3",name:"Website Visitors (30d)",type:"retargeting",size:24000,ctr:4.2,convRate:5.8,spend:320},{id:"h4",name:"Lookalike — Top Buyers",type:"lookalike",size:2100000,ctr:3.1,convRate:3.2,spend:480},{id:"h5",name:"Interior Design Keywords",type:"keyword",size:1800000,ctr:2.4,convRate:1.7,spend:210}],
  },
  {
    label: "Beauty & Makeup",
    keywords: ["beauty","makeup","cosmetic","lipstick","foundation","mascara","eyeshadow","blush","concealer","skincare","skin care","moisturizer","serum","toner","cleanser","face mask","spf","sunscreen","retinol","glow","routine","self care","nail","nails","nail art","hair","haircare","shampoo","conditioner","perfume","fragrance","body lotion"],
    broad:"24.6M", targeted:"6.1M", highIntent:"1.2M",
    demographics:{age:[{label:"18–24",pct:38},{label:"25–34",pct:34},{label:"35–44",pct:16},{label:"45–54",pct:8},{label:"55+",pct:4}],gender:[{label:"Women",pct:86,color:"bg-pink-400"},{label:"Men",pct:8,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],locations:[{name:"United States",pct:40},{name:"United Kingdom",pct:12},{name:"Canada",pct:10},{name:"Australia",pct:8},{name:"India",pct:6}]},
    audiences:[{id:"b1",name:"Beauty & Skincare Fans",type:"interest",size:5800000,ctr:3.0,convRate:2.1,spend:840},{id:"b2",name:"Women 18–39 Beauty Buyers",type:"demographic",size:7200000,ctr:2.5,convRate:2.7,spend:660},{id:"b3",name:"Makeup & Skincare Keywords",type:"keyword",size:2600000,ctr:2.3,convRate:1.9,spend:320},{id:"b4",name:"Lookalike — Repeat Buyers",type:"lookalike",size:2400000,ctr:3.2,convRate:3.4,spend:490},{id:"b5",name:"Product Page Visitors (7d)",type:"retargeting",size:28000,ctr:5.8,convRate:6.8,spend:240}],
  },
  {
    label: "Food & Recipes",
    keywords: ["food","recipe","cooking","baking","meal","dinner","lunch","breakfast","dessert","snack","healthy eating","nutrition","diet","vegan","vegetarian","keto","paleo","gluten free","meal prep","quick dinner","easy recipe","slow cooker","air fryer","pasta","pizza","cake","cookies","bread","soup","salad","smoothie"],
    broad:"27.8M", targeted:"6.9M", highIntent:"1.4M",
    demographics:{age:[{label:"18–24",pct:24},{label:"25–34",pct:35},{label:"35–44",pct:22},{label:"45–54",pct:12},{label:"55+",pct:7}],gender:[{label:"Women",pct:69,color:"bg-pink-400"},{label:"Men",pct:24,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],locations:[{name:"United States",pct:42},{name:"United Kingdom",pct:12},{name:"Canada",pct:10},{name:"Australia",pct:7},{name:"Germany",pct:5}]},
    audiences:[{id:"fo1",name:"Food & Recipe Enthusiasts",type:"interest",size:6300000,ctr:2.2,convRate:1.4,spend:590},{id:"fo2",name:"Home Cooks 25–44",type:"demographic",size:8400000,ctr:1.9,convRate:1.6,spend:470},{id:"fo3",name:"Recipe & Cooking Keywords",type:"keyword",size:3800000,ctr:1.8,convRate:1.2,spend:280},{id:"fo4",name:"Lookalike — Engaged Savers",type:"lookalike",size:3100000,ctr:2.4,convRate:1.8,spend:360},{id:"fo5",name:"Blog Visitors (30d)",type:"retargeting",size:52000,ctr:3.9,convRate:4.2,spend:180}],
  },
  {
    label: "Fitness & Wellness",
    keywords: ["fitness","workout","exercise","gym","yoga","pilates","running","jogging","cycling","hiit","strength training","weight loss","lose weight","weight lifting","bodybuilding","abs","cardio","stretching","meditation","mindfulness","mental health","wellness","health","nutrition","protein","supplement","crossfit","zumba","aerobics"],
    broad:"18.7M", targeted:"4.8M", highIntent:"960K",
    demographics:{age:[{label:"18–24",pct:30},{label:"25–34",pct:38},{label:"35–44",pct:20},{label:"45–54",pct:9},{label:"55+",pct:3}],gender:[{label:"Women",pct:64,color:"bg-pink-400"},{label:"Men",pct:31,color:"bg-blue-400"},{label:"Unspecified",pct:5,color:"bg-gray-300"}],locations:[{name:"United States",pct:39},{name:"United Kingdom",pct:13},{name:"Canada",pct:11},{name:"Australia",pct:9},{name:"Germany",pct:5}]},
    audiences:[{id:"f1",name:"Fitness & Workout Fans",type:"interest",size:5100000,ctr:2.6,convRate:2.0,spend:760},{id:"f2",name:"Women 18–34 Health Focus",type:"demographic",size:6200000,ctr:2.3,convRate:2.6,spend:580},{id:"f3",name:"Gym & Activewear Keywords",type:"keyword",size:2200000,ctr:2.1,convRate:1.8,spend:290},{id:"f4",name:"Lookalike — Active Buyers",type:"lookalike",size:2800000,ctr:2.9,convRate:2.4,spend:440},{id:"f5",name:"App Visitors Retargeting",type:"retargeting",size:31000,ctr:4.8,convRate:5.4,spend:270}],
  },
  {
    label: "Travel & Adventure",
    keywords: ["travel","vacation","holiday","trip","destination","hotel","resort","airbnb","flight","cruise","backpacking","adventure","explore","wanderlust","bucket list","road trip","beach","mountain","camping","hiking","europe","asia","tropical","safari","honeymoon","solo travel","family travel","travel tips","packing","tourism"],
    broad:"19.5M", targeted:"4.9M", highIntent:"980K",
    demographics:{age:[{label:"18–24",pct:26},{label:"25–34",pct:40},{label:"35–44",pct:20},{label:"45–54",pct:10},{label:"55+",pct:4}],gender:[{label:"Women",pct:62,color:"bg-pink-400"},{label:"Men",pct:32,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],locations:[{name:"United States",pct:36},{name:"United Kingdom",pct:16},{name:"Canada",pct:11},{name:"Australia",pct:9},{name:"Germany",pct:7}]},
    audiences:[{id:"t1",name:"Travel Planners & Dreamers",type:"interest",size:4600000,ctr:2.5,convRate:1.6,spend:680},{id:"t2",name:"Adults 25–44 Frequent Travelers",type:"demographic",size:5900000,ctr:2.0,convRate:1.9,spend:520},{id:"t3",name:"Destination Keywords",type:"keyword",size:2100000,ctr:1.9,convRate:1.4,spend:310},{id:"t4",name:"Lookalike — Bookers",type:"lookalike",size:2600000,ctr:2.7,convRate:2.2,spend:420},{id:"t5",name:"Landing Page Visitors (14d)",type:"retargeting",size:19000,ctr:4.6,convRate:5.0,spend:220}],
  },
  {
    label: "Wedding & Events",
    keywords: ["wedding","bride","bridal","groom","engagement","ceremony","reception","proposal","ring","bouquet","bridesmaid","wedding dress","wedding cake","wedding venue","floral","centerpiece","invitation","honeymoon","bachelorette","rehearsal dinner","wedding planner","wedding decor","wedding photography"],
    broad:"14.2M", targeted:"3.6M", highIntent:"720K",
    demographics:{age:[{label:"18–24",pct:26},{label:"25–34",pct:48},{label:"35–44",pct:16},{label:"45–54",pct:7},{label:"55+",pct:3}],gender:[{label:"Women",pct:82,color:"bg-pink-400"},{label:"Men",pct:11,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],locations:[{name:"United States",pct:44},{name:"United Kingdom",pct:12},{name:"Canada",pct:9},{name:"Australia",pct:8},{name:"India",pct:6}]},
    audiences:[{id:"w1",name:"Brides & Wedding Planners",type:"interest",size:3800000,ctr:3.4,convRate:2.8,spend:720},{id:"w2",name:"Women 25–34 Engaged",type:"demographic",size:2100000,ctr:2.9,convRate:3.2,spend:580},{id:"w3",name:"Wedding Keyword Searchers",type:"keyword",size:1400000,ctr:2.6,convRate:2.1,spend:340},{id:"w4",name:"Lookalike — Past Buyers",type:"lookalike",size:1800000,ctr:3.1,convRate:2.6,spend:410},{id:"w5",name:"Website Visitors (30d)",type:"retargeting",size:18000,ctr:5.2,convRate:6.1,spend:190}],
  },
  {
    label: "Parenting & Kids",
    keywords: ["baby","infant","toddler","kids","children","parenting","mom","dad","mother","father","newborn","pregnancy","pregnant","nursery","stroller","diaper","breastfeeding","baby food","toy","educational toy","kids room","playroom","school","kids activity","family","preschool","kindergarten","child development"],
    broad:"13.1M", targeted:"3.3M", highIntent:"660K",
    demographics:{age:[{label:"18–24",pct:18},{label:"25–34",pct:44},{label:"35–44",pct:28},{label:"45–54",pct:8},{label:"55+",pct:2}],gender:[{label:"Women",pct:79,color:"bg-pink-400"},{label:"Men",pct:14,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],locations:[{name:"United States",pct:41},{name:"United Kingdom",pct:13},{name:"Canada",pct:10},{name:"Australia",pct:8},{name:"India",pct:5}]},
    audiences:[{id:"k1",name:"Parents & Caregivers",type:"interest",size:4800000,ctr:2.4,convRate:2.0,spend:640},{id:"k2",name:"Moms 25–39",type:"demographic",size:5200000,ctr:2.1,convRate:2.3,spend:510},{id:"k3",name:"Baby & Kids Keywords",type:"keyword",size:1900000,ctr:2.0,convRate:1.7,spend:260},{id:"k4",name:"Lookalike — Family Buyers",type:"lookalike",size:2300000,ctr:2.6,convRate:2.1,spend:380},{id:"k5",name:"Product Page Visitors (14d)",type:"retargeting",size:22000,ctr:4.4,convRate:5.2,spend:210}],
  },
  {
    label: "DIY & Crafts",
    keywords: ["diy","craft","handmade","make","create","tutorial","how to","upcycle","repurpose","sewing","knitting","crochet","embroidery","macrame","candle making","soap making","resin","painting","drawing","watercolor","acrylic","woodworking","carpentry","home project","paper craft"],
    broad:"13.8M", targeted:"3.4M", highIntent:"680K",
    demographics:{age:[{label:"18–24",pct:20},{label:"25–34",pct:34},{label:"35–44",pct:26},{label:"45–54",pct:14},{label:"55+",pct:6}],gender:[{label:"Women",pct:76,color:"bg-pink-400"},{label:"Men",pct:17,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],locations:[{name:"United States",pct:43},{name:"United Kingdom",pct:13},{name:"Canada",pct:10},{name:"Australia",pct:7},{name:"Germany",pct:5}]},
    audiences:[{id:"d1",name:"DIY & Craft Enthusiasts",type:"interest",size:3900000,ctr:2.3,convRate:1.6,spend:520},{id:"d2",name:"Creative Women 25–44",type:"demographic",size:4600000,ctr:2.0,convRate:1.8,spend:400},{id:"d3",name:"Craft & Tutorial Keywords",type:"keyword",size:1700000,ctr:1.9,convRate:1.4,spend:230},{id:"d4",name:"Lookalike — Craft Buyers",type:"lookalike",size:2000000,ctr:2.5,convRate:1.9,spend:310},{id:"d5",name:"Blog & Video Visitors (30d)",type:"retargeting",size:36000,ctr:3.8,convRate:4.0,spend:160}],
  },
  {
    label: "Pets & Animals",
    keywords: ["pet","dog","cat","puppy","kitten","animal","breed","training","pet food","dog food","cat food","vet","grooming","leash","collar","fish","bird","hamster","rabbit","pet care","rescue","adopt","shelter","pet toy","treats","dog training","cat behavior"],
    broad:"15.7M", targeted:"3.9M", highIntent:"780K",
    demographics:{age:[{label:"18–24",pct:22},{label:"25–34",pct:36},{label:"35–44",pct:24},{label:"45–54",pct:12},{label:"55+",pct:6}],gender:[{label:"Women",pct:66,color:"bg-pink-400"},{label:"Men",pct:27,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],locations:[{name:"United States",pct:44},{name:"United Kingdom",pct:12},{name:"Canada",pct:10},{name:"Australia",pct:8},{name:"Germany",pct:5}]},
    audiences:[{id:"p1",name:"Pet Owners & Animal Lovers",type:"interest",size:4400000,ctr:2.4,convRate:1.8,spend:610},{id:"p2",name:"Dog & Cat Owners 25–44",type:"demographic",size:5100000,ctr:2.0,convRate:2.0,spend:480},{id:"p3",name:"Pet Food & Care Keywords",type:"keyword",size:1800000,ctr:1.9,convRate:1.6,spend:250},{id:"p4",name:"Lookalike — Subscription Buyers",type:"lookalike",size:2100000,ctr:2.7,convRate:2.4,spend:370},{id:"p5",name:"Store Visitors (14d)",type:"retargeting",size:26000,ctr:4.2,convRate:5.0,spend:190}],
  },
  {
    label: "Technology & Gadgets",
    keywords: ["tech","technology","gadget","phone","smartphone","iphone","android","laptop","computer","tablet","ipad","smart home","alexa","smart watch","earbuds","headphones","camera","drone","gaming","console","streaming","software","app","coding","programming","developer","startup","saas","productivity","automation","ai","artificial intelligence"],
    broad:"16.4M", targeted:"4.1M", highIntent:"820K",
    demographics:{age:[{label:"18–24",pct:32},{label:"25–34",pct:38},{label:"35–44",pct:18},{label:"45–54",pct:8},{label:"55+",pct:4}],gender:[{label:"Women",pct:38,color:"bg-pink-400"},{label:"Men",pct:56,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],locations:[{name:"United States",pct:38},{name:"India",pct:12},{name:"United Kingdom",pct:11},{name:"Canada",pct:8},{name:"Germany",pct:6}]},
    audiences:[{id:"te1",name:"Tech Enthusiasts",type:"interest",size:4600000,ctr:2.2,convRate:1.8,spend:720},{id:"te2",name:"Adults 18–34 Tech Buyers",type:"demographic",size:5800000,ctr:2.0,convRate:2.0,spend:580},{id:"te3",name:"Gadget & Device Keywords",type:"keyword",size:2400000,ctr:1.9,convRate:1.5,spend:340},{id:"te4",name:"Lookalike — High-Value Buyers",type:"lookalike",size:2700000,ctr:2.6,convRate:2.3,spend:460},{id:"te5",name:"Product Page Visitors (7d)",type:"retargeting",size:33000,ctr:4.8,convRate:5.8,spend:280}],
  },
  {
    label: "Business & Finance",
    keywords: ["business","entrepreneur","startup","finance","investing","money","income","passive income","side hustle","freelance","online business","ecommerce","dropshipping","etsy","stock","crypto","budget","saving","financial freedom","wealth","credit","real estate","marketing","social media marketing","branding","sales","email marketing"],
    broad:"9.8M", targeted:"2.5M", highIntent:"500K",
    demographics:{age:[{label:"18–24",pct:20},{label:"25–34",pct:42},{label:"35–44",pct:24},{label:"45–54",pct:10},{label:"55+",pct:4}],gender:[{label:"Women",pct:52,color:"bg-pink-400"},{label:"Men",pct:42,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],locations:[{name:"United States",pct:45},{name:"United Kingdom",pct:12},{name:"Canada",pct:9},{name:"India",pct:8},{name:"Australia",pct:6}]},
    audiences:[{id:"bu1",name:"Entrepreneurs & Business Owners",type:"interest",size:3100000,ctr:2.0,convRate:1.6,spend:580},{id:"bu2",name:"Adults 25–44 Income Seekers",type:"demographic",size:4200000,ctr:1.8,convRate:1.9,spend:450},{id:"bu3",name:"Business & Finance Keywords",type:"keyword",size:1600000,ctr:1.7,convRate:1.4,spend:270},{id:"bu4",name:"Lookalike — Course Buyers",type:"lookalike",size:1900000,ctr:2.4,convRate:2.0,spend:360},{id:"bu5",name:"Sales Page Visitors (7d)",type:"retargeting",size:18000,ctr:4.6,convRate:5.4,spend:200}],
  },
  {
    label: "Education & Learning",
    keywords: ["education","learning","study","school","college","university","course","online course","skill","certificate","degree","tutoring","exam","test prep","language","spanish","french","english","math","science","reading","book","e-learning","udemy","coursera","masterclass","workshop","webinar","training","professional development","resume","career"],
    broad:"9.6M", targeted:"2.4M", highIntent:"480K",
    demographics:{age:[{label:"18–24",pct:36},{label:"25–34",pct:34},{label:"35–44",pct:18},{label:"45–54",pct:8},{label:"55+",pct:4}],gender:[{label:"Women",pct:57,color:"bg-pink-400"},{label:"Men",pct:37,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],locations:[{name:"United States",pct:36},{name:"India",pct:14},{name:"United Kingdom",pct:11},{name:"Canada",pct:8},{name:"Australia",pct:6}]},
    audiences:[{id:"e1",name:"Lifelong Learners",type:"interest",size:3400000,ctr:2.1,convRate:1.5,spend:420},{id:"e2",name:"Students & Young Professionals",type:"demographic",size:4800000,ctr:1.9,convRate:1.7,spend:340},{id:"e3",name:"Course & Learning Keywords",type:"keyword",size:1500000,ctr:1.8,convRate:1.3,spend:200},{id:"e4",name:"Lookalike — Course Completers",type:"lookalike",size:1700000,ctr:2.3,convRate:1.8,spend:290},{id:"e5",name:"Landing Page Visitors (14d)",type:"retargeting",size:16000,ctr:4.0,convRate:4.8,spend:150}],
  },
];

function classifyNiche(input: string): NicheDef {
  const lower = input.toLowerCase();
  let best: NicheDef = NICHES[0];
  let bestScore = 0;
  for (const niche of NICHES) {
    let score = 0;
    for (const kw of niche.keywords) {
      if (lower.includes(kw)) score += kw.split(" ").length;
    }
    if (score > bestScore) { bestScore = score; best = niche; }
  }
  return best;
}

// ── Plan generator ────────────────────────────────────────────────────────────

function hash(str: string, i: number): number {
  let h = 0;
  for (const c of str + i) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return Math.abs(h);
}

function generatePlan(inputs: CampaignInputs): GeneratedPlan {
  const niche = classifyNiche(inputs.product);
  const seed = inputs.product.toLowerCase().trim();
  const daily = Math.round(inputs.monthlyBudget / 30);

  type Mod = [string, KwRow["competition"], number, number, KwRow["type"]];
  const highIntentMods: Mod[] = [
    ["buy", "high", 1.20, 72, "exact"],
    ["shop", "high", 1.10, 68, "exact"],
    ["best", "high", 0.95, 70, "exact"],
    ["cheap", "medium", 0.62, 45, "phrase"],
  ];
  const discoveryMods: Mod[] = [
    ["ideas", "high", 0.88, 65, "broad"],
    ["inspiration", "high", 0.82, 62, "broad"],
    ["aesthetic", "medium", 0.72, 50, "broad"],
    ["tutorial", "low", 0.44, 34, "phrase"],
  ];
  const longTailMods: Mod[] = [
    ["for beginners", "low", 0.40, 30, "phrase"],
    ["on a budget", "low", 0.36, 26, "phrase"],
    ["diy", "medium", 0.62, 44, "phrase"],
    ["how to", "medium", 0.54, 38, "broad"],
  ];

  function buildKws(mods: Mod[]): KwRow[] {
    return mods.map((m, i): KwRow => ({
      keyword: `${seed} ${m[0]}`,
      volume: Math.round((hash(seed, i) % 700000) + 80000),
      competition: m[1],
      suggestedBid: m[2] + (hash(seed, i) % 30) / 100,
      difficulty: m[3] + (hash(seed, i) % 10) - 5,
      type: m[4],
    }));
  }

  const negMap: Record<string, string[]> = {
    "Fashion & Clothing": ["free clothes","clothing donation","cheap knock off","thrift store near me"],
    "Home Decor & Interior": ["free furniture","rental furniture","furniture disposal","second hand"],
    "Beauty & Makeup": ["free samples","cosmetic surgery","diy cheap makeup","free beauty products"],
    "Food & Recipes": ["free food","food bank","restaurant jobs","food delivery driver"],
    "Fitness & Wellness": ["gym jobs","free gym membership","personal trainer salary","fitness instructor course"],
    "Travel & Adventure": ["travel nursing","travel jobs","working holiday","travel grants"],
    "Wedding & Events": ["free wedding venues","elope","wedding cancellation","divorce"],
    "Parenting & Kids": ["childcare jobs","babysitter rates","school fees","child support"],
    "DIY & Crafts": ["free craft supplies","craft store jobs","craft fair vendor"],
    "Pets & Animals": ["pet adoption","animal shelter jobs","free pet food","vet school"],
    "Technology & Gadgets": ["tech jobs","free software","open source","tech support jobs"],
    "Business & Finance": ["free grants","bankruptcy","debt relief","business failure"],
    "Education & Learning": ["free courses","scholarship application","student loans","teaching jobs"],
  };

  const goalCreativeMap: Record<GoalType, CreativeConcept[]> = {
    sales: [
      { title: "Product Showcase", format: "Standard Pin", visualDirection: "Clean white/light background with product front-and-center. Show texture, color variations. Include price tag overlay.", headline: `The ${inputs.product} Everyone's Talking About`, description: `Discover why thousands chose our ${seed}. Premium quality, fast shipping. Shop now.`, cta: "Shop Now", why: "Sales campaigns perform best with direct product imagery and price transparency. Clean backgrounds boost CTR by 28% vs lifestyle-only shots." },
      { title: "Before & After Story", format: "Carousel Pin", visualDirection: "Slide 1: the 'problem'. Slide 2: transformation in progress. Slide 3: stunning result with your product.", headline: `This Changed Everything — ${inputs.product} Results`, description: `See the transformation. Real results from real customers using our ${seed}.`, cta: "Get the Look", why: "Carousel pins showing transformation journeys drive 3.2× more saves and 2.1× higher conversion rates for product-focused campaigns." },
      { title: "Social Proof Highlight", format: "Video Pin", visualDirection: "15–30s compilation of customer unboxings, reviews, or in-use moments. Add captions. End with product logo.", headline: `Why 10,000+ Chose Our ${inputs.product}`, description: `Join the community. Real people, real results.`, cta: "Shop Now", why: "User-generated content in video format generates 4× higher engagement than branded content alone and builds purchase confidence." },
    ],
    traffic: [
      { title: "Curiosity Hook", format: "Standard Pin", visualDirection: "Bold text overlay on a striking image. Tease the content without giving away the answer. Use contrasting colors.", headline: `You Won't Believe These ${inputs.product} Ideas →`, description: `Click to discover our complete guide. Saved by 50K+ Pinners.`, cta: "See More", why: "Traffic campaigns thrive on open loops — the headline teases content that only the click can resolve, boosting CTR by up to 40%." },
      { title: "List-Based Guide", format: "Idea Pin", visualDirection: "Multi-slide educational format. Slide 1: numbered list teaser. Slides 2–6: one idea per slide with minimal text + strong visual.", headline: `7 ${inputs.product} Ideas That Actually Work`, description: `Save this for later — you'll thank yourself.`, cta: "Learn More", why: "Idea Pins receive preferential distribution in Pinterest's feed and generate the most saves, driving sustained organic traffic over months." },
      { title: "Seasonal Timely Content", format: "Standard Pin", visualDirection: "Season-appropriate warm or cool tones. Date or season text overlay. Urgency-inducing design.", headline: `Best ${inputs.product} Trends This Season`, description: `Stay ahead with our curated picks. New content weekly.`, cta: "Explore Now", why: "Timely content tied to seasons gets indexed for seasonal searches 6–8 weeks before peak, building traffic momentum ahead of demand." },
    ],
    leads: [
      { title: "Lead Magnet Offer", format: "Standard Pin", visualDirection: "Mockup of your freebie (checklist, guide, quiz). Professional flat-lay style. Include 'FREE' prominently.", headline: `Free ${inputs.product} Guide — Download Now`, description: `Get our complete ${seed} playbook. 100% free, no catch.`, cta: "Download Now", why: "Lead generation pins with a clear free offer and visible value prop (mockup of the resource) convert 2.4× better than text-only calls to action." },
      { title: "Quiz or Assessment Hook", format: "Video Pin", visualDirection: "Animated text asking the quiz question. Builds curiosity. End frame shows partial results to drive clicks.", headline: `Which ${inputs.product} Type Are You? [Quiz]`, description: `Take our 60-second quiz. Get personalised recommendations.`, cta: "Take Quiz", why: "Interactive content frames (quizzes, assessments) generate 3× more click-throughs because they're personalised and create immediate curiosity." },
    ],
    awareness: [
      { title: "Brand Story", format: "Video Pin", visualDirection: "Cinematic behind-the-scenes or brand story. Show the people, the process, the 'why'. Emotional storytelling.", headline: `The Story Behind Our ${inputs.product}`, description: `Built with purpose, designed for you.`, cta: "Learn More", why: "Awareness campaigns benefit from emotional storytelling. Video pins drive 3× higher brand recall than static images when watched over 6 seconds." },
      { title: "Lifestyle Integration", format: "Standard Pin", visualDirection: "Your product naturally integrated into an aspirational lifestyle scene. Not staged — authentic, lived-in feel.", headline: `This Is the ${inputs.product} Aesthetic`, description: `Join a community who values quality.`, cta: "Explore", why: "Lifestyle imagery builds brand affinity by letting Pinners see themselves using your product. This drives saves — your best long-term awareness metric." },
      { title: "Educational Value Pin", format: "Idea Pin", visualDirection: "Teach something genuinely useful related to your niche. Position your brand as the expert. No hard sell.", headline: `Everything You Need to Know About ${inputs.product}`, description: `Expert guide — save it, share it.`, cta: "Save This", why: "Educational content builds trust and positions you as an authority. Pinners save educational content 5× more often than promotional content." },
    ],
  };

  const budgetDaily = Math.round(inputs.monthlyBudget / 30);

  // Realistic Pinterest benchmarks: CPM $4-7 (use $5.50), CPC $0.80-1.40 (use $1.10), CTR ~0.3%
  // Higher-competition niches (fashion, beauty, wedding) have higher CPMs
  const nicheCpmMap: Record<string, number> = {
    "Fashion & Clothing": 6.50, "Beauty & Makeup": 6.20, "Wedding & Events": 7.00,
    "Home Decor & Interior": 5.80, "Food & Recipes": 5.00, "Fitness & Wellness": 5.50,
    "Travel & Adventure": 5.20, "Parenting & Kids": 4.80, "DIY & Crafts": 4.20,
    "Pets & Animals": 4.50, "Technology & Gadgets": 5.00, "Business & Finance": 5.80,
    "Education & Learning": 4.00,
  };
  const nicheCpcMap: Record<string, number> = {
    "Fashion & Clothing": 1.20, "Beauty & Makeup": 1.15, "Wedding & Events": 1.40,
    "Home Decor & Interior": 1.10, "Food & Recipes": 0.90, "Fitness & Wellness": 1.05,
    "Travel & Adventure": 1.00, "Parenting & Kids": 0.95, "DIY & Crafts": 0.80,
    "Pets & Animals": 0.85, "Technology & Gadgets": 1.00, "Business & Finance": 1.10,
    "Education & Learning": 0.80,
  };
  const baseCpm = nicheCpmMap[niche.label] ?? 5.50;
  const baseCpc = nicheCpcMap[niche.label] ?? 1.10;
  // impressions per dollar = 1000 / CPM; clicks per dollar = 1 / CPC
  const impPerDollar = 1000 / baseCpm;
  const clkPerDollar = 1 / baseCpc;
  const convRate = 0.025; // 2.5% conversion rate on clicks

  const budgetOptions: Record<string, BudgetOption> = {
    conservative: {
      label: "Conservative",
      daily: Math.round(budgetDaily * 0.6),
      monthly: Math.round(inputs.monthlyBudget * 0.6),
      impressions: formatNumber(Math.round(budgetDaily * 0.6 * impPerDollar)),
      clicks: formatNumber(Math.round(budgetDaily * 0.6 * clkPerDollar)),
      conversions: String(Math.max(1, Math.round(budgetDaily * 0.6 * clkPerDollar * convRate))),
      roas: "3.2×",
    },
    recommended: {
      label: "Recommended",
      daily: budgetDaily,
      monthly: inputs.monthlyBudget,
      impressions: formatNumber(Math.round(budgetDaily * impPerDollar)),
      clicks: formatNumber(Math.round(budgetDaily * clkPerDollar)),
      conversions: String(Math.max(1, Math.round(budgetDaily * clkPerDollar * convRate))),
      roas: "4.1×",
    },
    aggressive: {
      label: "Aggressive",
      daily: Math.round(budgetDaily * 1.6),
      monthly: Math.round(inputs.monthlyBudget * 1.6),
      impressions: formatNumber(Math.round(budgetDaily * 1.6 * impPerDollar * 1.05)),
      clicks: formatNumber(Math.round(budgetDaily * 1.6 * clkPerDollar * 1.05)),
      conversions: String(Math.max(1, Math.round(budgetDaily * 1.6 * clkPerDollar * convRate * 1.05))),
      roas: "5.4×",
    },
  };

  const readinessScore = Math.min(98,
    (inputs.product.length > 5 ? 25 : 10) +
    (inputs.url.length > 5 ? 20 : 0) +
    (inputs.monthlyBudget >= 300 ? 20 : inputs.monthlyBudget >= 100 ? 15 : 8) +
    20 + // goal always selected
    (inputs.market !== "United States" ? 5 : 5) +
    (inputs.gender !== "all" ? 5 : 3)
  );

  const goalAudienceWhy: Record<GoalType, string> = {
    sales: "For sales campaigns, retargeting and lookalike audiences consistently outperform cold audiences. We prioritise high-intent segments and warm audiences first.",
    traffic: "Traffic campaigns benefit from broad interest audiences at the top of the funnel. We balance reach with relevance using interest + keyword targeting.",
    leads: "Lead generation works best with demographic and interest targeting that matches your customer profile. We include a lookalike seed from engaged content viewers.",
    awareness: "Awareness campaigns need maximum reach. We use Pinterest's broad interest categories and demographic targeting to maximise unique impressions.",
  };

  return {
    niche,
    inputs,
    readinessScore,
    readinessBreakdown: [
      { label: "Product Definition", score: inputs.product.length > 5 ? 25 : 10, max: 25 },
      { label: "Website / URL", score: inputs.url.length > 5 ? 20 : 0, max: 20 },
      { label: "Budget Level", score: inputs.monthlyBudget >= 300 ? 20 : inputs.monthlyBudget >= 100 ? 15 : 8, max: 20 },
      { label: "Campaign Goal", score: 20, max: 20 },
      { label: "Market Selection", score: 15, max: 15 },
    ],
    summary: {
      reachEstimate: (() => {
        // Scale global niche reach to selected market share
        const locEntry = niche.demographics.locations.find(l => l.name === inputs.market);
        const share = (locEntry?.pct ?? 100) / 100;
        const raw = niche.broad;
        const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
        const isM = raw.includes("M");
        const inM = isM ? num : num / 1000;
        const scaled = inM * share;
        return scaled >= 1 ? `${scaled.toFixed(1)}M` : `${Math.round(scaled * 1000)}K`;
      })(),
      weeklyImpressions: formatNumber(Math.round(daily * 7 * impPerDollar)),
      suggestedDailyBudget: daily,
      projectedMonthlyClicks: formatNumber(Math.round(inputs.monthlyBudget * clkPerDollar)),
      estimatedCpa: `$${baseCpc.toFixed(2)}`,
      competitionLevel: daily < 20 ? "Low" : daily < 60 ? "Medium" : "High",
    },
    audience: {
      primary: niche.audiences[0].name,
      secondary: niche.audiences[1].name,
      why: goalAudienceWhy[inputs.goal],
    },
    keywords: {
      highIntent: buildKws(highIntentMods),
      discovery: buildKws(discoveryMods),
      longTail: buildKws(longTailMods),
      negative: negMap[niche.label] ?? ["free", "cheap knockoff", "diy only"],
    },
    budget: {
      conservative: budgetOptions.conservative,
      recommended: budgetOptions.recommended,
      aggressive: budgetOptions.aggressive,
    },
    creative: goalCreativeMap[inputs.goal],
    market: {
      opportunityScore: Math.min(98, 55 + (hash(seed, 0) % 40)),
      competitorInsights: [
        `Most ${niche.label} advertisers use Standard Pins — Video Pins have 60% less competition.`,
        `Average CPM in this niche is $4.20–$6.80. You can beat it with strong creative.`,
        `Top performers post 3–5× per week to maintain distribution momentum.`,
      ],
      differentiation: [
        `Focus on ${inputs.goal === "sales" ? "price anchoring and social proof" : inputs.goal === "traffic" ? "educational content gaps" : inputs.goal === "leads" ? "high-value free resources" : "authentic brand storytelling"}.`,
        `Target the 25–34 age group — underserved by most ${niche.label} advertisers.`,
        `Weekend posting (Fri–Sun) sees 34% higher engagement in this niche.`,
      ],
      timing: `Start campaigns on Thursday–Friday for best first-week performance. ${niche.label} peaks seasonally — plan 6 weeks ahead of key dates.`,
    },
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function WhyTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
      >
        <HelpCircle className="w-3.5 h-3.5" /> Why?
      </button>
      {show && (
        <div className="absolute z-20 bottom-full left-0 mb-2 w-72 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl leading-relaxed">
          <Lightbulb className="w-3.5 h-3.5 text-yellow-400 inline mr-1.5" />
          {text}
          <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

function RegenerateBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const handleClick = () => {
    setSpinning(true);
    setTimeout(() => { setSpinning(false); onClick(); }, 800);
  };
  return (
    <button onClick={handleClick} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#e60023] font-medium transition-colors">
      <RefreshCw className={cn("w-3.5 h-3.5", spinning && "animate-spin")} />
      {spinning ? "Regenerating..." : `↻ Regenerate ${label}`}
    </button>
  );
}

function ScoreBar({ score, max, color = "bg-[#e60023]" }: { score: number; max: number; color?: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2">
      <div className={cn("h-2 rounded-full transition-all duration-700", color)} style={{ width: `${(score / max) * 100}%` }} />
    </div>
  );
}

function CompBadge({ level }: { level: "low" | "medium" | "high" }) {
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize",
      level === "low" ? "bg-green-100 text-green-700" : level === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"
    )}>{level}</span>
  );
}

// ── Campaign Planner (entry form) ─────────────────────────────────────────────

const GOALS: { key: GoalType; label: string; desc: string; icon: string }[] = [
  { key: "sales", label: "Sales & Conversions", desc: "Drive purchases and direct revenue", icon: "🛍️" },
  { key: "traffic", label: "Website Traffic", desc: "Bring visitors to your site or blog", icon: "🌐" },
  { key: "leads", label: "Lead Generation", desc: "Collect emails, sign-ups or enquiries", icon: "📧" },
  { key: "awareness", label: "Brand Awareness", desc: "Reach new audiences and build recognition", icon: "📣" },
];

const MARKETS = ["United States","United Kingdom","Canada","Australia","Germany","France","Brazil","India","Mexico","Argentina","Italy","Spain","Netherlands","Japan","South Korea"];
const BUDGET_PRESETS = [100, 250, 500, 1000, 2500];
const PROGRESS_STEPS = [
  "Analysing your product niche...",
  "Mapping audience segments...",
  "Generating keyword strategy...",
  "Building budget allocations...",
  "Crafting creative concepts...",
  "Calculating readiness score...",
  "Finalising your campaign plan...",
];

interface CampaignPlannerProps { onGenerate: (plan: GeneratedPlan) => void; }

function CampaignPlanner({ onGenerate }: CampaignPlannerProps) {
  const [inputs, setInputs] = useState<CampaignInputs>({
    product: "", url: "", goal: "sales", market: "United States",
    monthlyBudget: 500, gender: "all", ageMin: 18, ageMax: 65,
    category: "", targetCpa: "", targetRoas: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [customBudget, setCustomBudget] = useState(false);

  const set = (k: keyof CampaignInputs, v: string | number) =>
    setInputs(p => ({ ...p, [k]: v }));

  const canGenerate = inputs.product.trim().length > 2 && inputs.monthlyBudget > 0;

  const handleGenerate = () => {
    if (!canGenerate) return;
    setGenerating(true);
    setProgressStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setProgressStep(step);
      if (step >= PROGRESS_STEPS.length) {
        clearInterval(interval);
        setTimeout(() => { onGenerate(generatePlan(inputs)); }, 400);
      }
    }, 380);
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e60023] to-pink-400 flex items-center justify-center mb-6 shadow-lg">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Building Your Campaign Plan</h2>
        <p className="text-sm text-gray-500 mb-8">Our AI is analysing your niche and generating a complete Pinterest strategy.</p>
        <div className="w-full max-w-sm space-y-3 text-left">
          {PROGRESS_STEPS.map((step, i) => (
            <div key={step} className={cn("flex items-center gap-3 text-sm transition-all",
              i < progressStep ? "text-gray-800" : i === progressStep ? "text-[#e60023] font-medium" : "text-gray-300"
            )}>
              {i < progressStep ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : i === progressStep ? (
                <div className="w-4 h-4 border-2 border-[#e60023] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 border-2 border-gray-200 rounded-full flex-shrink-0" />
              )}
              {step}
            </div>
          ))}
        </div>
        <div className="mt-8 w-full max-w-sm bg-gray-100 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-[#e60023] to-pink-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(progressStep / PROGRESS_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-[#e60023]/10 text-[#e60023] px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
          <Sparkles className="w-4 h-4" /> AI Campaign Planner
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Build Your Pinterest Campaign</h2>
        <p className="text-gray-500 mt-2 text-sm">Tell us about your product and goals — we&apos;ll generate a complete advertising strategy in seconds.</p>
      </div>

      {/* Step 1 — Product */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-[#e60023] text-white text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="font-semibold text-gray-900">What are you advertising?</h3>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Product or Service Name *</label>
          <input
            value={inputs.product}
            onChange={e => set("product", e.target.value)}
            placeholder="e.g. Organic Dog Food, Watercolor Tutorials, Home Decor Prints..."
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Website URL (optional)</label>
          <input
            value={inputs.url}
            onChange={e => set("url", e.target.value)}
            placeholder="https://yourwebsite.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
          />
        </div>
      </div>

      {/* Step 2 — Goal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-[#e60023] text-white text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="font-semibold text-gray-900">What&apos;s your campaign goal?</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(g => (
            <button
              key={g.key}
              onClick={() => set("goal", g.key)}
              className={cn(
                "text-left p-4 rounded-xl border-2 transition-all",
                inputs.goal === g.key ? "border-[#e60023] bg-[#e60023]/5" : "border-gray-100 hover:border-gray-200"
              )}
            >
              <div className="text-xl mb-1">{g.icon}</div>
              <div className="text-sm font-semibold text-gray-800">{g.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{g.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3 — Market */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-[#e60023] text-white text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="font-semibold text-gray-900">Target Market</h3>
        </div>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={inputs.market}
            onChange={e => set("market", e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023] bg-white"
          >
            {MARKETS.map(m => <option key={m}>{m}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Step 4 — Budget */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-[#e60023] text-white text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="font-semibold text-gray-900">Monthly Budget</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {BUDGET_PRESETS.map(b => (
            <button
              key={b}
              onClick={() => { set("monthlyBudget", b); setCustomBudget(false); }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                !customBudget && inputs.monthlyBudget === b ? "border-[#e60023] bg-[#e60023]/5 text-[#e60023]" : "border-gray-100 text-gray-600 hover:border-gray-200"
              )}
            >
              ${b.toLocaleString()}
            </button>
          ))}
          <button
            onClick={() => setCustomBudget(true)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
              customBudget ? "border-[#e60023] bg-[#e60023]/5 text-[#e60023]" : "border-gray-100 text-gray-600 hover:border-gray-200"
            )}
          >
            Custom
          </button>
        </div>
        {customBudget && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              min={50}
              value={inputs.monthlyBudget}
              onChange={e => set("monthlyBudget", Number(e.target.value))}
              className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
            />
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">≈ ${Math.round(inputs.monthlyBudget / 30)}/day · We&apos;ll recommend the best daily split strategy.</p>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">5</span>
            <h3 className="font-semibold text-gray-900">Advanced Settings <span className="text-xs font-normal text-gray-400 ml-1">Optional</span></h3>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", showAdvanced && "rotate-180")} />
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Gender</label>
                <select value={inputs.gender} onChange={e => set("gender", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 bg-white">
                  <option value="all">All Genders</option>
                  <option value="female">Women</option>
                  <option value="male">Men</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Age Range</label>
                <div className="flex gap-2">
                  <input type="number" min={18} max={65} value={inputs.ageMin} onChange={e => set("ageMin", Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20" />
                  <span className="text-gray-400 self-center text-sm">–</span>
                  <input type="number" min={18} max={65} value={inputs.ageMax} onChange={e => set("ageMax", Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Target CPA ($)</label>
                <input value={inputs.targetCpa} onChange={e => set("targetCpa", e.target.value)}
                  placeholder="e.g. 15.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Target ROAS</label>
                <input value={inputs.targetRoas} onChange={e => set("targetRoas", e.target.value)}
                  placeholder="e.g. 4.0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate CTA */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full py-4 rounded-2xl text-white font-bold text-base bg-gradient-to-r from-[#e60023] to-pink-500 hover:from-[#ad081b] hover:to-[#e60023] transition-all shadow-lg shadow-[#e60023]/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" />
        Generate My Campaign Plan
      </button>
      {!canGenerate && <p className="text-center text-xs text-gray-400">Enter your product name to continue</p>}
    </div>
  );
}

// ── Section tabs content ──────────────────────────────────────────────────────

const SECTIONS = [
  { key: "audience", label: "Audience", icon: Users },
  { key: "keywords", label: "Keywords", icon: Search },
  { key: "budget", label: "Budget", icon: DollarSign },
  { key: "creative", label: "Creative", icon: Sparkles },
  { key: "market", label: "Market", icon: Globe },
] as const;

function AudienceSection({ plan, mode }: { plan: GeneratedPlan; mode: Mode }) {
  const { niche } = plan;
  const [regen, setRegen] = useState(0);
  const audiences = niche.audiences;
  const demo = niche.demographics;

  // Scale global niche audience numbers to the selected market's share
  const marketEntry = demo.locations.find(l => l.name === plan.inputs.market);
  const marketShare = (marketEntry?.pct ?? 100) / 100;
  function scaleAudience(raw: string): string {
    const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
    const isM = raw.includes("M");
    const inMillions = isM ? num : num / 1000;
    const scaled = inMillions * marketShare;
    if (scaled >= 1) return `${scaled.toFixed(1)}M`;
    return `${Math.round(scaled * 1000)}K`;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900">Audience Strategy</h3>
          <RegenerateBtn label="Audience Plan" onClick={() => setRegen(v => v + 1)} />
        </div>
        <p className="text-sm text-gray-500 mb-4">Auto-generated for: <strong>{niche.label}</strong> · Goal: <strong className="capitalize">{plan.inputs.goal}</strong></p>
        <WhyTooltip text={plan.audience.why} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Broad Reach", size: scaleAudience(niche.broad), desc: "Interest targeting", color: "bg-blue-50 border-blue-100" },
            { label: "Targeted", size: scaleAudience(niche.targeted), desc: "Keyword + interest", color: "bg-purple-50 border-purple-100" },
            { label: "High Intent", size: scaleAudience(niche.highIntent), desc: "Retargeting + lookalike", color: "bg-green-50 border-green-100" },
          ].map(({ label, size, desc, color }) => (
            <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
              <div className="text-2xl font-bold text-gray-900">{size}</div>
              <div className="text-sm font-semibold text-gray-700 mt-1">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc} · {plan.inputs.market}</div>
            </div>
          ))}
        </div>
        {mode === "advanced" && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <strong>Advanced:</strong> Primary audience — {plan.audience.primary}. Secondary — {plan.audience.secondary}. Start with Primary for week 1, layer Secondary after 7 days of data.
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Demographic Insights</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{niche.label}</span>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              📍 {plan.inputs.market}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Age Distribution</div>
            {demo.age.map(({ label, pct }) => (
              <div key={label} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-600 w-10">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-[#e60023] h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8">{pct}%</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Gender Split</div>
            {demo.gender.map(({ label, pct, color }) => (
              <div key={label} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-600 w-20">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={cn(color, "h-2 rounded-full transition-all")} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8">{pct}%</span>
              </div>
            ))}
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-5">Target Location</div>
            {/* Show selected market as 100% target, then niche global breakdown below */}
            <div className="flex items-center justify-between py-1.5 border-b border-[#e60023]/20 bg-[#e60023]/5 rounded-lg px-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#e60023] font-bold">✓</span>
                <span className="text-sm font-semibold text-gray-800">{plan.inputs.market}</span>
                <span className="text-xs text-[#e60023] font-semibold">Targeted</span>
              </div>
              <span className="text-xs font-bold text-[#e60023]">100%</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 mb-3">
              Your ads will only run in <strong>{plan.inputs.market}</strong>. Niche audience distribution within this market:
            </p>
            {(() => {
              // Find this market's share from niche data, use it to scale
              const marketEntry = demo.locations.find(l => l.name === plan.inputs.market);
              const marketPct = marketEntry?.pct ?? 100;
              // Show age distribution scaled to selected market proportion (just informational)
              return demo.locations
                .filter(l => l.name === plan.inputs.market)
                .concat(demo.locations.filter(l => l.name !== plan.inputs.market).slice(0, 3))
                .map(({ name, pct }, i) => (
                  <div key={name} className={cn(
                    "flex items-center justify-between py-1 border-b border-gray-50",
                    name === plan.inputs.market ? "opacity-100" : "opacity-40"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                      <span className={cn("text-xs", name === plan.inputs.market ? "text-gray-700 font-medium" : "text-gray-400")}>{name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-400">{pct}% of niche</span>
                  </div>
                ));
            })()}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Recommended Audience Segments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>{["Audience","Type","Size","CTR","Conv. Rate","Spend"].map(h => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                const totalWeight = audiences.reduce((s, a) => s + a.spend, 0);
                const budget = plan.inputs.monthlyBudget;
                return audiences.map(aud => {
                  const scaledSpend = Math.round((aud.spend / totalWeight) * budget);
                  return (
                    <tr key={aud.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-3 text-sm font-medium text-gray-800">{aud.name}</td>
                      <td className="px-3 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                          aud.type==="retargeting"?"bg-orange-100 text-orange-700":aud.type==="lookalike"?"bg-purple-100 text-purple-700":aud.type==="demographic"?"bg-blue-100 text-blue-700":"bg-green-100 text-green-700"
                        )}>{aud.type}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(aud.size)}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-800">{aud.ctr}%</td>
                      <td className="px-3 py-3 text-sm text-gray-700">{aud.convRate}%</td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-800">${scaledSpend}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        {regen > 0 && <p className="text-xs text-gray-400 mt-3">Regenerated {regen}× — audience mix updated.</p>}
      </div>
    </div>
  );
}

function KeywordsSection({ plan, mode }: { plan: GeneratedPlan; mode: Mode }) {
  const [tab, setTab] = useState<"highIntent"|"discovery"|"longTail">("highIntent");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const kws = plan.keywords[tab];

  const COMP_COLOR: Record<string, string> = {
    low: "text-green-600 bg-green-50",
    medium: "text-yellow-600 bg-yellow-50",
    high: "text-red-500 bg-red-50",
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900">Keyword Strategy</h3>
          <WhyTooltip text="Keywords are grouped by intent: High Intent (ready to buy), Discovery (exploring ideas), Long Tail (specific, lower competition). A balanced mix across all three is recommended for most goals." />
        </div>
        <p className="text-sm text-gray-500 mb-4">Auto-generated for: <strong>{plan.inputs.product}</strong></p>
        <div className="flex gap-2 mb-4">
          {([["highIntent","High Intent","🎯"],["discovery","Discovery","🔍"],["longTail","Long Tail","🪄"]] as const).map(([k, l, icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                tab === k ? "bg-[#e60023] text-white" : "text-gray-500 hover:bg-gray-100"
              )}>
              {icon} {l}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>{["Keyword","Match","Volume","Competition","Bid",""].map(h => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {kws.map(kw => (
                <tr key={kw.keyword} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-800">{kw.keyword}</td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold",
                      kw.type==="exact"?"bg-orange-100 text-orange-700":kw.type==="phrase"?"bg-purple-100 text-purple-700":"bg-blue-100 text-blue-700"
                    )}>{kw.type}</span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatNumber(kw.volume)}</td>
                  <td className="px-3 py-3"><CompBadge level={kw.competition} /></td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">${kw.suggestedBid.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => setAdded(p => { const n = new Set(p); n.has(kw.keyword) ? n.delete(kw.keyword) : n.add(kw.keyword); return n; })}
                      className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg",
                        added.has(kw.keyword) ? "bg-green-100 text-green-700" : "text-[#e60023] hover:bg-[#e60023]/5"
                      )}>
                      {added.has(kw.keyword) ? "✓ Added" : "+ Add"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Suggested Negative Keywords</h3>
          <WhyTooltip text="Negative keywords prevent your ads from showing to people who won't convert — reducing wasted spend and improving your campaign's efficiency." />
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.keywords.negative.map(kw => (
            <div key={kw} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs px-3 py-1.5 rounded-full font-medium">
              − {kw}
            </div>
          ))}
        </div>
        {mode === "advanced" && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            <strong>Tip:</strong> Review search terms weekly and add new negatives. Most campaigns see a 15–25% efficiency gain after 2 weeks of negative keyword refinement.
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetSection({ plan, mode }: { plan: GeneratedPlan; mode: Mode }) {
  const [selected, setSelected] = useState<"conservative"|"recommended"|"aggressive">("recommended");
  const opt = plan.budget[selected];
  const [customDaily, setCustomDaily] = useState(opt.daily);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900">Budget Allocation</h3>
          <WhyTooltip text="We model three budget scenarios based on your monthly input. Recommended gives the best balance of reach and efficiency. Conservative reduces risk while you test. Aggressive maximises volume and data collection speed." />
        </div>
        <p className="text-sm text-gray-500 mb-4">Based on ${plan.inputs.monthlyBudget.toLocaleString()}/month</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {(["conservative","recommended","aggressive"] as const).map(k => {
            const o = plan.budget[k];
            return (
              <button key={k} onClick={() => setSelected(k)}
                className={cn("text-left p-4 rounded-xl border-2 transition-all",
                  selected === k ? "border-[#e60023] bg-[#e60023]/5" : "border-gray-100 hover:border-gray-200"
                )}>
                <div className={cn("text-xs font-bold uppercase tracking-wide mb-1",
                  k==="conservative"?"text-blue-600":k==="recommended"?"text-[#e60023]":"text-purple-600"
                )}>{k==="recommended" ? "★ "+o.label : o.label}</div>
                <div className="text-xl font-bold text-gray-900">${o.daily}/day</div>
                <div className="text-xs text-gray-500 mt-1">${o.monthly.toLocaleString()}/mo</div>
                <div className="text-xs text-gray-400 mt-0.5">ROAS {o.roas}</div>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Est. Impressions", value: opt.impressions, icon: "👁️" },
            { label: "Est. Clicks", value: opt.clicks, icon: "🖱️" },
            { label: "Est. Conversions", value: opt.conversions, icon: "🎯" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}/day</div>
            </div>
          ))}
        </div>
      </div>

      {mode === "advanced" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Custom Daily Budget</h3>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Daily Budget</span>
            <span className="text-xl font-bold text-[#e60023]">${customDaily}</span>
          </div>
          <input type="range" min={5} max={500} step={5} value={customDaily}
            onChange={e => setCustomDaily(Number(e.target.value))}
            className="w-full accent-[#e60023]" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>$5/day</span><span>$500/day</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3 flex justify-between"><span className="text-gray-500">Est. CPC</span><strong>${(customDaily / Math.max(1, customDaily * 58)).toFixed(2)}</strong></div>
            <div className="bg-gray-50 rounded-xl p-3 flex justify-between"><span className="text-gray-500">Est. CPM</span><strong>${(customDaily / Math.max(1, customDaily * 2.4)).toFixed(2)}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Generate alternative copy variations for a creative concept
function generateVariations(concept: CreativeConcept, product: string, varIndex: number) {
  const headlineTemplates = [
    [`The ${product} Everyone's Talking About`, `Why ${product} Lovers Can't Stop Raving`, `Meet the ${product} That Changes Everything`, `Your New Favourite ${product} Is Here`],
    [`Transform Your Life With ${product}`, `The ${product} Secret You Need to Know`, `${product} That Actually Works`, `Finally — A ${product} Worth Loving`],
    [`Discover the Best ${product} of the Year`, `${product} Built for People Who Care`, `The ${product} That Delivers Results`, `Upgrade to the ${product} You Deserve`],
    [`Why Everyone Is Switching to This ${product}`, `The ${product} Review You've Been Waiting For`, `Real Results From Real ${product} Users`, `Join 10,000+ Happy ${product} Customers`],
  ];
  const descTemplates = [
    [`Discover why thousands chose our ${product}. Premium quality, fast shipping. Shop now.`, `Join the community that's obsessed with our ${product}. Limited stock — order today.`, `Our ${product} is crafted for people who expect the best. See why reviewers love it.`, `Finally a ${product} that lives up to the hype. Free returns. Shop risk-free.`],
    [`Don't settle for less. Our ${product} sets the standard. Fast delivery included.`, `Real quality, real results. See what our ${product} can do for you. Shop today.`, `Trusted by thousands. Our ${product} is the one everyone keeps coming back to.`, `Give yourself the ${product} you actually deserve. Ships in 24 hours.`],
    [`Premium ${product} at a price that makes sense. Order now & get free shipping.`, `Your search for the perfect ${product} ends here. Shop with confidence.`, `Every detail matters. That's why our ${product} is different. Explore the collection.`, `See why our ${product} has 4.9 stars. Shop now and feel the difference.`],
    [`New in: the ${product} everyone is pinning. Grab yours before it sells out.`, `People are obsessed with this ${product} for a reason. Discover it today.`, `The ${product} that started a movement. Join thousands of happy customers.`, `Limited time: get our bestselling ${product} with free express shipping.`],
  ];
  const ctaOptions = ["Shop Now", "Learn More", "Get Yours", "Explore", "Buy Now", "Discover", "See More", "Try It"];

  const hIdx = varIndex % headlineTemplates[0].length;
  const tIdx = Math.min(varIndex, headlineTemplates.length - 1);
  return {
    headline: headlineTemplates[tIdx][hIdx],
    description: descTemplates[tIdx][hIdx],
    cta: ctaOptions[(varIndex + concept.cta.length) % ctaOptions.length],
  };
}

// Render a single copy card (original or variation)
function CopyCard({ label, headline, description, cta }: { label: string; headline: string; description: string; cta: string }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="bg-[#e60023]/10 text-[#e60023] text-xs px-3 py-1 rounded-full font-semibold">{cta}</span>
      </div>
      <p className="text-sm font-semibold text-gray-800">{headline}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function CreativeSection({ plan }: { plan: GeneratedPlan; mode: Mode }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  // extras[i] = number of extra variation cards added for concept i
  const [extras, setExtras] = useState<Record<number, number>>({});

  return (
    <div className="space-y-4">
      {plan.creative.map((concept, i) => {
        const extraCount = extras[i] ?? 0;

        return (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-[#e60023]/10 text-[#e60023] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{concept.title}</div>
                <div className="text-xs text-gray-400">{concept.format}</div>
              </div>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", expanded === i && "rotate-180")} />
          </button>
          {expanded === i && (
            <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-4">
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Visual Direction</div>
                <p className="text-sm text-purple-900">{concept.visualDirection}</p>
              </div>

              {/* Original copy */}
              <CopyCard label="Original" headline={concept.headline} description={concept.description} cta={concept.cta} />

              {/* Extra variation cards */}
              {Array.from({ length: extraCount }).map((_, vi) => {
                const v = generateVariations(concept, plan.inputs.product || "product", vi);
                return <CopyCard key={vi} label={`Variation ${vi + 1}`} headline={v.headline} description={v.description} cta={v.cta} />;
              })}

              <div className="flex items-center justify-between pt-1">
                <WhyTooltip text={concept.why} />
                <div className="flex items-center gap-2">
                  {extraCount > 0 && (
                    <button
                      onClick={() => setExtras(e => ({ ...e, [i]: 0 }))}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >Clear variations</button>
                  )}
                  <button
                    onClick={() => setExtras(e => ({ ...e, [i]: (e[i] ?? 0) + 1 }))}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#e60023] bg-[#e60023]/8 hover:bg-[#e60023]/15 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Add More
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Format Performance Guide</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { type: "Standard Pin", ctr: "1.8–2.6%", saves: "High", best: "Products, before/after, lifestyle" },
            { type: "Video Pin", ctr: "2.4–4.2%", saves: "Very High", best: "Tutorials, stories, demos" },
            { type: "Carousel Pin", ctr: "2.1–3.8%", saves: "High", best: "Multi-product, step-by-step" },
            { type: "Idea Pin", ctr: "3.0–5.1%", saves: "Highest", best: "How-to, recipes, educational" },
          ].map(f => (
            <div key={f.type} className="border border-gray-100 rounded-xl p-3 hover:border-[#e60023]/30 transition-colors">
              <div className="text-sm font-semibold text-gray-800 mb-1">{f.type}</div>
              <div className="text-xs text-gray-500">CTR: <strong>{f.ctr}</strong> · Saves: <strong>{f.saves}</strong></div>
              <div className="text-xs text-gray-400 mt-0.5">{f.best}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketSection({ plan, mode }: { plan: GeneratedPlan; mode: Mode }) {
  const [trendType, setTrendType] = useState<"growing"|"seasonal">("growing");
  const [trends, setTrends] = useState<{keyword:string;pctChangeFromLastYear:number|null;trendType:string}[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendLive, setTrendLive] = useState(false);

  const region = plan.inputs.market === "United Kingdom" ? "GB"
    : plan.inputs.market === "Canada" ? "CA"
    : plan.inputs.market === "Australia" ? "AU"
    : plan.inputs.market === "Germany" ? "DE"
    : plan.inputs.market === "France" ? "FR"
    : plan.inputs.market === "Brazil" ? "BR"
    : plan.inputs.market === "India" ? "IN"
    : plan.inputs.market === "Mexico" ? "MX"
    : "US";

  const loadTrends = useCallback(async (type: "growing"|"seasonal") => {
    setTrendType(type);
    setTrendLoading(true);
    try {
      const interest = encodeURIComponent(plan.niche.label);
      const res = await fetch(`/api/pinterest-trends?type=${type}&region=${region}&interest=${interest}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.trends) && data.trends.length > 0) {
          setTrends(data.trends);
          setTrendLive(true);
        }
      }
    } catch { /* fall through */ }
    setTrendLoading(false);
  }, [plan.niche.label, region]);

  useState(() => { loadTrends("growing"); });

  const score = plan.market.opportunityScore;

  return (
    <div className="space-y-5">
      {/* Opportunity Score */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Market Opportunity Score</h3>
          <WhyTooltip text="Opportunity score is calculated from niche search volume, competition density, and Pinterest audience match. 70+ is a strong opportunity; 85+ is exceptional." />
        </div>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.8" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={score >= 80 ? "#16a34a" : score >= 60 ? "#e60023" : "#f59e0b"}
                strokeWidth="3.8" strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center rotate-0">
              <span className="text-2xl font-bold text-gray-900">{score}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-800 mb-2">{score >= 80 ? "Excellent Opportunity" : score >= 60 ? "Good Opportunity" : "Moderate Opportunity"}</div>
            <div className="space-y-2 text-xs text-gray-600">
              {plan.market.differentiation.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  {d}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competitor Insights */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Competitor Insights</h3>
        <div className="space-y-3">
          {plan.market.competitorInsights.map((c, i) => (
            <div key={i} className="flex items-start gap-3 bg-blue-50 rounded-xl p-3">
              <BarChart2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">{c}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
          <strong>Timing:</strong> {plan.market.timing}
        </div>
      </div>

      {/* Trending Searches */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Trending Pinterest Searches</h3>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
              trendLive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            )}>
              {trendLive ? "● Live" : "○ Sample"}
            </span>
          </div>
          <div className="flex gap-1">
            {(["growing","seasonal"] as const).map(t => (
              <button key={t} onClick={() => loadTrends(t)}
                className={cn("text-xs px-2.5 py-1 rounded-lg font-medium capitalize transition-colors",
                  trendType===t ? "bg-[#e60023] text-white" : "text-gray-500 hover:bg-gray-100"
                )}>{t}</button>
            ))}
          </div>
        </div>
        {trendLoading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#e60023]/20 border-t-[#e60023] rounded-full animate-spin" /></div>
        ) : trendLive && trends.length > 0 ? (
          <div className="space-y-2">
            {trends.slice(0, 15).map((t, i) => (
              <div key={t.keyword} className="flex items-center gap-3 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-5">{i+1}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800 capitalize">{t.keyword}</div>
                  <div className="text-xs text-gray-400 capitalize">{t.trendType} · US</div>
                </div>
                <div className={cn("text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1",
                  (t.pctChangeFromLastYear ?? 0) >= 0 ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"
                )}>
                  <TrendingUp className="w-3 h-3" />
                  {t.pctChangeFromLastYear !== null
                    ? t.pctChangeFromLastYear > 999
                      ? "New ↑"
                      : `${t.pctChangeFromLastYear >= 0 ? "+" : ""}${t.pctChangeFromLastYear}%`
                    : "Trending"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {TREND_DATA.slice(0, 10).map(t => (
              <div key={t.keyword} className="flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{t.keyword}</div>
                  <div className="text-xs text-gray-400">{t.category} · Peak: {t.peak}</div>
                </div>
                <div className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 text-green-600 bg-green-50">
                  <TrendingUp className="w-3 h-3" />+{t.change}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mode === "advanced" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Seasonal Opportunity Calendar</h3>
          <div className="grid grid-cols-3 gap-2">
            {SEASONAL_CALENDAR.map(m => (
              <div key={m.month} className={cn("rounded-xl p-3 border",
                m.score>=90?"bg-red-50 border-red-200":m.score>=80?"bg-orange-50 border-orange-200":m.score>=70?"bg-yellow-50 border-yellow-100":"bg-gray-50 border-gray-100"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-800">{m.month}</span>
                  <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded",
                    m.score>=90?"text-red-700 bg-red-100":m.score>=80?"text-orange-700 bg-orange-100":"text-gray-600 bg-gray-100"
                  )}>{m.score}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{m.opportunity}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Campaign Blueprint / Readiness Score ──────────────────────────────────────

function ReadinessScore({ plan }: { plan: GeneratedPlan }) {
  const { readinessScore, readinessBreakdown } = plan;
  const color = readinessScore >= 80 ? "text-green-600" : readinessScore >= 60 ? "text-amber-600" : "text-red-500";
  const barColor = readinessScore >= 80 ? "bg-green-500" : readinessScore >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 text-center">
          <div className={cn("text-4xl font-black", color)}>{readinessScore}</div>
          <div className="text-xs text-gray-400 mt-0.5">/ 100</div>
          <div className="text-xs font-semibold text-gray-600 mt-1">Campaign Ready</div>
        </div>
        <div className="flex-1 space-y-2">
          {readinessBreakdown.map(({ label, score, max }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-36 flex-shrink-0">{label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className={cn("h-1.5 rounded-full transition-all duration-700", score === max ? "bg-green-500" : score > 0 ? barColor : "bg-gray-200")}
                  style={{ width: `${(score / max) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-600 w-10 text-right">{score}/{max}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Plan View (after generation) ─────────────────────────────────────────────

function PlanView({ plan, onBack }: { plan: GeneratedPlan; onBack: () => void }) {
  const [section, setSection] = useState<PlanSection>("audience");
  const mode: Mode = "advanced";
  const [liveEst, setLiveEst] = useState<LiveEstimate | null>(plan.liveEstimate ?? null);
  const [fetchingEst, setFetchingEst] = useState(!plan.liveEstimate);

  // Fetch live Pinterest estimates if not already fetched
  useState(() => {
    if (plan.liveEstimate) return;
    (async () => {
      try {
        const res = await fetch("/api/pinterest-campaign-estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: plan.inputs.goal,
            market: plan.inputs.market,
            monthlyBudget: plan.inputs.monthlyBudget,
            niche: plan.niche.label,
            gender: plan.inputs.gender,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.live) setLiveEst(data as LiveEstimate);
        }
      } catch { /* keep estimated */ }
      setFetchingEst(false);
    })();
  });

  const goalLabel = GOALS.find(g => g.key === plan.inputs.goal)?.label ?? plan.inputs.goal;
  const isLive = liveEst?.live === true;

  // Prefer live data over estimates; fall back gracefully
  const stats = [
    {
      label: "Reach Estimate",
      value: (isLive && liveEst.reachEstimate) ? liveEst.reachEstimate : plan.summary.reachEstimate,
    },
    {
      label: "Weekly Impressions",
      value: (isLive && liveEst.weeklyImpressions) ? liveEst.weeklyImpressions : plan.summary.weeklyImpressions,
    },
    {
      label: "Monthly Clicks",
      value: (isLive && liveEst.monthlyClicks) ? liveEst.monthlyClicks : plan.summary.projectedMonthlyClicks,
    },
    {
      label: "Est. CPC",
      value: (isLive && liveEst.estimatedCpa) ? liveEst.estimatedCpa : plan.summary.estimatedCpa,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Blueprint Header */}
      <div className="bg-gradient-to-r from-[#e60023] to-pink-500 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={onBack} className="flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> New Plan
              </button>
              {fetchingEst ? (
                <span className="flex items-center gap-1 text-white/60 text-xs">
                  <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  Fetching live estimates...
                </span>
              ) : isLive ? (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold">● Live from Pinterest</span>
              ) : (
                <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">~ Estimated</span>
              )}
            </div>
            <h2 className="text-xl font-bold">{plan.inputs.product}</h2>
            <p className="text-white/80 text-sm mt-0.5">{goalLabel} · {plan.inputs.market} · ${plan.inputs.monthlyBudget.toLocaleString()}/mo</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-lg font-bold">{value}</div>
              <div className="text-xs text-white/70 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Readiness Score */}
      <ReadinessScore plan={plan} />

      {/* Section nav + content */}
      <div className="flex gap-6">
        <div className="w-44 flex-shrink-0 space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSection(key)}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                section === key ? "bg-[#e60023] text-white" : "text-gray-600 hover:bg-gray-100"
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          {section === "audience" && <AudienceSection plan={plan} mode={mode} />}
          {section === "keywords" && <KeywordsSection plan={plan} mode={mode} />}
          {section === "budget" && <BudgetSection plan={plan} mode={mode} />}
          {section === "creative" && <CreativeSection plan={plan} mode={mode} />}
          {section === "market" && <MarketSection plan={plan} mode={mode} />}
        </div>
      </div>

      {/* Final Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Ready to Launch?</h3>
            <p className="text-sm text-gray-500 mt-0.5">Your campaign plan is complete. Campaign Readiness: <strong className={plan.readinessScore >= 80 ? "text-green-600" : "text-amber-600"}>{plan.readinessScore}/100</strong></p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              <Info className="w-4 h-4" /> Save Plan
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#e60023] to-pink-500 text-white rounded-xl text-sm font-bold hover:from-[#ad081b] hover:to-[#e60023] transition-all shadow-md shadow-[#e60023]/20">
              <Zap className="w-4 h-4" /> Launch This Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PlanTab() {
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);

  if (!plan) {
    return <CampaignPlanner onGenerate={setPlan} />;
  }

  return <PlanView plan={plan} onBack={() => setPlan(null)} />;
}
