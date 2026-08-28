import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Context-aware modifiers — matched against the query to pick relevant suffixes
const CONTEXT_MODIFIERS: { patterns: RegExp; suffixes: string[] }[] = [
  {
    patterns: /wallpaper|background|iphone|phone|desktop|screen/i,
    suffixes: ["aesthetic", "for bedroom", "bedroom", "living room", "laptop", "for laptop", "for living room", "summer", "ipad", "pc", "for phone", "cute"],
  },
  {
    patterns: /nail|nails/i,
    suffixes: ["aesthetic", "design", "acrylic", "gel", "art", "simple", "short", "french", "summer", "for beginners", "cute", "color"],
  },
  {
    patterns: /hair|hairstyle|haircut/i,
    suffixes: ["color ideas", "cut", "style", "braids", "highlights", "balayage", "for women", "short", "long", "curly", "natural", "layers"],
  },
  {
    patterns: /home decor|interior|room decor/i,
    suffixes: ["aesthetic", "modern", "boho", "minimalist", "on a budget", "small", "diy", "inspiration", "cozy", "simple", "living room", "bedroom"],
  },
  {
    patterns: /living room/i,
    suffixes: ["ideas", "decor", "aesthetic", "modern", "small", "cozy", "boho", "minimalist", "on a budget", "furniture", "layout", "color"],
  },
  {
    patterns: /bedroom/i,
    suffixes: ["ideas", "decor", "aesthetic", "small", "cozy", "teen", "adult", "pink", "blue", "green", "minimalist", "boho"],
  },
  {
    patterns: /outfit|fashion|style|clothing|dress|clothes/i,
    suffixes: ["ideas", "aesthetic", "summer", "fall", "winter", "spring", "for women", "casual", "trendy", "boho", "minimalist", "inspo"],
  },
  {
    patterns: /recipe|food|meal|dinner|lunch|breakfast|cake|cookie|bread/i,
    suffixes: ["easy", "healthy", "quick", "for beginners", "simple", "homemade", "best", "vegetarian", "delicious", "inspiration", "ideas", "creamy"],
  },
  {
    patterns: /wedding|bride|bridal/i,
    suffixes: ["ideas", "aesthetic", "inspiration", "dress", "decor", "flowers", "hairstyle", "makeup", "simple", "boho", "elegant", "color palette"],
  },
  {
    patterns: /tattoo/i,
    suffixes: ["ideas", "small", "minimalist", "for women", "aesthetic", "flower", "simple", "fine line", "meaningful", "unique", "placement", "behind ear"],
  },
  {
    patterns: /makeup|beauty|skincare|eyeshadow|lipstick/i,
    suffixes: ["tutorial", "natural", "glam", "everyday", "for beginners", "summer", "tips", "routine", "inspiration", "aesthetic", "no makeup", "dewy"],
  },
  {
    patterns: /garden|plant|flower|gardening/i,
    suffixes: ["ideas", "aesthetic", "design", "small", "diy", "inspiration", "layout", "backyard", "indoor", "beginner", "raised bed", "cottage"],
  },
  {
    patterns: /travel|vacation|trip/i,
    suffixes: ["ideas", "aesthetic", "destinations", "outfits", "packing", "photography", "Europe", "Asia", "budget", "solo", "couple", "bucket list"],
  },
  {
    patterns: /fitness|workout|exercise|gym/i,
    suffixes: ["routine", "motivation", "aesthetic", "at home", "for women", "beginner", "tips", "plan", "inspiration", "outfits", "healthy", "weight loss"],
  },
];

const DEFAULT_SUFFIXES = [
  "ideas", "aesthetic", "inspiration", "design", "tutorial",
  "simple", "for beginners", "diy", "on a budget", "modern",
];

