// Category/listing page crawler — extracts article links directly from HTML pages.
// Handles both traditional HTML <a> links and modern JS-rendered sites by parsing
// embedded JSON (__NEXT_DATA__, JSON-LD, Gatsby, and inline script URL patterns).

const FETCH_TIMEOUT = 12_000;
const MAX_BODY_SIZE = 800_000; // 800KB — enough for Next.js __NEXT_DATA__ payloads
const MAX_PAGINATION_PAGES = 6;
const MAX_LINKS_PER_PAGE = 1000;

export interface CrawledPageResult {
  articleLinks: string[];
  paginationPagesVisited: number;
  totalLinksFound: number;
  error?: string;
}

// ── HTML fetcher ──────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
      if (total >= MAX_BODY_SIZE) { reader.cancel(); break; }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }
    return new TextDecoder().decode(merged);
  } catch {
    return null;
  }
}

// ── Extract all <a href> links from HTML ──────────────────────────────────────

function extractHtmlLinks(html: string, baseUrl: string, baseDomain: string): string[] {
  const base = new URL(baseUrl);
  const links: string[] = [];
  const regex = /href=["']([^"'#][^"']*?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], base.origin + base.pathname);
      if (resolved.hostname !== baseDomain) continue;
      resolved.search = "";
      resolved.hash = "";
      links.push(resolved.href);
    } catch { /* skip */ }
  }
  return links;
}

// ── Parse __NEXT_DATA__ (Next.js) ────────────────────────────────────────────
// Next.js embeds the page's initial props as JSON in <script id="__NEXT_DATA__">
// This includes article lists, story cards, etc.

function extractNextDataUrls(html: string, baseDomain: string): string[] {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  try {
    const json = JSON.parse(match[1]);
    return extractUrlsFromJson(json, baseDomain);
  } catch {
    return [];
  }
}

// ── Parse Gatsby / window.__INITIAL_STATE__ / REDUX_STATE ────────────────────

function extractInlineStateUrls(html: string, baseDomain: string): string[] {
  const patterns = [
    /window\.__(?:INITIAL_STATE|REDUX_STATE|APP_STATE|PRELOADED_STATE)__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
    /window\.__(?:GATSBY_DATA|gatsby_cache)__\s*=\s*({[\s\S]*?});?\s*<\/script>/i,
  ];
  const urls: string[] = [];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (!m) continue;
    try {
      const json = JSON.parse(m[1]);
      urls.push(...extractUrlsFromJson(json, baseDomain));
    } catch { /* skip */ }
  }
  return urls;
}

// ── Parse JSON-LD structured data ────────────────────────────────────────────

function extractJsonLdUrls(html: string, baseDomain: string): string[] {
  const urls: string[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      urls.push(...extractUrlsFromJson(json, baseDomain));
    } catch { /* skip */ }
  }
  return urls;
}

// ── Recursively pull all URL-looking strings from a JSON object ───────────────
// Looks for string values that are same-domain URLs, or objects with url/href/link fields

function extractUrlsFromJson(obj: unknown, baseDomain: string, depth = 0): string[] {
  if (depth > 12) return [];
  const urls: string[] = [];

  if (typeof obj === "string") {
    if (obj.startsWith("http") && obj.includes(baseDomain)) {
      try {
        const u = new URL(obj);
        if (u.hostname === baseDomain) {
          u.search = ""; u.hash = "";
          urls.push(u.href);
        }
      } catch { /* */ }
    } else if (obj.startsWith("/") && obj.length > 1 && !obj.startsWith("//")) {
      // Relative path
      if (obj.includes("-") && obj.length > 5) {
        urls.push(`https://${baseDomain}${obj}`);
      }
    }
    return urls;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      urls.push(...extractUrlsFromJson(item, baseDomain, depth + 1));
    }
    return urls;
  }

  if (obj && typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    // Prioritize known URL-carrying field names
    const urlFields = ["url", "href", "link", "canonicalUrl", "canonical", "slug", "path", "articleUrl", "articleLink", "contentUrl"];
    for (const field of urlFields) {
      if (typeof rec[field] === "string") {
        urls.push(...extractUrlsFromJson(rec[field], baseDomain, depth + 1));
      }
    }
    // Recurse into all other fields too
    for (const [key, val] of Object.entries(rec)) {
      if (urlFields.includes(key)) continue; // already processed
      if (key === "__html" || key === "html" || key === "innerHTML") continue; // skip HTML blobs
      urls.push(...extractUrlsFromJson(val, baseDomain, depth + 1));
    }
  }

  return urls;
}

// ── Scan script tags for URL-pattern strings ──────────────────────────────────
// Some sites embed article lists as plain JS arrays of URL strings

