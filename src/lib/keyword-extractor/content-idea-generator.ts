// Content Idea Generator — uses OpenAI to generate original content ideas from article topics

import OpenAI from "openai";

export interface ContentIdea {
  title: string;
  primaryKeyword: string;
  searchIntent: "Informational" | "Inspirational" | "Commercial" | "Transactional" | "Educational";
  angle: string;
  subtopics: string[];
  pinterestTitle: string;
  pinterestKeywords: string[];
  pinterestAngle: string;
  suggestedBoard: string;
}

export interface GenerateIdeasInput {
  keywords: string[];           // extracted keywords / article titles selected by user
  category: string;
  pageMeta?: { title: string; h1: string; metaDescription: string }[];
}

export async function generateContentIdeas(input: GenerateIdeasInput): Promise<ContentIdea[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const keywordList = input.keywords.slice(0, 10).map((k, i) => `${i + 1}. ${k}`).join("\n");
  const metaContext = input.pageMeta?.slice(0, 5)
    .map((m) => [m.title, m.h1, m.metaDescription].filter(Boolean).join(" | "))
    .join("\n") ?? "";

  const prompt = `You are an expert Pinterest content strategist. Analyze the following article topics and generate ORIGINAL content ideas inspired by these topics — do NOT copy or rewrite them.

Category/Niche: ${input.category}

Source article topics from competitor research:
${keywordList}

${metaContext ? `Additional page context:\n${metaContext}\n` : ""}

Generate 5 to 8 original content ideas. For each, provide:
- "title": compelling, specific content title (not a copy of source)
- "primaryKeyword": the main search phrase this would target
- "searchIntent": one of: Informational, Inspirational, Commercial, Transactional, Educational
- "angle": 1-2 sentences describing what makes this content unique and valuable
- "subtopics": array of 3–5 sub-topics or H2 headings for this content
- "pinterestTitle": Pinterest-optimized pin title (under 100 chars, keyword near start)
- "pinterestKeywords": array of 3–5 related Pinterest search phrases
- "pinterestAngle": what visual/concept would make a great pin for this topic
- "suggestedBoard": what Pinterest board category this belongs to

Rules:
- Be original — understand the topic and create new angles
- Do not directly copy any source title
- Write naturally for humans first, search intent second
- Do not make ranking or traffic promises
- Keep the niche focused on "${input.category}"

Respond ONLY with a valid JSON array of content idea objects.`;

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { ideas?: ContentIdea[] } | ContentIdea[];

  const ideas: ContentIdea[] = Array.isArray(parsed) ? parsed : (parsed as { ideas?: ContentIdea[] }).ideas ?? [];
  return ideas.slice(0, 8);
}
