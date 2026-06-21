export const PINTEREST_CATEGORIES = [
  {
    id: "home",
    name: "Home Decor",
    icon: "🏠",
    subcategories: [
      "Room Decor",
      "Home Decor Style",
      "Wall",
      "Furniture",
      "Storage and Organization",
      "Lighting",
      "Flooring",
      "Home Maintenance",
      "Home Accessories",
      "Door",
      "Exterior",
      "Remodel",
      "Entrance",
      "Stairs",
      "Window Treatment",
      "Home Decor Tips",
      "Home Painting",
    ],
  },
  {
    id: "travel",
    name: "Travel",
    icon: "✈️",
    subcategories: [
      "Travel Destinations",
      "Travel Ideas",
      "Travel Tips",
      "Restaurant",
    ],
  },
  {
    id: "health",
    name: "Health",
    icon: "💪",
    subcategories: [
      "Diet and Nutrition",
      "Lifestyle",
      "Medical",
      "Weight Loss",
    ],
  },
  {
    id: "food",
    name: "Food & Drinks",
    icon: "🍽️",
    subcategories: [
      "Meal Planning",
      "Desserts",
      "Fruit",
      "Appetizers",
      "Drinks",
      "World Cuisine",
      "Salad",
      "Special Diet",
      "Cooking Method",
      "Bread",
      "Snacks",
      "Meat",
      "Soup",
      "Condiments",
      "Pizza",
      "Sandwich",
      "Seafood",
      "Vegetables",
      "Food for Special Event",
    ],
  },
  {
    id: "parenting",
    name: "Parenting",
    icon: "👶",
    subcategories: [
      "Toys",
      "Baby",
      "Family Activities",
      "Parenting Advice",
      "Toddlers and Preschoolers",
    ],
  },
  {
    id: "gardening",
    name: "Gardening",
    icon: "🌱",
    subcategories: [
      "Planting",
      "Garden Types",
      "Garden Design",
      "Gardening Supplies",
    ],
  },
  {
    id: "events",
    name: "Event Planning",
    icon: "🎉",
    subcategories: [
      "Holiday",
      "Personal Celebration",
      "Gifts",
      "Hosting Occasions",
      "School Celebration",
    ],
  },
  {
    id: "art",
    name: "Art",
    icon: "🎨",
    subcategories: [
      "Painting",
      "Drawing",
      "Photography",
      "Street Art",
      "Body Art",
      "Art Supplies",
      "Art Tutorial",
      "Illustration",
      "Mosaic",
      "Fashion Design",
      "Ceramic Art",
      "Digital Art",
      "Fonts and Calligraphy",
      "Rock Art",
      "Metal Art",
      "Mixed Media Art",
      "Poster Design",
    ],
  },
  {
    id: "womens-fashion",
    name: "Women's Fashion",
    icon: "👗",
    subcategories: [
      "Women's Shoes",
      "Women's Jewelry and Accessories",
      "Women's Bottoms",
      "Dress",
      "Women's Style",
      "Women's Bag",
      "Women's Outfits by Occasions",
      "Women's Activewear",
      "Women's Intimates",
      "Women's Top",
      "Women's Outerwear",
      "Jumpsuits and Romper",
    ],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: "🎬",
    subcategories: [
      "Humor",
      "Comics",
      "Movie",
      "Music",
      "Celebrities",
      "Gaming",
      "Book",
      "TV Show",
      "Theater",
    ],
  },
  {
    id: "diy",
    name: "DIY and Crafts",
    icon: "🛠️",
    subcategories: [
      "Fabric Crafts",
      "DIY Projects",
      "Woodworking",
      "DIY Stationery",
      "DIY Event",
      "DIY Home and Decorations",
      "DIY Pottery",
      "DIY Bag and Purse",
      "DIY Techniques and Supplies",
      "Polymer Crafts",
      "DIY Edible",
      "DIY Jewelry",
      "Beading",
      "DIY Beauty",
    ],
  },
  {
    id: "beauty",
    name: "Beauty",
    icon: "💄",
    subcategories: [
      "Hair",
      "Skin Care",
      "Bath and Body Care",
      "Nails",
      "Makeup",
      "Fragrance",
    ],
  },
  {
    id: "children-fashion",
    name: "Children Fashion",
    icon: "👦",
    subcategories: [
      "Teen Clothing",
      "Children Clothing",
      "Baby Clothing",
    ],
  },
  {
    id: "mens-fashion",
    name: "Men's Fashion",
    icon: "👔",
    subcategories: [
      "Men's Shirts and Top",
      "Men's Style",
      "Men's Outfit by Occasions",
      "Men's Shoes",
      "Men's Accessories",
    ],
  },
];

export const MOCK_KEYWORDS: Record<string, KeywordResult[]> = { default: [] };

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randComp(): "low" | "medium" | "high" {
  return (["low", "medium", "high"] as const)[rand(0, 2)];
}
function randCpc() {
  return parseFloat((Math.random() * 2.5 + 0.1).toFixed(2));
}
function randTrend() {
  return rand(-15, 45);
}

