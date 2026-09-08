import OpenAI from "openai";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PinterestRelatedKeyword {
  keyword: string;
  monthlySearches: number | null;
  competition: string | null;
  suggestedBid: number | null;
}

export interface PinterestTrendingKeyword {
  keyword: string;
  weeklyChange: number | null;
  monthlyChange: number | null;
  yearlyChange: number | null;
}

export interface PinterestKeywordData {
  seedKeyword: string;
  country: string;
  language: string;
  relatedKeywords: PinterestRelatedKeyword[];
  trendingKeywords: PinterestTrendingKeyword[];
  retrievedAt: string;
}

export interface KeywordEntry {
  keyword: string;
  source: "pinterest" | "ai" | "pinterest+ai";
  intent: "informational" | "commercial" | "navigational" | "transactional" | "seasonal" | "question";
  relevanceScore: number;
  opportunityScore: number;
  trendInterpretation: string;
  recommended: boolean;
}

export interface KeywordCluster {
  name: string;
  keywords: string[];
  opportunityScore: number;
  trendDirection: "up" | "down" | "stable" | "unknown";
}

export interface ContentIdea {
  title: string;
  targetKeywords: string[];
  intent: string;
  format: "Idea Pin" | "Standard Pin" | "Blog Post" | "Video Pin" | "Carousel";
}

export interface SEORecommendations {
  primaryKeyword: string;
  secondaryKeywords: string[];
  pinTitle: string;
  pinDescription: string;
  boardSuggestion: string;
  contentAngle: string;
}

export interface KeywordIntelligenceResult {
  seedKeyword: string;
  summary: {
    trendStatus: string;
    overallOpportunity: number;
    summaryText: string;
  };
  keywords: KeywordEntry[];
  clusters: KeywordCluster[];
  contentIdeas: ContentIdea[];
  seasonalInsights: string[];
  recommendations: SEORecommendations;
}

// ── OpenAI Analyzer ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Pinterest SEO and keyword intelligence analyst.

You are given:
1. A seed keyword
2. Real Pinterest keyword data collected by the application (may be empty if unavailable)
3. Real Pinterest trending keyword data (may be empty if unavailable)

Your job is to analyze the supplied data and produce useful Pinterest keyword intelligence.

IMPORTANT RULES:
- Never invent Pinterest search volume numbers
- Never invent Pinterest trend scores
- Never claim an AI-generated metric is official Pinterest data
- Never fabricate competition numbers from nothing
- Use only supplied Pinterest metrics for factual Pinterest measurements
- Clearly mark your generated keyword suggestions as source "ai"
- Mark keywords that appear in the supplied Pinterest data as source "pinterest"
- Mark keywords derived from Pinterest data + AI expansion as source "pinterest+ai"
- relevanceScore, opportunityScore, and overallOpportunity are AI analytical scores (0-100) — NOT Pinterest official metrics
- Generate semantically relevant keyword ideas grouped by intent
- Produce practical, actionable Pinterest SEO recommendations
- Return valid JSON only — no markdown, no commentary outside JSON`;

export async function analyzeKeywords(data: PinterestKeywordData): Promise<KeywordIntelligenceResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const maxKeywords = parseInt(process.env.OPENAI_MAX_KEYWORDS ?? "50");

  // Diagnostic logging (key presence only, never the value)
  console.log("[keyword-intelligence] OPENAI_API_KEY present:", !!apiKey);
  console.log("[keyword-intelligence] OPENAI_API_KEY prefix:", apiKey ? apiKey.slice(0, 7) + "..." : "MISSING");
  console.log("[keyword-intelligence] model:", model);

  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in environment");

  const client = new OpenAI({ apiKey });

  const hasRelated = data.relatedKeywords.length > 0;
  const hasTrending = data.trendingKeywords.length > 0;

  const userPrompt = `Analyze this Pinterest keyword data and return a comprehensive keyword intelligence report as JSON.

