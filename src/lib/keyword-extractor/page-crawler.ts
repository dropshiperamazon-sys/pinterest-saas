// Page Crawler — fetches public pages and extracts title/H1/headings
// Lightweight: uses regex on raw HTML, no headless browser

const FETCH_TIMEOUT = 6000;
const MAX_BODY_SIZE = 200_000; // 200KB max — we only need the <head> and early body

export interface PageMeta {
  url: string;
  title: string;
  h1: string;
  headings: string;      // concatenated H2/H3 text
  metaDescription: string;
  bodySnippet: string;   // first ~500 chars of visible body text
}

function extractTag(html: string, pattern: RegExp): string {
  const m = html.match(pattern);
  return m ? decodeEntities(m[1].trim()) : "";
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export async function fetchPageMeta(url: string): Promise<PageMeta> {
  const empty: PageMeta = { url, title: "", h1: "", headings: "", metaDescription: "", bodySnippet: "" };
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KeywordExtractorBot/1.0; +https://mypinpro.com/bot)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return empty;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return empty;

    // Read only the first MAX_BODY_SIZE bytes to avoid large downloads
    const reader = res.body?.getReader();
    if (!reader) return empty;
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalSize += value.length;
      if (totalSize >= MAX_BODY_SIZE) { reader.cancel(); break; }
    }
    const html = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc); merged.set(c, acc.length);
        return merged;
      }, new Uint8Array())
    );

    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1 = extractTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "").trim();
    const metaDescription = extractTag(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)
      || extractTag(html, /<meta[^>]*content=["']([^"']*?)["'][^>]*name=["']description["']/i);

    // Extract H2/H3 headings
    const headingMatches = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)];
    const headings = headingMatches
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .slice(0, 10)
      .join(" | ");

    // Extract body text snippet — strip tags, collapse whitespace, take first 500 chars
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodySnippet = bodyMatch
      ? bodyMatch[1]
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500)
      : "";

    return { url, title, h1, headings, metaDescription, bodySnippet };
  } catch {
    return empty;
  }
}

// Batch fetch with concurrency limit
export async function fetchPageMetaBatch(urls: string[], concurrency = 5): Promise<PageMeta[]> {
  const results: PageMeta[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((u) => fetchPageMeta(u)));
    results.push(...batchResults);
  }
  return results;
}
