// Pinterest SEO Audit Engine — deterministic, weight-based scoring

export interface PinSEOInput {
  id: string;
  title: string;
  description: string;
  altText: string;
  link: string;
  boardName: string;
  boardDescription: string;
  focusKeyword: string;
}

export interface SEOCheckResult {
  rule: string;
  status: "pass" | "warn" | "fail" | "na";
  message: string;
  impact: "high" | "medium" | "low";
  category: keyof typeof SCORING_WEIGHTS;
}

export interface PinSEOScore {
  overall: number; // 0–100
  breakdown: Record<keyof typeof SCORING_WEIGHTS, number>; // 0–100 per category
  checks: SEOCheckResult[];
  keywordIntent: KeywordIntent;
  grade: "A" | "B" | "C" | "D" | "F";
}

export type KeywordIntent =
  | "Informational"
  | "Commercial"
  | "Transactional"
  | "Educational"
  | "Inspirational"
  | "Unknown";

export const SCORING_WEIGHTS = {
  focusKeyword: 0.15,
  title: 0.20,
  description: 0.20,
  altText: 0.10,
  destinationUrl: 0.10,
  keywordRelevance: 0.10,
  searchIntentAlignment: 0.10,
  boardRelevance: 0.05,
} as const;

// ── helpers ─────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function containsKeyword(text: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  const t = normalize(text);
  const k = normalize(keyword);
  return t.includes(k);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasUrlScheme(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function keywordDensity(text: string, keyword: string): number {
  if (!keyword.trim() || !text.trim()) return 0;
  const words = normalize(text).split(" ");
  const kw = normalize(keyword);
  const matches = words.filter((_, i) => {
    const slice = words.slice(i, i + kw.split(" ").length).join(" ");
    return slice === kw;
  }).length;
  return (matches / words.length) * 100;
}

// ── Keyword intent classifier ────────────────────────────────────────────────

const INTENT_PATTERNS: { intent: KeywordIntent; patterns: RegExp[] }[] = [
  {
    intent: "Transactional",
    patterns: [/\b(buy|shop|order|price|cheap|discount|sale|deal|coupon|purchase|affordable)\b/i],
  },
  {
    intent: "Commercial",
    patterns: [/\b(best|top|review|compare|vs\b|versus|alternative|recommend)\b/i],
  },
  {
    intent: "Educational",
    patterns: [/\b(how to|tutorial|guide|tips|learn|step by step|beginner|course|lesson)\b/i],
  },
  {
    intent: "Inspirational",
    patterns: [/\b(ideas|inspiration|aesthetic|inspo|mood|vibe|dream|beautiful|stunning)\b/i],
  },
  {
    intent: "Informational",
    patterns: [/\b(what is|why|when|where|definition|meaning|facts|history)\b/i],
  },
];

export function classifyKeywordIntent(keyword: string): KeywordIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(keyword))) return intent;
  }
  return "Informational"; // sensible default
}

// ── Individual rule checkers ─────────────────────────────────────────────────

function checkFocusKeyword(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const kw = input.focusKeyword.trim();

  if (!kw) {
    results.push({
      rule: "Focus Keyword Set",
      status: "warn",
      message: "No focus keyword entered. Enter one to unlock targeted analysis.",
      impact: "high",
      category: "focusKeyword",
    });
    return results;
  }

  results.push({
    rule: "Focus Keyword Set",
    status: "pass",
    message: `Focus keyword "${kw}" is set.`,
    impact: "high",
    category: "focusKeyword",
  });

  const kwLength = kw.split(" ").length;
  results.push({
    rule: "Focus Keyword Length",
    status: kwLength >= 2 && kwLength <= 5 ? "pass" : "warn",
    message:
      kwLength < 2
        ? "Single-word keywords are very competitive. Use 2–5 word long-tail phrases."
        : kwLength > 5
        ? "Very long keywords may be too specific. Aim for 2–5 words."
        : `Keyword length (${kwLength} words) is optimal.`,
    impact: "medium",
    category: "focusKeyword",
  });

  return results;
}