Seed Keyword: "${data.seedKeyword}"
Country: ${data.country}
Language: ${data.language}

${hasRelated
  ? `Pinterest Related Keywords (REAL DATA — do not modify these metrics):\n${JSON.stringify(data.relatedKeywords.slice(0, maxKeywords), null, 2)}`
  : "Pinterest Related Keywords: None available (API not accessible for this account)"}

${hasTrending
  ? `Pinterest Trending Keywords (REAL DATA):\n${JSON.stringify(data.trendingKeywords.slice(0, 20), null, 2)}`
  : "Pinterest Trending Keywords: None available"}

Return ONLY a JSON object with this exact structure (no markdown wrapping):
{
  "seedKeyword": "${data.seedKeyword}",
  "summary": {
    "trendStatus": "Growing | Stable | Seasonal | Declining",
    "overallOpportunity": <number 0-100, your AI score>,
    "summaryText": "<2-3 sentences analyzing this keyword's Pinterest opportunity>"
  },
  "keywords": [
    {
      "keyword": "<keyword string>",
      "source": "pinterest" | "ai" | "pinterest+ai",
      "intent": "informational" | "commercial" | "navigational" | "transactional" | "seasonal" | "question",
      "relevanceScore": <0-100, AI score>,
      "opportunityScore": <0-100, AI score>,
      "trendInterpretation": "<brief 1-sentence explanation>",
      "recommended": true | false
    }
  ],
  "clusters": [
    {
      "name": "<cluster topic name>",
      "keywords": ["<keyword1>", "<keyword2>"],
      "opportunityScore": <0-100, AI score>,
      "trendDirection": "up" | "down" | "stable" | "unknown"
    }
  ],
  "contentIdeas": [
    {
      "title": "<Pinterest pin or post title>",
      "targetKeywords": ["<keyword1>"],
      "intent": "<intent description>",
      "format": "Idea Pin" | "Standard Pin" | "Blog Post" | "Video Pin" | "Carousel"
    }
  ],
  "seasonalInsights": ["<insight string>"],
  "recommendations": {
    "primaryKeyword": "<best keyword to target>",
    "secondaryKeywords": ["<kw1>", "<kw2>"],
    "pinTitle": "<optimized pin title using seed keyword>",
    "pinDescription": "<optimized pin description 100-150 words>",
    "boardSuggestion": "<suggested board name>",
    "contentAngle": "<content angle recommendation>"
  }
}

Include 20-40 keywords total. Include at least 5 content ideas. Include 3-6 clusters. Keep recommendations practical for Pinterest creators.`;

  let response;
  try {
    console.log("[keyword-intelligence] Calling OpenAI API, model:", model);
    response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    });
    console.log("[keyword-intelligence] OpenAI response received, finish_reason:", response.choices[0]?.finish_reason);
  } catch (err: unknown) {
    // Log the full error so we can diagnose auth/billing/model issues
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      console.error("[keyword-intelligence] OpenAI API error:", {
        status: e.status,
        message: e.message,
        code: e.code,
        type: e.type,
        error: e.error,
      });
      const status = (e.status as number) ?? 0;
      if (status === 401) throw new Error("OpenAI authentication failed (401) — check OPENAI_API_KEY");
      if (status === 403) throw new Error("OpenAI access forbidden (403) — key may lack permissions");
      if (status === 429) throw new Error("OpenAI rate limit or quota exceeded (429)");
      if (status === 404) throw new Error(`OpenAI model not found (404) — model "${model}" may not exist`);
      if (status === 400) throw new Error(`OpenAI bad request (400): ${e.message}`);
      throw new Error(`OpenAI API error ${status}: ${e.message}`);
    }
    throw err;
  }

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  try {
    return JSON.parse(content) as KeywordIntelligenceResult;
  } catch {
    console.error("[keyword-intelligence] Failed to parse OpenAI JSON response:", content.slice(0, 500));
    throw new Error("OpenAI returned invalid JSON");
  }
}
