// Article classifier — two-stage, multi-signal content classification
// Stage 1: URL-based (instant, no network)
// Stage 2: Content-based (title, H1, JSON-LD schema, date, word count)

import type { PageMeta } from "./page-crawler";

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 — URL classification
// ─────────────────────────────────────────────────────────────────────────────

// Final URL path segments that are ALWAYS utility/legal pages.
// These have hyphens and would pass a naive "has-hyphen = article" check.
const EXCLUDE_FINAL_SLUGS = new Set([
  // Privacy / legal
  "privacy-policy", "privacy", "cookie-policy", "cookie-notice",
  "cookie-statement", "cookies", "cookie",
  "terms-of-service", "terms-and-conditions", "terms-conditions",
  "terms-of-use", "terms", "tos", "tac",
  "disclaimer", "legal", "legal-notice", "legal-information",
  "copyright", "ip-policy", "dmca",
  "affiliate-disclosure", "disclosure", "earnings-disclaimer",
  "gdpr", "ccpa",
  // Contact / about
  "contact", "contact-us", "contact-me", "get-in-touch", "reach-us",
  "about", "about-us", "about-me", "our-story", "who-we-are",
  "team", "our-team", "meet-the-team",
  // Auth
  "login", "log-in", "signin", "sign-in",
  "logout", "log-out", "signout", "sign-out",
  "register", "signup", "sign-up", "create-account", "join", "membership",
  "forgot-password", "reset-password",
  // Account / e-commerce
  "account", "my-account", "profile", "settings", "preferences", "dashboard",
  "cart", "basket", "shopping-cart", "checkout",
  "order", "orders", "order-confirmation", "order-history",
  "payment", "billing", "subscription", "subscriptions",
  "wishlist", "wish-list", "favorites",
  // Utility
  "sitemap", "sitemap-page", "xml-sitemap",
  "subscribe", "unsubscribe", "newsletter", "newsletter-signup",
  "advertise", "advertising", "advertisers", "sponsors", "sponsorship", "sponsored",
  "press", "press-kit", "media-kit", "newsroom",
  "accessibility", "accessibility-statement", "accessibility-policy",
  "404", "not-found", "error", "404-error",
  "maintenance", "coming-soon", "offline",
  "thank-you", "thanks", "success", "confirmation",
  "rss", "feed", "atom", "sitemap-feed",
]);

// Path SEGMENTS (anywhere in the path) that indicate non-article content.
const EXCLUDE_PATH_SEGMENTS = new Set([
  "legal", "policy", "policies",
  "auth", "oauth", "sso",
  "checkout", "payment",
  "admin", "wp-admin", "wp-login",
  "api", "graphql", "webhook",
  "cdn", "static", "assets",
]);

// URL patterns for archive/navigation pages
const ARCHIVE_PATTERNS = [
  /\/(author|tag|tags|category|categories|topic|topics)\//i,
  /\/(author|tag|tags|category|categories|topic|topics)\/[^/]+\/?$/i,
  /\/page\/\d+\/?$/i,
  /\/p\/\d+\/?$/i,
  /[?&](page|p|paged)=\d+/i,
  /[?&](s|q|query|search)=/i,
];

export type ContentType =
  | "ARTICLE"
  | "BLOG_POST"
  | "GUIDE"
  | "TUTORIAL"
  | "RECIPE"
  | "REVIEW"
  | "NEWS"
  | "LEGAL_PAGE"
  | "UTILITY_PAGE"
  | "CATEGORY"
  | "TAG"
  | "AUTHOR"
  | "PAGINATION"
  | "PRODUCT"
  | "SEARCH"
  | "MEDIA"
  | "OTHER"
  | "UNKNOWN";

export interface UrlClassification {
  contentType: ContentType;
  pass: boolean;       // true = proceed to slug extraction + content fetch
  reason: string;
}

