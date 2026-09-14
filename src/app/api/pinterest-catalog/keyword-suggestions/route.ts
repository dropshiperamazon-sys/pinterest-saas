import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const { title, description } = await req.json() as { title?: string; description?: string };
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a Pinterest SEO expert. Based on this product, suggest 5 short Pinterest search keywords that shoppers would realistically type to find it.

Product title: ${title}
Product description: ${description || "(none)"}

Rules:
- Each keyword must be 1-4 words
- Use terms people actually search on Pinterest (e.g. "gold hoop earrings", "boho wedding ring")
- Be specific to THIS product — no generic filler
- Return ONLY a JSON array of 5 strings, nothing else

Example: ["gold hoop earrings", "minimalist gold jewelry", "dainty earrings women", "everyday gold hoops", "simple hoop earrings"]`;

  try {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "[]";
    const m = text.match(/\[[\s\S]*\]/);
    const keywords: string[] = m ? JSON.parse(m[0]) : [];

    return NextResponse.json({ keywords: keywords.slice(0, 5) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