function extractScriptTagUrls(html: string, baseDomain: string): string[] {
  const urls: string[] = [];
  // Find all URL strings in script content that match the same domain
  const urlRegex = new RegExp(
    `["']https?://${baseDomain.replace(".", "\\.")}(/[a-z0-9][a-z0-9\\-/_]{10,}?)["']`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(html)) !== null) {
    try {
      const u = new URL(`https://${baseDomain}${m[1]}`);
      u.search = ""; u.hash = "";
      urls.push(u.href);
    } catch { /* */ }
  }
  return urls;
}

// ── Article URL classifier ────────────────────────────────────────────────────

function looksLikeArticle(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== baseDomain) return false;
    const path = parsed.pathname;
    if (path === "/" || path === "") return false;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml|json|rss|mp4|mp3)$/i.test(path)) return false;
    if (/\/(wp-admin|wp-json|wp-content|feed|rss|api|cdn|assets|static|images|img|fonts|tag|tags|author|search|login|signup|register|cart|checkout|account|sitemap)\//i.test(path)) return false;
    if (/\/(page\/\d+|p\/\d+)\/?$/i.test(path)) return false;
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) return false;
    const slug = segments.at(-1) ?? "";
    // Must have a descriptive slug (has hyphens or is long) or be a numeric ID with a parent slug
    return slug.includes("-") || slug.length > 12 || /^\d+$/.test(slug);
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = ""; u.hash = "";
    let path = u.pathname;
    if (path.endsWith("/") && path.length > 1) path = path.slice(0, -1);
    return `${u.hostname}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

// ── Pagination discovery ──────────────────────────────────────────────────────

function detectCurrentPageNumber(url: string): number {
  try {
    const u = new URL(url);
    const p = u.searchParams.get("page") || u.searchParams.get("p");
    if (p) return parseInt(p, 10) || 1;
    const m = url.match(/\/page\/(\d+)/i) || url.match(/\/p\/(\d+)/i);
    if (m) return parseInt(m[1], 10) || 1;
  } catch { /* */ }
  return 1;
}

function extractPaginationLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const candidates: string[] = [];

  // rel="next"
  const relNext = html.match(/rel=["']next["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']next["']/i);
  if (relNext) {
    const href = relNext[1] || relNext[2];
    try { candidates.push(new URL(href, base.href).href); } catch { /* */ }
  }

  return candidates;
}

// ── Main crawl function ───────────────────────────────────────────────────────

export async function crawlCategoryPage(inputUrl: string): Promise<CrawledPageResult> {
  let baseDomain: string;
  try {
    baseDomain = new URL(inputUrl).hostname;
  } catch {
    return { articleLinks: [], paginationPagesVisited: 0, totalLinksFound: 0, error: "Invalid URL" };
  }

  const visited = new Set<string>();
  const articleSet = new Set<string>();
  const articleLinks: string[] = [];
  let paginationPagesVisited = 0;
  let totalLinksFound = 0;

  // Queue: submitted URL + proactive pagination guesses
  const queue: string[] = [inputUrl];
  const currentPage = detectCurrentPageNumber(inputUrl);
  for (let pg = currentPage + 1; pg <= currentPage + MAX_PAGINATION_PAGES; pg++) {
    try {
      const byParam = new URL(inputUrl);
      byParam.searchParams.set("page", String(pg));
      queue.push(byParam.href);
      const byPath = new URL(inputUrl);
      byPath.pathname = byPath.pathname.replace(/\/$/, "") + `/page/${pg}/`;
      queue.push(byPath.href);
    } catch { /* */ }
  }

  for (const pageUrl of queue.slice(0, 1 + MAX_PAGINATION_PAGES * 2)) {
    const normPage = pageUrl.toLowerCase();
    if (visited.has(normPage)) continue;
    visited.add(normPage);

    const html = await fetchHtml(pageUrl);
    if (!html) continue;

    if (pageUrl !== inputUrl) paginationPagesVisited++;

    // Gather links from all extraction methods
    const allLinks: string[] = [
      ...extractHtmlLinks(html, pageUrl, baseDomain),
      ...extractNextDataUrls(html, baseDomain),
      ...extractInlineStateUrls(html, baseDomain),
      ...extractJsonLdUrls(html, baseDomain),
      ...extractScriptTagUrls(html, baseDomain),
    ];

    totalLinksFound += allLinks.length;

    for (const link of allLinks.slice(0, MAX_LINKS_PER_PAGE)) {
      if (!looksLikeArticle(link, baseDomain)) continue;
      const normLink = normalizeUrl(link);
      if (!articleSet.has(normLink)) {
        articleSet.add(normLink);
        articleLinks.push(link);
      }
    }

    // Discover real rel="next" pagination from HTML
    if (paginationPagesVisited < MAX_PAGINATION_PAGES) {
      const pagLinks = extractPaginationLinks(html, pageUrl);
      for (const pg of pagLinks) {
        const pgNorm = pg.toLowerCase();
        if (!visited.has(pgNorm)) queue.push(pg);
      }
    }
  }

  return { articleLinks, paginationPagesVisited, totalLinksFound };
}
