// Sitemap Service — discovers and parses public XML sitemaps
import { createGunzip } from "zlib";
import { Readable } from "stream";

export interface SitemapURL {
  loc: string;
  lastmod?: string;
  priority?: string;
}

export interface SitemapProgress {
  sitemapsDiscovered: number;
  sitemapsProcessed: number;
  urlsFromSitemaps: number;
  message: string;
}

const FETCH_TIMEOUT = 15_000;
const MAX_SITEMAPS_TO_PROCESS = 150;   // max sitemap files to fetch
const MAX_URLS_PER_SITEMAP = 50_000;   // per individual sitemap file
const MAX_TOTAL_URLS = 200_000;        // hard ceiling across all sitemaps

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── Dedicated robots.txt fetcher (does NOT require XML) ───────────────────────
// fetchText validates XML; robots.txt is plain-text so we need a separate fetcher.

async function fetchRobotsTxt(domain: string): Promise<string | null> {
  const url = `${domain}/robots.txt`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/plain, */*" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    console.log(`[sitemap] robots.txt HTTP ${res.status} | ${url}`);
    if (!res.ok) return null;
    const text = await res.text();
    console.log(`[sitemap] robots.txt body (${text.length} bytes): ${text.slice(0, 200)}`);
    return text;
  } catch (err) {
    console.log(`[sitemap] robots.txt fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Generic XML sitemap fetcher ───────────────────────────────────────────────

async function fetchText(url: string): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/xml, text/xml, application/rss+xml, */*;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") ?? "";
    const finalUrl = res.url ?? url;
    console.log(`[sitemap] HTTP ${res.status} | CT: ${contentType} | ${url}`);

    if (!res.ok) {
      console.log(`[sitemap] SKIP ${url} → HTTP ${res.status}`);
      return null;
    }

    // Handle gzip-encoded sitemaps (.xml.gz or content-encoding: gzip)
    const isGzip = url.endsWith(".gz") || contentType.includes("gzip") ||
      res.headers.get("content-encoding") === "gzip";

    let text: string;
    if (isGzip) {
      try {
        const buffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        text = await new Promise<string>((resolve, reject) => {
          const gunzip = createGunzip();
          const chunks: Buffer[] = [];
          const readable = Readable.from(Buffer.from(uint8));
          readable.pipe(gunzip);
          gunzip.on("data", (chunk: Buffer) => chunks.push(chunk));
          gunzip.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          gunzip.on("error", reject);
        });
        console.log(`[sitemap] Decompressed gzip: ${url} (${uint8.length} → ${text.length} bytes)`);
      } catch (gzipErr) {
        console.log(`[sitemap] SKIP ${url} → gzip decompress failed: ${gzipErr}`);
        return null;
      }
    } else {
      text = await res.text();
    }

    // Strip UTF-8 BOM if present
    const cleaned = text.startsWith("﻿") ? text.slice(1) : text;
    const trimmed = cleaned.trim();

    // Accept only if body looks like XML (regardless of Content-Type header,
    // which some misconfigured servers set to text/html even for valid XML)
    const isXmlBody =
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<sitemapindex") ||
      trimmed.startsWith("<urlset") ||
      trimmed.startsWith("<rss") ||
      // Some sitemaps start directly with the root element after whitespace
      /^<[a-z]/i.test(trimmed);

    if (!isXmlBody) {
      console.log(`[sitemap] SKIP ${url} → not XML (starts with: ${JSON.stringify(trimmed.slice(0, 80))})`);
      return null;
    }

    // Reject HTML disguised as XML (Cloudflare challenges, login redirects)
    if (/<html[\s>]/i.test(trimmed.slice(0, 1000))) {
      console.log(`[sitemap] SKIP ${url} → HTML body (bot protection or login wall)`);
      return null;
    }

    console.log(`[sitemap] OK ${url} | ${trimmed.length} chars | starts: ${JSON.stringify(trimmed.slice(0, 80))}`);
    return { text: cleaned, finalUrl };
  } catch (err) {
    console.log(`[sitemap] SKIP ${url} → ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Extract loc URLs, supporting CDATA and namespaces ────────────────────────
// Handles: <loc>url</loc>  <loc><![CDATA[url]]></loc>  <ns:loc>url</ns:loc>

function extractLocUrl(raw: string): string {
  let val = raw.trim();
  // Strip CDATA wrapper
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)]]>$/);
  if (cdata) val = cdata[1].trim();
  return val.replace(/&amp;/g, "&").replace(/\s+/g, "");
}

// Parse <loc> tags from either a sitemapindex or a urlset (with namespace support)
function parseLocEntries(xml: string): string[] {
  const locs: string[] = [];
  // Match <loc> or namespace-qualified <ns:loc> — no attributes expected on loc
  const regex = /<(?:[a-z]+:)?loc[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const url = extractLocUrl(m[1]);
    if (url && url.startsWith("http")) locs.push(url);
  }
  return locs;
}

// Is this XML document a sitemapindex (vs a urlset)?
function detectSitemapType(xml: string): "index" | "urlset" | "unknown" {
  const head = xml.slice(0, 3000).toLowerCase();
  if (/<sitemapindex[\s>]/i.test(head)) return "index";
  if (/<urlset[\s>]/i.test(head)) return "urlset";
  if (/<sitemap[\s>]/i.test(head)) return "index";
  if (/<url[\s>]/i.test(head)) return "urlset";
  return "unknown";
}

// Parse full URL entries from a urlset (with lastmod/priority), namespace-safe
function parseUrlsetEntries(xml: string): SitemapURL[] {
  const urls: SitemapURL[] = [];
  // Split on </url> or </ns:url>
  const urlBlocks = xml.split(/<\/(?:[a-z]+:)?url>/i);
  let count = 0;
  for (const block of urlBlocks) {
    if (count >= MAX_URLS_PER_SITEMAP) break;
    const locMatch = block.match(/<(?:[a-z]+:)?loc[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?loc>/i);
    if (!locMatch) continue;
    const loc = extractLocUrl(locMatch[1]);
    if (!loc || !loc.startsWith("http")) continue;
    const lastmodMatch = block.match(/<(?:[a-z]+:)?lastmod[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?lastmod>/i);
    const priorityMatch = block.match(/<(?:[a-z]+:)?priority[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?priority>/i);
    urls.push({
      loc,
      lastmod: lastmodMatch?.[1]?.trim(),
      priority: priorityMatch?.[1]?.trim(),
    });
    count++;
  }
  return urls;
}

// ── robots.txt → Sitemap directives ─────────────────────────────────────────

async function getSitemapsFromRobots(domain: string): Promise<string[]> {
  const text = await fetchRobotsTxt(domain);
  if (!text) return [];
  const found: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^Sitemap:\s*(.+)/i);
    if (m) {
      const sitemapUrl = m[1].trim();
      console.log(`[sitemap] robots.txt → Sitemap: ${sitemapUrl}`);
      found.push(sitemapUrl);
    }
  }
  return found;
}

// ── Build initial candidate queue ─────────────────────────────────────────────

async function buildSitemapQueue(domain: string): Promise<string[]> {
  const seen = new Set<string>();
  const queue: string[] = [];

  const add = (url: string) => {
    const normalized = url.split("?")[0].replace(/\/$/, "");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      queue.push(url);
    }
  };

  // 1. robots.txt — highest priority (may reveal exact sitemap paths)
  const fromRobots = await getSitemapsFromRobots(domain);
  for (const s of fromRobots) add(s);

  // 2. Well-known locations in order of popularity
  const commonPaths = [
    // Generic / universal
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    // WordPress (5.5+ default)
    "/wp-sitemap.xml",
    // WordPress plugins (Yoast, AIOSEO, Rank Math, All-in-One)
    "/sitemap_index.xml",
    "/post-sitemap.xml",
    "/page-sitemap.xml",
    "/category-sitemap.xml",
    "/tag-sitemap.xml",
    "/news-sitemap.xml",
    // Rank Math
    "/sitemap-index.xml",
    // Squarespace / Wix / Shopify / HubSpot
    "/sitemap-1.xml",
    "/sitemap-2.xml",
    "/sitemap-3.xml",
    // Blogspot / Blogger
    "/sitemap.xml?page=1",
    // Generic variants
    "/sitemap/sitemap.xml",
    "/sitemap/index.xml",
    "/sitemap-articles.xml",
    "/sitemap-posts.xml",
    "/sitemap/articles/",
    "/sitemap/sitemap-index.xml",
    "/sitemap_post.xml",
    "/sitemaps/sitemap.xml",
    "/sitemaps/sitemap-index.xml",
    // Webflow / custom
    "/sitemap/",
    "/feed/sitemap.xml",
  ];
  for (const path of commonPaths) add(`${domain}${path}`);

  return queue;
}

// ── Main crawler ──────────────────────────────────────────────────────────────

export async function crawlSitemap(
  inputUrl: string,
  onProgress?: (p: SitemapProgress) => void
): Promise<{
  urls: SitemapURL[];
  sitemapsFound: string[];
  sitemapsProcessed: number;
  error?: string;
}> {
  let domain: string;
  try {
    const parsed = new URL(inputUrl);
    domain = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return { urls: [], sitemapsFound: [], sitemapsProcessed: 0, error: "Invalid URL" };
  }

  console.log(`[sitemap] ══ Starting sitemap crawl for ${domain} ══`);

  const initialQueue = await buildSitemapQueue(domain);
  console.log(`[sitemap] Initial candidates: ${initialQueue.length}`);

  const queue: string[] = [...initialQueue];
  const visitedSitemaps = new Set<string>();
  const allUrls: SitemapURL[] = [];
  const urlLocsSeen = new Set<string>();
  const sitemapsFound: string[] = [];
  let sitemapsProcessed = 0;

  const report = () => {
    onProgress?.({
      sitemapsDiscovered: sitemapsFound.length,
      sitemapsProcessed,
      urlsFromSitemaps: allUrls.length,
      message: `${sitemapsFound.length} sitemaps · ${allUrls.length.toLocaleString()} URLs`,
    });
  };

  while (queue.length > 0 && sitemapsProcessed < MAX_SITEMAPS_TO_PROCESS && allUrls.length < MAX_TOTAL_URLS) {
    const sitemapUrl = queue.shift()!;

    const normalizedUrl = sitemapUrl.split("?")[0].replace(/\/$/, "");
    if (visitedSitemaps.has(normalizedUrl)) {
      console.log(`[sitemap] ALREADY SEEN: ${sitemapUrl}`);
      continue;
    }
    visitedSitemaps.add(normalizedUrl);

    onProgress?.({
      sitemapsDiscovered: sitemapsFound.length,
      sitemapsProcessed,
      urlsFromSitemaps: allUrls.length,
      message: `Fetching: ${sitemapUrl}`,
    });

    const result = await fetchText(sitemapUrl);
    if (!result) continue;

    const { text } = result;
    const docType = detectSitemapType(text);
    console.log(`[sitemap] ─ type=${docType} | ${text.length}B | ${sitemapUrl}`);

    if (docType === "index") {
      const childSitemapUrls = parseLocEntries(text);
      sitemapsFound.push(sitemapUrl);
      sitemapsProcessed++;

      console.log(`[sitemap] Index → ${childSitemapUrls.length} child sitemaps`);
      let newChildren = 0;
      for (const childUrl of childSitemapUrls) {
        const normChild = childUrl.split("?")[0].replace(/\/$/, "");
        if (!visitedSitemaps.has(normChild)) {
          queue.unshift(childUrl); // prioritize children over remaining candidates
          newChildren++;
        }
      }
      console.log(`[sitemap] Queued ${newChildren} children (queue=${queue.length})`);
      report();

    } else if (docType === "urlset" || docType === "unknown") {
      const entries = parseUrlsetEntries(text);
      sitemapsFound.push(sitemapUrl);
      sitemapsProcessed++;

      if (entries.length === 0 && docType === "unknown") {
        // Malformed index — treat any .xml locs as child sitemaps
        const locs = parseLocEntries(text);
        const xmlLocs = locs.filter((l) => l.endsWith(".xml") || l.endsWith(".xml.gz") || l.includes("sitemap"));
        if (xmlLocs.length > 0) {
          console.log(`[sitemap] Unknown type, treating ${xmlLocs.length} locs as child sitemaps`);
          for (const childUrl of xmlLocs) {
            const normChild = childUrl.split("?")[0].replace(/\/$/, "");
            if (!visitedSitemaps.has(normChild)) queue.push(childUrl);
          }
          report();
          continue;
        }
      }

      let added = 0;
      for (const entry of entries) {
        if (allUrls.length >= MAX_TOTAL_URLS) break;
        if (!urlLocsSeen.has(entry.loc)) {
          urlLocsSeen.add(entry.loc);
          allUrls.push(entry);
          added++;
        }
      }
      console.log(`[sitemap] Urlset: ${entries.length} entries → ${added} new (total ${allUrls.length})`);
      report();
    }
  }

  console.log(`[sitemap] ══ Done: ${sitemapsFound.length} sitemaps, ${allUrls.length} URLs ══`);
  console.log(`[sitemap] Sitemaps: ${sitemapsFound.join(" | ")}`);

  return { urls: allUrls, sitemapsFound, sitemapsProcessed };
}
