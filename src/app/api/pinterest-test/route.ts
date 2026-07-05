import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "No access token configured" }, { status: 400 });
  }

  const res = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: "Pinterest token invalid", details: data }, { status: 401 });
  }

  // Also fetch boards
  const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=10", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const boards = await boardsRes.json();

  return NextResponse.json({
    status: "✅ Token valid",
    user: {
      username: data.username,
      name: data.business_name || data.username,
      image: data.profile_image,
    },
    boards: boards.items?.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })) || [],
  });
}