function checkTitle(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const { title, focusKeyword } = input;

  if (!title) {
    results.push({ rule: "Title Present", status: "fail", message: "Pin has no title.", impact: "high", category: "title" });
    return results;
  }

  results.push({ rule: "Title Present", status: "pass", message: "Pin has a title.", impact: "high", category: "title" });

  const len = title.length;
  results.push({
    rule: "Title Length",
    status: len >= 20 && len <= 100 ? "pass" : len < 20 ? "warn" : "warn",
    message:
      len < 20
        ? `Title is too short (${len} chars). Aim for 20–100 characters.`
        : len > 100
        ? `Title is long (${len} chars). Pinterest may truncate after 100 characters.`
        : `Title length (${len} chars) is good.`,
    impact: "medium",
    category: "title",
  });

  if (focusKeyword.trim()) {
    const inTitle = containsKeyword(title, focusKeyword);
    results.push({
      rule: "Keyword in Title",
      status: inTitle ? "pass" : "fail",
      message: inTitle
        ? `Focus keyword "${focusKeyword}" found in title.`
        : `Focus keyword "${focusKeyword}" is missing from the title.`,
      impact: "high",
      category: "title",
    });

    const words = normalize(title).split(" ");
    const kwNorm = normalize(focusKeyword);
    const idx = words.findIndex((_, i) => words.slice(i, i + kwNorm.split(" ").length).join(" ") === kwNorm);
    const isNearStart = idx >= 0 && idx <= 3;
    results.push({
      rule: "Keyword Near Title Start",
      status: isNearStart ? "pass" : "warn",
      message: isNearStart
        ? "Focus keyword appears near the start of the title (good)."
        : "Move the focus keyword to the first 3 words of the title for stronger SEO signal.",
      impact: "medium",
      category: "title",
    });
  }

  const hasNumber = /\d/.test(title);
  results.push({
    rule: "Title Contains Number",
    status: hasNumber ? "pass" : "warn",
    message: hasNumber
      ? "Title includes a number (boosts click-through rate)."
      : "Adding a number (e.g., '10 ideas') can improve engagement.",
    impact: "low",
    category: "title",
  });

  return results;
}

function checkDescription(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const { description, focusKeyword } = input;

  if (!description) {
    results.push({ rule: "Description Present", status: "fail", message: "Pin has no description.", impact: "high", category: "description" });
    return results;
  }

  results.push({ rule: "Description Present", status: "pass", message: "Pin has a description.", impact: "high", category: "description" });

  const wc = wordCount(description);
  results.push({
    rule: "Description Length",
    status: wc >= 50 && wc <= 200 ? "pass" : wc < 20 ? "fail" : "warn",
    message:
      wc < 20
        ? `Description is very short (${wc} words). Aim for 50–200 words.`
        : wc < 50
        ? `Description is a bit short (${wc} words). 50–200 words is ideal.`
        : wc > 200
        ? `Description is long (${wc} words). Pinterest shows ~150 words; keep the most important info early.`
        : `Description length (${wc} words) is optimal.`,
    impact: "medium",
    category: "description",
  });

  if (focusKeyword.trim()) {
    const inDesc = containsKeyword(description, focusKeyword);
    results.push({
      rule: "Keyword in Description",
      status: inDesc ? "pass" : "fail",
      message: inDesc
        ? `Focus keyword "${focusKeyword}" found in description.`
        : `Focus keyword "${focusKeyword}" is missing from the description.`,
      impact: "high",
      category: "description",
    });

    const density = keywordDensity(description, focusKeyword);
    results.push({
      rule: "Keyword Density",
      status: density >= 0.5 && density <= 3 ? "pass" : density > 3 ? "warn" : "warn",
      message:
        density > 3
          ? `Keyword density is ${density.toFixed(1)}% — avoid over-stuffing (ideal: 0.5–3%).`
          : density < 0.5
          ? `Keyword density is ${density.toFixed(1)}% — mention the keyword a bit more (ideal: 0.5–3%).`
          : `Keyword density is ${density.toFixed(1)}% — good balance.`,
      impact: "medium",
      category: "description",
    });
  }

  const hasCallToAction = /\b(save|click|visit|shop|learn more|check out|discover|explore|see more|get yours)\b/i.test(description);
  results.push({
    rule: "Call-to-Action Present",
    status: hasCallToAction ? "pass" : "warn",
    message: hasCallToAction
      ? "Description includes a call-to-action (encourages engagement)."
      : "Consider adding a call-to-action like 'Save this pin' or 'Click to learn more'.",
    impact: "low",
    category: "description",
  });

  return results;
}

