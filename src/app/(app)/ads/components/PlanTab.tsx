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

// ── Niche classifier ────────────────────────────────────────────────────────
// Each niche has a keyword set. We score the user's input against all niches
// and pick the highest scorer, so any keyword maps sensibly.

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
  type: "interest"|"demographic"|"keyword"|"lookalike"|"retargeting";
  size: number; ctr: number; convRate: number; spend: number;
}

const NICHES: NicheDef[] = [
  {
    label: "Fashion & Clothing",
    keywords: ["fashion","clothing","clothes","outfit","dress","wear","apparel","shirt","jeans","pants","shoes","sneakers","boots","jacket","coat","skirt","blouse","top","hoodie","sweater","activewear","streetwear","style","wardrobe","looks","ootd","trends","boutique","designer","luxury fashion","fast fashion","sustainable fashion","capsule wardrobe","minimalist fashion"],
    broad:"31.4M", targeted:"7.9M", highIntent:"1.6M",
    demographics: {
      age:[{label:"18–24",pct:34},{label:"25–34",pct:36},{label:"35–44",pct:17},{label:"45–54",pct:9},{label:"55+",pct:4}],
      gender:[{label:"Women",pct:78,color:"bg-pink-400"},{label:"Men",pct:16,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:41},{name:"United Kingdom",pct:13},{name:"Canada",pct:10},{name:"Australia",pct:7},{name:"France",pct:5}],
    },
    audiences:[
      {id:"fa1",name:"Fashion & Style Lovers",type:"interest",size:7400000,ctr:2.9,convRate:1.7,spend:920},
      {id:"fa2",name:"Women 18–29 Trend Seekers",type:"demographic",size:9100000,ctr:2.4,convRate:2.0,spend:710},
      {id:"fa3",name:"Clothing & Apparel Keywords",type:"keyword",size:3100000,ctr:2.2,convRate:1.5,spend:380},
      {id:"fa4",name:"Lookalike — Fashion Buyers",type:"lookalike",size:3600000,ctr:2.7,convRate:2.2,spend:530},
      {id:"fa5",name:"Cart Abandoners (14d)",type:"retargeting",size:42000,ctr:5.6,convRate:7.2,spend:310},
    ],
  },
  {
    label: "Home Decor & Interior",
    keywords: ["home decor","interior","furniture","living room","bedroom","kitchen","bathroom","decor","decoration","cozy","aesthetic","room","house","apartment","boho","farmhouse","modern","minimalist home","scandinavian","rustic","wall art","throw pillow","rug","lamp","shelf","curtain","renovation","remodel","staging","neutral home","neutral tones","home design","interior design"],
    broad:"22.1M", targeted:"5.4M", highIntent:"1.1M",
    demographics: {
      age:[{label:"18–24",pct:22},{label:"25–34",pct:38},{label:"35–44",pct:24},{label:"45–54",pct:11},{label:"55+",pct:5}],
      gender:[{label:"Women",pct:74,color:"bg-pink-400"},{label:"Men",pct:18,color:"bg-blue-400"},{label:"Unspecified",pct:8,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:38},{name:"United Kingdom",pct:14},{name:"Canada",pct:11},{name:"Australia",pct:8},{name:"Germany",pct:6}],
    },
    audiences:[
      {id:"h1",name:"Home Decor Enthusiasts",type:"interest",size:4200000,ctr:2.8,convRate:1.9,spend:890},
      {id:"h2",name:"Women 25–44 Homeowners",type:"demographic",size:8100000,ctr:2.1,convRate:2.4,spend:640},
      {id:"h3",name:"Website Visitors (30d)",type:"retargeting",size:24000,ctr:4.2,convRate:5.8,spend:320},
      {id:"h4",name:"Lookalike — Top Buyers",type:"lookalike",size:2100000,ctr:3.1,convRate:3.2,spend:480},
      {id:"h5",name:"Interior Design Keywords",type:"keyword",size:1800000,ctr:2.4,convRate:1.7,spend:210},
    ],
  },
  {
    label: "Beauty & Makeup",
    keywords: ["beauty","makeup","cosmetic","lipstick","foundation","mascara","eyeshadow","blush","concealer","skincare","skin care","moisturizer","serum","toner","cleanser","face mask","spf","sunscreen","retinol","glow","routine","self care","nail","nails","nail art","hair","haircare","shampoo","conditioner","hair mask","perfume","fragrance","body lotion","body care"],
    broad:"24.6M", targeted:"6.1M", highIntent:"1.2M",
    demographics: {
      age:[{label:"18–24",pct:38},{label:"25–34",pct:34},{label:"35–44",pct:16},{label:"45–54",pct:8},{label:"55+",pct:4}],
      gender:[{label:"Women",pct:86,color:"bg-pink-400"},{label:"Men",pct:8,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:40},{name:"United Kingdom",pct:12},{name:"Canada",pct:10},{name:"Australia",pct:8},{name:"India",pct:6}],
    },
    audiences:[
      {id:"b1",name:"Beauty & Skincare Fans",type:"interest",size:5800000,ctr:3.0,convRate:2.1,spend:840},
      {id:"b2",name:"Women 18–39 Beauty Buyers",type:"demographic",size:7200000,ctr:2.5,convRate:2.7,spend:660},
      {id:"b3",name:"Makeup & Skincare Keywords",type:"keyword",size:2600000,ctr:2.3,convRate:1.9,spend:320},
      {id:"b4",name:"Lookalike — Repeat Buyers",type:"lookalike",size:2400000,ctr:3.2,convRate:3.4,spend:490},
      {id:"b5",name:"Product Page Visitors (7d)",type:"retargeting",size:28000,ctr:5.8,convRate:6.8,spend:240},
    ],
  },
  {
    label: "Food & Recipes",
    keywords: ["food","recipe","cooking","baking","meal","dinner","lunch","breakfast","dessert","snack","healthy eating","nutrition","diet","vegan","vegetarian","keto","paleo","gluten free","meal prep","meal plan","quick dinner","easy recipe","slow cooker","air fryer","instant pot","pasta","pizza","cake","cookies","bread","soup","salad","smoothie","cocktail","drink","coffee"],
    broad:"27.8M", targeted:"6.9M", highIntent:"1.4M",
    demographics: {
      age:[{label:"18–24",pct:24},{label:"25–34",pct:35},{label:"35–44",pct:22},{label:"45–54",pct:12},{label:"55+",pct:7}],
      gender:[{label:"Women",pct:69,color:"bg-pink-400"},{label:"Men",pct:24,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:42},{name:"United Kingdom",pct:12},{name:"Canada",pct:10},{name:"Australia",pct:7},{name:"Germany",pct:5}],
    },
    audiences:[
      {id:"fo1",name:"Food & Recipe Enthusiasts",type:"interest",size:6300000,ctr:2.2,convRate:1.4,spend:590},
      {id:"fo2",name:"Home Cooks 25–44",type:"demographic",size:8400000,ctr:1.9,convRate:1.6,spend:470},
      {id:"fo3",name:"Recipe & Cooking Keywords",type:"keyword",size:3800000,ctr:1.8,convRate:1.2,spend:280},
      {id:"fo4",name:"Lookalike — Engaged Savers",type:"lookalike",size:3100000,ctr:2.4,convRate:1.8,spend:360},
      {id:"fo5",name:"Blog Visitors (30d)",type:"retargeting",size:52000,ctr:3.9,convRate:4.2,spend:180},
    ],
  },
  {
    label: "Fitness & Wellness",
    keywords: ["fitness","workout","exercise","gym","yoga","pilates","running","jogging","cycling","hiit","strength training","weight loss","lose weight","weight lifting","bodybuilding","abs","cardio","stretching","meditation","mindfulness","mental health","wellness","health","nutrition","protein","supplement","pre workout","marathon","5k","crossfit","zumba","dance","aerobics","boot camp"],
    broad:"18.7M", targeted:"4.8M", highIntent:"960K",
    demographics: {
      age:[{label:"18–24",pct:30},{label:"25–34",pct:38},{label:"35–44",pct:20},{label:"45–54",pct:9},{label:"55+",pct:3}],
      gender:[{label:"Women",pct:64,color:"bg-pink-400"},{label:"Men",pct:31,color:"bg-blue-400"},{label:"Unspecified",pct:5,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:39},{name:"United Kingdom",pct:13},{name:"Canada",pct:11},{name:"Australia",pct:9},{name:"Germany",pct:5}],
    },
    audiences:[
      {id:"f1",name:"Fitness & Workout Fans",type:"interest",size:5100000,ctr:2.6,convRate:2.0,spend:760},
      {id:"f2",name:"Women 18–34 Health Focus",type:"demographic",size:6200000,ctr:2.3,convRate:2.6,spend:580},
      {id:"f3",name:"Gym & Activewear Keywords",type:"keyword",size:2200000,ctr:2.1,convRate:1.8,spend:290},
      {id:"f4",name:"Lookalike — Active Buyers",type:"lookalike",size:2800000,ctr:2.9,convRate:2.4,spend:440},
      {id:"f5",name:"App Visitors Retargeting",type:"retargeting",size:31000,ctr:4.8,convRate:5.4,spend:270},
    ],
  },
  {
    label: "Travel & Adventure",
    keywords: ["travel","vacation","holiday","trip","destination","hotel","resort","airbnb","flight","cruise","backpacking","adventure","explore","wanderlust","bucket list","road trip","beach","mountain","camping","hiking","europe","asia","tropical","safari","honeymoon","solo travel","family travel","travel tips","packing","travel guide","tourism","sightseeing","passport","visa"],
    broad:"19.5M", targeted:"4.9M", highIntent:"980K",
    demographics: {
      age:[{label:"18–24",pct:26},{label:"25–34",pct:40},{label:"35–44",pct:20},{label:"45–54",pct:10},{label:"55+",pct:4}],
      gender:[{label:"Women",pct:62,color:"bg-pink-400"},{label:"Men",pct:32,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:36},{name:"United Kingdom",pct:16},{name:"Canada",pct:11},{name:"Australia",pct:9},{name:"Germany",pct:7}],
    },
    audiences:[
      {id:"t1",name:"Travel Planners & Dreamers",type:"interest",size:4600000,ctr:2.5,convRate:1.6,spend:680},
      {id:"t2",name:"Adults 25–44 Frequent Travelers",type:"demographic",size:5900000,ctr:2.0,convRate:1.9,spend:520},
      {id:"t3",name:"Destination & Travel Keywords",type:"keyword",size:2100000,ctr:1.9,convRate:1.4,spend:310},
      {id:"t4",name:"Lookalike — Bookers",type:"lookalike",size:2600000,ctr:2.7,convRate:2.2,spend:420},
      {id:"t5",name:"Landing Page Visitors (14d)",type:"retargeting",size:19000,ctr:4.6,convRate:5.0,spend:220},
    ],
  },
  {
    label: "Wedding & Events",
    keywords: ["wedding","bride","bridal","groom","engagement","ceremony","reception","vow","proposal","ring","bouquet","bridesmaid","maid of honor","wedding dress","wedding cake","wedding venue","floral","centerpiece","invitation","rsvp","honeymoon","anniversary","bachelorette","bach party","rehearsal dinner","wedding planner","table setting","wedding decor","wedding photography"],
    broad:"14.2M", targeted:"3.6M", highIntent:"720K",
    demographics: {
      age:[{label:"18–24",pct:26},{label:"25–34",pct:48},{label:"35–44",pct:16},{label:"45–54",pct:7},{label:"55+",pct:3}],
      gender:[{label:"Women",pct:82,color:"bg-pink-400"},{label:"Men",pct:11,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:44},{name:"United Kingdom",pct:12},{name:"Canada",pct:9},{name:"Australia",pct:8},{name:"India",pct:6}],
    },
    audiences:[
      {id:"w1",name:"Brides & Wedding Planners",type:"interest",size:3800000,ctr:3.4,convRate:2.8,spend:720},
      {id:"w2",name:"Women 25–34 Engaged",type:"demographic",size:2100000,ctr:2.9,convRate:3.2,spend:580},
      {id:"w3",name:"Wedding Keyword Searchers",type:"keyword",size:1400000,ctr:2.6,convRate:2.1,spend:340},
      {id:"w4",name:"Lookalike — Past Buyers",type:"lookalike",size:1800000,ctr:3.1,convRate:2.6,spend:410},
      {id:"w5",name:"Website Visitors (30d)",type:"retargeting",size:18000,ctr:5.2,convRate:6.1,spend:190},
    ],
  },
  {
    label: "Parenting & Kids",
    keywords: ["baby","infant","toddler","kids","children","parenting","mom","dad","mother","father","newborn","pregnancy","pregnant","nursery","stroller","diaper","breastfeeding","formula","baby food","toy","educational toy","kids room","playroom","school","homework","kids activity","craft kids","story time","family","siblings","twins","preschool","kindergarten","child development"],
    broad:"13.1M", targeted:"3.3M", highIntent:"660K",
    demographics: {
      age:[{label:"18–24",pct:18},{label:"25–34",pct:44},{label:"35–44",pct:28},{label:"45–54",pct:8},{label:"55+",pct:2}],
      gender:[{label:"Women",pct:79,color:"bg-pink-400"},{label:"Men",pct:14,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:41},{name:"United Kingdom",pct:13},{name:"Canada",pct:10},{name:"Australia",pct:8},{name:"India",pct:5}],
    },
    audiences:[
      {id:"k1",name:"Parents & Caregivers",type:"interest",size:4800000,ctr:2.4,convRate:2.0,spend:640},
      {id:"k2",name:"Moms 25–39",type:"demographic",size:5200000,ctr:2.1,convRate:2.3,spend:510},
      {id:"k3",name:"Baby & Kids Keywords",type:"keyword",size:1900000,ctr:2.0,convRate:1.7,spend:260},
      {id:"k4",name:"Lookalike — Family Buyers",type:"lookalike",size:2300000,ctr:2.6,convRate:2.1,spend:380},
      {id:"k5",name:"Product Page Visitors (14d)",type:"retargeting",size:22000,ctr:4.4,convRate:5.2,spend:210},
    ],
  },
  {
    label: "DIY & Crafts",
    keywords: ["diy","craft","handmade","make","create","tutorial","how to","step by step","upcycle","repurpose","thrift flip","sewing","knitting","crochet","embroidery","macrame","candle making","soap making","resin","painting","drawing","art","sketchbook","watercolor","acrylic","woodworking","woodwork","carpentry","home project","renovation diy","garden diy","paper craft"],
    broad:"13.8M", targeted:"3.4M", highIntent:"680K",
    demographics: {
      age:[{label:"18–24",pct:20},{label:"25–34",pct:34},{label:"35–44",pct:26},{label:"45–54",pct:14},{label:"55+",pct:6}],
      gender:[{label:"Women",pct:76,color:"bg-pink-400"},{label:"Men",pct:17,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:43},{name:"United Kingdom",pct:13},{name:"Canada",pct:10},{name:"Australia",pct:7},{name:"Germany",pct:5}],
    },
    audiences:[
      {id:"d1",name:"DIY & Craft Enthusiasts",type:"interest",size:3900000,ctr:2.3,convRate:1.6,spend:520},
      {id:"d2",name:"Creative Women 25–44",type:"demographic",size:4600000,ctr:2.0,convRate:1.8,spend:400},
      {id:"d3",name:"Craft & Tutorial Keywords",type:"keyword",size:1700000,ctr:1.9,convRate:1.4,spend:230},
      {id:"d4",name:"Lookalike — Craft Buyers",type:"lookalike",size:2000000,ctr:2.5,convRate:1.9,spend:310},
      {id:"d5",name:"Blog & Video Visitors (30d)",type:"retargeting",size:36000,ctr:3.8,convRate:4.0,spend:160},
    ],
  },
  {
    label: "Gardening & Plants",
    keywords: ["garden","gardening","plant","flower","floral","bloom","grow","greenhouse","raised bed","vegetable garden","herb garden","composting","landscaping","lawn","outdoor","patio","backyard","balcony garden","indoor plant","houseplant","succulent","cactus","fiddle leaf","monstera","pothos","propagation","soil","seed","planting","seasonal garden","spring planting","winter garden"],
    broad:"11.2M", targeted:"2.8M", highIntent:"560K",
    demographics: {
      age:[{label:"18–24",pct:14},{label:"25–34",pct:28},{label:"35–44",pct:30},{label:"45–54",pct:18},{label:"55+",pct:10}],
      gender:[{label:"Women",pct:71,color:"bg-pink-400"},{label:"Men",pct:23,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:40},{name:"United Kingdom",pct:15},{name:"Canada",pct:10},{name:"Australia",pct:9},{name:"Germany",pct:7}],
    },
    audiences:[
      {id:"g1",name:"Gardening & Plant Lovers",type:"interest",size:3200000,ctr:2.0,convRate:1.5,spend:430},
      {id:"g2",name:"Homeowners 30–54",type:"demographic",size:4100000,ctr:1.8,convRate:1.7,spend:360},
      {id:"g3",name:"Garden & Plant Keywords",type:"keyword",size:1400000,ctr:1.7,convRate:1.3,spend:200},
      {id:"g4",name:"Lookalike — Repeat Buyers",type:"lookalike",size:1700000,ctr:2.3,convRate:1.8,spend:280},
      {id:"g5",name:"Product Page Visitors (30d)",type:"retargeting",size:14000,ctr:3.6,convRate:4.4,spend:130},
    ],
  },
  {
    label: "Pets & Animals",
    keywords: ["pet","dog","cat","puppy","kitten","animal","breed","training","pet food","dog food","cat food","vet","veterinary","grooming","leash","collar","cage","tank","fish","bird","hamster","rabbit","pet care","rescue","adopt","shelter","pet toy","treats","paw","fur baby","pet friendly","dog training","cat behavior","exotic pet"],
    broad:"15.7M", targeted:"3.9M", highIntent:"780K",
    demographics: {
      age:[{label:"18–24",pct:22},{label:"25–34",pct:36},{label:"35–44",pct:24},{label:"45–54",pct:12},{label:"55+",pct:6}],
      gender:[{label:"Women",pct:66,color:"bg-pink-400"},{label:"Men",pct:27,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:44},{name:"United Kingdom",pct:12},{name:"Canada",pct:10},{name:"Australia",pct:8},{name:"Germany",pct:5}],
    },
    audiences:[
      {id:"p1",name:"Pet Owners & Animal Lovers",type:"interest",size:4400000,ctr:2.4,convRate:1.8,spend:610},
      {id:"p2",name:"Dog & Cat Owners 25–44",type:"demographic",size:5100000,ctr:2.0,convRate:2.0,spend:480},
      {id:"p3",name:"Pet Food & Care Keywords",type:"keyword",size:1800000,ctr:1.9,convRate:1.6,spend:250},
      {id:"p4",name:"Lookalike — Subscription Buyers",type:"lookalike",size:2100000,ctr:2.7,convRate:2.4,spend:370},
      {id:"p5",name:"Store Visitors (14d)",type:"retargeting",size:26000,ctr:4.2,convRate:5.0,spend:190},
    ],
  },
  {
    label: "Technology & Gadgets",
    keywords: ["tech","technology","gadget","phone","smartphone","iphone","android","laptop","computer","tablet","ipad","smart home","alexa","smart watch","earbuds","headphones","camera","drone","gaming","console","ps5","xbox","nintendo","streaming","software","app","coding","programming","developer","startup","saas","productivity","tools","automation","ai","artificial intelligence"],
    broad:"16.4M", targeted:"4.1M", highIntent:"820K",
    demographics: {
      age:[{label:"18–24",pct:32},{label:"25–34",pct:38},{label:"35–44",pct:18},{label:"45–54",pct:8},{label:"55+",pct:4}],
      gender:[{label:"Women",pct:38,color:"bg-pink-400"},{label:"Men",pct:56,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:38},{name:"India",pct:12},{name:"United Kingdom",pct:11},{name:"Canada",pct:8},{name:"Germany",pct:6}],
    },
    audiences:[
      {id:"te1",name:"Tech Enthusiasts & Early Adopters",type:"interest",size:4600000,ctr:2.2,convRate:1.8,spend:720},
      {id:"te2",name:"Adults 18–34 Tech Buyers",type:"demographic",size:5800000,ctr:2.0,convRate:2.0,spend:580},
      {id:"te3",name:"Gadget & Device Keywords",type:"keyword",size:2400000,ctr:1.9,convRate:1.5,spend:340},
      {id:"te4",name:"Lookalike — High-Value Buyers",type:"lookalike",size:2700000,ctr:2.6,convRate:2.3,spend:460},
      {id:"te5",name:"Product Page Visitors (7d)",type:"retargeting",size:33000,ctr:4.8,convRate:5.8,spend:280},
    ],
  },
  {
    label: "Business & Finance",
    keywords: ["business","entrepreneur","startup","finance","investing","money","income","passive income","side hustle","freelance","online business","ecommerce","dropshipping","amazon fba","etsy","stock","crypto","budget","saving","debt","financial freedom","wealth","credit","mortgage","real estate","property","marketing","social media marketing","branding","sales","lead generation","email marketing"],
    broad:"9.8M", targeted:"2.5M", highIntent:"500K",
    demographics: {
      age:[{label:"18–24",pct:20},{label:"25–34",pct:42},{label:"35–44",pct:24},{label:"45–54",pct:10},{label:"55+",pct:4}],
      gender:[{label:"Women",pct:52,color:"bg-pink-400"},{label:"Men",pct:42,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:45},{name:"United Kingdom",pct:12},{name:"Canada",pct:9},{name:"India",pct:8},{name:"Australia",pct:6}],
    },
    audiences:[
      {id:"bu1",name:"Entrepreneurs & Business Owners",type:"interest",size:3100000,ctr:2.0,convRate:1.6,spend:580},
      {id:"bu2",name:"Adults 25–44 Income Seekers",type:"demographic",size:4200000,ctr:1.8,convRate:1.9,spend:450},
      {id:"bu3",name:"Business & Finance Keywords",type:"keyword",size:1600000,ctr:1.7,convRate:1.4,spend:270},
      {id:"bu4",name:"Lookalike — Course Buyers",type:"lookalike",size:1900000,ctr:2.4,convRate:2.0,spend:360},
      {id:"bu5",name:"Sales Page Visitors (7d)",type:"retargeting",size:18000,ctr:4.6,convRate:5.4,spend:200},
    ],
  },
  {
    label: "Education & Learning",
    keywords: ["education","learning","study","school","college","university","course","online course","skill","certificate","degree","tutoring","homework","exam","test prep","language","spanish","french","english","math","science","history","reading","book","e-learning","udemy","coursera","masterclass","workshop","webinar","training","professional development","resume","career"],
    broad:"9.6M", targeted:"2.4M", highIntent:"480K",
    demographics: {
      age:[{label:"18–24",pct:36},{label:"25–34",pct:34},{label:"35–44",pct:18},{label:"45–54",pct:8},{label:"55+",pct:4}],
      gender:[{label:"Women",pct:57,color:"bg-pink-400"},{label:"Men",pct:37,color:"bg-blue-400"},{label:"Unspecified",pct:6,color:"bg-gray-300"}],
      locations:[{name:"United States",pct:36},{name:"India",pct:14},{name:"United Kingdom",pct:11},{name:"Canada",pct:8},{name:"Australia",pct:6}],
    },
    audiences:[
      {id:"e1",name:"Lifelong Learners",type:"interest",size:3400000,ctr:2.1,convRate:1.5,spend:420},
      {id:"e2",name:"Students & Young Professionals",type:"demographic",size:4800000,ctr:1.9,convRate:1.7,spend:340},
      {id:"e3",name:"Course & Learning Keywords",type:"keyword",size:1500000,ctr:1.8,convRate:1.3,spend:200},
      {id:"e4",name:"Lookalike — Course Completers",type:"lookalike",size:1700000,ctr:2.3,convRate:1.8,spend:290},
      {id:"e5",name:"Landing Page Visitors (14d)",type:"retargeting",size:16000,ctr:4.0,convRate:4.8,spend:150},
    ],
  },
];

