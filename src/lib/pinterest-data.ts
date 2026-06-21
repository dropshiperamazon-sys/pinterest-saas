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

// ── PIN ANALYSIS DATA ─────────────────────────────────────────────────────────

export interface PinData {
  id: string;
  title: string;
  description: string;
  imageEmoji: string;
  pinUrl: string;
  boardName: string;
  creatorName: string;
  creatorHandle: string;
  postedAt: string;
  saves: number;
  clicks: number;
  impressions: number;
  closeups: number;
  keywords: { keyword: string; matchType: "exact" | "phrase" | "broad" }[];
  category: string;
  format: "standard" | "video" | "carousel" | "idea";
  engagementRate: number;
}

export const MOCK_PINS: PinData[] = [
  {
    id: "pin_001",
    title: "20 Minimalist Bedroom Ideas That Feel Like a 5-Star Hotel",
    description: "Transform your bedroom into a serene retreat with these minimalist design ideas. From neutral palettes to clean-lined furniture, discover how to create a hotel-worthy bedroom at home.",
    imageEmoji: "🛏️",
    pinUrl: "https://pinterest.com/pin/001",
    boardName: "Bedroom Inspo",
    creatorName: "Home Style Co",
    creatorHandle: "@homestyleco",
    postedAt: "2026-04-12T09:00:00",
    saves: 284500,
    clicks: 62100,
    impressions: 4200000,
    closeups: 189000,
    engagementRate: 6.78,
    category: "Home Decor",
    format: "standard",
    keywords: [
      { keyword: "minimalist bedroom", matchType: "exact" },
      { keyword: "bedroom ideas", matchType: "exact" },
      { keyword: "minimalist bedroom aesthetic", matchType: "exact" },
      { keyword: "bedroom decor ideas", matchType: "phrase" },
      { keyword: "hotel bedroom style", matchType: "phrase" },
      { keyword: "neutral bedroom design", matchType: "phrase" },
      { keyword: "cozy bedroom ideas", matchType: "phrase" },
      { keyword: "bedroom inspo", matchType: "phrase" },
      { keyword: "interior design", matchType: "broad" },
      { keyword: "room makeover", matchType: "broad" },
      { keyword: "home styling", matchType: "broad" },
    ],
  },
  {
    id: "pin_002",
    title: "Quick 30-Minute Healthy Dinner Recipes for Busy Weeknights",
    description: "Eating healthy doesn't have to take hours. These 30-minute dinner recipes are nutritious, delicious, and perfect for busy weeknights. Meal prep friendly!",
    imageEmoji: "🥗",
    pinUrl: "https://pinterest.com/pin/002",
    boardName: "Healthy Eating",
    creatorName: "Nourish Kitchen",
    creatorHandle: "@nourishkitchen",
    postedAt: "2026-03-28T12:00:00",
    saves: 412000,
    clicks: 98400,
    impressions: 6800000,
    closeups: 312000,
    engagementRate: 6.05,
    category: "Food & Drinks",
    format: "carousel",
    keywords: [
      { keyword: "healthy dinner recipes", matchType: "exact" },
      { keyword: "quick dinner recipes", matchType: "exact" },
      { keyword: "30 minute meals", matchType: "exact" },
      { keyword: "healthy recipes for dinner", matchType: "phrase" },
      { keyword: "easy weeknight dinners", matchType: "phrase" },
      { keyword: "meal prep ideas", matchType: "phrase" },
      { keyword: "healthy meal prep", matchType: "phrase" },
      { keyword: "dinner ideas for family", matchType: "phrase" },
      { keyword: "clean eating", matchType: "broad" },
      { keyword: "nutritious meals", matchType: "broad" },
      { keyword: "cooking ideas", matchType: "broad" },
    ],
  },
  {
    id: "pin_003",
    title: "Summer Outfit Ideas 2025 — What to Wear This Season",
    description: "Stay stylish all summer long with these trending outfit ideas. From casual beach looks to chic street style, find your perfect summer wardrobe.",
    imageEmoji: "👗",
    pinUrl: "https://pinterest.com/pin/003",
    boardName: "Summer Fashion",
    creatorName: "Style Maven",
    creatorHandle: "@stylemaven",
    postedAt: "2026-05-02T10:30:00",
    saves: 198700,
    clicks: 44200,
    impressions: 3100000,
    closeups: 145000,
    engagementRate: 6.41,
    category: "Women's Fashion",
    format: "idea",
    keywords: [
      { keyword: "summer outfits 2025", matchType: "exact" },
      { keyword: "summer outfit ideas", matchType: "exact" },
      { keyword: "what to wear in summer", matchType: "exact" },
      { keyword: "summer fashion trends 2025", matchType: "phrase" },
      { keyword: "cute summer outfits", matchType: "phrase" },
      { keyword: "casual summer looks", matchType: "phrase" },
      { keyword: "beach outfit ideas", matchType: "phrase" },
      { keyword: "summer wardrobe essentials", matchType: "phrase" },
      { keyword: "fashion inspo", matchType: "broad" },
      { keyword: "clothing ideas", matchType: "broad" },
      { keyword: "ootd", matchType: "broad" },
    ],
  },
  {
    id: "pin_004",
    title: "DIY Garden Planters You Can Make This Weekend",
    description: "Spruce up your outdoor space with these easy and affordable DIY planter ideas. Made from wood pallets, terracotta, and recycled materials.",
    imageEmoji: "🌱",
    pinUrl: "https://pinterest.com/pin/004",
    boardName: "Garden Projects",
    creatorName: "Green Thumb Co",
    creatorHandle: "@greenthumbco",
    postedAt: "2026-02-14T08:00:00",
    saves: 156300,
    clicks: 31800,
    impressions: 2400000,
    closeups: 98200,
    engagementRate: 6.52,
    category: "Gardening",
    format: "standard",
    keywords: [
      { keyword: "diy garden planters", matchType: "exact" },
      { keyword: "garden planter ideas", matchType: "exact" },
      { keyword: "diy planters", matchType: "exact" },
      { keyword: "easy diy garden projects", matchType: "phrase" },
      { keyword: "garden decor ideas diy", matchType: "phrase" },
      { keyword: "outdoor planter ideas", matchType: "phrase" },
      { keyword: "diy patio decor", matchType: "phrase" },
      { keyword: "plant care", matchType: "broad" },
      { keyword: "backyard landscaping", matchType: "broad" },
      { keyword: "green thumb tips", matchType: "broad" },
    ],
  },
  {
    id: "pin_005",
    title: "10-Step Korean Skin Care Routine for Glowing Skin",
    description: "Achieve that iconic glass skin with a proper Korean skin care routine. Step-by-step guide including cleansers, toners, essences, and SPF.",
    imageEmoji: "✨",
    pinUrl: "https://pinterest.com/pin/005",
    boardName: "Skin Care Routine",
    creatorName: "Glow Labs",
    creatorHandle: "@glowlabs",
    postedAt: "2026-05-15T11:00:00",
    saves: 321000,
    clicks: 87600,
    impressions: 5400000,
    closeups: 241000,
    engagementRate: 5.94,
    category: "Beauty",
    format: "carousel",
    keywords: [
      { keyword: "korean skin care routine", matchType: "exact" },
      { keyword: "skin care routine", matchType: "exact" },
      { keyword: "glowing skin routine", matchType: "exact" },
      { keyword: "10 step skincare routine", matchType: "phrase" },
      { keyword: "skin care routine for beginners", matchType: "phrase" },
      { keyword: "best skincare routine", matchType: "phrase" },
      { keyword: "glass skin routine", matchType: "phrase" },
      { keyword: "skincare tips", matchType: "phrase" },
      { keyword: "beauty regimen", matchType: "broad" },
      { keyword: "complexion care", matchType: "broad" },
      { keyword: "glow routine", matchType: "broad" },
    ],
  },
  {
    id: "pin_006",
    title: "Boho Wedding Decor Ideas That Will Take Your Breath Away",
    description: "Create a magical bohemian wedding with these stunning decor ideas. From pampas grass centrepieces to macramé backdrops, your guests will be wowed.",
    imageEmoji: "💍",
    pinUrl: "https://pinterest.com/pin/006",
    boardName: "Wedding Inspiration",
    creatorName: "Bridal Bliss Co",
    creatorHandle: "@bridalbliss",
    postedAt: "2026-01-20T09:30:00",
    saves: 478200,
    clicks: 102400,
    impressions: 7200000,
    closeups: 389000,
    engagementRate: 6.63,
    category: "Event Planning",
    format: "standard",
    keywords: [
      { keyword: "boho wedding decor", matchType: "exact" },
      { keyword: "wedding decor ideas", matchType: "exact" },
      { keyword: "bohemian wedding", matchType: "exact" },
      { keyword: "boho wedding inspiration", matchType: "phrase" },
      { keyword: "outdoor wedding decor", matchType: "phrase" },
      { keyword: "pampas grass wedding", matchType: "phrase" },
      { keyword: "wedding centerpiece ideas", matchType: "phrase" },
      { keyword: "bridal inspiration", matchType: "broad" },
      { keyword: "wedding planning", matchType: "broad" },
      { keyword: "nuptials", matchType: "broad" },
    ],
  },
  {
    id: "pin_007",
    title: "Full Body Workout at Home — No Equipment Needed",
    description: "Get fit without a gym membership! This full body workout targets every muscle group using only your bodyweight. Perfect for beginners and intermediate.",
    imageEmoji: "💪",
    pinUrl: "https://pinterest.com/pin/007",
    boardName: "Home Workouts",
    creatorName: "FitLife Studio",
    creatorHandle: "@fitlifestudio",
    postedAt: "2026-04-01T07:00:00",
    saves: 267800,
    clicks: 58900,
    impressions: 4100000,
    closeups: 198000,
    engagementRate: 6.52,
    category: "Health",
    format: "video",
    keywords: [
      { keyword: "full body workout at home", matchType: "exact" },
      { keyword: "home workout no equipment", matchType: "exact" },
      { keyword: "bodyweight workout", matchType: "exact" },
      { keyword: "full body workout for beginners", matchType: "phrase" },
      { keyword: "home workout routine", matchType: "phrase" },
      { keyword: "no gym workout", matchType: "phrase" },
      { keyword: "workout plan for women", matchType: "phrase" },
      { keyword: "exercise routine", matchType: "broad" },
      { keyword: "fitness training", matchType: "broad" },
      { keyword: "getting fit", matchType: "broad" },
    ],
  },
  {
    id: "pin_008",
    title: "Aesthetic Room Makeover — Dark Academia Bedroom",
    description: "Embrace the dark academia aesthetic in your bedroom with rich jewel tones, vintage books, and moody lighting. Here's how to recreate this look.",
    imageEmoji: "📚",
    pinUrl: "https://pinterest.com/pin/008",
    boardName: "Aesthetic Rooms",
    creatorName: "Moody Spaces",
    creatorHandle: "@moodyspaces",
    postedAt: "2026-03-10T14:00:00",
    saves: 344600,
    clicks: 74100,
    impressions: 5100000,
    closeups: 278000,
    engagementRate: 6.76,
    category: "Home Decor",
    format: "carousel",
    keywords: [
      { keyword: "dark academia bedroom", matchType: "exact" },
      { keyword: "dark academia aesthetic", matchType: "exact" },
      { keyword: "aesthetic room", matchType: "exact" },
      { keyword: "dark academia room decor", matchType: "phrase" },
      { keyword: "moody bedroom ideas", matchType: "phrase" },
      { keyword: "aesthetic bedroom makeover", matchType: "phrase" },
      { keyword: "dark bedroom aesthetic", matchType: "phrase" },
      { keyword: "room decoration", matchType: "broad" },
      { keyword: "interior design", matchType: "broad" },
      { keyword: "home styling", matchType: "broad" },
    ],
  },
];

// Generate mock top-performing pins for a keyword search
export function searchPinsByKeyword(keyword: string): PinData[] {
  const lower = keyword.toLowerCase();
  // Filter pins that have the keyword in title, description, or keywords list
  const matched = MOCK_PINS.filter(
    (pin) =>
      pin.title.toLowerCase().includes(lower) ||
      pin.description.toLowerCase().includes(lower) ||
      pin.category.toLowerCase().includes(lower) ||
      pin.keywords.some((k) => k.keyword.includes(lower))
  );

  // If no direct match, return all pins sorted by saves (simulating broad match discovery)
  const pool = matched.length >= 3 ? matched : MOCK_PINS;
  return [...pool].sort((a, b) => b.saves - a.saves);
}

// Look up a single pin by URL (simulated)
export function getPinByUrl(url: string): PinData | null {
  // Match by any pin id pattern in the URL
  const match = MOCK_PINS.find((p) => url.includes(p.id) || url.includes(p.pinUrl));
  // If no specific match, return a realistic demo pin based on URL hash
  if (!match) {
    const index = Math.abs(url.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % MOCK_PINS.length;
    return MOCK_PINS[index];
  }
  return match;
}
