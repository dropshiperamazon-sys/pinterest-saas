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
];

export const MOCK_KEYWORDS: Record<string, KeywordResult[]> = {
  default: [
    { keyword: "home decor ideas", volume: 2400000, trend: 12, competition: "medium", category: "Home Decor", cpc: 0.85 },
    { keyword: "wedding dress", volume: 1800000, trend: 5, competition: "high", category: "Weddings", cpc: 1.20 },
    { keyword: "healthy recipes", volume: 3200000, trend: 18, competition: "high", category: "Food & Drink", cpc: 0.65 },
    { keyword: "workout routine", volume: 1500000, trend: 22, competition: "medium", category: "Health & Fitness", cpc: 0.90 },
    { keyword: "nail art designs", volume: 2100000, trend: 8, competition: "low", category: "Fashion & Beauty", cpc: 0.45 },
    { keyword: "travel photography", volume: 980000, trend: 15, competition: "medium", category: "Travel", cpc: 0.75 },
    { keyword: "DIY crafts", volume: 1600000, trend: 10, competition: "low", category: "Home Decor", cpc: 0.55 },
    { keyword: "baby shower ideas", volume: 1200000, trend: 3, competition: "medium", category: "Kids & Parenting", cpc: 0.80 },
  ],
};

export function generateKeywords(query: string): KeywordResult[] {
  const base = query.toLowerCase();
  const suffixes = ["ideas", "inspiration", "tips", "tutorial", "design", "aesthetic", "2024", "trends", "diy", "easy"];
  const prefixes = ["best", "beautiful", "modern", "simple", "unique", "creative", "minimalist", "boho"];

  const results: KeywordResult[] = [];

  // Main keyword
  results.push({
    keyword: base,
    volume: Math.floor(Math.random() * 2000000) + 100000,
    trend: Math.floor(Math.random() * 40) - 10,
    competition: ["low", "medium", "high"][Math.floor(Math.random() * 3)] as "low" | "medium" | "high",
    category: "General",
    cpc: parseFloat((Math.random() * 2 + 0.1).toFixed(2)),
  });

  suffixes.slice(0, 6).forEach((suffix) => {
    results.push({
      keyword: `${base} ${suffix}`,
      volume: Math.floor(Math.random() * 1500000) + 50000,
      trend: Math.floor(Math.random() * 40) - 10,
      competition: ["low", "medium", "high"][Math.floor(Math.random() * 3)] as "low" | "medium" | "high",
      category: "General",
      cpc: parseFloat((Math.random() * 2 + 0.1).toFixed(2)),
    });
  });

  prefixes.slice(0, 4).forEach((prefix) => {
    results.push({
      keyword: `${prefix} ${base}`,
      volume: Math.floor(Math.random() * 1000000) + 30000,
      trend: Math.floor(Math.random() * 40) - 10,
      competition: ["low", "medium", "high"][Math.floor(Math.random() * 3)] as "low" | "medium" | "high",
      category: "General",
      cpc: parseFloat((Math.random() * 2 + 0.1).toFixed(2)),
    });
  });

  return results;
}

export interface KeywordResult {
  keyword: string;
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