// Tokenise input into words, score each niche by keyword hits
function classifyNiche(input: string): NicheDef | null {
  if (!input.trim()) return null;
  const lower = input.toLowerCase();
  let best: NicheDef | null = null;
  let bestScore = 0;
  for (const niche of NICHES) {
    let score = 0;
    for (const kw of niche.keywords) {
      if (lower.includes(kw)) score += kw.split(" ").length; // multi-word phrases score higher
    }
    if (score > bestScore) { bestScore = score; best = niche; }
  }
  return best;
}

// Default demographics shown before any search
const DEFAULT_DEMOGRAPHICS = {
  age:[{label:"18–24",pct:28},{label:"25–34",pct:38},{label:"35–44",pct:19},{label:"45–54",pct:10},{label:"55+",pct:5}],
  gender:[{label:"Women",pct:71,color:"bg-pink-400"},{label:"Men",pct:22,color:"bg-blue-400"},{label:"Unspecified",pct:7,color:"bg-gray-300"}],
  locations:[{name:"United States",pct:38},{name:"United Kingdom",pct:14},{name:"Canada",pct:11},{name:"Australia",pct:8},{name:"Germany",pct:6}],
};

function AudiencePlanning() {
  const [query, setQuery] = useState("");
  const [matched, setMatched] = useState<NicheDef | null>(null);

  const demographics = matched?.demographics ?? DEFAULT_DEMOGRAPHICS;
  const audiences = matched?.audiences ?? (MOCK_AUDIENCES as unknown as AudienceRow[]);

  return (
    <div className="space-y-5">
      {/* Audience Estimator */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Audience Size Estimator</h3>
        <p className="text-sm text-gray-500 mb-4">Enter any keyword or niche — we&apos;ll identify the market and show matching audience data.</p>
        <div className="flex gap-3">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setMatched(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) setMatched(classifyNiche(query.trim())); }}
            placeholder="e.g. women's activewear, organic dog food, watercolor tutorial..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
          />
          <button
            onClick={() => { if (query.trim()) setMatched(classifyNiche(query.trim())); }}
            disabled={!query.trim()}
            className="bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Estimate
          </button>
        </div>
        {matched && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">Identified niche:</span>
              <span className="bg-[#e60023]/10 text-[#e60023] text-xs font-semibold px-2.5 py-0.5 rounded-full">{matched.label}</span>
              <span className="text-xs text-gray-400">for &quot;{query}&quot;</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Broad Audience", size: matched.broad, desc: "Interest-based reach", color: "bg-blue-50 border-blue-100" },
                { label: "Targeted Audience", size: matched.targeted, desc: "Keyword + interest match", color: "bg-purple-50 border-purple-100" },
                { label: "High-Intent Audience", size: matched.highIntent, desc: "Retargeting + lookalike", color: "bg-green-50 border-green-100" },
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

      {/* Demographic Insights — updates with niche */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Demographic Insights</h3>
          {matched && <span className="text-xs text-gray-400">{matched.label}</span>}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Age Distribution</div>
            {demographics.age.map(({ label, pct }) => (
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
            <div className="space-y-3">
              {demographics.gender.map(({ label, pct, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-20">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8">{pct}%</span>
                </div>
              ))}
            </div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-5">Top Locations</div>
            {demographics.locations.map(({ name, pct }, i) => (
              <div key={name} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <span className="text-sm text-gray-700">{name}</span>
                </div>
                <span className="text-xs font-semibold text-gray-600">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audience Segments — updates with niche */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">
            Audience Segments
            {matched && <span className="ml-2 text-xs font-normal text-gray-400">— {matched.label}</span>}
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
              {audiences.map((aud) => (
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
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 w-12">{formatNumber(aud.size)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[40px]">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (aud.size / 10000000) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full",
                      aud.ctr >= 4 ? "bg-green-100 text-green-700" :
                      aud.ctr >= 2.5 ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    )}>
                      {aud.ctr >= 4 ? "🔥" : aud.ctr >= 2.5 ? "📈" : "📊"} {aud.ctr}%
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full",
                      aud.convRate >= 5 ? "bg-emerald-100 text-emerald-700" :
                      aud.convRate >= 2.5 ? "bg-green-100 text-green-700" :
                      aud.convRate >= 1.5 ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-500"
                    )}>
                      {aud.convRate >= 5 ? "⭐" : aud.convRate >= 2.5 ? "✅" : "➡️"} {aud.convRate}%
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: `hsl(${Math.max(0, 120 - (aud.spend / 10))} 60% 45%)` }} />
                      <span className="text-sm font-semibold text-gray-800">${aud.spend}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Keyword generator ───────────────────────────────────────────────────────
interface KwRow { keyword: string; volume: number; competition: "low"|"medium"|"high"; suggestedBid: number; difficulty: number; type: "exact"|"phrase"|"broad"; }

function generateKeywords(seed: string): { positive: KwRow[]; negative: string[] } {
  const s = seed.toLowerCase().trim();
  const niche = classifyNiche(s);

  // Build 12 keyword variations from the seed
  type Mod = [string, KwRow["competition"], number, number, KwRow["type"]];
  const modifiers: Mod[] = [
    ["ideas", "high", 0.9, 68, "broad"],
    ["inspiration", "high", 0.85, 65, "broad"],
    ["on a budget", "low", 0.38, 28, "phrase"],
    ["aesthetic", "medium", 0.72, 50, "broad"],
    ["for beginners", "low", 0.42, 32, "phrase"],
    ["diy", "medium", 0.65, 46, "phrase"],
    ["2025", "medium", 0.60, 42, "exact"],
    ["tips", "medium", 0.55, 38, "phrase"],
    ["tutorial", "low", 0.45, 34, "phrase"],
    ["cheap", "low", 0.32, 24, "phrase"],
    ["best", "high", 0.95, 72, "exact"],
    ["how to", "medium", 0.58, 40, "broad"],
  ];

  // Seed-based pseudo-random for volume variety
  const hash = (str: string, i: number) => {
    let h = 0;
    for (const c of str + i) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return Math.abs(h);
  };

  const baseVolume = niche
    ? parseInt(niche.broad.replace(/[^0-9]/g, "")) * (niche.broad.includes("M") ? 50000 : 5000)
    : 400000;

  const posRaw: KwRow[] = modifiers.map((mod, i): KwRow => ({
    keyword: `${s} ${mod[0]}`,
    volume: Math.round((hash(s, i) % 800000) + 80000),
    competition: mod[1],
    suggestedBid: mod[2] + (hash(s, i) % 30) / 100,
    difficulty: mod[3] + (hash(s, i) % 10) - 5,
    type: mod[4],
  }));
  const seedRow: KwRow = { keyword: s, volume: Math.round(baseVolume * 0.6), competition: "high", suggestedBid: 1.10, difficulty: 70, type: "exact" };
  const positive: KwRow[] = [seedRow, ...posRaw].sort((a, b) => b.volume - a.volume);

  // Generate niche-relevant negative keywords
  const negMap: Record<string, string[]> = {
    "Fashion & Clothing": ["free clothes", "thrift store near me", "clothing donation", "cheap knock off"],
    "Home Decor & Interior": ["free furniture", "rental furniture", "furniture disposal", "second hand"],
    "Beauty & Makeup": ["free samples", "diy cheap makeup", "cosmetic surgery", "free beauty products"],
    "Food & Recipes": ["free food", "food bank", "restaurant jobs", "food delivery driver"],
    "Fitness & Wellness": ["gym jobs", "free gym membership", "fitness instructor course", "personal trainer salary"],
    "Travel & Adventure": ["travel nursing", "travel jobs", "working holiday visa", "travel grants"],
    "Wedding & Events": ["free wedding venues", "elope", "wedding cancellation", "divorce"],
    "Parenting & Kids": ["childcare jobs", "babysitter rates", "school fees", "child support"],
    "DIY & Crafts": ["free craft supplies", "craft store jobs", "craft fair vendor", "how to sell crafts"],
    "Gardening & Plants": ["gardening jobs", "plant disposal", "free compost", "landscaping jobs"],
    "Pets & Animals": ["pet adoption", "animal shelter jobs", "free pet food", "vet school"],
    "Technology & Gadgets": ["tech jobs", "free software", "open source", "tech support jobs"],
    "Business & Finance": ["free business grants", "bankruptcy", "debt relief", "business failure"],
    "Education & Learning": ["free courses", "scholarship application", "student loans", "teaching jobs"],
  };
  const negative = negMap[niche?.label ?? ""] ?? ["free", "cheap knockoff", "diy only", "no budget", "tutorial only"];

  return { positive, negative };
}

function KeywordPlanning() {
  const [kwSearch, setKwSearch] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [liveKeywords, setLiveKeywords] = useState<KwRow[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const defaultPositive = KEYWORD_PLAN.filter((k) => !k.negative) as KwRow[];
  const defaultNegative = KEYWORD_PLAN.filter((k) => k.negative).map(k => k.keyword);

  const generated = searched ? generateKeywords(searched) : { positive: defaultPositive, negative: defaultNegative };

  const positive = (liveKeywords && liveKeywords.length > 0) ? liveKeywords : generated.positive;
  const negative = generated.negative;

  const niche = searched ? classifyNiche(searched) : null;

  const doSearch = async () => {
    const q = kwSearch.trim();
    if (!q) return;
    setSearched(q);
    setLiveKeywords(null);
    setIsLive(false);
    setFetching(true);
    try {
      const res = await fetch(`/api/pinterest-keywords?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.keywords) && data.keywords.length > 0) {
          // Map Pinterest API response to KwRow shape
          const rows: KwRow[] = data.keywords.map((k: { keyword: string; monthlySearches: number | null; competition: string | null; suggestedBid: number | null }, i: number) => ({
            keyword: k.keyword,
            volume: k.monthlySearches ?? 0,
            competition: (["low","medium","high"].includes(k.competition ?? "") ? k.competition : "medium") as KwRow["competition"],
            suggestedBid: k.suggestedBid ?? 0.5,
            difficulty: Math.round(30 + (i % 4) * 15),
            type: (i === 0 ? "exact" : i % 3 === 0 ? "broad" : "phrase") as KwRow["type"],
          }));
          setLiveKeywords(rows);
          setIsLive(true);
        }
      }
    } catch {
      // fall through to generated data
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Keyword Research</h3>
        <p className="text-sm text-gray-500 mb-4">Enter a product, niche, or topic to get keyword recommendations tailored to your campaign.</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={kwSearch}
              onChange={e => { setKwSearch(e.target.value); setSearched(null); }}
              onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
              placeholder="e.g. yoga mat, boho wall art, keto snacks, wedding bouquet..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e60023]/20 focus:border-[#e60023]"
            />
          </div>
          <button
            onClick={doSearch}
            disabled={!kwSearch.trim() || fetching}
            className="bg-[#e60023] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#ad081b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {fetching ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            {fetching ? "Searching..." : "Find Keywords"}
          </button>
        </div>
        {niche && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span>Identified niche:</span>
            <span className="bg-[#e60023]/10 text-[#e60023] font-semibold px-2 py-0.5 rounded-full">{niche.label}</span>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">
                Keyword Recommendations
                {searched && <span className="ml-2 text-xs font-normal text-gray-400">for &quot;{searched}&quot;</span>}
              </h3>
              {searched && (
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                  isLive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                )}>
                  {isLive ? "● Live" : "○ Generated"}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {isLive ? "Real data from Pinterest Ads API." : "Estimated data — connect Pinterest Ads for live results."}
            </p>
          </div>
          <button
            onClick={() => setAdded(new Set(positive.map(k => k.keyword)))}
            className="text-sm text-[#e60023] font-medium border border-[#e60023]/30 px-3 py-1.5 rounded-lg hover:bg-[#e60023]/5 transition-colors"
          >
            + Add All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {["Keyword", "Match", "Volume", "Difficulty", "Competition", "Bid", ""].map((h) => (
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
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 w-16">{formatNumber(kw.volume)}</span>
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (kw.volume / 2500000) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><DifficultyBar score={kw.difficulty} /></td>
                  <td className="px-3 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold capitalize", COMP_COLOR[kw.competition])}>{kw.competition}</span>
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-800">${kw.suggestedBid.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setAdded(prev => { const n = new Set(prev); n.has(kw.keyword) ? n.delete(kw.keyword) : n.add(kw.keyword); return n; })}
                      className={cn("text-xs font-semibold px-2 py-0.5 rounded-lg transition-colors",
                        added.has(kw.keyword) ? "bg-green-100 text-green-700" : "text-[#e60023] hover:bg-[#e60023]/5"
                      )}
                    >
                      {added.has(kw.keyword) ? "✓ Added" : "+ Add"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Negative Keywords */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Suggested Negative Keywords</h3>
        <p className="text-sm text-gray-500 mb-4">Exclude these to avoid wasted spend on irrelevant searches.</p>
        <div className="flex flex-wrap gap-2">
          {negative.map((kw) => (
            <div key={kw} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs px-3 py-1.5 rounded-full font-medium">
              <span>− {kw}</span>
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