export function generateKeywords(query: string): KeywordResult[] {
  const base = query.toLowerCase().trim();
  const words = base.split(" ");
  const results: KeywordResult[] = [];
  const seen = new Set<string>();

  const add = (
    keyword: string,
    matchType: "broad" | "phrase" | "exact",
    volumeMin: number,
    volumeMax: number
  ) => {
    const kw = keyword.trim().toLowerCase();
    if (!kw || seen.has(kw)) return;
    seen.add(kw);
    results.push({
      keyword: kw,
      matchType,
      volume: rand(volumeMin, volumeMax),
      trend: randTrend(),
      competition: randComp(),
      category: "General",
      cpc: randCpc(),
    });
  };

  // ── EXACT MATCH (highest volume, tightest relevance) ──────────────────────
  add(base, "exact", 400000, 3000000);

  const exactModifiers = [
    "ideas", "inspiration", "aesthetic", "design", "style", "tutorial",
    "tips", "diy", "easy", "simple", "modern", "ideas 2024", "ideas 2025",
    "trends 2024", "trends 2025", "for beginners", "step by step",
  ];
  exactModifiers.forEach((m) => {
    add(`${base} ${m}`, "exact", 80000, 1200000);
    if (words.length === 1) add(`${m} ${base}`, "exact", 50000, 900000);
  });

  const exactPrefixes = [
    "best", "beautiful", "unique", "creative", "minimalist", "boho",
    "aesthetic", "cute", "elegant", "luxury", "budget", "diy",
  ];
  exactPrefixes.forEach((p) => add(`${p} ${base}`, "exact", 40000, 800000));

  const exactSuffixes = [
    "on a budget", "for small spaces", "on pinterest", "that are trending",
    "for home", "for bedroom", "for living room", "for women", "for men",
    "for kids", "for beginners", "that wow", "under $50", "ideas cheap",
  ];
  exactSuffixes.forEach((s) => add(`${base} ${s}`, "exact", 20000, 500000));

  // ── PHRASE MATCH (medium relevance, broader) ───────────────────────────────
  const phrasePrefixes = [
    "how to", "how to make", "how to style", "how to create", "how to diy",
    "what is", "best way to", "easy way to", "quick", "cheap", "affordable",
    "trendy", "popular", "viral", "aesthetic", "pinterest worthy",
  ];
  phrasePrefixes.forEach((p) => add(`${p} ${base}`, "phrase", 15000, 450000));

  const phraseSuffixes = [
    "ideas and inspiration", "design ideas", "style guide", "color palette",
    "mood board", "aesthetic board", "how to guide", "complete guide",
    "tips and tricks", "before and after", "transformation", "makeover",
    "inspo", "goals", "vibes", "look", "theme", "collection", "checklist",
    "hacks", "101", "for instagram", "photo ideas", "pin ideas",
  ];
  phraseSuffixes.forEach((s) => add(`${base} ${s}`, "phrase", 10000, 350000));

  // multi-word phrase expansions
  if (words.length > 1) {
    words.forEach((w, i) => {
      if (w.length < 3) return;
      const rest = words.filter((_, j) => j !== i).join(" ");
      add(`${rest} ${w} ideas`, "phrase", 8000, 200000);
      add(`best ${rest} ${w}`, "phrase", 5000, 150000);
    });
  } else {
    const topicExpanders = [
      "room", "bedroom", "living room", "kitchen", "bathroom", "garden",
      "outdoor", "indoor", "home", "office", "apartment", "small space",
      "wall", "floor", "ceiling",
    ];
    topicExpanders.forEach((t) => {
      add(`${base} ${t}`, "phrase", 10000, 400000);
      add(`${t} ${base}`, "phrase", 8000, 300000);
    });
  }

  // ── BROAD MATCH (loosest, highest reach) ──────────────────────────────────
  const broadSuffixes = [
    "photos", "pictures", "images", "wallpaper", "background", "quotes",
    "aesthetic quotes", "funny", "cute", "pretty", "beautiful", "amazing",
    "stunning", "gorgeous", "perfect", "dreamy", "cozy", "chic", "bold",
    "neutral", "colorful", "pastel", "dark", "light", "white", "black",
    "pink", "blue", "green", "gold", "silver", "rustic", "farmhouse",
    "scandinavian", "bohemian", "vintage", "retro", "classic", "modern",
    "contemporary", "industrial", "eclectic",
  ];
  broadSuffixes.forEach((s) => add(`${base} ${s}`, "broad", 5000, 250000));

  const broadCombos = [
    `${base} on a budget diy`,
    `cheap ${base} ideas that look expensive`,
    `pinterest ${base} board ideas`,
    `${base} board pinterest`,
    `easy ${base} for beginners tutorial`,
    `${base} inspiration board aesthetic`,
    `trending ${base} 2024 ideas`,
    `trending ${base} 2025 ideas`,
    `${base} ideas you haven't seen`,
    `unique ${base} nobody talks about`,
    `${base} that went viral on pinterest`,
    `affordable ${base} ideas`,
    `luxury ${base} ideas`,
    `minimalist ${base} aesthetic`,
    `${base} color scheme ideas`,
    `${base} layout ideas`,
    `${base} product recommendations`,
    `top ${base} pins`,
    `most saved ${base} pins`,
    `${base} mood board ideas`,
  ];
  broadCombos.forEach((kw) => add(kw, "broad", 3000, 120000));

  // seasonal / event variants
  const seasons = ["spring", "summer", "fall", "winter", "holiday", "christmas", "halloween"];
  seasons.forEach((s) => {
    add(`${s} ${base}`, "broad", 5000, 300000);
    add(`${base} for ${s}`, "broad", 3000, 200000);
  });

  return results;
}

