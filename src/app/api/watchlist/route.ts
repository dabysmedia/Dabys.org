import { NextResponse } from "next/server";
import { addWatchlistItem, removeWatchlistItem } from "@/lib/data";

// POST /api/watchlist — add a movie to the current user's watchlist
export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId as string | undefined;
  const tmdbId =
    typeof body.tmdbId === "number"
      ? body.tmdbId
      : typeof body.tmdbId === "string"
        ? parseInt(body.tmdbId, 10)
        : undefined;
  const movieTitle = body.movieTitle as string | undefined;
  const posterUrl = body.posterUrl as string | undefined;
  const letterboxdUrl = (body.letterboxdUrl as string) || "";
  const year = body.year as string | undefined;

  if (!userId || tmdbId == null || !movieTitle || !posterUrl) {
    return NextResponse.json(
      { error: "Missing userId, tmdbId, movieTitle, or posterUrl" },
      { status: 400 }
    );
  }

  const item = addWatchlistItem(userId, {
    tmdbId,
    movieTitle,
    posterUrl,
    letterboxdUrl,
    year,
  });
  return NextResponse.json(item);
}

// DELETE /api/watchlist — remove a movie from the current user's watchlist
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || undefined;
  const tmdbIdParam = url.searchParams.get("tmdbId");
  const tmdbId =
    tmdbIdParam != null ? parseInt(tmdbIdParam, 10) : undefined;

  if (!userId || tmdbId == null || Number.isNaN(tmdbId)) {
    return NextResponse.json(
      { error: "Missing or invalid userId or tmdbId" },
      { status: 400 }
    );
  }

  const removed = removeWatchlistItem(userId, tmdbId);
  return NextResponse.json({ removed });
}
