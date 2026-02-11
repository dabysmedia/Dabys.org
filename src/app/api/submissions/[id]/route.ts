import { NextResponse } from "next/server";
import { getSubmissions, saveSubmissions } from "@/lib/data";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const subs = getSubmissions();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const s = subs[idx];

  if (typeof body.weekId === "string") s.weekId = body.weekId;
  if (typeof body.userId === "string") s.userId = body.userId;
  if (typeof body.userName === "string") s.userName = body.userName;
  if (typeof body.movieTitle === "string" && body.movieTitle.trim()) s.movieTitle = body.movieTitle.trim();
  if (typeof body.posterUrl === "string") s.posterUrl = body.posterUrl;
  if (typeof body.letterboxdUrl === "string") s.letterboxdUrl = body.letterboxdUrl;
  if (typeof body.year === "string") s.year = body.year || undefined;
  if (typeof body.overview === "string") s.overview = body.overview || undefined;
  if (typeof body.trailerUrl === "string") s.trailerUrl = body.trailerUrl || undefined;
  if (typeof body.backdropUrl === "string") s.backdropUrl = body.backdropUrl || undefined;
  if (typeof body.tmdbId === "number") s.tmdbId = body.tmdbId;
  if (typeof body.createdAt === "string") s.createdAt = body.createdAt;
  // Pitch: only allow if requester is the submitter (body.userId must match)
  if (typeof body.pitch === "string" && typeof body.userId === "string" && body.userId === s.userId) {
    const trimmed = body.pitch.trim().slice(0, 100);
    s.pitch = trimmed || undefined;
  }

  subs[idx] = s;
  saveSubmissions(subs);
  return NextResponse.json(s);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const subs = getSubmissions();
  const filtered = subs.filter((s) => s.id !== id);
  if (filtered.length === subs.length) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  saveSubmissions(filtered);
  return NextResponse.json({ success: true });
}
