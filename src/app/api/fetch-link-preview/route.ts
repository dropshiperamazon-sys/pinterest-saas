import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = await res.text();

    const getMeta = (property: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
      return match?.[1] ?? null;
    };

    const getMetaName = (name: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"));
      return match?.[1] ?? null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const image = getMeta("og:image") || getMeta("twitter:image") || getMetaName("twitter:image");
    const title = getMeta("og:title") || getMeta("twitter:title") || getMetaName("twitter:title") || titleMatch?.[1]?.trim() || "";
    const description = getMeta("og:description") || getMetaName("description") || "";

    return NextResponse.json({ image, title: title.slice(0, 200), description: description.slice(0, 500) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
