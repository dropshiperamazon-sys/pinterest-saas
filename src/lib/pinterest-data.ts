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

// Synonym/related concept map used to generate true broad match variants
// Broad match can show for related searches that don't contain the original keyword words
const SYNONYM_MAP: Record<string, string[]> = {
  "home decor": ["interior design", "house decorating", "home styling", "room decoration", "home furnishing", "house interior"],
  "room decor": ["bedroom styling", "living space design", "room makeover", "interior decoration", "space styling"],
  "furniture": ["home furnishings", "sofas and chairs", "home accessories", "decor pieces", "household items"],
  "recipes": ["cooking ideas", "meal ideas", "dishes to make", "food preparation", "kitchen inspiration"],
  "desserts": ["sweets", "baked goods", "pastries", "cakes and cookies", "confections", "treats"],
  "healthy eating": ["clean eating", "nutritious meals", "diet food", "wellness food", "balanced diet"],
  "outfits": ["clothing ideas", "style looks", "fashion inspo", "what to wear", "wardrobe ideas", "ootd"],
  "shoes": ["footwear", "sneakers", "heels", "boots", "sandals", "kicks"],
  "dress": ["gowns", "frocks", "maxi dress", "midi dress", "evening wear", "sundress"],
  "workout": ["exercise routine", "fitness training", "gym session", "physical training", "fitness routine"],
  "weight loss": ["fat burning", "slimming tips", "body transformation", "calorie deficit", "getting fit"],
  "makeup": ["cosmetics", "beauty looks", "face beat", "glam look", "beauty routine", "beauty products"],
  "skin care": ["skincare routine", "complexion care", "facial care", "beauty regimen", "glow routine", "face routine"],
  "hair": ["hairstyle", "hair care", "hair look", "tresses", "mane styling", "hairdo"],
  "travel": ["vacation ideas", "trip inspiration", "holiday destinations", "getaway ideas", "wanderlust"],
  "travel destinations": ["places to visit", "vacation spots", "holiday locations", "travel bucket list", "places to go"],
  "painting": ["canvas art", "acrylic art", "fine art", "artwork", "painted pieces"],
  "drawing": ["sketching", "illustration", "pencil art", "line art", "doodle art"],
  "gardening": ["plant care", "growing plants", "garden ideas", "backyard landscaping", "green thumb tips"],
  "diy projects": ["craft ideas", "handmade projects", "creative making", "home projects", "upcycling ideas"],
  "woodworking": ["carpentry", "wood crafts", "timber projects", "wood building", "furniture making"],
  "nails": ["nail art", "manicure ideas", "nail designs", "gel nails", "nail polish"],
  "wedding": ["bridal inspiration", "wedding planning", "nuptials", "marriage ceremony", "bridal ideas"],
  "baby": ["newborn care", "infant ideas", "baby shower", "nursery ideas", "baby products"],
  "tattoo": ["body art", "ink designs", "tattoo ideas", "tattooing", "body tattoo"],
  "quotes": ["inspirational sayings", "motivational words", "life quotes", "wisdom sayings", "affirmations"],
};

