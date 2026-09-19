import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";
import { getActivePinterestToken } from "@/lib/pinterest-token";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are",
  "was","were","be","been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","this","that","these","those","i","you","he","she","it",
  "we","they","my","your","his","her","its","our","their","what","which","who","when","where",
  "why","how","all","each","every","both","few","more","most","other","some","such","no","not",
  "only","same","so","than","too","very","just","about","up","out","if","then","as","until",
  "while","after","before","get","got","make","go","come","take","see","know","think","look",
  "use","find","tell","ask","seem","feel","try","leave","call","keep","let","set","put","new",
  "old","great","good","best","top","free","now","also","like","many","much","way","day","time",
  "year","home","life","love","work","people","save","shop","pin","pins",
]);

function extractKeywordsForPin(title: string, description: string): {
  keyword: string;
  inTitle: boolean;
  inDescription: boolean;
  type: "short" | "long";
}[] {
  const combined = `${title} ${description}`.toLowerCase();
  const words = combined.replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();

  const seen = new Set<string>();
  const result: { keyword: string; inTitle: boolean; inDescription: boolean; type: "short" | "long" }[] = [];

  // Unigrams
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    result.push({
      keyword: w,
      inTitle: titleLower.includes(w),
      inDescription: descLower.includes(w),
      type: "short",
    });
  }

  // Bigrams and trigrams as long-tail
  for (let i = 0; i < words.length - 1; i++) {
    const bi = `${words[i]} ${words[i + 1]}`;
    if (!seen.has(bi)) {
      seen.add(bi);
      result.push({
        keyword: bi,
        inTitle: titleLower.includes(bi),
        inDescription: descLower.includes(bi),
        type: "long",
      });
    }
    if (i < words.length - 2) {
      const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!seen.has(tri)) {
        seen.add(tri);
        result.push({
          keyword: tri,
          inTitle: titleLower.includes(tri),
          inDescription: descLower.includes(tri),
          type: "long",
        });
      }
    }
  }

  return result.slice(0, 12);
}

function dateStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function fetchPinAnalytics(pinId: string, accessToken: string): Promise<{
  impressions: number; engagements: number; saves: number; outboundClicks: number;
}> {
  const start = dateStr(30);
  const end = dateStr(0);
  const url = `https://api.pinterest.com/v5/pins/${encodeURIComponent(pinId)}/analytics` +
    `?start_date=${start}&end_date=${end}&metric_types=ENGAGEMENT,IMPRESSION,SAVE,OUTBOUND_CLICK&app_types=ALL`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!res.ok) return { impressions: 0, engagements: 0, saves: 0, outboundClicks: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const daily: Record<string, unknown>[] = Array.isArray(data?.all?.daily_metrics)
      ? data.all.daily_metrics
      : Array.isArray(data) ? data : [];
    const totals = daily.reduce((acc: { impressions: number; engagements: number; saves: number; outboundClicks: number }, row) => {
      const m = (row.metrics ?? row) as Record<string, number>;
      return {
        impressions: acc.impressions + (Number(m.IMPRESSION) || 0),
        engagements: acc.engagements + (Number(m.ENGAGEMENT) || 0),
        saves: acc.saves + (Number(m.SAVE) || 0),
        outboundClicks: acc.outboundClicks + (Number(m.OUTBOUND_CLICK) || 0),
      };
    }, { impressions: 0, engagements: 0, saves: 0, outboundClicks: 0 });
    return totals;
  } catch {
    return { impressions: 0, engagements: 0, saves: 0, outboundClicks: 0 };
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const accessToken = await getActivePinterestToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const boardId = req.nextUrl.searchParams.get("boardId");
  if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 });
  const withAnalytics = req.nextUrl.searchParams.get("analytics") === "true";

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Paginate up to 250 pins
  const pins: object[] = [];
  let bookmark: string | null = null;

  for (let page = 0; page < 10; page++) {
    const url = `https://api.pinterest.com/v5/boards/${boardId}/pins?page_size=25${bookmark ? `&bookmark=${bookmark}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    pins.push(...(data.items ?? []));
    bookmark = data.bookmark ?? null;
    if (!bookmark) break;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const basePins = (pins as any[]).map((pin: any) => {
    const title = (pin.title ?? "").trim();
    const description = (pin.description ?? "").trim();
    const link = (pin.link ?? "").trim();
    const thumbnail =
      pin.media?.images?.["150x150"]?.url ??
      pin.media?.images?.["400x300"]?.url ??
      pin.media?.images?.["600x"]?.url ??
      "";
    return {
      id: pin.id,
      title,
      description,
      link,
      thumbnail,
      altText: pin.alt_text ?? "",
      keywords: extractKeywordsForPin(title, description),
      createdAt: pin.created_at ?? "",
      analytics: null as null | { impressions: number; engagements: number; saves: number; outboundClicks: number },
    };
  });

  if (withAnalytics) {
    // Fetch analytics in batches of 5 to respect rate limits
    const BATCH = 5;
    for (let i = 0; i < basePins.length; i += BATCH) {
      const batch = basePins.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(p => fetchPinAnalytics(p.id, accessToken)));
      results.forEach((r, j) => { basePins[i + j].analytics = r; });
    }
  }

  return NextResponse.json({ pins: basePins, total: basePins.length });
}