function fallbackSuggestions(q: string): string[] {
  const match = CONTEXT_MODIFIERS.find(c => c.patterns.test(q));
  const suffixes = match?.suffixes ?? DEFAULT_SUFFIXES;
  const base = q.toLowerCase().trim();
  const baseWords = new Set(base.split(" "));

  return suffixes
    .filter(s => {
      // Skip suffix if its first word already appears in the query
      const firstWord = s.split(" ")[0];
      return !baseWords.has(firstWord);
    })
    .map(s => `${base} ${s}`)
    .slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  // Get user's Pinterest token for authenticated requests
  let accessToken: string | null = null;
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (email) {
      const raw = await redis.get(`pinterest_connection:${email}`);
      if (raw) {
        const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };
        accessToken = parsed.accessToken;
      }
    }
  } catch { /* continue without token */ }

  // 1. Try Pinterest Trends search API (what trends.pinterest.com search box uses)
  const trendsEndpoints = [
    `https://trends.pinterest.com/api/v1/keywords/search?query=${encodeURIComponent(q)}&country_code=US`,
    `https://trends.pinterest.com/api/v1/search?query=${encodeURIComponent(q)}&country_code=US`,
  ];

  for (const url of trendsEndpoints) {
    try {
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://trends.pinterest.com/",
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = await res.json();

      const items: unknown[] = data?.keywords ?? data?.results ?? data?.suggestions ?? data?.data ?? (Array.isArray(data) ? data : []);
      const suggestions = items
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          const o = item as Record<string, unknown>;
          return (o.keyword ?? o.term ?? o.query ?? o.display ?? o.name ?? "") as string;
        })
        .filter(Boolean);

      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions: suggestions.slice(0, 12), source: "trends_search" });
      }
    } catch { /* try next */ }
  }

  // 2. Try Pinterest general autocomplete endpoints
  const autocompleteEndpoints = [
    `https://www.pinterest.com/resource/SearchAutocompletesResource/get/?source_url=/&data=${encodeURIComponent(JSON.stringify({ options: { query: q }, context: {} }))}&_=${Date.now()}`,
    `https://www.pinterest.com/search/autocomplete/?q=${encodeURIComponent(q)}`,
  ];

  for (const url of autocompleteEndpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.pinterest.com/",
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const data = await res.json();

      const items: unknown[] =
        data?.resource_response?.data ??
        data?.resource_response?.data?.items ??
        (Array.isArray(data) ? data : []) ??
        data?.items ?? [];

      const suggestions = items
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          const o = item as Record<string, unknown>;
          return (o.display ?? o.query ?? o.term ?? o.name ?? "") as string;
        })
        .filter(Boolean);

      if (suggestions.length > 0) {
        return NextResponse.json({ suggestions: suggestions.slice(0, 12), source: "autocomplete" });
      }
    } catch { /* try next */ }
  }

  // 3. Try Pinterest API v5 keyword suggestions with OAuth token
  if (accessToken) {
    try {
      const accountsRes = await fetch("https://api.pinterest.com/v5/ad_accounts?page_size=1", {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(4000),
      });

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const adAccountId: string | null = accountsData?.items?.[0]?.id ?? null;

        if (adAccountId) {
          const kwRes = await fetch(
            `https://api.pinterest.com/v5/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=${encodeURIComponent(q)}&limit=12`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(4000),
            }
          );
          if (kwRes.ok) {
            const kwData = await kwRes.json();
            const suggestions: string[] = (kwData?.suggestions ?? kwData?.keywords ?? kwData?.items ?? [])
              .map((k: unknown) => {
                if (typeof k === "string") return k;
                const o = k as Record<string, unknown>;
                return (o.keyword ?? o.name ?? o.query ?? "") as string;
              })
              .filter(Boolean);
            if (suggestions.length > 0) {
              return NextResponse.json({ suggestions: suggestions.slice(0, 12), source: "api" });
            }
          }
        }
      }
    } catch { /* fall through */ }
  }

  // 4. Context-aware static fallback
  return NextResponse.json({ suggestions: fallbackSuggestions(q), source: "fallback" });
}