function getSynonyms(base: string): string[] {
  const lower = base.toLowerCase();
  if (SYNONYM_MAP[lower]) return SYNONYM_MAP[lower];
  for (const key of Object.keys(SYNONYM_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return SYNONYM_MAP[key];
  }
  // Generic fallback synonyms built from the keyword's root word
  const root = lower.split(" ")[0];
  return [
    `${root} inspiration`,
    `${root} guide`,
    `${root} trends`,
    `${root} aesthetic`,
    `${root} inspo`,
    `${root} style`,
    `types of ${root}`,
    `popular ${root}`,
  ];
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
    const kw = keyword.trim().toLowerCase().replace(/\s+/g, " ");
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

  // ── EXACT MATCH ────────────────────────────────────────────────────────────
  // Shows when a search has the same meaning or intent as the keyword.
  // Includes: the keyword itself, plurals/singulars, minor reordering, close variants.
  add(base, "exact", 400000, 3000000);

  // Plural/singular variants (same intent)
  if (!base.endsWith("s")) add(`${base}s`, "exact", 150000, 1200000);
  if (base.endsWith("s")) add(base.slice(0, -1), "exact", 150000, 1200000);
  if (base.endsWith("ing")) add(base.replace(/ing$/, ""), "exact", 80000, 600000);
  if (!base.endsWith("ing") && words.length === 1) add(`${base}ing`, "exact", 60000, 500000);

  // Word reorder variants (same meaning, different phrasing)
  if (words.length === 2) {
    add(`${words[1]} ${words[0]}`, "exact", 100000, 800000);
  }
  if (words.length === 3) {
    add(`${words[1]} ${words[0]} ${words[2]}`, "exact", 60000, 500000);
    add(`${words[2]} ${words[1]} ${words[0]}`, "exact", 40000, 300000);
  }

  // Close variants — keyword + a word that keeps the same core intent
  // e.g. [running shoes] → "running shoes" / "running shoe" / "run shoes"
  const exactCloseSuffixes = [
    "ideas", "inspiration", "aesthetic", "design", "style", "styles",
    "tutorial", "tips", "diy", "2024", "2025", "trends", "trend",
    "pictures", "photos", "images", "wallpaper",
  ];
  exactCloseSuffixes.forEach((m) => add(`${base} ${m}`, "exact", 50000, 900000));

  // ── PHRASE MATCH ──────────────────────────────────────────────────────────
  // Ad shows when search CONTAINS the keyword meaning, with extra words before or after.
  // e.g. "running shoes" → "best running shoes for women", "cheap running shoes 2024"

  // Words added BEFORE the keyword
  const phraseBefore = [
    "best", "beautiful", "unique", "creative", "minimalist", "modern", "simple",
    "easy", "cheap", "affordable", "luxury", "elegant", "cute", "pretty",
    "aesthetic", "trending", "popular", "viral", "boho", "rustic", "cozy",
    "chic", "classic", "bold", "dreamy", "stunning", "gorgeous", "perfect",
    "quick", "diy", "homemade", "budget friendly", "professional", "top",
  ];
  phraseBefore.forEach((p) => add(`${p} ${base}`, "phrase", 20000, 700000));

  // Words added AFTER the keyword
  const phraseAfter = [
    "for women", "for men", "for kids", "for beginners", "for home",
    "for bedroom", "for living room", "for kitchen", "for apartment",
    "for small spaces", "on a budget", "step by step", "that are trending",
    "color palette", "mood board", "inspo board", "style guide",
    "before and after", "transformation", "makeover", "checklist",
    "tips and tricks", "hacks", "guide", "complete guide",
    "ideas and inspiration", "design ideas", "how to guide",
    "for instagram", "that went viral", "you need to try",
    "for spring", "for summer", "for fall", "for winter",
    "for christmas", "for halloween", "for thanksgiving",
    "under 50 dollars", "under 100 dollars", "ideas 2024", "ideas 2025",
    "trends 2024", "trends 2025", "nobody talks about",
  ];
  phraseAfter.forEach((s) => add(`${base} ${s}`, "phrase", 8000, 450000));

  // Combos: words before AND after (still contains keyword in the middle)
  const phraseCombos = [
    `best ${base} ideas`,
    `easy ${base} for beginners`,
    `cheap ${base} that look expensive`,
    `beautiful ${base} on a budget`,
    `modern ${base} design ideas`,
    `minimalist ${base} aesthetic`,
    `cozy ${base} vibes`,
    `aesthetic ${base} inspo`,
    `trending ${base} ideas 2024`,
    `trending ${base} ideas 2025`,
    `unique ${base} nobody has seen`,
    `diy ${base} step by step`,
    `luxury ${base} ideas`,
    `simple ${base} for small spaces`,
    `creative ${base} tutorial`,
    `gorgeous ${base} inspiration`,
    `budget friendly ${base} ideas`,
    `most popular ${base} on pinterest`,
    `viral ${base} ideas`,
    `cute ${base} for beginners`,
  ];
  phraseCombos.forEach((v) => add(v, "phrase", 5000, 280000));

  // ── BROAD MATCH ───────────────────────────────────────────────────────────
  // Ads can show for related searches, synonyms, and similar concepts.
  // These do NOT necessarily contain the original keyword words.
  // e.g. "running shoes" → "jogging sneakers", "athletic footwear", "sports shoes"

  const synonyms = getSynonyms(base);

  // Synonym keywords on their own (the core of true broad match)
  synonyms.forEach((s) => {
    add(s, "broad", 15000, 700000);
    add(`${s} ideas`, "broad", 8000, 400000);
    add(`${s} inspiration`, "broad", 6000, 300000);
    add(`best ${s}`, "broad", 5000, 250000);
    add(`${s} aesthetic`, "broad", 4000, 200000);
    add(`${s} tips`, "broad", 3000, 180000);
    add(`${s} 2024`, "broad", 3000, 150000);
    add(`${s} 2025`, "broad", 2000, 120000);
    add(`${s} for beginners`, "broad", 2000, 100000);
    add(`${s} on a budget`, "broad", 2000, 90000);
  });

  // Related intent / category-level concepts (broader audience discovery)
  const broadRelated = [
    `pinterest ${base} board`,
    `${base} mood board`,
    `most saved ${base} pins`,
    `${base} pin ideas`,
    `${base} board aesthetic`,
    `how to start ${base}`,
    `${base} for your home`,
    `${base} influencer favorites`,
    `${base} celebrity style`,
    `what is ${base}`,
    `${base} meaning`,
    `${base} examples`,
    `${base} 101`,
    `types of ${base}`,
    `${base} brands`,
    `${base} products`,
    `where to buy ${base}`,
    `${base} shopping ideas`,
  ];
  broadRelated.forEach((v) => add(v, "broad", 1500, 160000));

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
