// Site Content Discovery Engine
//
// Generic multi-level discovery for any public website.
// Does NOT assume any specific URL structure, CMS, or site architecture.
//
// Discovery pipeline:
//   Homepage → classify links → hub pages → article links + pagination → merge
//
// "Hub" pages = pages that CONTAIN article links (categories, archives, nav sections).
// We crawl hub pages one level deep to find the articles inside them.
// This handles sites where the homepage links to categories, not directly to articles.

const FETCH_TIMEOUT = 8_000;
const MAX_BODY_SIZE = 800_000;

// Hub crawl settings
const MAX_HUBS_TO_CRAWL = 30;    // max category/nav/archive pages to follow
const HUB_CONCURRENCY = 8;       // concurrent hub page fetches
const MAX_PAGINATION_PER_HUB = 2; // max pagination pages to follow per hub (rel=next only)
const MAX_LINKS_PER_PAGE = 2000;

export interface SiteDiscoveryResult {
  articleLinks: string[];
  hubsFound: number;
  hubsCrawled: number;
  paginationPagesCrawled: number;
  homepageLinksFound: number;
  totalLinksFound: number;
  error?: string;
}

// ── HTML fetcher ──────────────────────────────────────────────────────────────

async function fetchHtml(url: string, timeout = FETCH_TIMEOUT): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(timeout),
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
    const urlFields = ["url", "href", "link", "canonicalUrl", "canonical", "slug", "path", "articleUrl", "articleLink", "contentUrl"];
    for (const field of urlFields) {
      if (typeof rec[field] === "string") {
        urls.push(...extractUrlsFromJson(rec[field], baseDomain, depth + 1));
      }
    }
    for (const [key, val] of Object.entries(rec)) {
      if (urlFields.includes(key)) continue;
      if (key === "__html" || key === "html" || key === "innerHTML") continue;
      urls.push(...extractUrlsFromJson(val, baseDomain, depth + 1));
    }
  }

  return urls;
}

// ── Scan script tags for URL-pattern strings ──────────────────────────────────

function extractScriptTagUrls(html: string, baseDomain: string): string[] {
  const urls: string[] = [];
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

// ── URL utility functions ────────────────────────────────────────────────────

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

// Utility/legal slugs that should never be crawled
const UTILITY_SLUGS = new Set([
  "privacy-policy", "privacy", "cookie-policy", "cookie-notice", "cookie-statement", "cookies",
  "terms-of-service", "terms-and-conditions", "terms-conditions", "terms-of-use", "terms", "tos",
  "disclaimer", "legal", "legal-notice", "copyright", "dmca", "gdpr", "ccpa",
  "affiliate-disclosure", "disclosure", "earnings-disclaimer",
  "contact", "contact-us", "contact-me", "about", "about-us", "about-me", "our-story",
  "team", "our-team", "meet-the-team", "who-we-are",
  "login", "log-in", "signin", "sign-in", "logout", "log-out", "signout", "sign-out",
  "register", "signup", "sign-up", "create-account", "join", "membership",
  "forgot-password", "reset-password",
  "account", "my-account", "profile", "settings", "preferences", "dashboard",
  "cart", "basket", "shopping-cart", "checkout", "order", "orders", "payment", "billing",
  "subscription", "subscriptions", "wishlist", "wish-list", "favorites",
  "sitemap", "subscribe", "unsubscribe", "newsletter", "newsletter-signup",
  "advertise", "advertising", "press", "press-kit", "media-kit", "newsroom",
  "accessibility", "search", "404", "not-found", "error", "maintenance", "coming-soon",
  "thank-you", "thanks", "success", "confirmation", "rss", "feed", "atom",
]);

// Path segments that indicate non-crawlable paths
const EXCLUDED_SEGMENTS = new Set([
  "wp-admin", "wp-json", "wp-login", "wp-content",
  "api", "graphql", "webhook", "cdn", "static", "assets",
  "auth", "oauth", "sso", "checkout", "payment", "admin",
]);

// ── Hub page detection ────────────────────────────────────────────────────────
// A "hub" is a page that aggregates article links — category pages, archive
// pages, navigation sections, blog indexes, topic pages, etc.
// Heuristic: shallow URL (1-2 path segments) that isn't a utility page and
// isn't already an obvious article (long descriptive slug).

function looksLikeHub(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== baseDomain) return false;
    const path = parsed.pathname;
    if (path === "/" || path === "") return false;
    // Skip files
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml|json|rss|mp4|mp3|woff|ttf)$/i.test(path)) return false;
    // Skip pagination
    if (/\/(page\/\d+|p\/\d+)\/?$/i.test(path)) return false;

    const segs = path.split("/").filter(Boolean);

    // Skip technical path segments
    if (segs.some(s => EXCLUDED_SEGMENTS.has(s))) return false;

    // Hub pages are shallow: 1 or 2 path segments
    if (segs.length < 1 || segs.length > 2) return false;

    const finalSeg = segs.at(-1) ?? "";
    if (finalSeg.length < 2) return false;

    // Skip utility slugs
    if (UTILITY_SLUGS.has(finalSeg)) return false;

    // An article slug typically has 5+ hyphen-separated words (long descriptive title).
    // A hub slug is shorter (1-4 words): "living-room", "home-decor", "diy-projects".
    // Note: some short articles exist, but crawling them as hubs is harmless —
    // if they don't contain article links, we just get 0 additional URLs from them.
    if (finalSeg.split("-").length >= 6) return false; // very likely an article, not a hub

    return true;
  } catch {
    return false;
  }
}

