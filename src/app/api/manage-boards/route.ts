import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

async function getToken(req: NextRequest): Promise<string> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  // Fallback: look up from redis via email in session header
  const email = req.headers.get("x-user-email");
  if (email) {
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
    const raw = await redis.get<string>(`pinterest_connection:${email}`);
    const conn = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) as { accessToken?: string } : null;
    if (conn?.accessToken) return conn.accessToken;
  }
  return process.env.PINTEREST_ACCESS_TOKEN ?? "";
}

// GET /api/manage-boards — list boards with their sections
export async function GET(req: NextRequest) {
  const token = await getToken(req);
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=100", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const boardsData = await boardsRes.json();
    if (!boardsRes.ok) return NextResponse.json({ error: boardsData }, { status: boardsRes.status });

    const boards = (boardsData.items ?? []) as Array<{
      id: string; name: string; description: string; privacy: string;
    }>;

    // Fetch sections for all boards in parallel
    const withSections = await Promise.all(
      boards.map(async (b) => {
        const secRes = await fetch(`https://api.pinterest.com/v5/boards/${b.id}/sections?page_size=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const secData = secRes.ok ? await secRes.json() : { items: [] };
        return {
          id: b.id,
          name: b.name,
          description: b.description ?? "",
          privacy: b.privacy ?? "PUBLIC",
          sections: (secData.items ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        };
      })
    );

    return NextResponse.json({ boards: withSections });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/manage-boards — create board  { action:"create_board", name, description?, privacy? }
//                         — create section { action:"create_section", boardId, name }
export async function POST(req: NextRequest) {
  const token = await getToken(req);
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  if (body.action === "create_board") {
    const res = await fetch("https://api.pinterest.com/v5/boards", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: body.name,
        description: body.description ?? "",
        privacy: body.privacy ?? "PUBLIC",
      }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json({ board: { id: data.id, name: data.name, description: data.description ?? "", privacy: data.privacy ?? "PUBLIC", sections: [] } });
  }

  if (body.action === "create_section") {
    const res = await fetch(`https://api.pinterest.com/v5/boards/${body.boardId}/sections`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: body.name }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json({ section: { id: data.id, name: data.name } });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// PATCH /api/manage-boards — update board { boardId, name?, description? }
//                          — rename section { boardId, sectionId, name }
export async function PATCH(req: NextRequest) {
  const token = await getToken(req);
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  if (body.sectionId) {
    const res = await fetch(`https://api.pinterest.com/v5/boards/${body.boardId}/sections/${body.sectionId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: body.name }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json({ section: { id: data.id, name: data.name } });
  }

  const payload: Record<string, string> = {};
  if (body.name) payload.name = body.name;
  if (body.description !== undefined) payload.description = body.description;

  const res = await fetch(`https://api.pinterest.com/v5/boards/${body.boardId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
  return NextResponse.json({ board: { id: data.id, name: data.name, description: data.description ?? "" } });
}

// DELETE /api/manage-boards — delete section { boardId, sectionId }
export async function DELETE(req: NextRequest) {
  const token = await getToken(req);
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  if (body.sectionId) {
    const res = await fetch(`https://api.pinterest.com/v5/boards/${body.boardId}/sections/${body.sectionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ error: data }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown delete target" }, { status: 400 });
}
