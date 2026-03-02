import { NextResponse } from "next/server";
import {
  getHivemindVideos,
  addHivemindVideo,
  updateHivemindVideoNote,
  getUsers,
  getHivemindVideoVoteCounts,
  getUserVotesForVideos,
} from "@/lib/data";

/** Extract YouTube video ID from URL or return as-is if already an ID. */
function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // youtu.be/ID
  const shortMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  const videos = getHivemindVideos();
  const users = getUsers();
  const userById = new Map(users.map((u) => [u.id, u]));
  const videoIds = videos.map((v) => v.id);
  const voteCounts = getHivemindVideoVoteCounts(videoIds);
  const userVotes = userId ? getUserVotesForVideos(userId, videoIds) : {};

  const enriched = videos.map((v) => ({
    ...v,
    addedByUserName: v.addedByUserId ? userById.get(v.addedByUserId)?.name ?? "Unknown" : undefined,
    thumbsUp: voteCounts[v.id]?.thumbsUp ?? 0,
    thumbsDown: voteCounts[v.id]?.thumbsDown ?? 0,
    userVote: userVotes[v.id] as 1 | -1 | undefined,
  }));
  return NextResponse.json({ videos: enriched });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const youtubeIdOrUrl = typeof body.youtubeId === "string" ? body.youtubeId : typeof body.youtubeUrl === "string" ? body.youtubeUrl : "";
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : undefined;

  const youtubeId = extractYoutubeId(youtubeIdOrUrl);
  if (!youtubeId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL or video ID" },
      { status: 400 }
    );
  }

  const video = addHivemindVideo({ youtubeId, title: title || undefined, addedByUserId: userId });
  return NextResponse.json({ success: true, video });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!videoId || !userId) {
    return NextResponse.json(
      { error: "videoId and userId required" },
      { status: 400 }
    );
  }

  const updated = updateHivemindVideoNote(videoId, userId, note);
  if (!updated) {
    return NextResponse.json(
      { error: "Video not found or you are not the submitter" },
      { status: 403 }
    );
  }
  return NextResponse.json({ success: true, video: updated });
}
