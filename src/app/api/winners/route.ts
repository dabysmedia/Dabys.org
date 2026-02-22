import { NextResponse } from "next/server";
import { getWinners, saveWinners, getSubmissions, saveSubmissions, getCurrentWeek, getWeeks, getUsers, getProfile, addCredits, getCreditSettings, getVotes, isWinnerArchived } from "@/lib/data";
import { addPendingPoolEntriesForWinner, getCompletedWinnerIds, getCompletedHoloWinnerIds } from "@/lib/cards";

export async function GET() {
  const winners = getWinners();
  const weeks = getWeeks();
  const users = getUsers();
  const submissions = getSubmissions();
  const votes = getVotes();
  const enriched = winners.map((w) => {
    const week = weeks.find((wk) => wk.id === w.weekId);
    const submitterUser = users.find((u) => u.name === w.submittedBy);
    const submittedByUserId = submitterUser?.id || "";
    const winningSubmission = submissions.find(
      (s) => s.weekId === w.weekId && (s.userName === w.submittedBy || s.userId === submittedByUserId)
    );
    const voteCount = winningSubmission
      ? votes.filter((v) => v.weekId === w.weekId && v.submissionId === winningSubmission.id).length
      : 0;
    let submitterAvatarUrl: string | undefined;
    let submitterDisplayedBadge: { winnerId: string; movieTitle: string; isHolo: boolean } | null = null;
    if (submittedByUserId) {
      const profile = getProfile(submittedByUserId);
      submitterAvatarUrl = profile.avatarUrl || undefined;
      const completedWinnerIds = getCompletedWinnerIds(submittedByUserId);
      const completedHoloWinnerIds = getCompletedHoloWinnerIds(submittedByUserId);
      const displayedWinnerId = profile.displayedBadgeWinnerId ?? null;
      if (displayedWinnerId && completedWinnerIds.includes(displayedWinnerId)) {
        const winnerEntry = winners.find((x) => x.id === displayedWinnerId);
        submitterDisplayedBadge = {
          winnerId: displayedWinnerId,
          movieTitle: winnerEntry?.movieTitle ?? "Unknown",
          isHolo: completedHoloWinnerIds.includes(displayedWinnerId),
        };
      }
    }
    return {
      ...w,
      weekTheme: week?.theme || "",
      submittedByUserId,
      submitterAvatarUrl,
      submitterDisplayedBadge,
      voteCount,
      reviewsLocked: !isWinnerArchived(w.id),
    };
  });
  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.movieTitle || typeof body.movieTitle !== "string") {
    return NextResponse.json(
      { error: "Movie title is required" },
      { status: 400 }
    );
  }

  const winners = getWinners();
  const newId = String(
    Math.max(0, ...winners.map((w) => parseInt(w.id, 10))) + 1
  );

  const currentWeek = getCurrentWeek();

  const newWinner = {
    id: newId,
    weekId: body.manual ? (body.weekId || "") : currentWeek?.id || "",
    movieTitle: body.movieTitle.trim(),
    posterUrl: body.posterUrl || "",
    letterboxdUrl: body.letterboxdUrl || "",
    submittedBy: body.submittedBy || "",
    publishedAt: body.publishedAt || new Date().toISOString(),
    tmdbId: body.tmdbId || undefined,
    year: body.year || undefined,
    overview: body.overview || undefined,
    trailerUrl: body.trailerUrl || undefined,
    backdropUrl: body.backdropUrl || undefined,
    runtime: typeof body.runtime === "number" && body.runtime >= 0 ? body.runtime : undefined,
    screeningAt: typeof body.screeningAt === "string" && body.screeningAt.trim() ? body.screeningAt.trim() : undefined,
  };

  winners.push(newWinner);
  saveWinners(winners);

  if (newWinner.tmdbId) {
    addPendingPoolEntriesForWinner(newWinner).catch((e) => console.error("Pending pool add error", e));
  }

  if (body.submittedBy) {
    const users = getUsers();
    const submitter = users.find((u) => u.name === body.submittedBy);
    if (submitter) {
      const { submissionWin: amount } = getCreditSettings();
      addCredits(submitter.id, amount, "submission_win", { winnerId: newWinner.id, weekId: newWinner.weekId });
    }
  }

  // When adding manually, also create a submission so it counts in past weeks & profiles
  if (body.manual && body.weekId && body.submittedBy) {
    const users = getUsers();
    const submitter = users.find((u) => u.name === body.submittedBy);
    if (submitter) {
      const subs = getSubmissions();
      const alreadyExists = subs.some(
        (s) => s.weekId === body.weekId && s.userId === submitter.id
      );
      if (!alreadyExists) {
        const subId = String(
          Math.max(0, ...subs.map((s) => parseInt(s.id, 10))) + 1
        );
        const newSub = {
          id: subId,
          weekId: body.weekId,
          userId: submitter.id,
          userName: body.submittedBy,
          movieTitle: newWinner.movieTitle,
          posterUrl: newWinner.posterUrl,
          letterboxdUrl: newWinner.letterboxdUrl,
          tmdbId: newWinner.tmdbId,
          year: newWinner.year,
          overview: newWinner.overview,
          trailerUrl: newWinner.trailerUrl,
          backdropUrl: newWinner.backdropUrl,
          createdAt: newWinner.publishedAt,
        };
        subs.push(newSub);
        saveSubmissions(subs);
      }
    }
  }

  return NextResponse.json(newWinner, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const orderedIds = body.order;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "order must be a non-empty array of winner ids" }, { status: 400 });
  }

  const winners = getWinners();
  const idSet = new Set(orderedIds);
  const byId = new Map(winners.map((w) => [w.id, w]));

  if (orderedIds.some((id) => typeof id !== "string" || !byId.has(id))) {
    return NextResponse.json({ error: "order contains invalid or missing winner ids" }, { status: 400 });
  }
  if (byId.size !== orderedIds.length) {
    return NextResponse.json({ error: "order must contain each winner exactly once" }, { status: 400 });
  }

  const reordered = orderedIds.map((id) => byId.get(id)!);
  saveWinners(reordered);
  return NextResponse.json(reordered);
}