export interface KeywordResult {
  keyword: string;
  matchType: "broad" | "phrase" | "exact";
  volume: number;
  trend: number;
  competition: "low" | "medium" | "high";
  category: string;
  cpc: number;
}

export const MOCK_COMPETITORS = [
  {
    id: "1",
    name: "HomeStyleCo",
    avatar: "HS",
    niche: "Home Decor",
    followers: 245000,
    monthlyImpressions: 12000000,
    adsRunning: 8,
    topKeywords: ["home decor ideas", "modern living room", "minimalist bedroom"],
    creatives: [
      { id: "a1", title: "Summer Home Refresh", format: "Standard", ctr: 3.2, spend: 1200, impressions: 450000, image: "🏠" },
      { id: "a2", title: "Cozy Winter Vibes", format: "Carousel", ctr: 4.1, spend: 2300, impressions: 780000, image: "🕯️" },
      { id: "a3", title: "Minimalist Kitchen", format: "Video", ctr: 5.8, spend: 3400, impressions: 1200000, image: "🍳" },
    ],
  },
  {
    id: "2",
    name: "FashionForwardBrand",
    avatar: "FF",
    niche: "Fashion",
    followers: 189000,
    monthlyImpressions: 8500000,
    adsRunning: 12,
    topKeywords: ["summer outfits", "women's fashion 2024", "boho style"],
    creatives: [
      { id: "b1", title: "Summer Collection Drop", format: "Video", ctr: 6.2, spend: 4500, impressions: 2100000, image: "👗" },
      { id: "b2", title: "OOTD Inspo", format: "Standard", ctr: 2.8, spend: 800, impressions: 320000, image: "✨" },
      { id: "b3", title: "Accessories Haul", format: "Carousel", ctr: 3.9, spend: 1600, impressions: 690000, image: "👜" },
    ],
  },
  {
    id: "3",
    name: "FitLifeStudio",
    avatar: "FL",
    niche: "Fitness",
    followers: 312000,
    monthlyImpressions: 15000000,
    adsRunning: 6,
    topKeywords: ["workout routine", "weight loss tips", "gym motivation"],
    creatives: [
      { id: "c1", title: "30-Day Challenge", format: "Standard", ctr: 7.1, spend: 5200, impressions: 3400000, image: "💪" },
      { id: "c2", title: "Healthy Meal Plan", format: "Carousel", ctr: 4.5, spend: 2100, impressions: 980000, image: "🥗" },
      { id: "c3", title: "Morning Routine", format: "Video", ctr: 8.2, spend: 6800, impressions: 4200000, image: "🌅" },
    ],
  },
];

export const MOCK_SCHEDULED_PINS = [
  { id: "1", title: "Summer Home Refresh Ideas", board: "Home Decor", scheduledAt: "2026-06-21T10:00:00", status: "scheduled", imageUrl: "🏠" },
  { id: "2", title: "Healthy Breakfast Recipes", board: "Food & Recipes", scheduledAt: "2026-06-21T14:00:00", status: "scheduled", imageUrl: "🥗" },
  { id: "3", title: "Workout Tips for Beginners", board: "Fitness", scheduledAt: "2026-06-22T09:00:00", status: "scheduled", imageUrl: "💪" },
  { id: "4", title: "Minimalist Bedroom Design", board: "Interior Design", scheduledAt: "2026-06-20T11:00:00", status: "published", imageUrl: "🛏️" },
  { id: "5", title: "DIY Wall Art Tutorial", board: "DIY & Crafts", scheduledAt: "2026-06-19T15:00:00", status: "published", imageUrl: "🎨" },
];

export const AD_OBJECTIVES = [
  { id: "awareness", label: "Brand Awareness", description: "Reach more people and increase brand recognition", icon: "👁️" },
  { id: "traffic", label: "Traffic", description: "Drive visitors to your website or landing page", icon: "🌐" },
  { id: "conversions", label: "Conversions", description: "Get more purchases, sign-ups, or leads", icon: "🎯" },
  { id: "video_views", label: "Video Views", description: "Maximize views on your video content", icon: "▶️" },
  { id: "catalog", label: "Catalog Sales", description: "Show ads from your product catalog", icon: "🛍️" },
];
