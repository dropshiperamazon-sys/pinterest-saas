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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const maxKeywords = parseInt(process.env.OPENAI_MAX_KEYWORDS ?? "50");

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

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  return JSON.parse(content) as KeywordIntelligenceResult;
}
