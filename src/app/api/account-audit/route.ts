import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Extract meaningful seed topics from pin/board text ─────────────────────────
// Rather than dumping every word, we pull 2-4 word noun phrases that look like
// real search intent (what people would type into Pinterest search).

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are",
  "was","were","be","been","have","has","had","do","does","did","will","would","could","should",
  "this","that","these","those","i","you","he","she","it","we","they","my","your","his","her",
  "its","our","their","what","which","who","when","where","why","how","all","each","some","just",
  "so","than","too","very","get","make","go","come","take","see","know","look","use","find","tell",
  "also","like","many","much","now","free","shop","new","best","top","good","great","save","click",
  "follow","share","pin","check","here","there","up","out","off","into","over","today","later",
  "someone","needs","little","things","along","test","less","covered","premium","options","collection",
  "shipping","orders","miss","prem","picks","starter","we've","don't",
]);

// Patterns that look like purchase/spam noise rather than search intent
const NOISE_PATTERN = /\b(click|buy now|shop now|limited|sale|off|discount|code|promo|deal|order)\b/i;

function extractSeedTopics(texts: string[]): string[] {
  const seen = new Set<string>();
  const seeds: { phrase: string; score: number }[] = [];

  for (const text of texts) {
    if (!text) continue;
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = clean.split(" ").filter(w => w.length > 2 && !STOP_WORDS.has(w));

    // Prefer 2–4 word phrases (more Pinterest search-like than single words)
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(" ");
        if (seen.has(phrase)) continue;
        if (NOISE_PATTERN.test(phrase)) continue;
        if (phrase.split(" ").every(w => STOP_WORDS.has(w))) continue;
        seen.add(phrase);
        // Score: longer phrases score higher, penalise single-count
        seeds.push({ phrase, score: len * 2 });
      }
    }
  }

  // Deduplicate: if a shorter phrase is contained in a longer one already present, drop it
  const top = seeds
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(s => s.phrase);

  return top.filter(p => !top.some(q => q !== p && q.includes(p) && q.length > p.length));
}

// ── Expand seeds into real Pinterest-style search phrases ──────────────────────
// Uses the same context-aware suffix logic as the autocomplete API, but applied
// to seeds derived from the account's own content.

const INTENT_SUFFIXES: { patterns: RegExp; suffixes: string[] }[] = [
  { patterns: /wall|art|decor|poster|print|canvas/i, suffixes: ["ideas", "for bedroom", "aesthetic", "living room", "minimalist", "boho", "modern", "diy", "on a budget", "black and white"] },
  { patterns: /home|interior|room|house|apartment|kitchen|bathroom/i, suffixes: ["decor ideas", "aesthetic", "modern", "minimalist", "on a budget", "diy", "inspiration", "cozy", "small space", "organization"] },
  { patterns: /outfit|fashion|style|clothes|dress|wear/i, suffixes: ["ideas", "aesthetic", "casual", "summer", "fall", "winter", "for women", "trendy", "inspo", "minimalist"] },
  { patterns: /nail|nails/i, suffixes: ["aesthetic", "design ideas", "acrylic", "short", "simple", "summer", "cute", "french tip", "gel", "color ideas"] },
  { patterns: /hair|hairstyle|haircut|braid/i, suffixes: ["ideas", "color ideas", "for women", "natural", "short", "long", "curly", "highlights", "tutorial", "aesthetic"] },
  { patterns: /recipe|food|meal|dinner|lunch|breakfast|cake|bake|cook/i, suffixes: ["easy", "healthy", "ideas", "quick", "homemade", "simple", "for beginners", "vegetarian", "delicious", "inspiration"] },
  { patterns: /fitness|workout|exercise|gym|yoga|pilates/i, suffixes: ["routine", "for beginners", "at home", "for women", "motivation", "aesthetic", "tips", "plan", "inspiration", "healthy"] },
  { patterns: /garden|plant|flower|outdoor/i, suffixes: ["ideas", "aesthetic", "diy", "small", "backyard", "inspiration", "beginner", "layout", "design", "indoor"] },
  { patterns: /wedding|bride|bridal/i, suffixes: ["inspiration", "ideas", "aesthetic", "decor", "dress", "flowers", "hairstyle", "makeup", "boho", "elegant"] },
  { patterns: /tattoo/i, suffixes: ["ideas", "small", "minimalist", "for women", "aesthetic", "simple", "flower", "fine line", "meaningful", "placement"] },
  { patterns: /makeup|beauty|skincare|eyeshadow|lipstick/i, suffixes: ["tutorial", "natural", "everyday", "for beginners", "tips", "routine", "aesthetic", "glam", "dewy", "summer"] },
  { patterns: /travel|vacation|trip|destination/i, suffixes: ["ideas", "aesthetic", "packing", "outfits", "photography", "bucket list", "Europe", "budget", "solo", "couple"] },
  { patterns: /money|income|finance|invest|budget|passive/i, suffixes: ["tips", "ideas", "for beginners", "online", "saving tips", "management", "strategies", "hacks", "side hustle", "budgeting"] },
  { patterns: /business|entrepreneur|marketing|brand/i, suffixes: ["tips", "ideas", "strategy", "inspiration", "for beginners", "online", "social media", "growth", "aesthetic", "branding"] },
  { patterns: /digital|online|social media|content|creator/i, suffixes: ["tips", "ideas", "for beginners", "aesthetic", "strategy", "inspiration", "tools", "marketing", "growth", "monetize"] },
];

const DEFAULT_SUFFIXES = ["ideas", "aesthetic", "inspiration", "for beginners", "diy", "modern", "minimalist", "on a budget", "tutorial", "tips"];

