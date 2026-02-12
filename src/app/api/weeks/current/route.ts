import { NextResponse } from "next/server";
import {
  getWeeks,
  saveWeeks,
  getCurrentWeek,
  getSubmissions,
  getVotes,
  getWinners,
  saveWinners,
  addCredits,
} from "@/lib/data";

export async function GET() {
  const current = getCurrentWeek();
  if (!current) {
    return NextResponse.json({ error: "No active week" }, { status: 404 });
  }
  return NextResponse.json(current);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const weeks = getWeeks();
  const idx = weeks.findIndex((w) => !w.endedAt);

  if (idx === -1) {
    return NextResponse.json({ error: "No active week" }, { status: 404 });
  }

  const currentWeek = weeks[idx];

  if (body.theme !== undefined) {
    currentWeek.theme = body.theme;
  }

  if (body.phase !== undefined) {
    currentWeek.phase = body.phase;

    // When a week is marked as winner_published, automatically
    // pick the top-voted submission (for this week) and add it
    // to winners.json if a winner doesn't already exist.
    if (body.phase === "winner_published") {
      const weekId = currentWeek.id;

      const existingWinners = getWinners();
      const alreadyHasWinner = existingWinners.some((w) => w.weekId === weekId);

      if (!alreadyHasWinner) {
        const allSubmissions = getSubmissions().filter((s) => s.weekId === weekId);
        const allVotes = getVotes().filter((v) => v.weekId === weekId);

        if (allSubmissions.length > 0) {
          // Build vote tally per submission
          const tally: Record<string, number> = {};
          allVotes.forEach((v) => {
            tally[v.submissionId] = (tally[v.submissionId] || 0) + 1;
          });

          // Pick submission with most votes; break ties by earliest createdAt
          const winnerSub = [...allSubmissions].sort((a, b) => {
            const aVotes = tally[a.id] || 0;
            const bVotes = tally[b.id] || 0;
            if (bVotes !== aVotes) return bVotes - aVotes;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })[0];

          if (winnerSub) {
            const newId = String(
              Math.max(0, ...existingWinners.map((w) => parseInt(w.id, 10))) + 1
            );

            existingWinners.push({
              id: newId,
              weekId,
              movieTitle: winnerSub.movieTitle,
              posterUrl: winnerSub.posterUrl,
              letterboxdUrl: winnerSub.letterboxdUrl,
              submittedBy: winnerSub.userName,
              publishedAt: new Date().toISOString(),
              tmdbId: winnerSub.tmdbId,
              year: winnerSub.year,
              overview: winnerSub.overview,
              trailerUrl: winnerSub.trailerUrl,
              backdropUrl: winnerSub.backdropUrl,
            });

            saveWinners(existingWinners);
            addCredits(winnerSub.userId, 50, "submission_win", { winnerId: newId, weekId });
          }
        }
      }
    }
  }

  saveWeeks(weeks);
  return NextResponse.json(currentWeek);
}
