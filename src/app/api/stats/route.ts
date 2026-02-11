import { NextResponse } from "next/server";
import {
  getSubmissions,
  getWinners,
  getVotes,
  getRatings,
  getComments,
  getWeeks,
  getUsers,
} from "@/lib/data";

export async function GET() {
  const submissions = getSubmissions();
  const winners = getWinners();
  const votes = getVotes();
  const ratings = getRatings();
  const comments = getComments();
  const weeks = getWeeks();
  const users = getUsers();

  // Totals
  const totalWeeks = weeks.length;
  const totalSubmissions = submissions.length;
  const totalVotes = votes.length;
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

  // Most active voters (userId -> count; we need userName from users)
  const voteCountByUser = new Map<string, number>();
  for (const v of votes) {
    voteCountByUser.set(v.userId, (voteCountByUser.get(v.userId) || 0) + 1);
  }
  const mostActiveVoters = Array.from(voteCountByUser.entries())
    .map(([userId, count]) => ({
      userName: users.find((u) => u.id === userId)?.name || "Unknown",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Best rated winner (avg stars, at least 1 rating)
  const ratingByWinner = new Map<string, { sum: number; count: number }>();
  for (const r of ratings) {
    const cur = ratingByWinner.get(r.winnerId) || { sum: 0, count: 0 };
    cur.sum += r.stars;
    cur.count += 1;
    ratingByWinner.set(r.winnerId, cur);
  }
  let bestRatedWinner: { winnerId: string; movieTitle: string; posterUrl: string; avgStars: number; ratingCount: number } | null = null;
  let bestAvg = 0;
  for (const [winnerId, { sum, count }] of ratingByWinner.entries()) {
    if (count < 1) continue;
    const avg = sum / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      const winner = winners.find((w) => w.id === winnerId);
      if (winner) {
        bestRatedWinner = {
          winnerId,
          movieTitle: winner.movieTitle,
          posterUrl: winner.posterUrl || "",
          avgStars: Math.round(avg * 10) / 10,
          ratingCount: count,
        };
      }
    }
  }

  // Most discussed winner (comment count per winner)
  const commentCountByWinner = new Map<string, number>();
  for (const c of comments) {
    commentCountByWinner.set(c.winnerId, (commentCountByWinner.get(c.winnerId) || 0) + 1);
  }
  let mostDiscussedWinner: { winnerId: string; movieTitle: string; posterUrl: string; commentCount: number } | null = null;
  let maxComments = 0;
  for (const [winnerId, commentCount] of commentCountByWinner.entries()) {
    if (commentCount > maxComments) {
      maxComments = commentCount;
      const winner = winners.find((w) => w.id === winnerId);
      if (winner) {
        mostDiscussedWinner = {
          winnerId,
          movieTitle: winner.movieTitle,
          posterUrl: winner.posterUrl || "",
          commentCount,
        };
      }
    }
  }

  // Submissions by theme (weekId -> count, then join with weeks for theme name)
  const subsByWeek = new Map<string, number>();
  for (const s of submissions) {
    subsByWeek.set(s.weekId, (subsByWeek.get(s.weekId) || 0) + 1);
  }
  const submissionsByTheme = weeks
    .map((w) => ({
      theme: w.theme,
      weekId: w.id,
      count: subsByWeek.get(w.id) || 0,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalWeeks,
    totalSubmissions,
    totalVotes,
    totalWinners,
    totalRatings,
    totalComments,
    mostSubmittedMovie,
    topSubmitters,
    winLeaders,
    mostActiveVoters,
    bestRatedWinner,
    mostDiscussedWinner,
    submissionsByTheme,
  });
}
