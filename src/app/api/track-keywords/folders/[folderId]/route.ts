import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getFolder, updateFolder, deleteFolder,
  listKeywordsInFolder, getFolderStats,
} from "@/lib/track-keywords-db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { folderId } = await params;
  const folder = await getFolder(email, folderId);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  const [keywords, stats] = await Promise.all([
    listKeywordsInFolder(email, folderId),
    getFolderStats(email, folderId),
  ]);

  return NextResponse.json({ folder: { ...folder, ...stats }, keywords });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { folderId } = await params;
  const folder = await getFolder(email, folderId);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  const body = await req.json() as { name?: string; description?: string };
  const updated = await updateFolder(email, folderId, body);
  return NextResponse.json({ folder: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ folderId: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { folderId } = await params;
  const folder = await getFolder(email, folderId);
  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  await deleteFolder(email, folderId);
  return NextResponse.json({ success: true });
}
