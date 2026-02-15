import { NextResponse } from "next/server";
import type { Submission } from "@/lib/data";
import {
  getWeeks,
  saveWeeks,
  getCurrentWeek,
  getSubmissions,
  getVotes,
  getWinners,
  saveWinners,
  addCredits,
  getCreditSettings,
} from "@/lib/data";
import { addPendingPoolEntriesForWinner } from "@/lib/cards";

/** Award credits per vote received to non-winning submitters when winner is published. */
function awardVotesReceivedCredits(
  winnerSubmissionId: string,
  allSubmissions: Submission[],
  tally: Record<string, number>,
  creditsPerVote: number,
  weekId: string
) {
  for (const sub of allSubmissions) {
    if (sub.id === winnerSubmissionId) continue;
    const votes = tally[sub.id] ?? 0;
    if (votes > 0) {
      addCredits(sub.userId, creditsPerVote * votes, "votes_received", { weekId, submissionId: sub.id });
    }
  }
}

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
    // When transitioning to winner_published, detect ties and either return tie data or create winner
    if (body.phase === "winner_published") {
      const weekId = currentWeek.id;
      const existingWinners = getWinners();
      const alreadyHasWinner = existingWinners.some((w) => w.weekId === weekId);

      if (!alreadyHasWinner) {
        const allSubmissions = getSubmissions().filter((s) => s.weekId === weekId);
        const allVotes = getVotes().filter((v) => v.weekId === weekId);

        const tally: Record<string, number> = {};
        allVotes.forEach((v) => {
          tally[v.submissionId] = (tally[v.submissionId] || 0) + 1;
        });
        const maxVotes = Math.max(0, ...Object.values(tally));
        const tiedSubmissions = allSubmissions.filter((s) => (tally[s.id] || 0) === maxVotes);

        // Tie resolution: client sent a chosen submission (manual or random pick)
        const submissionId = body.submissionId as string | undefined;
        if (submissionId) {
          const chosen = tiedSubmissions.find((s) => s.id === submissionId);
          if (!chosen) {
            return NextResponse.json(
              {
                error: "Chosen submission is not among the tied submissions",
                tiedSubmissions: tiedSubmissions.map((s) => ({ id: s.id, movieTitle: s.movieTitle })),
              },
              { status: 400 }
            );
          }
          const newId = String(
            Math.max(0, ...existingWinners.map((w) => parseInt(w.id, 10))) + 1
          );
          existingWinners.push({
            id: newId,
            weekId,
            movieTitle: chosen.movieTitle,
            posterUrl: chosen.posterUrl,
            letterboxdUrl: chosen.letterboxdUrl,
            submittedBy: chosen.userName,
            publishedAt: new Date().toISOString(),
            tmdbId: chosen.tmdbId,
            year: chosen.year,
            overview: chosen.overview,
            trailerUrl: chosen.trailerUrl,
            backdropUrl: chosen.backdropUrl,
          });
          saveWinners(existingWinners);
          const { submissionWin: amount, votesReceivedPerVote } = getCreditSettings();
          addCredits(chosen.userId, amount, "submission_win", { winnerId: newId, weekId });
          awardVotesReceivedCredits(chosen.id, allSubmissions, tally, votesReceivedPerVote, weekId);
          const newWinner = existingWinners[existingWinners.length - 1];
          if (newWinner?.tmdbId) {
            addPendingPoolEntriesForWinner(newWinner).catch((e) => console.error("Pending pool add error", e));
          }
          currentWeek.phase = "winner_published";
          saveWeeks(weeks);
          return NextResponse.json(currentWeek);
        }

        // No submissionId: if tie, return tie info without changing phase
        if (tiedSubmissions.length > 1) {
          return NextResponse.json({
            tie: true,
            tiedSubmissions: tiedSubmissions.map((s) => ({
              id: s.id,
              movieTitle: s.movieTitle,
              userName: s.userName,
              posterUrl: s.posterUrl,
            })),
            currentWeek,
          });
        }

        // Single top submission: create winner and set phase
        if (tiedSubmissions.length > 0) {
          const winnerSub = tiedSubmissions[0];
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
          const { submissionWin: amount, votesReceivedPerVote } = getCreditSettings();
          addCredits(winnerSub.userId, amount, "submission_win", { winnerId: newId, weekId });
          awardVotesReceivedCredits(winnerSub.id, allSubmissions, tally, votesReceivedPerVote, weekId);
          const newWinner = existingWinners[existingWinners.length - 1];
          if (newWinner?.tmdbId) {
            addPendingPoolEntriesForWinner(newWinner).catch((e) => console.error("Pending pool add error", e));
          }
        }
      }

      currentWeek.phase = "winner_published";
    } else {
      currentWeek.phase = body.phase;
    }
  }

  saveWeeks(weeks);
  return NextResponse.json(currentWeek);
}