// ── Article URL detection ────────────────────────────────────────────────────
// Broad filter: keeps any URL that could be editorial content.
// False positives (category pages, etc.) are removed later by classifyPage().

function looksLikeArticle(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== baseDomain) return false;
    const path = parsed.pathname;
    if (path === "/" || path === "") return false;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml|json|rss|mp4|mp3)$/i.test(path)) return false;
    if (/\/(wp-admin|wp-json|wp-content|feed|rss|api|cdn|assets|static|images|img|fonts|tag|tags|author|search|login|signup|register|cart|checkout|account|sitemap)\//i.test(path)) return false;
    if (/\/(page\/\d+|p\/\d+)\/?$/i.test(path)) return false;
    const segs = path.split("/").filter(Boolean);
    if (segs.length < 1) return false;
    const finalSeg = segs.at(-1) ?? "";
    if (UTILITY_SLUGS.has(finalSeg)) return false;
    // Must have a descriptive slug (hyphen, long, or numeric ID) or be 2+ levels deep
    return finalSeg.includes("-") || finalSeg.length > 12 || /^\d+$/.test(finalSeg) || segs.length >= 2;
  } catch {
    return false;
  }
}

// ── Extract rel=next pagination URL ──────────────────────────────────────────

function extractRelNextUrl(html: string, baseUrl: string): string | null {
  const m = html.match(/rel=["']next["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']next["']/i);
  if (!m) return null;
  const href = m[1] || m[2];
  try { return new URL(href, new URL(baseUrl).href).href; } catch { return null; }
}

// ── All-source link extraction ────────────────────────────────────────────────

function extractAllLinks(html: string, pageUrl: string, baseDomain: string): string[] {
  return [
    ...extractHtmlLinks(html, pageUrl, baseDomain),
    ...extractNextDataUrls(html, baseDomain),
    ...extractInlineStateUrls(html, baseDomain),
    ...extractJsonLdUrls(html, baseDomain),
    ...extractScriptTagUrls(html, baseDomain),
  ];
}

// ── Main discovery function ───────────────────────────────────────────────────
//
// Generic two-phase internal discovery:
//   Phase A: Homepage → classify links → identify article candidates + hub candidates
//   Phase B: Crawl hub pages concurrently → extract articles + follow rel=next pagination
//
// Works for any public website regardless of URL structure or CMS.

