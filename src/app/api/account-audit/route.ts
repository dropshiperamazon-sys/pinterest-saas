import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are",
  "was","were","be","been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","need","dare","ought","used","this","that","these","those",
  "i","you","he","she","it","we","they","my","your","his","her","its","our","their","what","which",
  "who","whom","when","where","why","how","all","each","every","both","few","more","most","other",
  "some","such","no","not","only","same","so","than","too","very","just","about","up","out","if",
  "then","because","as","until","while","although","though","after","before","since","during",
  "through","into","onto","off","over","under","again","further","once","here","there","get",
  "got","make","made","go","gone","come","came","take","took","see","saw","know","knew","think",
  "thought","look","looked","use","used","find","found","tell","told","ask","asked","seem","seemed",
  "feel","felt","try","tried","leave","left","call","called","keep","kept","let","set","put","new",
  "old","great","good","best","top","free","now","shop","your","their","also","like","many","much",
  "way","ways","day","days","time","times","year","years","home","life","love","work","people",
]);

function extractKeywords(texts: string[]): { keyword: string; count: number; sources: string[] }[] {
  const freq: Record<string, { count: number; sources: Set<string> }> = {};

  for (const text of texts) {
    if (!text) continue;
    // extract 1-3 word phrases
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (const w of words) {
      if (!freq[w]) freq[w] = { count: 0, sources: new Set() };
      freq[w].count++;
      freq[w].sources.add(text.slice(0, 40));
    }

    // bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bi = `${words[i]} ${words[i + 1]}`;
      if (!freq[bi]) freq[bi] = { count: 0, sources: new Set() };
      freq[bi].count++;
      freq[bi].sources.add(text.slice(0, 40));
    }
  }

  return Object.entries(freq)
    .filter(([, v]) => v.count >= 1)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 100)
    .map(([keyword, v]) => ({ keyword, count: v.count, sources: Array.from(v.sources).slice(0, 3) }));
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

  // Fetch pins for up to 5 boards to extract keywords
  const pinTexts: string[] = [];
  const boardTexts: string[] = boards.map((b) => `${b.name ?? ""} ${b.description ?? ""}`);

  for (const board of boards.slice(0, 10)) {
    try {
      const pinsRes = await fetch(
        `https://api.pinterest.com/v5/boards/${board.id}/pins?page_size=25`,
        { headers }
      );
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
  const keywords = extractKeywords(allTexts);

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
    keywords,
    totalTextsAnalyzed: allTexts.length,
  });
}
