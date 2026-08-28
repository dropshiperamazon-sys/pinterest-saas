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
    suffixes: ["aesthetic", "design", "acrylic", "gel", "art", "simple", "short", "french", "ideas 2026", "summer", "for beginners", "cute"],
  },
  {
    patterns: /hair|hairstyle|haircut/i,
    suffixes: ["color ideas", "cut", "style", "braids", "highlights", "balayage", "ideas 2026", "for women", "short", "long", "curly", "natural"],
  },
  {
    patterns: /home decor|interior|living room|bedroom|kitchen|bathroom/i,
    suffixes: ["ideas", "aesthetic", "modern", "boho", "minimalist", "on a budget", "small", "diy", "inspiration", "cozy", "simple", "2026"],
  },
  {
    patterns: /outfit|fashion|style|clothing|dress|clothes/i,
    suffixes: ["ideas", "aesthetic", "summer", "fall", "winter", "spring", "for women", "casual", "trendy", "2026", "boho", "minimalist"],
  },
  {
    patterns: /recipe|food|meal|dinner|lunch|breakfast|cake|cookie|bread/i,
    suffixes: ["easy", "healthy", "quick", "ideas", "for beginners", "simple", "homemade", "best", "vegetarian", "delicious", "2026", "inspiration"],
  },
  {
    patterns: /wedding|bride|bridal/i,
    suffixes: ["ideas", "aesthetic", "inspiration", "dress", "decor", "flowers", "hairstyle", "makeup", "simple", "boho", "elegant", "2026"],
  },
  {
    patterns: /tattoo/i,
    suffixes: ["ideas", "small", "minimalist", "for women", "aesthetic", "flower", "simple", "fine line", "meaningful", "unique", "placement", "behind ear"],
  },
  {
    patterns: /makeup|beauty|skincare|eyeshadow|lipstick/i,
    suffixes: ["ideas", "aesthetic", "tutorial", "natural", "glam", "everyday", "for beginners", "summer", "tips", "routine", "2026", "inspiration"],
  },
  {
    patterns: /garden|plant|flower|gardening/i,
    suffixes: ["ideas", "aesthetic", "design", "small", "diy", "inspiration", "layout", "backyard", "indoor", "beginner", "raised bed", "2026"],
  },
];

const DEFAULT_SUFFIXES = [
  "ideas", "aesthetic", "inspiration", "design", "tutorial",
  "2026", "simple", "for beginners", "diy", "ideas 2026",
];

function fallbackSuggestions(q: string): string[] {
  const match = CONTEXT_MODIFIERS.find(c => c.patterns.test(q));
  const suffixes = match?.suffixes ?? DEFAULT_SUFFIXES;
  const base = q.toLowerCase().trim();
  const baseWords = new Set(base.split(" "));

  return suffixes
    .filter(s => {
      // Skip suffix if its first word is already in the query (avoids "ideas ideas", "aesthetic aesthetic")
      const firstWord = s.split(" ")[0];
      return !baseWords.has(firstWord);
    })
    .map(s => `${base} ${s}`)
    .slice(0, 10);
}

async function tryPinterestAutocomplete(q: string): Promise<string[] | null> {
  // Pinterest's internal SearchAutocompletesResource endpoint
  const params = new URLSearchParams({
    source_url: "/search/pins/",
    data: JSON.stringify({ options: { query: q, proxied: false }, context: {} }),
    _: Date.now().toString(),
  });

  const urls = [
    `https://www.pinterest.com/resource/SearchAutocompletesResource/get/?${params}`,
    `https://www.pinterest.com/search/autocomplete/?q=${encodeURIComponent(q)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.pinterest.com/",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();

      // SearchAutocompletesResource wraps in resource_response.data
      const items: unknown[] =
        data?.resource_response?.data ??
        data?.resource_response?.data?.items ??
        (Array.isArray(data) ? data : null) ??
        data?.items ?? [];

      const suggestions = items
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          const o = item as Record<string, unknown>;
          return (o.display ?? o.query ?? o.term ?? o.name ?? "") as string;
        })
        .filter(Boolean);

      if (suggestions.length > 0) return suggestions.slice(0, 12);
    } catch { /* try next */ }
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  // 1. Try Pinterest's public autocomplete endpoints
  const live = await tryPinterestAutocomplete(q);
  if (live) return NextResponse.json({ suggestions: live, source: "live" });

  // 2. Try Pinterest API v5 keyword suggestions using user's OAuth token
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (email) {
      const raw = await redis.get(`pinterest_connection:${email}`);
      if (raw) {
        const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

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
              if (suggestions.length > 0) return NextResponse.json({ suggestions: suggestions.slice(0, 12), source: "api" });
            }
          }
        }
      }
    }
  } catch { /* fall through */ }

  // 3. Context-aware static fallback
  return NextResponse.json({ suggestions: fallbackSuggestions(q), source: "fallback" });
}
