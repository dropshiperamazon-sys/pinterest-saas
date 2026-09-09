// Category/listing page crawler — extracts article links directly from HTML pages.
// Used when the submitted URL is a category/archive/listing page rather than a root domain.

const FETCH_TIMEOUT = 10_000;
const MAX_BODY_SIZE = 500_000; // 500KB — enough for large listing pages
const MAX_PAGINATION_PAGES = 6; // follow up to 6 pagination pages
const MAX_LINKS_PER_PAGE = 500;

export interface CrawledPageResult {
  articleLinks: string[];          // unique article URLs found across all pages
  paginationPagesVisited: number;
  totalLinksFound: number;
  error?: string;
}

// ── HTML fetcher ──────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KeywordExtractorBot/1.0; +https://mypinpro.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    // Stream-read with size cap
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

// ── Extract all <a href> links from HTML, resolve to absolute URLs ────────────

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links: string[] = [];
  const regex = /href=["']([^"'#?][^"']*?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], base.origin + base.pathname);
      // Only keep links on the same domain
      if (resolved.hostname !== base.hostname) continue;
      // Strip query strings and fragments for article links
      resolved.search = "";
      resolved.hash = "";
      links.push(resolved.href);
    } catch {
      // skip malformed
    }
  }
  return links;
}

// ── Detect pagination links ───────────────────────────────────────────────────
// Looks for "next page" patterns: ?page=N, /page/N/, /2/, rel="next"

function extractPaginationLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const candidates: string[] = [];

  // rel="next" is the most reliable signal
  const relNext = html.match(/rel=["']next["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']next["']/i);
  if (relNext) {
    const href = relNext[1] || relNext[2];
    try { candidates.push(new URL(href, base.href).href); } catch { /* skip */ }
  }

  // Page number patterns
  const pagePatterns = [
    /href=["']([^"']*[?&]page=(\d+)[^"']*)["']/gi,
    /href=["']([^"']*\/page\/(\d+)\/?[^"']*)["']/gi,
    /href=["']([^"']*\/p\/(\d+)\/?[^"']*)["']/gi,
  ];

  const currentPage = detectCurrentPageNumber(baseUrl);

  for (const pat of pagePatterns) {
    let m: RegExpExecArray | null;
    pat.lastIndex = 0;
    while ((m = pat.exec(html)) !== null) {
      const pageNum = parseInt(m[2], 10);
      if (pageNum <= currentPage || pageNum > currentPage + MAX_PAGINATION_PAGES) continue;
      try {
        const link = new URL(m[1], base.origin);
        link.hash = "";
        candidates.push(link.href);
      } catch { /* skip */ }
    }
  }

  return [...new Set(candidates)];
}

function detectCurrentPageNumber(url: string): number {
  try {
    const u = new URL(url);
    const pageParam = u.searchParams.get("page");
    if (pageParam) return parseInt(pageParam, 10) || 1;
    const pathMatch = url.match(/\/page\/(\d+)/i) || url.match(/\/p\/(\d+)/i);
    if (pathMatch) return parseInt(pathMatch[1], 10) || 1;
  } catch { /* */ }
  return 1;
}

// ── Article URL classifier ────────────────────────────────────────────────────
// Same logic as isArticleUrl in relevance-engine but callable here too.

function looksLikeArticle(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== baseDomain) return false;
    const path = parsed.pathname;
    if (path === "/" || path === "") return false;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml|json|rss)$/i.test(path)) return false;
    if (/\/(wp-admin|wp-json|feed|rss|api|cdn|assets|static|images|img|js|css|fonts|tag|tags|author|search|login|signup|register|cart|checkout|account|wp-content)\//i.test(path)) return false;
    if (/\/(page\/\d+|p\/\d+)\/?$/i.test(path)) return false;  // pagination pages themselves
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 1) return false;
    const slug = segments.at(-1) ?? "";
    // Article-like: has hyphens OR is long enough, and has at least 2 path segments
    return (slug.includes("-") || slug.length > 15) && segments.length >= 2;
  } catch {
    return false;
  }
}

// Normalize URL: remove trailing slash variation, lowercase hostname
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    // Ensure consistent trailing slash treatment: always add trailing slash
    if (!u.pathname.includes(".") && !u.pathname.endsWith("/")) {
      u.pathname += "/";
    }
    return u.href.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
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
  const articleSet = new Set<string>();  // normalized article URLs
  const articleLinks: string[] = [];     // originals for return
  let paginationPagesVisited = 0;
  let totalLinksFound = 0;

  // Queue starting with the submitted URL
  const queue: string[] = [inputUrl];
  // We also add the first few pagination pages proactively
  // (some sites don't emit rel="next" but do have predictable URL patterns)
  for (let pg = 2; pg <= MAX_PAGINATION_PAGES; pg++) {
    try {
      const u = new URL(inputUrl);
      // Try ?page=N
      const byParam = new URL(u.href);
      byParam.searchParams.set("page", String(pg));
      queue.push(byParam.href);
      // Try /page/N/ suffix on path
      const byPath = new URL(u.href);
      byPath.pathname = byPath.pathname.replace(/\/$/, "") + `/page/${pg}/`;
      queue.push(byPath.href);
    } catch { /* */ }
  }

  for (const pageUrl of queue) {
    const norm = pageUrl.toLowerCase();
    if (visited.has(norm)) continue;
    visited.add(norm);

    const html = await fetchHtml(pageUrl);
    if (!html) continue;

    if (pageUrl !== inputUrl) paginationPagesVisited++;

    // Extract all links from this page
    const allLinks = extractLinks(html, pageUrl);
    totalLinksFound += allLinks.length;

    // Filter to article-like links
    for (const link of allLinks.slice(0, MAX_LINKS_PER_PAGE)) {
      if (!looksLikeArticle(link, baseDomain)) continue;
      const normLink = normalizeUrl(link);
      if (!articleSet.has(normLink)) {
        articleSet.add(normLink);
        articleLinks.push(link);
      }
    }

    // Discover pagination from this page's HTML (rel="next" etc.)
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
