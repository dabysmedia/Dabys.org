import { NextResponse } from "next/server";
import { setHivemindVideoVote } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const vote = body.vote === 1 || body.vote === -1 ? body.vote : undefined;

  if (!videoId || !userId || vote === undefined) {
    return NextResponse.json(
      { error: "videoId, userId, and vote (1 or -1) required" },
      { status: 400 }
    );
  }

  setHivemindVideoVote(videoId, userId, vote);
  return NextResponse.json({ success: true });
}