export async function discoverSiteContent(
  domain: string,
  onProgress?: (msg: string) => void,
): Promise<SiteDiscoveryResult> {
  let baseDomain: string;
  try {
    baseDomain = new URL(domain).hostname;
  } catch {
    return { articleLinks: [], hubsFound: 0, hubsCrawled: 0, paginationPagesCrawled: 0, homepageLinksFound: 0, totalLinksFound: 0, error: "Invalid URL" };
  }

  const articleSetNorm = new Set<string>(); // normalized form for dedup
  const articleLinks: string[] = [];         // original URLs (for fetching)
  const hubUrlsNorm = new Set<string>();
  const hubUrls: string[] = [];
  let totalLinksFound = 0;
  let paginationPagesCrawled = 0;

  const addArticle = (url: string) => {
    const norm = normalizeUrl(url);
    if (!articleSetNorm.has(norm)) {
      articleSetNorm.add(norm);
      articleLinks.push(url);
    }
  };

  // ── Phase A: Homepage discovery ───────────────────────────────────────────
  onProgress?.("Crawling homepage for supplemental links…");
  const homepageHtml = await fetchHtml(domain);
  if (!homepageHtml) {
    return { articleLinks: [], hubsFound: 0, hubsCrawled: 0, paginationPagesCrawled: 0, homepageLinksFound: 0, totalLinksFound: 0, error: "Homepage unreachable" };
  }

  const homepageLinks = extractAllLinks(homepageHtml, domain, baseDomain);
  totalLinksFound += homepageLinks.length;

  for (const link of homepageLinks.slice(0, MAX_LINKS_PER_PAGE)) {
    if (looksLikeArticle(link, baseDomain)) addArticle(link);
    if (looksLikeHub(link, baseDomain)) {
      const norm = normalizeUrl(link);
      if (!hubUrlsNorm.has(norm)) {
        hubUrlsNorm.add(norm);
        hubUrls.push(link);
      }
    }
  }

  // ── Phase B: Hub page crawl ───────────────────────────────────────────────
  const toProcess = hubUrls.slice(0, MAX_HUBS_TO_CRAWL);
  let hubsCrawled = 0;

  if (toProcess.length > 0) {
    onProgress?.(`Discovered ${toProcess.length} content hub${toProcess.length === 1 ? "" : "s"} — crawling for article links…`);
  }

  for (let i = 0; i < toProcess.length; i += HUB_CONCURRENCY) {
    const batch = toProcess.slice(i, i + HUB_CONCURRENCY);
    const htmlResults = await Promise.all(batch.map(url => fetchHtml(url)));

    // Also collect pagination URLs discovered from this batch
    const paginationUrls: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const html = htmlResults[j];
      if (!html) continue;

      hubsCrawled++;
      const hubUrl = batch[j];

      const hubLinks = extractAllLinks(html, hubUrl, baseDomain);
      totalLinksFound += hubLinks.length;

      for (const link of hubLinks.slice(0, MAX_LINKS_PER_PAGE)) {
        if (looksLikeArticle(link, baseDomain)) addArticle(link);
      }

      // Discover rel=next pagination (only — no URL guessing)
      const nextUrl = extractRelNextUrl(html, hubUrl);
      if (nextUrl && !hubUrlsNorm.has(normalizeUrl(nextUrl))) {
        paginationUrls.push(nextUrl);
      }
    }

    // Follow pagination pages discovered in this batch (limited)
    const pagToFollow = paginationUrls.slice(0, MAX_PAGINATION_PER_HUB * HUB_CONCURRENCY);
    if (pagToFollow.length > 0) {
      const pagHtmls = await Promise.all(pagToFollow.map(url => fetchHtml(url)));
      for (let k = 0; k < pagToFollow.length; k++) {
        const html = pagHtmls[k];
        if (!html) continue;
        paginationPagesCrawled++;
        const pagLinks = extractHtmlLinks(html, pagToFollow[k], baseDomain);
        totalLinksFound += pagLinks.length;
        for (const link of pagLinks.slice(0, MAX_LINKS_PER_PAGE)) {
          if (looksLikeArticle(link, baseDomain)) addArticle(link);
        }
      }
    }

    onProgress?.(`Hub discovery: ${Math.min(i + HUB_CONCURRENCY, toProcess.length)}/${toProcess.length} hubs crawled — ${articleLinks.length} article links so far…`);
  }

  return {
    articleLinks,
    hubsFound: toProcess.length,
    hubsCrawled,
    paginationPagesCrawled,
    homepageLinksFound: homepageLinks.length,
    totalLinksFound,
  };
}

// ── Legacy export (kept for compatibility) ────────────────────────────────────
// Delegates to discoverSiteContent.

export interface CrawledPageResult {
  articleLinks: string[];
  paginationPagesVisited: number;
  totalLinksFound: number;
  error?: string;
}

export async function crawlCategoryPage(inputUrl: string): Promise<CrawledPageResult> {
  const result = await discoverSiteContent(inputUrl);
  return {
    articleLinks: result.articleLinks,
    paginationPagesVisited: result.paginationPagesCrawled,
    totalLinksFound: result.totalLinksFound,
    error: result.error,
  };
}
