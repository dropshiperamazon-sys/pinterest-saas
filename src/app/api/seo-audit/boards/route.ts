import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function getAccessToken(email: string): Promise<string> {
  const raw = await redis.get<string>(`pinterest_connection:${email}`);
  const conn = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken?: string } : null;
  return conn?.accessToken ?? process.env.PINTEREST_ACCESS_TOKEN ?? "";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const boardId = new URL(req.url).searchParams.get("boardId");

  const accessToken = await getAccessToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const headers = { Authorization: `Bearer ${accessToken}` };

  if (boardId) {
    // Return pins for a specific board
    const [boardRes, pinsRes] = await Promise.all([
      fetch(`https://api.pinterest.com/v5/boards/${boardId}`, { headers }),
      fetch(`https://api.pinterest.com/v5/boards/${boardId}/pins?page_size=50`, { headers }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const board: any = boardRes.ok ? await boardRes.json() : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pinsData: any = pinsRes.ok ? await pinsRes.json() : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pins: any[] = pinsData.items ?? [];

    return NextResponse.json({
      board: {
        id: board.id,
        name: board.name ?? "",
        description: board.description ?? "",
        pinCount: board.pin_count ?? pins.length,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pins: pins.map((p: any) => {
        const media = (p.media ?? {}) as Record<string, unknown>;
        const images = (media.images ?? {}) as Record<string, { url?: string }>;
        const thumbnailUrl =
          images["400x300"]?.url ?? images["150x150"]?.url ?? "";
        return {
          id: p.id ?? "",
          title: p.title ?? "",
          description: p.description ?? "",
          altText: p.alt_text ?? "",
          link: p.link ?? "",
          thumbnailUrl,
          createdAt: p.created_at ?? "",
          creativeType: p.creative_type ?? "REGULAR",
        };
      }),
    });
  }

  // Return all boards
  const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=50", { headers });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boardsData: any = boardsRes.ok ? await boardsRes.json() : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boards: any[] = boardsData.items ?? [];

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    boards: boards.map((b: any) => ({
      id: b.id,
      name: b.name ?? "",
      description: b.description ?? "",
      pinCount: b.pin_count ?? 0,
    })),
  });
}
