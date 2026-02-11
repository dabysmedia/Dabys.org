import { NextResponse } from "next/server";
import {
  getSubmissions,
  getWinners,
  getRatings,
  getComments,
  getWeeks,
  getUsers,
  getProfiles,
  computeDabysScorePct,
} from "@/lib/data";

export async function GET() {
  const submissions = getSubmissions();
  const winners = getWinners();
  const ratings = getRatings();
  const comments = getComments();
  const weeks = getWeeks();
  const users = getUsers();
  const profiles = getProfiles();

  // Totals
  const totalWeeks = weeks.length;
  const totalSubmissions = submissions.length;
  const totalWinners = winners.length;
  const totalRatings = ratings.length;
  const totalComments = comments.length;

  // Most submitted movie (by tmdbId or movieTitle)
  const movieCount = new Map<string, { count: number; movieTitle: string; posterUrl: string; year?: string }>();
  for (const s of submissions) {
    const key = s.tmdbId != null ? `tmdb:${s.tmdbId}` : `title:${s.movieTitle.trim().toLowerCase()}`;
    const existing = movieCount.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      movieCount.set(key, {
        count: 1,
        movieTitle: s.movieTitle,
        posterUrl: s.posterUrl || "",
        year: s.year,
      });
    }
  }
  let mostSubmittedMovie: { movieTitle: string; posterUrl: string; year?: string; count: number } | null = null;
  let maxCount = 0;
  for (const v of movieCount.values()) {
    if (v.count > maxCount) {
      maxCount = v.count;
      mostSubmittedMovie = { ...v };
    }
  }

  // Top submitters (userName -> count)
  const submitCountByUser = new Map<string, number>();
  for (const s of submissions) {
    submitCountByUser.set(s.userName, (submitCountByUser.get(s.userName) || 0) + 1);
  }
  const topSubmitters = Array.from(submitCountByUser.entries())
    .map(([userName, count]) => ({ userName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Win leaders (submittedBy -> count)
  const winCountByUser = new Map<string, number>();
  for (const w of winners) {
    if (w.submittedBy) {
      winCountByUser.set(w.submittedBy, (winCountByUser.get(w.submittedBy) || 0) + 1);
    }
  }
  const winLeaders = Array.from(winCountByUser.entries())
    .map(([userName, count]) => ({ userName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Biggest skippers (profiles sorted by skipsUsed desc, join with users for name)
  const biggestSkippers = profiles
    .filter((p) => (p.skipsUsed ?? 0) > 0)
    .map((p) => {
      const user = users.find((u) => u.id === p.userId);
      return { userName: user?.name ?? p.userId, skipsUsed: p.skipsUsed ?? 0 };
    })
    .sort((a, b) => b.skipsUsed - a.skipsUsed)
    .slice(0, 5);

  // Best rated winner (avg stars, at least 1 rating)
  const ratingByWinner = new Map<string, { sum: number; count: number }>();
  for (const r of ratings) {
    const cur = ratingByWinner.get(r.winnerId) || { sum: 0, count: 0 };
    cur.sum += r.stars;
    cur.count += 1;
    ratingByWinner.set(r.winnerId, cur);
  }
  let bestRatedWinner: { winnerId: string; movieTitle: string; posterUrl: string; avgStars: number; ratingCount: number; dabysScorePct: number } | null = null;
  let bestAvg = 0;
  for (const [winnerId, { sum, count }] of ratingByWinner.entries()) {
    if (count < 1) continue;
    const avg = sum / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      const winner = winners.find((w) => w.id === winnerId);
      if (winner) {
        const winnerRatings = ratings.filter((r) => r.winnerId === winnerId);
        const dabysScorePct = computeDabysScorePct(winnerRatings);
        bestRatedWinner = {
          winnerId,
          movieTitle: winner.movieTitle,
          posterUrl: winner.posterUrl || "",
          avgStars: Math.round(avg * 10) / 10,
          ratingCount: count,
          dabysScorePct,
        };
      }
    }
  }

  // Longest movie (winners with runtime, pick max)
  const withRuntime = winners.filter((w) => w.runtime != null && w.runtime > 0);
  let longestWinner: { winnerId: string; movieTitle: string; posterUrl: string; runtimeMinutes: number } | null = null;
  if (withRuntime.length > 0) {
    const longest = withRuntime.reduce((a, b) => (a.runtime! > b.runtime! ? a : b));
    longestWinner = {
      winnerId: longest.id,
      movieTitle: longest.movieTitle,
      posterUrl: longest.posterUrl || "",
      runtimeMinutes: longest.runtime!,
    };
  }

  // Most popular decade (from winning films' release year)
  const decadeCount = new Map<string, number>();
  for (const w of winners) {
    const y = w.year ? parseInt(w.year, 10) : NaN;
    const decade = !Number.isNaN(y) ? `${Math.floor(y / 10) * 10}s` : "Unknown";
    decadeCount.set(decade, (decadeCount.get(decade) || 0) + 1);
  }
  const winnersByDecade = Array.from(decadeCount.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalWeeks,
    totalSubmissions,
    totalWinners,
    totalRatings,
    totalComments,
    mostSubmittedMovie,
    topSubmitters,
    winLeaders,
    biggestSkippers,
    bestRatedWinner,
    longestWinner,
    winnersByDecade,
  });
}
