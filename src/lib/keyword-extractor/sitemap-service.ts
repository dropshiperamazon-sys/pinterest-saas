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

const FETCH_TIMEOUT = 12_000;
const MAX_SITEMAPS_TO_PROCESS = 100;   // max sitemap files to fetch
const MAX_URLS_PER_SITEMAP = 15_000;   // per individual sitemap file
const MAX_TOTAL_URLS = 50_000;         // hard ceiling across all sitemaps

async function fetchText(url: string): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KeywordExtractorBot/1.0; +https://mypinpro.com/bot)",
        "Accept": "application/xml, text/xml, */*",
        // Request identity to avoid getting gzip binary that text() can't decode
        "Accept-Encoding": "identity",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: "follow",
    });
    if (!res.ok) {
      console.log(`[sitemap] SKIP ${url} → HTTP ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    const finalUrl = res.url ?? url;

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
    if (!trimmed.startsWith("<") && !trimmed.startsWith("<?")) {
      console.log(`[sitemap] SKIP ${url} → not XML (starts with: ${JSON.stringify(trimmed.slice(0, 60))})`);
      return null;
    }
    return { text: cleaned, finalUrl };
  } catch (err) {
    console.log(`[sitemap] SKIP ${url} → ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// Parse <loc> tags from either a sitemapindex or a urlset
function parseLocEntries(xml: string): string[] {
  const locs: string[] = [];
  // Use multiline-safe regex: \s* handles newlines around the URL
  const regex = /<loc[\s>][^<]*>([\s\S]*?)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const url = m[1].trim().replace(/&amp;/g, "&").replace(/\s+/g, "");
    if (url && url.startsWith("http")) locs.push(url);
  }
  return locs;
}

// Is this XML document a sitemapindex (vs a urlset)?
function detectSitemapType(xml: string): "index" | "urlset" | "unknown" {
  const head = xml.slice(0, 2000).toLowerCase();
  if (/<sitemapindex[\s>]/i.test(head)) return "index";
  if (/<urlset[\s>]/i.test(head)) return "urlset";
  // Fallback: if it has <sitemap> children it's an index, if <url> children it's a urlset
  if (/<sitemap[\s>]/i.test(head)) return "index";
  if (/<url[\s>]/i.test(head)) return "urlset";
  return "unknown";
}

// Parse full URL entries from a urlset (with lastmod/priority)
function parseUrlsetEntries(xml: string): SitemapURL[] {
  const urls: SitemapURL[] = [];
  const urlBlocks = xml.split(/<\/url>/i);
  let count = 0;
  for (const block of urlBlocks) {
    if (count >= MAX_URLS_PER_SITEMAP) break;
    const locMatch = block.match(/<loc[\s>][^<]*>([\s\S]*?)<\/loc>/i);
    if (!locMatch) continue;
    const loc = locMatch[1].trim().replace(/&amp;/g, "&").replace(/\s+/g, "");
    if (!loc || !loc.startsWith("http")) continue;
    const lastmodMatch = block.match(/<lastmod[\s>][^<]*>([\s\S]*?)<\/lastmod>/i);
    const priorityMatch = block.match(/<priority[\s>][^<]*>([\s\S]*?)<\/priority>/i);
    urls.push({
      loc,
      lastmod: lastmodMatch?.[1]?.trim(),
      priority: priorityMatch?.[1]?.trim(),
    });
    count++;
  }
  return urls;
}

// Read robots.txt and extract Sitemap: directives
async function getSitemapsFromRobots(domain: string): Promise<string[]> {
  const robotsUrl = `${domain}/robots.txt`;
  console.log(`[sitemap] Fetching robots.txt: ${robotsUrl}`);
  const result = await fetchText(robotsUrl);
  if (!result) return [];
  const found: string[] = [];
  for (const line of result.text.split("\n")) {
    const m = line.match(/^Sitemap:\s*(.+)/i);
    if (m) {
      const sitemapUrl = m[1].trim();
      console.log(`[sitemap] robots.txt → Sitemap: ${sitemapUrl}`);
      found.push(sitemapUrl);
    }
  }
  return found;
}

// Build the initial list of sitemap candidates to try
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

  // 1. robots.txt — highest priority
  const fromRobots = await getSitemapsFromRobots(domain);
  for (const s of fromRobots) add(s);

  // 2. Common well-known locations
  const commonPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap/sitemap.xml",
    "/sitemap/index.xml",
    "/post-sitemap.xml",
    "/page-sitemap.xml",
    "/category-sitemap.xml",
    "/news-sitemap.xml",
    "/sitemap-articles.xml",
    "/sitemap-posts.xml",
    "/sitemap-1.xml",
    "/sitemap-2.xml",
    "/sitemap/articles/",
    "/sitemap/sitemap-index.xml",
    "/sitemap_post.xml",
    "/sitemaps/sitemap.xml",
  ];
  for (const path of commonPaths) add(`${domain}${path}`);

  return queue;
}

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

  // BFS queue — starts with candidates, grows as indexes are discovered
  const queue: string[] = [...initialQueue];
  const visitedSitemaps = new Set<string>(); // prevent fetching same sitemap twice
  const allUrls: SitemapURL[] = [];
  const urlLocsSeen = new Set<string>(); // dedup article URLs
  const sitemapsFound: string[] = []; // all sitemap files that returned valid XML
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

    // Normalize to prevent fetching the same URL twice
    const normalizedUrl = sitemapUrl.split("?")[0].replace(/\/$/, "");
    if (visitedSitemaps.has(normalizedUrl)) {
      console.log(`[sitemap] ALREADY SEEN: ${sitemapUrl}`);
      continue;
    }
    visitedSitemaps.add(normalizedUrl);

    console.log(`[sitemap] Fetching [${sitemapsProcessed + 1}]: ${sitemapUrl}`);
    onProgress?.({
      sitemapsDiscovered: sitemapsFound.length,
      sitemapsProcessed,
      urlsFromSitemaps: allUrls.length,
      message: `Fetching sitemap [${sitemapsProcessed + 1}]: ${sitemapUrl}`,
    });

    const result = await fetchText(sitemapUrl);
    if (!result) continue;

    const { text } = result;
    const docType = detectSitemapType(text);
    console.log(`[sitemap] → type=${docType}, length=${text.length}`);

    if (docType === "index") {
      // Extract child sitemap URLs and add to queue
      const childSitemapUrls = parseLocEntries(text);
      sitemapsFound.push(sitemapUrl);
      sitemapsProcessed++;

      console.log(`[sitemap] Index has ${childSitemapUrls.length} child sitemaps:`);
      let newChildren = 0;
      for (const childUrl of childSitemapUrls) {
        const normChild = childUrl.split("?")[0].replace(/\/$/, "");
        if (!visitedSitemaps.has(normChild)) {
          console.log(`[sitemap]   → queuing child: ${childUrl}`);
          queue.push(childUrl);
          newChildren++;
        } else {
          console.log(`[sitemap]   → already seen: ${childUrl}`);
        }
      }
      console.log(`[sitemap] Queued ${newChildren} new child sitemaps (queue size: ${queue.length})`);
      report();

    } else if (docType === "urlset" || docType === "unknown") {
      const entries = parseUrlsetEntries(text);
      sitemapsFound.push(sitemapUrl);
      sitemapsProcessed++;

      if (entries.length === 0 && docType === "unknown") {
        // Could be a malformed index — try to extract any <loc> as child sitemaps
        const locs = parseLocEntries(text);
        const xmlLocs = locs.filter((l) => l.endsWith(".xml") || l.endsWith(".xml.gz") || l.includes("sitemap"));
        if (xmlLocs.length > 0) {
          console.log(`[sitemap] Unknown type with 0 urlset entries, trying ${xmlLocs.length} locs as child sitemaps`);
          for (const childUrl of xmlLocs) {
            const normChild = childUrl.split("?")[0].replace(/\/$/, "");
            if (!visitedSitemaps.has(normChild)) {
              queue.push(childUrl);
            }
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
      console.log(`[sitemap] Urlset: ${entries.length} entries, ${added} new (total: ${allUrls.length})`);
      report();
    }
  }

  console.log(`[sitemap] ══ Complete: ${sitemapsFound.length} sitemaps processed, ${allUrls.length} URLs ══`);
  console.log(`[sitemap] Sitemaps: ${sitemapsFound.join(", ")}`);

  return { urls: allUrls, sitemapsFound, sitemapsProcessed };
}
