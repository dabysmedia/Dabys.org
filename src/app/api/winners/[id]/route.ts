import { NextResponse } from "next/server";
import { getWinners, saveWinners, getRatings, saveRatings, getComments, saveComments, getCommentLikes, getWeeks, getSubmissions, getUsers, getProfiles, computeDabysScorePct } from "@/lib/data";
import { addPendingPoolEntriesForWinner, getDisplayedBadgeForUser } from "@/lib/cards";

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
  const allComments = getComments().filter((c) => c.winnerId === id);
  const likes = getCommentLikes();
  const { searchParams } = new URL(_request.url);
  const currentUserId = searchParams.get("userId") || "";

  const commentMap = new Map(allComments.map((c) => [c.id, c]));
  const comments = allComments.map((c) => {
    const commentLikesForThis = likes.filter((l) => l.commentId === c.id);
    const parent = c.parentId ? commentMap.get(c.parentId) : null;
    return {
      ...c,
      avatarUrl: profiles.find((p) => p.userId === c.userId)?.avatarUrl || "",
      likeCount: commentLikesForThis.length,
      likedByMe: currentUserId ? commentLikesForThis.some((l) => l.userId === currentUserId) : false,
      displayedBadge: getDisplayedBadgeForUser(c.userId),
      ...(parent && { parentUserName: parent.userName }),
    };
  });

  // Sort: top-level newest first, then replies under each parent (oldest first)
  const topLevel = comments.filter((c) => !c.parentId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const byParent = new Map<string, typeof comments>();
  for (const c of comments) {
    if (c.parentId) {
      const list = byParent.get(c.parentId) || [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  const sortedComments = topLevel.flatMap((c) => {
    const replies = byParent.get(c.id) || [];
    return [c, ...replies];
  });

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

  // Resolve submitter userId, avatar, and displayed badge
  const allUsers = getUsers();
  const submitterUser = allUsers.find((u) => u.name === winner.submittedBy);
  const submittedByUserId = submitterUser?.id || "";
  const submitterAvatarUrl = submittedByUserId ? (profiles.find((p) => p.userId === submittedByUserId)?.avatarUrl || undefined) : undefined;
  const submitterDisplayedBadge = submittedByUserId ? getDisplayedBadgeForUser(submittedByUserId) : null;

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
    submitterAvatarUrl,
    submitterDisplayedBadge,
    weekTheme,
    runnerUps,
    ratings,
    comments: sortedComments,
    stats: {
      thumbsUp,
      thumbsDown,
      avgStars: Math.round(avgStars * 10) / 10,
      totalRatings: ratings.length,
      totalComments: sortedComments.length,
      dabysScorePct: computeDabysScorePct(ratings),
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
  const prevTmdbId = w.tmdbId;

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
  if (typeof body.runtime === "number" && body.runtime >= 0) w.runtime = body.runtime;

  winners[idx] = w;
  saveWinners(winners);

  if (w.tmdbId != null && prevTmdbId !== w.tmdbId) {
    addPendingPoolEntriesForWinner(w).catch((e) => console.error("Pending pool add error", e));
  }

  return NextResponse.json(w);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const winners = getWinners();
  const idx = winners.findIndex((w) => w.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }

  const nextWinners = winners.filter((w) => w.id !== id);
  saveWinners(nextWinners);

  // Remove ratings and comments for this winner so we don't keep orphaned data
  const ratings = getRatings().filter((r) => r.winnerId !== id);
  const comments = getComments().filter((c) => c.winnerId !== id);
  saveRatings(ratings);
  saveComments(comments);

  return NextResponse.json({ ok: true, deletedId: id });
}
