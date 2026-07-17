import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are",
  "was","were","be","been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","need","this","that","these","those","i","you","he","she",
  "it","we","they","my","your","his","her","its","our","their","what","which","who","when","where",
  "why","how","all","each","every","both","few","more","most","other","some","such","no","not",
  "only","same","so","than","too","very","just","about","up","out","if","then","as","until",
  "while","after","before","since","during","through","into","onto","off","over","under","once",
  "here","there","get","got","make","go","come","take","see","know","think","look","use","find",
  "tell","ask","seem","feel","try","leave","call","keep","let","set","put","new","old","great",
  "good","best","top","free","now","shop","also","like","many","much","way","day","time","year",
  "home","life","love","work","people","pinterest","pin","pins","board","boards","save","saved",
]);

function extractKeywords(texts: string[]): { keyword: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    if (!text) continue;
    const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    for (const w of words) { freq[w] = (freq[w] ?? 0) + 1; }
    for (let i = 0; i < words.length - 1; i++) {
      const bi = `${words[i]} ${words[i + 1]}`;
      freq[bi] = (freq[bi] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 80)
    .map(([keyword, count]) => ({ keyword, count }));
}

function extractUsername(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  const username = extractUsername(url);
  if (!username) return NextResponse.json({ error: "Could not parse Pinterest username from URL" }, { status: 400 });

  // Fetch the public Pinterest profile page
  let html = "";
  try {
    const res = await fetch(`https://www.pinterest.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ error: `Profile not found (${res.status})` }, { status: 404 });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Failed to fetch Pinterest profile" }, { status: 502 });
  }

  // Extract structured data from the page
  const texts: string[] = [];

  // meta description / title
  const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";

  if (metaDesc) texts.push(metaDesc);
  if (ogTitle) texts.push(ogTitle);
  if (ogDesc) texts.push(ogDesc);
  if (pageTitle) texts.push(pageTitle);

  // Extract JSON-LD or __PWS_DATA__ / __redux_state__ embedded data
  const jsonMatches = html.matchAll(/\\"description\\":\\"([^"\\]{3,200})\\"/g);
  for (const m of jsonMatches) texts.push(m[1].replace(/\\n/g, " ").replace(/\\"/g, '"'));

  const titleMatches = html.matchAll(/\\"title\\":\\"([^"\\]{3,150})\\"/g);
  for (const m of titleMatches) texts.push(m[1]);

  // Pull display name, follower counts from meta
  const followerMatch = html.match(/(\d[\d,.]+)\s*followers?/i)?.[0] ?? "";
  const followingMatch = html.match(/(\d[\d,.]+)\s*following/i)?.[0] ?? "";

  // Try extracting board names from anchor text
  const boardMatches = [...html.matchAll(/aria-label="([^"]{3,60})"/g)].map((m) => m[1]);
  for (const b of boardMatches) texts.push(b);

  const keywords = extractKeywords(texts);

  // Sanitize display name
  const displayName = ogTitle.replace(/ on Pinterest$/, "").replace(/ \|.*$/, "").trim() || username;

  return NextResponse.json({
    username,
    displayName,
    about: metaDesc || ogDesc || "",
    followerInfo: followerMatch || followingMatch || "",
    keywords,
    textsAnalyzed: texts.length,
  });
}
