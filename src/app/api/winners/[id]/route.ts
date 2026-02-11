import { NextResponse } from "next/server";
import { getWinners, saveWinners, getRatings, getComments, getWeeks, getSubmissions, getUsers, getProfiles } from "@/lib/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const winners = getWinners();
  const winner = winners.find((w) => w.id === id);

  if (!winner) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }

  const ratings = getRatings().filter((r) => r.winnerId === id);
  const profiles = getProfiles();
  const comments = getComments()
    .filter((c) => c.winnerId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => ({
      ...c,
      avatarUrl: profiles.find((p) => p.userId === c.userId)?.avatarUrl || "",
    }));

  const thumbsUp = ratings.filter((r) => r.thumbsUp).length;
  const thumbsDown = ratings.filter((r) => !r.thumbsUp).length;
  const avgStars =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
      : 0;

  // Look up the week theme
  let weekTheme = "";
  if (winner.weekId) {
    const weeks = getWeeks();
    const week = weeks.find((w) => w.id === winner.weekId);
    if (week) weekTheme = week.theme;
  }

  // Resolve submitter userId from users list
  const allUsers = getUsers();
  const submitterUser = allUsers.find((u) => u.name === winner.submittedBy);
  const submittedByUserId = submitterUser?.id || "";

  // Get runner-up submissions from the same week (excluding the winning movie)
  let runnerUps: { movieTitle: string; posterUrl: string; letterboxdUrl: string; year?: string; userName: string; userId: string }[] = [];
  if (winner.weekId) {
    const allSubs = getSubmissions().filter(
      (s) => s.weekId === winner.weekId && s.movieTitle !== winner.movieTitle
    );
    runnerUps = allSubs.map((s) => ({
      movieTitle: s.movieTitle,
      posterUrl: s.posterUrl,
      letterboxdUrl: s.letterboxdUrl,
      year: s.year,
      userName: s.userName,
      userId: s.userId,
    }));
  }

  return NextResponse.json({
    ...winner,
    submittedByUserId,
    weekTheme,
    runnerUps,
    ratings,
    comments,
    stats: {
      thumbsUp,
      thumbsDown,
      avgStars: Math.round(avgStars * 10) / 10,
      totalRatings: ratings.length,
      totalComments: comments.length,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const winners = getWinners();
  const idx = winners.findIndex((w) => w.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const w = winners[idx];

  if (typeof body.weekId === "string") w.weekId = body.weekId;
  if (typeof body.submittedBy === "string") w.submittedBy = body.submittedBy;
  if (typeof body.publishedAt === "string") w.publishedAt = body.publishedAt;
  if (typeof body.movieTitle === "string" && body.movieTitle.trim()) w.movieTitle = body.movieTitle.trim();
  if (typeof body.posterUrl === "string") w.posterUrl = body.posterUrl;
  if (typeof body.letterboxdUrl === "string") w.letterboxdUrl = body.letterboxdUrl;
  if (typeof body.year === "string" && body.year !== undefined) w.year = body.year || undefined;
  if (typeof body.overview === "string") w.overview = body.overview || undefined;
  if (typeof body.trailerUrl === "string") w.trailerUrl = body.trailerUrl || undefined;
  if (typeof body.backdropUrl === "string") w.backdropUrl = body.backdropUrl || undefined;
  if (typeof body.tmdbId === "number") w.tmdbId = body.tmdbId;

  winners[idx] = w;
  saveWinners(winners);

  return NextResponse.json(w);
}
