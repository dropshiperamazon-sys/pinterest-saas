// Topic Profiler — dynamically expands any user topic into a structured profile
// using OpenAI. Result is cached in-memory for the process lifetime (per-request
// on serverless, but avoids duplicate calls within a single extraction run).

import OpenAI from "openai";

export interface TopicProfile {
  primaryTerms: string[];   // exact tokens from the user's topic
  synonyms: string[];       // semantically related single words
  phrases: string[];        // multi-word related phrases (2-4 words)
  antiTerms: string[];      // words that indicate the topic is NOT present (false-positive guard)
  intent: string;           // e.g. "ideas", "tutorial", "inspiration"
}

const cache = new Map<string, TopicProfile>();

export async function buildTopicProfile(topic: string): Promise<TopicProfile> {
  const cacheKey = topic.trim().toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // Fast path — no OpenAI: derive a basic profile purely from the text.
  // OpenAI is called if available for richer semantic expansion.
  const basic = basicProfile(topic);

  if (!process.env.OPENAI_API_KEY) {
    cache.set(cacheKey, basic);
    return basic;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const prompt = `You are a semantic search expert. Analyze this user topic and return a JSON object.

User topic: "${topic}"

Return JSON with these fields:
- "primaryTerms": array of the core words/phrases directly from the topic (lowercase)
- "synonyms": array of semantically related single words that would appear in articles about this topic
- "phrases": array of 2-4 word phrases commonly found in articles about this topic (max 15 phrases)
- "antiTerms": array of words that would indicate an article is NOT about this topic (false positive guards)
- "intent": the user's intent — one word from: ideas, tutorial, inspiration, guide, tips, recipes, design, decor, fashion, fitness, travel, other

Rules:
- Be specific. "small kitchen ideas" → synonyms include "compact", "tiny", "space-saving", NOT generic words like "room" or "design"
- antiTerms: for "Apple recipes", antiTerms might be ["banana", "mango", "berry"] to reduce false positives
- Phrases must be real phrases people would search for or that appear in article titles
- Keep all terms lowercase
- Return ONLY valid JSON, no markdown

Example for "small kitchen ideas":
{
  "primaryTerms": ["small", "kitchen", "ideas"],
  "synonyms": ["compact", "tiny", "mini", "narrow", "studio", "apartment", "space-saving", "galley", "layout", "storage"],
  "phrases": ["small kitchen", "kitchen ideas", "compact kitchen", "tiny kitchen", "kitchen storage", "small kitchen design", "apartment kitchen", "space saving kitchen", "kitchen layout", "kitchen decor"],
  "antiTerms": ["bathroom", "bedroom", "living room", "garden", "outdoor"],
  "intent": "ideas"
}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<TopicProfile & { intent: string }>;

    const profile: TopicProfile = {
      primaryTerms: Array.isArray(parsed.primaryTerms) ? parsed.primaryTerms.map(String) : basic.primaryTerms,
      synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.map(String).slice(0, 20) : basic.synonyms,
      phrases: Array.isArray(parsed.phrases) ? parsed.phrases.map(String).slice(0, 15) : basic.phrases,
      antiTerms: Array.isArray(parsed.antiTerms) ? parsed.antiTerms.map(String).slice(0, 10) : [],
      intent: typeof parsed.intent === "string" ? parsed.intent : basic.intent,
    };

    cache.set(cacheKey, profile);
    return profile;
  } catch {
    // Fall back to basic profile on any OpenAI error
    cache.set(cacheKey, basic);
    return basic;
  }
}

// Pure text-based profile — no external calls
function basicProfile(topic: string): TopicProfile {
  const lower = topic.toLowerCase().trim();
  const tokens = lower.split(/[\s\-_]+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  // Build bigrams and trigrams from tokens as candidate phrases
  const phrases: string[] = [];
  for (let len = 3; len >= 2; len--) {
    for (let i = 0; i <= tokens.length - len; i++) {
      phrases.push(tokens.slice(i, i + len).join(" "));
    }
  }
  // The full topic itself is a phrase too
  if (tokens.length >= 2) phrases.unshift(lower);

  // Detect intent from common suffix words
  const intentWords = ["ideas", "recipes", "tutorial", "tips", "guide", "inspiration", "design", "decor", "fashion", "fitness", "travel"];
  const intent = intentWords.find((w) => lower.includes(w)) ?? "ideas";

  return {
    primaryTerms: tokens,
    synonyms: [],       // no synonyms without AI
    phrases: [...new Set(phrases)],
    antiTerms: [],
    intent,
  };
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "my", "your",
  "how", "what", "when", "where", "why", "i", "you", "we", "they", "it",
]);
