import { NextResponse } from "next/server";
import { getSubmissions, saveSubmissions, getCurrentWeek, getProfiles, addCredits, hasReceivedCreditsForWeek, getCreditSettings } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";
import { getDisplayedBadgeForUser } from "@/lib/cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");

  const allSubs = getSubmissions();
  const profiles = getProfiles();

  // Count how many times each movie has been submitted (all time), keyed by tmdbId or movieTitle
  const countByMovie = new Map<string, number>();
  for (const s of allSubs) {
    const key = s.tmdbId != null ? `tmdb:${s.tmdbId}` : `title:${s.movieTitle.trim().toLowerCase()}`;
    countByMovie.set(key, (countByMovie.get(key) || 0) + 1);
  }

  let subs = weekId ? allSubs.filter((s) => s.weekId === weekId) : allSubs;

  const enriched = subs.map((s) => {
    const key = s.tmdbId != null ? `tmdb:${s.tmdbId}` : `title:${s.movieTitle.trim().toLowerCase()}`;
    const submissionCount = countByMovie.get(key) ?? 1;
    const profile = profiles.find((p) => p.userId === s.userId);
    const displayedBadge = getDisplayedBadgeForUser(s.userId);
    return { ...s, submissionCount, avatarUrl: profile?.avatarUrl || "", displayedBadge };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.movieTitle || !body.userId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const subs = getSubmissions();

  // Manual admin submission — allows specifying a weekId directly
  if (body.manual && body.weekId) {
    const newId = String(
      Math.max(0, ...subs.map((s) => parseInt(s.id, 10))) + 1
    );
    const newSub = {
      id: newId,
      weekId: body.weekId,
      userId: body.userId,
      userName: body.userName,
      movieTitle: body.movieTitle,
      posterUrl: body.posterUrl || "",
      letterboxdUrl: body.letterboxdUrl || "",
      tmdbId: body.tmdbId || undefined,
      year: body.year || undefined,
      overview: body.overview || undefined,
      trailerUrl: body.trailerUrl || undefined,
      backdropUrl: body.backdropUrl || undefined,
      createdAt: body.createdAt || new Date().toISOString(),
    };
    subs.push(newSub);
    saveSubmissions(subs);
    return NextResponse.json(newSub, { status: 201 });
  }

  // Normal user submission — requires open subs
  const currentWeek = getCurrentWeek();

  if (!currentWeek || currentWeek.phase !== "subs_open") {
    return NextResponse.json(
      { error: "Submissions are not open" },
      { status: 400 }
    );
  }

  // One submission per user per week
  const existing = subs.findIndex(
    (s) => s.weekId === currentWeek.id && s.userId === body.userId
  );
  if (existing >= 0) {
    return NextResponse.json(
      { error: "You already submitted this week. Clear it first to change." },
      { status: 409 }
    );
  }

  const newId = String(
    Math.max(0, ...subs.map((s) => parseInt(s.id, 10))) + 1
  );

  const newSub = {
    id: newId,
    weekId: currentWeek.id,
    userId: body.userId,
    userName: body.userName,
    movieTitle: body.movieTitle,
    posterUrl: body.posterUrl || "",
    letterboxdUrl: body.letterboxdUrl || "",
    tmdbId: body.tmdbId || undefined,
    year: body.year || undefined,
    overview: body.overview || undefined,
    trailerUrl: body.trailerUrl || undefined,
    backdropUrl: body.backdropUrl || undefined,
    createdAt: new Date().toISOString(),
  };

  subs.push(newSub);
  saveSubmissions(subs);

  // Award credits only once per user per week (even if they clear and resubmit)
  if (!hasReceivedCreditsForWeek(body.userId, "submission", currentWeek.id)) {
    const { submission: amount } = getCreditSettings();
    addCredits(body.userId, amount, "submission", { submissionId: newId, weekId: currentWeek.id });
  }

  // Movie night quest: submit a movie
  recordQuestProgress(body.userId, "submit_movie");

  return NextResponse.json(newSub, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const weekId = searchParams.get("weekId");

  if (!userId || !weekId) {
    return NextResponse.json({ error: "userId and weekId required" }, { status: 400 });
  }

  const subs = getSubmissions();
  const filtered = subs.filter(
    (s) => !(s.weekId === weekId && s.userId === userId)
  );
  saveSubmissions(filtered);
  return NextResponse.json({ success: true });
}
