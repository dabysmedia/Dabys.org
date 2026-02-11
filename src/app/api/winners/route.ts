import { NextResponse } from "next/server";
import { getWinners, saveWinners, getSubmissions, saveSubmissions, getCurrentWeek, getWeeks, getUsers } from "@/lib/data";

export async function GET() {
  const winners = getWinners();
  const weeks = getWeeks();
  const users = getUsers();
  const enriched = winners.map((w) => {
    const week = weeks.find((wk) => wk.id === w.weekId);
    const submitterUser = users.find((u) => u.name === w.submittedBy);
    return {
      ...w,
      weekTheme: week?.theme || "",
      submittedByUserId: submitterUser?.id || "",
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
  };

  winners.push(newWinner);
  saveWinners(winners);

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
