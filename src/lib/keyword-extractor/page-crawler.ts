// Page Crawler — fetches public pages and extracts title/H1/headings
// Lightweight: uses regex on raw HTML, no headless browser

const FETCH_TIMEOUT = 5000;
const MAX_BODY_SIZE = 500_000; // 500KB — enough to capture article body

export interface PageMeta {
  url: string;
  title: string;
  ogTitle: string;         // Open Graph title
  canonical: string;       // canonical URL if present
  h1: string;
  headings: string;        // concatenated H2/H3 text
  metaDescription: string;
  breadcrumbs: string;     // breadcrumb trail text
  bodySnippet: string;     // first ~800 chars of article body text
  datePublished?: string;  // ISO date string if found
  dateModified?: string;
  schemaTypes?: string[];  // JSON-LD @type values found on the page
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

// Extract a date field from JSON-LD blocks (datePublished / dateModified)
function extractDate(html: string, field: string): string | undefined {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]) as Record<string, unknown>;
      const val = json[field];
      if (typeof val === "string" && val) return val;
    } catch { /* */ }
  }
  return undefined;
}

export async function fetchPageMeta(url: string): Promise<PageMeta> {
  const empty: PageMeta = { url, title: "", ogTitle: "", canonical: "", h1: "", headings: "", metaDescription: "", breadcrumbs: "", bodySnippet: "", datePublished: undefined, dateModified: undefined, schemaTypes: [] };
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
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
    const ogTitle = extractTag(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)/i)
      || extractTag(html, /<meta[^>]*content=["']([^"']*?)["'][^>]*property=["']og:title["']/i);
    const canonical = extractTag(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)/i)
      || extractTag(html, /<link[^>]*href=["']([^"']*?)["'][^>]*rel=["']canonical["']/i);
    const h1 = extractTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "").trim();
    const metaDescription = extractTag(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)
      || extractTag(html, /<meta[^>]*content=["']([^"']*?)["'][^>]*name=["']description["']/i);

    // Extract H2/H3 headings
    const headingMatches = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)];
    const headings = headingMatches
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .slice(0, 15)
      .join(" | ");

    // Extract breadcrumbs from JSON-LD BreadcrumbList or aria-label="breadcrumb"
    let breadcrumbs = "";
    const ldRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let ldm: RegExpExecArray | null;
    while ((ldm = ldRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(ldm[1]) as Record<string, unknown>;
        const items = (json["@type"] === "BreadcrumbList" ? (json.itemListElement as Array<Record<string,unknown>> | undefined) : null) ?? [];
        if (items.length > 0) {
          breadcrumbs = items.map((i) => (i.name as string) ?? "").filter(Boolean).join(" > ");
          break;
        }
      } catch { /* */ }
    }

    // Extract body text — prefer <article> tag, fall back to <body>
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const bodyMatch = articleMatch ?? html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodySnippet = bodyMatch
      ? bodyMatch[1]
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 800)
      : "";

    // Extract dates — check meta tags, JSON-LD, and og tags
    const datePublished = extractDate(html, "datePublished") ||
      extractTag(html, /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*)/i) ||
      extractTag(html, /<meta[^>]*name=["']publish[_-]?date["'][^>]*content=["']([^"']*)/i) || undefined;
    const dateModified = extractDate(html, "dateModified") ||
      extractTag(html, /<meta[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']*)/i) || undefined;

    // Extract all @type values from JSON-LD blocks
    const schemaTypes: string[] = [];
    const schemaRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = schemaRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(sm[1]) as Record<string, unknown>;
        const typeVal = json["@type"];
        if (typeof typeVal === "string" && typeVal) schemaTypes.push(typeVal);
        else if (Array.isArray(typeVal)) typeVal.forEach((t) => typeof t === "string" && t && schemaTypes.push(t));
      } catch { /* */ }
    }

    return { url, title, ogTitle, canonical, h1, headings, metaDescription, breadcrumbs, bodySnippet, datePublished, dateModified, schemaTypes };
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
