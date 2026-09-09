// Category Relevance Engine — scores URLs against a selected category

export const CATEGORIES = [
  "Home Decor",
  "Interior Design",
  "Fashion",
  "Beauty",
  "Food",
  "Fitness",
  "Travel",
  "Parenting",
  "Wedding",
  "DIY",
  "Lifestyle",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number] | string;

// Keywords associated with each preset category
const CATEGORY_SIGNALS: Record<string, string[]> = {
  "Home Decor": [
    "home decor", "home decoration", "living room", "bedroom", "kitchen", "bathroom",
    "wall art", "furniture", "interior", "cozy", "apartment", "house", "room ideas",
    "curtains", "pillows", "rugs", "shelves", "lighting", "aesthetic home",
  ],
  "Interior Design": [
    "interior design", "interior", "architecture", "floor plan", "renovation", "remodel",
    "modern design", "minimalist", "scandinavian", "bohemian", "farmhouse", "industrial",
    "color palette", "space design", "home office", "open concept",
  ],
  "Fashion": [
    "fashion", "outfit", "style", "clothing", "dress", "wear", "wardrobe", "ootd",
    "street style", "capsule", "trend", "seasonal", "spring outfit", "summer outfit",
    "fall outfit", "winter outfit", "jeans", "blazer", "shoes", "accessories",
  ],
  "Beauty": [
    "beauty", "makeup", "skincare", "skin care", "hair", "nail", "lipstick", "foundation",
    "eyeliner", "eyeshadow", "moisturizer", "serum", "cleanser", "routine", "tutorial",
    "glow", "brow", "lashes", "cosmetics",
  ],
  "Food": [
    "food", "recipe", "meal", "dinner", "lunch", "breakfast", "snack", "dessert",
    "bake", "baking", "cook", "cooking", "healthy eating", "vegan", "vegetarian",
    "keto", "calories", "nutrition", "easy recipe", "quick meal",
  ],
  "Fitness": [
    "fitness", "workout", "exercise", "gym", "yoga", "pilates", "run", "running",
    "strength", "cardio", "weight loss", "abs", "training", "healthy lifestyle",
    "motivation", "home workout", "routine",
  ],
  "Travel": [
    "travel", "vacation", "trip", "destination", "explore", "adventure", "hotel",
    "flight", "itinerary", "packing", "backpacking", "road trip", "beach", "mountains",
    "europe", "asia", "bucket list", "guide", "tips",
  ],
  "Parenting": [
    "parenting", "baby", "toddler", "kids", "child", "children", "mom", "dad",
    "family", "school", "education", "pregnancy", "newborn", "nursery", "activities",
    "motherhood", "fatherhood", "raising",
  ],
  "Wedding": [
    "wedding", "bride", "groom", "bridal", "ceremony", "reception", "engagement",
    "venue", "flowers", "bouquet", "invitation", "cake", "decoration", "vow",
    "honeymoon", "dress", "suit", "ring",
  ],
  "DIY": [
    "diy", "do it yourself", "craft", "handmade", "tutorial", "project",
    "upcycle", "repurpose", "paint", "build", "woodwork", "sewing", "knit",
    "candle", "decoupage", "macrame", "printable",
  ],
  "Lifestyle": [
    "lifestyle", "self care", "wellness", "mental health", "productivity",
    "morning routine", "minimalism", "journal", "gratitude", "vision board",
    "budgeting", "finance", "reading", "hobbies", "personal development",
  ],
};

function tokenize(text: string): string {
  return text.toLowerCase().replace(/[-_\/]/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreRelevance(url: string, keyword: string, category: Category): number {
  const urlText = tokenize(url);
  const kwText = tokenize(keyword);
  const combined = `${urlText} ${kwText}`;

  // Get signals for this category
  const categoryKey = Object.keys(CATEGORY_SIGNALS).find(
    (k) => k.toLowerCase() === category.toLowerCase()
  );
  const signals: string[] = categoryKey ? CATEGORY_SIGNALS[categoryKey] : [];

  // Custom category: use the category name itself as a signal
  const customSignals: string[] = !categoryKey && category !== "Other"
    ? [category.toLowerCase(), ...category.toLowerCase().split(/\s+/)]
    : [];

  const allSignals = [...signals, ...customSignals];
  if (allSignals.length === 0) return 50; // "Other" — accept everything at neutral score

  let score = 0;
  let matched = 0;

  for (const signal of allSignals) {
    if (combined.includes(signal.toLowerCase())) {
      score += signal.split(" ").length > 1 ? 20 : 8; // multi-word matches score higher
      matched++;
    }
  }

  // Cap at 100
  return Math.min(100, Math.round(score));
}

export function isArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Must have a path beyond just "/"
    if (path === "/" || path === "") return false;

    // Exclude static assets, images, feeds, admin pages
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml|json)$/i.test(path)) return false;
    if (/\/(wp-admin|wp-json|feed|rss|api|cdn|assets|static|images|img|js|css|fonts)\//i.test(path)) return false;
    if (/\/(author|tag|tags|search|page\/\d+)\/?$/i.test(path)) return false;

    // Likely an article if the final segment looks like a slug (contains hyphens or is long)
    const slug = path.split("/").filter(Boolean).at(-1) ?? "";
    const hasHyphen = slug.includes("-");
    const isLong = slug.length > 15;

    return hasHyphen || isLong;
  } catch {
    return false;
  }
}
