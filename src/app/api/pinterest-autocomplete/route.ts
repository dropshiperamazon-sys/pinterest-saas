import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { auth } from "@/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Pinterest-style suggestion modifiers — ordered by real Pinterest search frequency
const MODIFIERS = [
  "ideas", "aesthetic", "inspiration", "design", "acrylic",
  "summer", "for beginners", "2026 ideas", "simple", "tutorial",
  "art", "color", "short", "gel", "winter",
  "fall", "spring", "cute", "natural", "french",
];

function fallbackSuggestions(q: string): string[] {
  const base = q.toLowerCase().trim();
  return MODIFIERS.map(m => `${base} ${m}`).slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ suggestions: [] });

  // Try Pinterest API v5 /keywords endpoint using the user's OAuth token
  try {
    const session = await auth();
    const email = session?.user?.email;

    if (email) {
      const raw = await redis.get(`pinterest_connection:${email}`);
      if (raw) {
        const { accessToken } = (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken: string };

        // Pinterest v5: GET /ad_accounts/{id}/targeting/keywords/suggestions
        // First get ad account id
        const accountsRes = await fetch("https://api.pinterest.com/v5/ad_accounts?page_size=1", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(4000),
        });

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          const adAccountId: string | null = accountsData?.items?.[0]?.id ?? null;

          if (adAccountId) {
            const kwRes = await fetch(
              `https://api.pinterest.com/v5/ad_accounts/${adAccountId}/targeting/keywords/suggestions?query=${encodeURIComponent(q)}&limit=12`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(4000),
              }
            );

            if (kwRes.ok) {
              const kwData = await kwRes.json();
              const suggestions: string[] = (kwData?.suggestions ?? kwData?.keywords ?? kwData?.items ?? [])
                .map((k: unknown) => {
                  if (typeof k === "string") return k;
                  const o = k as Record<string, unknown>;
                  return (o.keyword ?? o.name ?? o.query ?? "") as string;
                })
                .filter(Boolean);

              if (suggestions.length > 0) {
                return NextResponse.json({ suggestions: suggestions.slice(0, 12), source: "pinterest_api" });
              }
            }
          }
        }

        // Fallback: try trends keywords endpoint to extract related terms
        const trendsRes = await fetch(
          `https://api.pinterest.com/v5/trends/keywords/US/top/growing?limit=25`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(4000),
          }
        );

        if (trendsRes.ok) {
          const trendsData = await trendsRes.json();
          const items = Array.isArray(trendsData) ? trendsData : (trendsData?.trends ?? trendsData?.keywords ?? trendsData?.items ?? []);
          const qLower = q.toLowerCase();
          const related: string[] = items
            .map((item: Record<string, unknown>) => (item.keyword ?? item.term ?? "") as string)
            .filter((kw: string) => kw && kw.toLowerCase().includes(qLower) && kw.toLowerCase() !== qLower)
            .slice(0, 8);

          if (related.length >= 3) {
            return NextResponse.json({ suggestions: related, source: "trends" });
          }
        }
      }
    }
  } catch { /* fall through to static fallback */ }

  return NextResponse.json({ suggestions: fallbackSuggestions(q), source: "fallback" });
}