function checkAltText(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const { altText, focusKeyword } = input;

  if (!altText) {
    results.push({
      rule: "Alt Text Present",
      status: "warn",
      message: "No alt text found. Alt text helps Pinterest understand image content for search.",
      impact: "medium",
      category: "altText",
    });
    return results;
  }

  results.push({ rule: "Alt Text Present", status: "pass", message: "Pin has alt text.", impact: "medium", category: "altText" });

  const len = altText.length;
  results.push({
    rule: "Alt Text Length",
    status: len >= 50 && len <= 200 ? "pass" : len < 20 ? "warn" : "warn",
    message:
      len < 20
        ? `Alt text is very short (${len} chars). Aim for 50–200 characters.`
        : len > 200
        ? `Alt text is long (${len} chars). Keep it under 200 characters.`
        : `Alt text length (${len} chars) is good.`,
    impact: "low",
    category: "altText",
  });

  if (focusKeyword.trim()) {
    const inAlt = containsKeyword(altText, focusKeyword);
    results.push({
      rule: "Keyword in Alt Text",
      status: inAlt ? "pass" : "warn",
      message: inAlt
        ? `Focus keyword "${focusKeyword}" found in alt text.`
        : `Including the focus keyword "${focusKeyword}" in alt text reinforces topical relevance.`,
      impact: "medium",
      category: "altText",
    });
  }

  return results;
}

function checkDestinationUrl(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const { link } = input;

  if (!link) {
    results.push({
      rule: "Destination URL Present",
      status: "warn",
      message: "No destination URL. Pins with links drive traffic and rank higher.",
      impact: "high",
      category: "destinationUrl",
    });
    return results;
  }

  const hasScheme = hasUrlScheme(link);
  results.push({
    rule: "Destination URL Valid",
    status: hasScheme ? "pass" : "fail",
    message: hasScheme ? "Destination URL is properly formatted." : "URL is missing http:// or https:// — it may not work.",
    impact: "high",
    category: "destinationUrl",
  });

  const isHttps = /^https:\/\//i.test(link);
  results.push({
    rule: "Destination URL Uses HTTPS",
    status: isHttps ? "pass" : "warn",
    message: isHttps ? "URL uses HTTPS (secure)." : "URL uses HTTP. Switch to HTTPS for better trust signals.",
    impact: "medium",
    category: "destinationUrl",
  });

  if (input.focusKeyword.trim()) {
    const kwInUrl = containsKeyword(link, input.focusKeyword.replace(/\s+/g, "-"));
    results.push({
      rule: "Keyword in URL",
      status: kwInUrl ? "pass" : "warn",
      message: kwInUrl
        ? "Focus keyword found in destination URL."
        : "Including the focus keyword in your URL path can improve SEO.",
      impact: "low",
      category: "destinationUrl",
    });
  }

  return results;
}

function checkBoardRelevance(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const { boardName, boardDescription, focusKeyword } = input;

  if (!boardName) {
    results.push({ rule: "Board Assigned", status: "warn", message: "Pin is not on a board.", impact: "medium", category: "boardRelevance" });
    return results;
  }

  results.push({ rule: "Board Assigned", status: "pass", message: `Pin is on board: "${boardName}".`, impact: "medium", category: "boardRelevance" });

  if (focusKeyword.trim()) {
    const inBoardName = containsKeyword(boardName, focusKeyword);
    const inBoardDesc = containsKeyword(boardDescription, focusKeyword);
    results.push({
      rule: "Board Topically Relevant",
      status: inBoardName || inBoardDesc ? "pass" : "warn",
      message:
        inBoardName || inBoardDesc
          ? "Board name/description aligns with the focus keyword."
          : "The board name or description doesn't mention the focus keyword. Ensure the board is topically relevant.",
      impact: "medium",
      category: "boardRelevance",
    });
  }

  const boardWords = wordCount(boardName);
  results.push({
    rule: "Board Name Descriptive",
    status: boardWords >= 2 ? "pass" : "warn",
    message:
      boardWords >= 2
        ? "Board name is descriptive (2+ words)."
        : "Consider a more descriptive board name (2+ words) to signal topical focus.",
    impact: "low",
    category: "boardRelevance",
  });

  return results;
}

function checkKeywordRelevance(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const { title, description, altText, focusKeyword } = input;

  if (!focusKeyword.trim()) return results;

  const allText = `${title} ${description} ${altText}`;
  const appearances =
    (containsKeyword(title, focusKeyword) ? 1 : 0) +
    (containsKeyword(description, focusKeyword) ? 1 : 0) +
    (containsKeyword(altText, focusKeyword) ? 1 : 0);

  results.push({
    rule: "Keyword Coverage",
    status: appearances >= 2 ? "pass" : appearances === 1 ? "warn" : "fail",
    message:
      appearances >= 2
        ? `Keyword appears in ${appearances}/3 key fields (title, description, alt text) — strong coverage.`
        : appearances === 1
        ? `Keyword appears in only 1/3 key fields. Add it to more fields for better coverage.`
        : "Keyword not found in any field. This pin is not optimized for the focus keyword.",
    impact: "high",
    category: "keywordRelevance",
  });

  // Check for related terms / LSI signals
  const normalized = normalize(allText);
  const kwWords = normalize(focusKeyword).split(" ");
  const partialMatch = kwWords.some((w) => w.length >= 4 && normalized.includes(w));
  results.push({
    rule: "Related Terms Present",
    status: partialMatch ? "pass" : "warn",
    message: partialMatch
      ? "Pin content contains terms related to the focus keyword."
      : "Add semantically related terms to strengthen topical relevance.",
    impact: "low",
    category: "keywordRelevance",
  });

  return results;
}