export function classifyUrl(url: string): UrlClassification {
  let path: string;
  try {
    const parsed = new URL(url);
    path = parsed.pathname.toLowerCase();
  } catch {
    return { contentType: "OTHER", pass: false, reason: "Invalid URL" };
  }

  // Root URL
  if (path === "/" || path === "") {
    return { contentType: "OTHER", pass: false, reason: "Root URL" };
  }

  // File extension exclusions
  if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|tar|gz|css|js|ico|xml|json|mp4|mp3|avi|mov|woff|woff2|ttf|eot)$/i.test(path)) {
    return { contentType: "MEDIA", pass: false, reason: "File URL" };
  }

  // Technical paths
  if (/\/(wp-admin|wp-json|wp-login|wp-content\/(?!uploads)|feed|rss|atom|api\/)\//i.test(path)) {
    return { contentType: "UTILITY_PAGE", pass: false, reason: "Technical/admin path" };
  }

  // Archive/navigation patterns
  for (const pattern of ARCHIVE_PATTERNS) {
    if (pattern.test(url)) {
      const m = url.match(/\/(author|tag|tags|category|categories|topic|topics)\//i);
      const type: ContentType = m?.[1]?.toLowerCase().startsWith("author") ? "AUTHOR"
        : m?.[1]?.toLowerCase().startsWith("tag") ? "TAG"
        : "CATEGORY";
      return { contentType: type, pass: false, reason: `Archive page (${type})` };
    }
  }

  // Pagination specifically
  if (/\/page\/\d+\/?$/i.test(path) || /\/p\/\d+\/?$/i.test(path)) {
    return { contentType: "PAGINATION", pass: false, reason: "Pagination page" };
  }

  const segments = path.split("/").filter(Boolean);
  const finalSlug = segments.at(-1) ?? "";

  // Check excluded final slugs (exact match)
  if (EXCLUDE_FINAL_SLUGS.has(finalSlug)) {
    const contentType: ContentType = ["privacy-policy","cookie-policy","terms-of-service","terms-and-conditions","terms","disclaimer","legal","cookie","gdpr","ccpa","copyright","dmca","privacy","cookies","affiliate-disclosure","disclosure","earnings-disclaimer","cookie-notice"].includes(finalSlug) ? "LEGAL_PAGE" : "UTILITY_PAGE";
    return { contentType, pass: false, reason: `Excluded slug: /${finalSlug}/` };
  }

  // Check path segments
  for (const seg of segments) {
    if (EXCLUDE_PATH_SEGMENTS.has(seg)) {
      return { contentType: "UTILITY_PAGE", pass: false, reason: `Excluded path segment: /${seg}/` };
    }
  }

  // Must have a slug with at least a hyphen or min length
  // (avoids bare short slugs like /home/ /shop/ /blog/ with no specific content)
  const hasDescriptiveSlug = finalSlug.includes("-") || finalSlug.length > 10 || /^\d{4,}$/.test(finalSlug);
  if (!hasDescriptiveSlug) {
    return { contentType: "OTHER", pass: false, reason: `Non-descriptive slug: /${finalSlug}/` };
  }

  return { contentType: "ARTICLE", pass: true, reason: "Passes URL classifier" };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2 — Content-based classification
// ─────────────────────────────────────────────────────────────────────────────

// Schema.org types that indicate genuine article content
const ARTICLE_SCHEMA_TYPES = new Set([
  "article", "blogposting", "newsarticle", "techarticle",
  "howto", "recipe", "review", "report", "creativework",
  "socialmediaposting",
]);

// Patterns that identify a page AS a utility/legal page by its title/H1.
// IMPORTANT: these match the WHOLE title (after stripping site-name suffix),
// not just words within a content-article title.
// "Privacy Policy" → exclude | "Protect Your Privacy Online" → keep
const UTILITY_TITLE_PATTERNS = [
  /^privacy\s+policy$/i,
  /^cookie\s+(policy|notice|statement)$/i,
  /^cookies?\s*$/i,
  /^terms\s+(of\s+service|and\s+conditions?|of\s+use|&\s+conditions?)$/i,
  /^terms\s*$/i,
  /^disclaimer\s*$/i,
  /^legal\s+(notice|disclaimer|information)?$/i,
  /^legal\s*$/i,
  /^copyright\s*$/i,
  /^contact(\s+us)?\s*$/i,
  /^get\s+in\s+touch\s*$/i,
  /^about(\s+(us|me|this\s+site|this\s+blog))?\s*$/i,
  /^our\s+story\s*$/i,
  /^who\s+we\s+are\s*$/i,
  /^meet\s+the\s+team\s*$/i,
  /^log\s*in\s*$/i,
  /^sign\s+in\s*$/i,
  /^register\s*$/i,
  /^sign\s+up\s*$/i,
  /^create\s+(an?\s+)?account\s*$/i,
  /^my\s+account\s*$/i,
  /^shopping\s+cart\s*$/i,
  /^checkout\s*$/i,
  /^sitemap\s*$/i,
  /^search\s*$/i,
  /^subscribe\s*$/i,
  /^newsletter\s*(signup|subscription)?\s*$/i,
  /^accessibility(\s+statement)?\s*$/i,
  /^affiliate\s+disclosure\s*$/i,
  /^disclosure\s*$/i,
  /^advertise(\s+with\s+us)?\s*$/i,
  /^press(\s+kit)?\s*$/i,
  /^media\s+kit\s*$/i,
  /^404\s*(error|page)?\s*$/i,
  /^page\s+not\s+found\s*$/i,
  /^thank\s+you\s*$/i,
  /^coming\s+soon\s*$/i,
];

export interface PageClassification {
  contentType: ContentType;
  articleConfidence: number; // 0–100
  isArticle: boolean;
  reason: string;
  detectedSchema?: string;
}

export function classifyPage(meta: PageMeta): PageClassification {
  const rawTitle = (meta.title || "").trim();
  const h1 = (meta.h1 || "").trim();

  // Strip common site-name suffixes: "Title | Site Name"  "Title - Blog"
  const strippedTitle = rawTitle
    .replace(/\s*[\|–—]\s*.{2,40}$/, "")
    .replace(/\s+[-]\s+.{2,40}$/, "")
    .trim();

  const displayTitle = strippedTitle || h1;

  // ── Hard exclude based on title / H1 ────────────────────────────────────
  if (displayTitle) {
    for (const pattern of UTILITY_TITLE_PATTERNS) {
      if (pattern.test(displayTitle) || pattern.test(h1)) {
        return {
          contentType: "LEGAL_PAGE",
          articleConfidence: 0,
          isArticle: false,
          reason: `Utility/legal title: "${displayTitle || h1}"`,
        };
      }
    }
  }

  // No title/H1 at all → page fetch failed; pass with low confidence for slug extraction
  if (!rawTitle && !h1) {
    return {
      contentType: "UNKNOWN",
      articleConfidence: 35,
      isArticle: true,
      reason: "Page fetch failed — slug extraction only",
    };
  }

  // ── Build confidence score ───────────────────────────────────────────────
  let score = 40;
  const schemaTypes = (meta.schemaTypes ?? []).map((t) => t.toLowerCase());
  const matchedSchema = schemaTypes.find((t) => ARTICLE_SCHEMA_TYPES.has(t));

  // Schema.org signals
  if (matchedSchema) {
    score += 30;
  } else if (schemaTypes.includes("product")) {
    return {
      contentType: "PRODUCT",
      articleConfidence: 5,
      isArticle: false,
      reason: "Product page (schema:Product)",
    };
  }

  // Published date
  if (meta.datePublished) score += 10;

  // Breadcrumbs usually indicate editorial content hierarchy
  if (meta.breadcrumbs && meta.breadcrumbs.length > 5) score += 5;

  // Headings — structured article content
  const headingCount = (meta.headings || "").split("|").filter((h) => h.trim()).length;
  if (headingCount >= 3) score += 8;
  else if (headingCount >= 1) score += 4;

  // Body snippet word count
  const wordCount = (meta.bodySnippet || "").split(/\s+/).filter(Boolean).length;
  if (wordCount >= 80) score += 10;
  else if (wordCount >= 40) score += 5;
  else if (wordCount < 15) score -= 10; // very thin

  // Derive content type from schema
  let contentType: ContentType = "ARTICLE";
  if (matchedSchema === "recipe") contentType = "RECIPE";
  else if (matchedSchema === "howto") contentType = "TUTORIAL";
  else if (matchedSchema === "review") contentType = "REVIEW";
  else if (matchedSchema === "newsarticle") contentType = "NEWS";
  else if (matchedSchema === "blogposting") contentType = "BLOG_POST";

  const finalScore = Math.min(100, Math.max(0, score));

  return {
    contentType,
    articleConfidence: finalScore,
    isArticle: finalScore >= 45,
    reason: finalScore >= 45
      ? `Article (score=${finalScore}${matchedSchema ? `, schema=${matchedSchema}` : ""}${meta.datePublished ? ", dated" : ""})`
      : `Low confidence (score=${finalScore})`,
    detectedSchema: matchedSchema,
  };
}
