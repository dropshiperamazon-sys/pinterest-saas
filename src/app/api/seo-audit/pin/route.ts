import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Redis } from "@upstash/redis";
import { scorePinSEO, classifyKeywordIntent } from "@/lib/seo-audit-engine";

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

  const url = new URL(req.url);
  const pinId = url.searchParams.get("pinId");
  const focusKeyword = url.searchParams.get("keyword") ?? "";
  const boardId = url.searchParams.get("boardId") ?? "";

  if (!pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  const accessToken = await getAccessToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Fetch pin
  const pinRes = await fetch(`https://api.pinterest.com/v5/pins/${pinId}`, { headers });
  if (!pinRes.ok) {
    const err = await pinRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Pinterest API error: ${pinRes.status}`, detail: err }, { status: 200 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pin: any = await pinRes.json();

  // Fetch board details if we have boardId
  let boardName = "";
  let boardDescription = "";
  const pinBoardId = boardId || pin.board_id;
  if (pinBoardId) {
    try {
      const boardRes = await fetch(`https://api.pinterest.com/v5/boards/${pinBoardId}`, { headers });
      if (boardRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const board: any = await boardRes.json();
        boardName = board.name ?? "";
        boardDescription = board.description ?? "";
      }
    } catch { /* skip */ }
  }

  // Extract thumbnail
  const media = (pin.media ?? {}) as Record<string, unknown>;
  const images = (media.images ?? {}) as Record<string, { url?: string }>;
  const thumbnailUrl =
    images["1200x"]?.url ?? images["600x"]?.url ?? images["400x300"]?.url ?? images["150x150"]?.url ?? "";

  const input = {
    id: pin.id ?? pinId,
    title: pin.title ?? "",
    description: pin.description ?? "",
    altText: pin.alt_text ?? "",
    link: pin.link ?? "",
    boardName,
    boardDescription,
    focusKeyword,
  };

  const seoScore = scorePinSEO(input);

  return NextResponse.json({
    pin: {
      id: pin.id,
      title: pin.title ?? "",
      description: pin.description ?? "",
      altText: pin.alt_text ?? "",
      link: pin.link ?? "",
      pinUrl: pin.id ? `https://www.pinterest.com/pin/${pin.id}/` : "",
      thumbnailUrl,
      boardId: pinBoardId,
      boardName,
      createdAt: pin.created_at ?? "",
      creativeType: pin.creative_type ?? "REGULAR",
    },
    seoScore,
    keywordIntent: classifyKeywordIntent(focusKeyword || `${pin.title ?? ""} ${pin.description ?? ""}`),
    focusKeyword,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json() as {
    pinId: string;
    title?: string;
    description?: string;
    altText?: string;
    link?: string;
    boardId?: string;
  };

  if (!body.pinId) return NextResponse.json({ error: "pinId required" }, { status: 400 });

  const accessToken = await getAccessToken(email);
  if (!accessToken) return NextResponse.json({ error: "Pinterest not connected" }, { status: 400 });

  const patch: Record<string, string> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.altText !== undefined) patch.alt_text = body.altText;
  if (body.link !== undefined) patch.link = body.link;
  if (body.boardId !== undefined) patch.board_id = body.boardId;

  const patchRes = await fetch(`https://api.pinterest.com/v5/pins/${body.pinId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!patchRes.ok) {
    const err = await patchRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Pinterest API error: ${patchRes.status}`, detail: err }, { status: 200 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated: any = await patchRes.json();
  return NextResponse.json({ success: true, pin: updated });
}
