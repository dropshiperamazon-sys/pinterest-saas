// Sitemap Service — discovers and parses public XML sitemaps

export interface SitemapURL {
  loc: string;
  lastmod?: string;
  priority?: string;
}

const FETCH_TIMEOUT = 8000;
const MAX_CHILD_SITEMAPS = 30;          // process up to 30 child sitemaps per index
const MAX_URLS_PER_SITEMAP = 5000;      // per individual sitemap file
const MAX_TOTAL_URLS = 10_000;          // hard ceiling across all sitemaps

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KeywordExtractorBot/1.0; +https://mypinpro.com/bot)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Parse <loc> entries from any sitemap XML (both index and urlset)
function parseLocTags(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const url = m[1].trim().replace(/&amp;/g, "&");
    if (url) locs.push(url);
  }
  return locs;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

// Read robots.txt and extract Sitemap: directives
async function getSitemapsFromRobots(domain: string): Promise<string[]> {
  const robotsUrl = `${domain}/robots.txt`;
  const text = await fetchText(robotsUrl);
  if (!text) return [];
  const found: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^Sitemap:\s*(.+)/i);
    if (m) found.push(m[1].trim());
  }
  return found;
}

// Discover all sitemap URLs for a domain
async function discoverSitemaps(domain: string): Promise<string[]> {
  const candidates = new Set<string>();

  // 1. robots.txt
  const fromRobots = await getSitemapsFromRobots(domain);
  for (const s of fromRobots) candidates.add(s);

  // 2. Common locations
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap/sitemap.xml", "/post-sitemap.xml", "/page-sitemap.xml"]) {
    candidates.add(`${domain}${path}`);
  }

  return Array.from(candidates);
}

// Fetch and collect all leaf URLs from a sitemap (handles index recursion)
async function collectFromSitemap(sitemapUrl: string, depth = 0): Promise<SitemapURL[]> {
  if (depth > 2) return [];
  const text = await fetchText(sitemapUrl);
  if (!text) return [];

  const locs = parseLocTags(text);

  if (isSitemapIndex(text)) {
    // It's an index — each loc is a child sitemap
    const results: SitemapURL[] = [];
    for (const childUrl of locs.slice(0, MAX_CHILD_SITEMAPS)) {
      const childResults = await collectFromSitemap(childUrl, depth + 1);
      results.push(...childResults);
      if (results.length >= MAX_TOTAL_URLS) break;
    }
    return results;
  }

  // It's a urlset — extract lastmod and priority too
  const urls: SitemapURL[] = [];
  const urlBlocks = text.split(/<\/url>/i);
  for (const block of urlBlocks.slice(0, MAX_URLS_PER_SITEMAP)) {
    const locMatch = block.match(/<loc>\s*(.*?)\s*<\/loc>/i);
    if (!locMatch) continue;
    const loc = locMatch[1].trim().replace(/&amp;/g, "&");
    const lastmodMatch = block.match(/<lastmod>\s*(.*?)\s*<\/lastmod>/i);
    const priorityMatch = block.match(/<priority>\s*(.*?)\s*<\/priority>/i);
    urls.push({
      loc,
      lastmod: lastmodMatch?.[1],
      priority: priorityMatch?.[1],
    });
  }

  return urls;
}

export async function crawlSitemap(inputUrl: string): Promise<{ urls: SitemapURL[]; sitemapsFound: string[]; error?: string }> {
  let domain: string;
  try {
    const parsed = new URL(inputUrl);
    domain = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return { urls: [], sitemapsFound: [], error: "Invalid URL" };
  }

  const sitemapUrls = await discoverSitemaps(domain);
  const sitemapsFound: string[] = [];
  const seen = new Set<string>();
  const allUrls: SitemapURL[] = [];

  for (const sitemapUrl of sitemapUrls) {
    const text = await fetchText(sitemapUrl);
    if (!text || !text.trim().startsWith("<")) continue;
    sitemapsFound.push(sitemapUrl);

    const collected = await collectFromSitemap(sitemapUrl);
    for (const u of collected) {
      if (!seen.has(u.loc)) {
        seen.add(u.loc);
        allUrls.push(u);
      }
    }
    if (allUrls.length >= MAX_TOTAL_URLS) break;
  }

  return { urls: allUrls, sitemapsFound };
}