function checkSearchIntentAlignment(input: PinSEOInput): SEOCheckResult[] {
  const results: SEOCheckResult[] = [];
  const intent = classifyKeywordIntent(input.focusKeyword || `${input.title} ${input.description}`);

  const allText = `${input.title} ${input.description}`;

  let signalMatch = false;
  switch (intent) {
    case "Transactional":
      signalMatch = /\b(shop|buy|order|get|price)\b/i.test(allText);
      break;
    case "Commercial":
      signalMatch = /\b(best|review|compare|top|picks)\b/i.test(allText);
      break;
    case "Educational":
      signalMatch = /\b(how|step|guide|learn|tips|tutorial)\b/i.test(allText);
      break;
    case "Inspirational":
      signalMatch = /\b(ideas|inspiration|aesthetic|inspo|beautiful)\b/i.test(allText);
      break;
    default:
      signalMatch = true;
  }

  results.push({
    rule: "Search Intent Alignment",
    status: signalMatch ? "pass" : "warn",
    message: signalMatch
      ? `Pin content aligns with ${intent} search intent.`
      : `Keyword suggests ${intent} intent. Adjust title/description to match that intent.`,
    impact: "medium",
    category: "searchIntentAlignment",
  });

  return results;
}

// ── Main scoring function ────────────────────────────────────────────────────

function scoreCategory(checks: SEOCheckResult[], category: keyof typeof SCORING_WEIGHTS): number {
  const relevant = checks.filter((c) => c.category === category);
  if (relevant.length === 0) return 50; // neutral when no checks apply

  const highChecks = relevant.filter((c) => c.impact === "high");
  const medChecks = relevant.filter((c) => c.impact === "medium");
  const lowChecks = relevant.filter((c) => c.impact === "low");

  function checkScore(c: SEOCheckResult): number {
    switch (c.status) {
      case "pass": return 100;
      case "warn": return 50;
      case "fail": return 0;
      case "na": return 50;
    }
  }

  const allWithWeight = [
    ...highChecks.map((c) => ({ score: checkScore(c), weight: 3 })),
    ...medChecks.map((c) => ({ score: checkScore(c), weight: 2 })),
    ...lowChecks.map((c) => ({ score: checkScore(c), weight: 1 })),
  ];

  const totalWeight = allWithWeight.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return 50;
  return allWithWeight.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
}

export function scorePinSEO(input: PinSEOInput): PinSEOScore {
  const checks: SEOCheckResult[] = [
    ...checkFocusKeyword(input),
    ...checkTitle(input),
    ...checkDescription(input),
    ...checkAltText(input),
    ...checkDestinationUrl(input),
    ...checkBoardRelevance(input),
    ...checkKeywordRelevance(input),
    ...checkSearchIntentAlignment(input),
  ];

  const breakdown = {} as Record<keyof typeof SCORING_WEIGHTS, number>;
  let overall = 0;

  for (const [cat, weight] of Object.entries(SCORING_WEIGHTS) as [keyof typeof SCORING_WEIGHTS, number][]) {
    const catScore = scoreCategory(checks, cat);
    breakdown[cat] = Math.round(catScore);
    overall += catScore * weight;
  }

  overall = Math.round(overall);

  const grade: PinSEOScore["grade"] =
    overall >= 85 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : overall >= 40 ? "D" : "F";

  return {
    overall,
    breakdown,
    checks,
    keywordIntent: classifyKeywordIntent(input.focusKeyword || `${input.title} ${input.description}`),
    grade,
  };
}

// ── Account-level aggregated SEO scoring ────────────────────────────────────

export interface BoardSEOSummary {
  id: string;
  name: string;
  description: string;
  pinCount: number;
  url: string;
  avgScore: number;
  grade: PinSEOScore["grade"];
  issueCount: number;
}

export interface AccountSEOSummary {
  overallScore: number;
  grade: PinSEOScore["grade"];
  pinsAnalyzed: number;
  criticalIssues: string[];
  warnings: string[];
  opportunities: string[];
  boardSummaries: BoardSEOSummary[];
}

export function gradeFromScore(score: number): PinSEOScore["grade"] {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}
