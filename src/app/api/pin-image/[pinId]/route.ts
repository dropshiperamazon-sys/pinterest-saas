import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const { pinId: rawPinId } = await params;
  // Strip any file extension Pinterest might append or that we add for hint
  const pinId = rawPinId.replace(/\.[a-z]+$/i, "");
  const raw = await redis.get(`pin_image:${pinId}`);
  if (!raw) return new NextResponse("Not found", { status: 404 });

  const dataUrl = typeof raw === "string" ? raw : JSON.stringify(raw);
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return new NextResponse("Invalid image data", { status: 400 });

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
