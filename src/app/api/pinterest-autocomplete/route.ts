import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  try {
    const res = await fetch(
      `https://www.pinterest.com/search/autocomplete/?q=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PinterestBot/1.0)",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const data = await res.json();

    // Pinterest returns { resource_response: { data: { items: [{ display, ... }] } } }
    // or simply an array of strings, depending on version
    let suggestions: string[] = [];

    if (Array.isArray(data)) {
      suggestions = data.map((s: unknown) => (typeof s === "string" ? s : (s as Record<string, string>).display ?? "")).filter(Boolean);
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

    return NextResponse.json({ suggestions: suggestions.slice(0, 12) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
