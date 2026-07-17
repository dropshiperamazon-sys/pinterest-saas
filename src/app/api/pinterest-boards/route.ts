import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // Try bearer token from Authorization header first (passed by client)
  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Fall back to env access token
  const accessToken = headerToken || process.env.PINTEREST_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.pinterest.com/v5/boards?page_size=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "Pinterest API error", details: data }, { status: res.status });
    }

    const boards = (data.items || []).map((b: { id: string; name: string }) => ({
      id: b.id,
      name: b.name,
    }));

    return NextResponse.json({ boards });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch boards", details: String(err) }, { status: 500 });
  }
}
