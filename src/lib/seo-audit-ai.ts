// AI layer for SEO Audit — title/description generation using existing OpenAI client

import OpenAI from "openai";
import type { PinSEOInput } from "./seo-audit-engine";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export interface AISEOSuggestions {
  titles: string[];
  descriptions: string[];
  altTextSuggestions: string[];
  keywordSuggestions: string[];
}

export async function generateSEOSuggestions(input: PinSEOInput): Promise<AISEOSuggestions> {
  const prompt = `You are a Pinterest SEO expert. Given the following pin data, generate optimized suggestions.

Pin Data:
- Current Title: ${input.title || "(none)"}
- Current Description: ${input.description || "(none)"}
- Current Alt Text: ${input.altText || "(none)"}
- Focus Keyword: ${input.focusKeyword || "(not set)"}
- Board: ${input.boardName || "(unknown)"}
- Destination URL: ${input.link || "(none)"}

Generate a JSON response with:
1. "titles": array of 3 SEO-optimized title suggestions (each 20–100 chars, focus keyword near start)
2. "descriptions": array of 2 description suggestions (each 50–150 words, focus keyword included, with call-to-action)
3. "altTextSuggestions": array of 2 alt text suggestions (each 50–150 chars, descriptive, keyword-inclusive)
4. "keywordSuggestions": array of 5 related long-tail keywords for this niche

Rules:
- Never over-stuff keywords (max 1–2 mentions per field)
- Write naturally for human readers first, search second
- Match Pinterest's visual/discovery-focused tone
- Do not make performance promises (no "will rank #1" etc.)

Respond ONLY with valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as Partial<AISEOSuggestions>;

  return {
    titles: Array.isArray(parsed.titles) ? parsed.titles.slice(0, 3) : [],
    descriptions: Array.isArray(parsed.descriptions) ? parsed.descriptions.slice(0, 2) : [],
    altTextSuggestions: Array.isArray(parsed.altTextSuggestions) ? parsed.altTextSuggestions.slice(0, 2) : [],
    keywordSuggestions: Array.isArray(parsed.keywordSuggestions) ? parsed.keywordSuggestions.slice(0, 5) : [],
  };
}
