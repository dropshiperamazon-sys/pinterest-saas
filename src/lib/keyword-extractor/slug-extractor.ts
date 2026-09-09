// URL Slug → Clean Keyword converter

// Words that should stay lowercase in title case (minor words)
const MINOR_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet",
  "at", "by", "in", "of", "on", "to", "up", "as", "is", "it",
]);

// Path segments that are likely navigation/noise, not content
const NOISE_SEGMENTS = new Set([
  "blog", "post", "posts", "article", "articles", "news", "tag", "tags",
  "category", "categories", "archive", "archives", "page", "p", "wp-content",
  "index", "feed", "rss", "amp", "author", "authors", "search", "en",
  "us", "uk", "au", "ca", "fr", "de", "es", "www", "home",
]);

export function extractKeywordFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query string, hash, file extension
    let pathname = parsed.pathname;

    // Remove trailing slash
    pathname = pathname.replace(/\/+$/, "");

    // Split into segments
    const segments = pathname.split("/").filter(Boolean);

    // Remove noise segments from the front/middle, keeping the last meaningful one
    const meaningful = segments.filter((s) => !NOISE_SEGMENTS.has(s.toLowerCase()));

    // Take the last segment (most specific)
    const slug = meaningful.at(-1) ?? segments.at(-1) ?? "";

    if (!slug) return "";

    // Remove file extension (.html, .php, .aspx etc.)
    const noExt = slug.replace(/\.[a-z]{2,4}$/i, "");

    // URL-decode
    const decoded = decodeURIComponent(noExt);

    // Replace hyphens, underscores, dots with spaces
    const spaced = decoded.replace(/[-_\.]+/g, " ");

    // Remove purely numeric tokens (dates, IDs) if more than 2 digits
    const cleaned = spaced.replace(/\b\d{3,}\b/g, "").replace(/\s+/g, " ").trim();

    if (!cleaned) return "";

    return toTitleCase(cleaned);
  } catch {
    return "";
  }
}

function toTitleCase(str: string): string {
  const words = str.toLowerCase().split(" ").filter(Boolean);
  return words
    .map((word, i) => {
      if (i === 0 || i === words.length - 1 || !MINOR_WORDS.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

export function removeDuplicateKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const kw of keywords) {
    const normalized = kw.toLowerCase().replace(/\s+/g, " ").trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(kw);
    }
  }
  return result;
}
