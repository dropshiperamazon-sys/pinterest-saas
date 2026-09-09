// Sitemap Service — discovers and parses public XML sitemaps

export interface SitemapURL {
  loc: string;
  lastmod?: string;
  priority?: string;
}

export interface SitemapProgress {
  sitemapsFound: number;
  urlsCollected: number;
  message: string;
}

const FETCH_TIMEOUT = 10_000;
const MAX_CHILD_SITEMAPS = 60;
const MAX_URLS_PER_SITEMAP = 10_000;
const MAX_TOTAL_URLS = 30_000;

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

async function discoverSitemaps(domain: string): Promise<string[]> {
  const candidates = new Set<string>();

  const fromRobots = await getSitemapsFromRobots(domain);
  for (const s of fromRobots) candidates.add(s);

  const commonPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap/sitemap.xml",
    "/sitemap/index.xml",
    "/post-sitemap.xml",
    "/page-sitemap.xml",
    "/category-sitemap.xml",
    "/news-sitemap.xml",
    "/sitemap-articles.xml",
    "/sitemap-posts.xml",
    "/sitemaps/articles-sitemap.xml",
    "/sitemap-1.xml",
    "/sitemap-2.xml",
    "/sitemap/articles/",
    "/sitemap/sitemap-index.xml",
    "/sitemap_post.xml",
  ];
  for (const path of commonPaths) {
    candidates.add(`${domain}${path}`);
  }

  return Array.from(candidates);
}

// Recursively collect all leaf article URLs from a sitemap or sitemap index.
// `seenSitemaps` tracks which sitemap URLs have been fetched to prevent loops.
async function collectFromSitemap(
  sitemapUrl: string,
  seenSitemaps: Set<string>,
  allUrls: SitemapURL[],
  sitemapsFound: string[],
  onProgress?: (p: SitemapProgress) => void,
  depth = 0
): Promise<void> {
  if (depth > 4) return;
  if (seenSitemaps.has(sitemapUrl)) return;
  seenSitemaps.add(sitemapUrl);
  if (allUrls.length >= MAX_TOTAL_URLS) return;

  const text = await fetchText(sitemapUrl);
  if (!text || !text.trim().startsWith("<")) return;

  if (isSitemapIndex(text)) {
    sitemapsFound.push(sitemapUrl);
    onProgress?.({
      sitemapsFound: sitemapsFound.length,
      urlsCollected: allUrls.length,
      message: `Sitemap index: ${sitemapUrl}`,
    });

    const childUrls = parseLocTags(text);
    for (const childUrl of childUrls.slice(0, MAX_CHILD_SITEMAPS)) {
      if (allUrls.length >= MAX_TOTAL_URLS) break;
      await collectFromSitemap(childUrl, seenSitemaps, allUrls, sitemapsFound, onProgress, depth + 1);
    }
    return;
  }

  // Leaf urlset sitemap
  sitemapsFound.push(sitemapUrl);

  const seenLocs = new Set(allUrls.map((u) => u.loc));
  const urlBlocks = text.split(/<\/url>/i);
  let added = 0;
  for (const block of urlBlocks.slice(0, MAX_URLS_PER_SITEMAP)) {
    if (allUrls.length >= MAX_TOTAL_URLS) break;
    const locMatch = block.match(/<loc>\s*(.*?)\s*<\/loc>/i);
    if (!locMatch) continue;
    const loc = locMatch[1].trim().replace(/&amp;/g, "&");
    if (!loc || seenLocs.has(loc)) continue;
    seenLocs.add(loc);
    const lastmodMatch = block.match(/<lastmod>\s*(.*?)\s*<\/lastmod>/i);
    const priorityMatch = block.match(/<priority>\s*(.*?)\s*<\/priority>/i);
    allUrls.push({ loc, lastmod: lastmodMatch?.[1], priority: priorityMatch?.[1] });
    added++;
  }

  onProgress?.({
    sitemapsFound: sitemapsFound.length,
    urlsCollected: allUrls.length,
    message: `${sitemapUrl} → ${added} URLs`,
  });
}

export async function crawlSitemap(
  inputUrl: string,
  onProgress?: (p: SitemapProgress) => void
): Promise<{ urls: SitemapURL[]; sitemapsFound: string[]; error?: string }> {
  let domain: string;
  try {
    const parsed = new URL(inputUrl);
    domain = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return { urls: [], sitemapsFound: [], error: "Invalid URL" };
  }

  const candidateSitemapUrls = await discoverSitemaps(domain);
  onProgress?.({ sitemapsFound: 0, urlsCollected: 0, message: `Checking ${candidateSitemapUrls.length} sitemap candidates…` });

  const seenSitemaps = new Set<string>();
  const allUrls: SitemapURL[] = [];
  const sitemapsFound: string[] = [];

  for (const candidateUrl of candidateSitemapUrls) {
    if (allUrls.length >= MAX_TOTAL_URLS) break;
    await collectFromSitemap(candidateUrl, seenSitemaps, allUrls, sitemapsFound, onProgress, 0);
  }

  return { urls: allUrls, sitemapsFound };
}