function expandToSearchPhrases(seeds: string[]): { keyword: string; intent: string }[] {
  const results: { keyword: string; intent: string }[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const match = INTENT_SUFFIXES.find(c => c.patterns.test(seed));
    const suffixes = match?.suffixes ?? DEFAULT_SUFFIXES;
    const base = seed.toLowerCase().trim();

    // The seed itself may already be a good search phrase (3+ words)
    if (base.split(" ").length >= 3 && !seen.has(base)) {
      seen.add(base);
      results.push({ keyword: base, intent: "topic" });
    }

    // Expand with intent suffixes
    for (const suffix of suffixes.slice(0, 6)) {
      const phrase = `${base} ${suffix}`;
      if (!seen.has(phrase)) {
        seen.add(phrase);
        results.push({ keyword: phrase, intent: suffix });
      }
    }
  }

  return results;
}

// ── Also hit Pinterest Trends API for real trending terms in the niche ─────────

async function fetchTrendingKeywords(seeds: string[], accessToken: string): Promise<string[]> {
  const trending: string[] = [];
  const seen = new Set<string>();

  for (const seed of seeds.slice(0, 5)) {
    const encoded = encodeURIComponent(seed);
    const urls = [
      `https://trends.pinterest.com/api/v1/keywords/search?query=${encoded}&country_code=US`,
      `https://www.pinterest.com/search/autocomplete/?q=${encoded}`,
    ];

    for (const url of urls) {
      try {
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
          Referer: "https://www.pinterest.com/",
          Authorization: `Bearer ${accessToken}`,
        };
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
        if (!res.ok) continue;
        const data = await res.json();
        const items: unknown[] = data?.keywords ?? data?.results ?? data?.suggestions ?? data?.data ?? (Array.isArray(data) ? data : []);
        for (const item of items) {
          const kw = (typeof item === "string" ? item : ((item as Record<string, unknown>).keyword ?? (item as Record<string, unknown>).term ?? (item as Record<string, unknown>).query ?? "")) as string;
          if (kw && kw.length > 4 && !seen.has(kw.toLowerCase())) {
            seen.add(kw.toLowerCase());
            trending.push(kw);
          }
        }
        if (trending.length >= 20) break;
      } catch { /* skip */ }
    }
    if (trending.length >= 20) break;
  }

  return trending;
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const raw = await redis.get(`pinterest_connection:${email}`);
  if (!raw) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });
  const { accessToken } = typeof raw === "string" ? JSON.parse(raw) : (raw as { accessToken: string });

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Fetch profile
  const profileRes = await fetch("https://api.pinterest.com/v5/user_account", { headers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile: any = profileRes.ok ? await profileRes.json() : {};

  // Fetch boards
  const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=50", { headers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boardsData: any = boardsRes.ok ? await boardsRes.json() : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boards: any[] = boardsData.items ?? [];

  // Fetch pins for up to 10 boards
  const pinTexts: string[] = [];
  const boardTexts: string[] = boards.map((b) => `${b.name ?? ""} ${b.description ?? ""}`);

  for (const board of boards.slice(0, 10)) {
    try {
      const pinsRes = await fetch(`https://api.pinterest.com/v5/boards/${board.id}/pins?page_size=25`, { headers });
      if (!pinsRes.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pinsData: any = await pinsRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const pin of pinsData.items ?? []) {
        if (pin.title) pinTexts.push(pin.title);
        if (pin.description) pinTexts.push(pin.description);
        if (pin.alt_text) pinTexts.push(pin.alt_text);
      }
    } catch { /* skip */ }
  }

  const allTexts = [...boardTexts, ...pinTexts];

  // Step 1: extract seed topics (2–4 word meaningful phrases)
  const seeds = extractSeedTopics(allTexts);

  // Step 2: expand seeds into Pinterest-style search intent phrases
  const expanded = expandToSearchPhrases(seeds);

  // Step 3: fetch real trending keywords from Pinterest Trends for top seeds
  const trending = await fetchTrendingKeywords(seeds.slice(0, 5), accessToken);

  // Merge: trending first (real Pinterest data), then expanded, deduplicated
  const seen = new Set<string>();
  const keywords: { keyword: string; count: number; sources: string[] }[] = [];

  for (const kw of trending) {
    const k = kw.toLowerCase().trim();
    if (!seen.has(k) && k.split(" ").length >= 2) {
      seen.add(k);
      keywords.push({ keyword: k, count: 3, sources: ["Pinterest Trends"] });
    }
  }

  for (const { keyword, intent } of expanded) {
    if (!seen.has(keyword)) {
      seen.add(keyword);
      keywords.push({ keyword, count: keyword.split(" ").length >= 3 ? 2 : 1, sources: [intent] });
    }
  }

  return NextResponse.json({
    profile: {
      username: profile.username ?? "",
      displayName: profile.business_name ?? profile.username ?? "",
      about: profile.about ?? "",
      followerCount: profile.follower_count ?? 0,
      followingCount: profile.following_count ?? 0,
      pinCount: profile.pin_count ?? 0,
      boardCount: profile.board_count ?? 0,
      profileImage: profile.profile_image ?? "",
      website: profile.website_url ?? "",
    },
    boards: boards.map((b) => {
      const slug = (b.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const username = profile.username ?? "";
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        pinCount: b.pin_count,
        url: username && slug ? `https://pinterest.com/${username}/${slug}/` : "",
      };
    }),
    keywords: keywords.slice(0, 100),
    totalTextsAnalyzed: allTexts.length,
  });
}
