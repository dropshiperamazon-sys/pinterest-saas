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

function extractPinKeywords(title: string, description: string) {
  const combined = `${title} ${description}`.toLowerCase();
  const words = combined.replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const titleL = title.toLowerCase();
  const descL  = description.toLowerCase();
  const seen   = new Set<string>();
  const result: { keyword: string; inTitle: boolean; inDescription: boolean; type: "short" | "long" }[] = [];

  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      result.push({ keyword: w, inTitle: titleL.includes(w), inDescription: descL.includes(w), type: "short" });
    }
  }
  for (let i = 0; i < words.length - 1; i++) {
    const bi = `${words[i]} ${words[i + 1]}`;
    if (!seen.has(bi)) {
      seen.add(bi);
      result.push({ keyword: bi, inTitle: titleL.includes(bi), inDescription: descL.includes(bi), type: "long" });
    }
    if (i < words.length - 2) {
      const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!seen.has(tri)) {
        seen.add(tri);
        result.push({ keyword: tri, inTitle: titleL.includes(tri), inDescription: descL.includes(tri), type: "long" });
      }
    }
  }
  return result.slice(0, 12);
}

function extractUsername(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch { return null; }
}

// Try to pull pins from Pinterest's embedded JSON initial state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePinsFromHtml(html: string): any[] {
  const pins: { id: string; title: string; description: string; thumbnail: string }[] = [];
  const seen = new Set<string>();

  // Pinterest embeds data as escaped JSON in script tags in several formats.
  // Strategy 1: look for "id":"<numeric>" paired with title / description near an image URL
  // Extract all JSON-like pin objects from escaped embedded data.
  const pinBlockRegex = /\\"id\\":\\"(\d{10,})\\"[^}]{0,2000}?\\"title\\":\\"([^"\\]{0,200})\\"/g;
  let m: RegExpExecArray | null;
  while ((m = pinBlockRegex.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);

    // Try to find a description near this id
    const snippet = html.slice(m.index, m.index + 3000);
    const desc = snippet.match(/\\"description\\":\\"([^"\\]{0,500})\\"/)?.[1] ?? "";
    const thumb = snippet.match(/\\"url\\":\\"(https:\\\/\\\/i\\.pinimg\\.com[^"\\]+)\\"/)?.[1]
      ?.replace(/\\\//g, "/") ?? "";

    const title = m[2].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
    pins.push({ id, title, description: desc.replace(/\\n/g, " ").replace(/\\"/g, '"').trim(), thumbnail: thumb });
    if (pins.length >= 50) break;
  }

  // Strategy 2: un-escaped JSON-LD blocks
  if (pins.length === 0) {
    const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const ldm of ldMatches) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = JSON.parse(ldm[1]);
        const items = obj["@graph"] ?? (Array.isArray(obj) ? obj : [obj]);
        for (const item of items) {
          if (item.name && item["@type"]) {
            const id = item.url?.match(/\/pin\/(\d+)/)?.[1] ?? `ld_${pins.length}`;
            if (!seen.has(id)) {
              seen.add(id);
              pins.push({ id, title: item.name ?? "", description: item.description ?? "", thumbnail: item.image?.url ?? item.image ?? "" });
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  return pins;
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
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return NextResponse.json({ error: `Profile not found (${res.status})` }, { status: 404 });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Failed to fetch Pinterest profile" }, { status: 502 });
  }

  // ── Meta / profile data ───────────────────────────────────────────────────
  const metaDesc    = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const ogTitle     = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const ogDesc      = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const pageTitle   = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  const followerMatch  = html.match(/(\d[\d,.]+)\s*followers?/i)?.[0] ?? "";
  const followingMatch = html.match(/(\d[\d,.]+)\s*following/i)?.[0] ?? "";

  // ── Global keyword texts ──────────────────────────────────────────────────
  const texts: string[] = [];
  if (metaDesc)  texts.push(metaDesc);
  if (ogTitle)   texts.push(ogTitle);
  if (ogDesc)    texts.push(ogDesc);
  if (pageTitle) texts.push(pageTitle);

  for (const m of html.matchAll(/\\"description\\":\\"([^"\\]{3,200})\\"/g))
    texts.push(m[1].replace(/\\n/g, " ").replace(/\\"/g, '"'));
  for (const m of html.matchAll(/\\"title\\":\\"([^"\\]{3,150})\\"/g))
    texts.push(m[1]);
  for (const m of html.matchAll(/aria-label="([^"]{3,60})"/g))
    texts.push(m[1]);

  // ── Extract pins ──────────────────────────────────────────────────────────
  const rawPins = parsePinsFromHtml(html);
  const pins = rawPins.map((p) => ({
    id: p.id,
    title: (p.title ?? "").trim(),
    description: (p.description ?? "").trim(),
    thumbnail: p.thumbnail ?? "",
    pinUrl: `https://pinterest.com/pin/${p.id}/`,
    keywords: extractPinKeywords((p.title ?? "").trim(), (p.description ?? "").trim()),
  }));

  // Add pin texts to global keyword pool
  for (const p of pins) {
    if (p.title) texts.push(p.title);
    if (p.description) texts.push(p.description);
  }

  const keywords = extractKeywords(texts);
  const displayName = ogTitle.replace(/ on Pinterest$/, "").replace(/ \|.*$/, "").trim() || username;

  return NextResponse.json({
    username,
    displayName,
    about: metaDesc || ogDesc || "",
    followerInfo: followerMatch || followingMatch || "",
    keywords,
    textsAnalyzed: texts.length,
    pins,
  });
}
