import { NextResponse } from "next/server";

// Pinterest-style suggestion suffixes — mirrors what Pinterest's autocomplete shows
const SUFFIXES = [
  "ideas", "aesthetic", "inspiration", "ideas 2024", "ideas 2025",
  "for beginners", "diy", "tutorial", "board", "trend",
  "on a budget", "simple", "easy", "unique", "aesthetic ideas",
  "for women", "minimalist", "modern", "boho", "vintage",
];

function fallbackSuggestions(q: string): string[] {
  const base = q.toLowerCase().trim();
  return SUFFIXES
    .map(s => `${base} ${s}`)
    .filter(s => s !== base)
    .slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  try {
    const res = await fetch(
      `https://www.pinterest.com/search/autocomplete/?q=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.pinterest.com/",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ suggestions: fallbackSuggestions(q), source: "fallback" });
    }

    const data = await res.json();

    let suggestions: string[] = [];

    if (Array.isArray(data)) {
      suggestions = data
        .map((s: unknown) => (typeof s === "string" ? s : (s as Record<string, string>).display ?? ""))
        .filter(Boolean);
    } else {
      const items: unknown[] =
        data?.resource_response?.data?.items ??
        data?.items ??
        data?.results ??
        [];
      suggestions = items
        .map((item: unknown) => {
          if (typeof item === "string") return item;
          const o = item as Record<string, unknown>;
          return (o.display ?? o.query ?? o.term ?? o.name ?? "") as string;
        })
        .filter(Boolean);
    }

    if (suggestions.length === 0) {
      return NextResponse.json({ suggestions: fallbackSuggestions(q), source: "fallback" });
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 12), source: "live" });
  } catch {
    return NextResponse.json({ suggestions: fallbackSuggestions(q), source: "fallback" });
  }
}
