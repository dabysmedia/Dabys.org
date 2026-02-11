import { NextResponse } from "next/server";
import { getWinners } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface Slice { name: string; count: number }

export async function GET() {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { favoriteActors: [], favoriteDirectors: [], favoriteGenres: [], error: "TMDB not configured" },
      { status: 200 }
    );
  }

  const winners = getWinners().filter((w) => w.tmdbId != null);
  const actorCount = new Map<string, number>();
  const directorCount = new Map<string, number>();
  const genreCount = new Map<string, number>();

  for (const w of winners) {
    try {
      const base = "https://api.themoviedb.org/3";
      const movieUrl = `${base}/movie/${w.tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
      const creditsUrl = `${base}/movie/${w.tmdbId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;

      const [movieRes, creditsRes] = await Promise.all([
        fetch(movieUrl),
        fetch(creditsUrl),
      ]);

      const m = movieRes.ok ? await movieRes.json() : null;
      const cred = creditsRes.ok ? await creditsRes.json() : null;

      if (m?.genres && Array.isArray(m.genres)) {
        for (const g of m.genres) {
          const name = (g as { name?: string }).name;
          if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1);
        }
      }

      if (cred?.crew && Array.isArray(cred.crew)) {
        for (const c of cred.crew as { job?: string; name?: string }[]) {
          if (c.job === "Director" && c.name) {
            directorCount.set(c.name, (directorCount.get(c.name) || 0) + 1);
          }
        }
      }

      // Top 20 billed actors per movie from the dedicated credits endpoint
      const cast = (cred?.cast && Array.isArray(cred.cast)) ? (cred.cast as { name?: string; order?: number }[]) : [];
      const withOrder = cast
        .filter((c) => c && typeof c.name === "string" && c.name.trim() !== "")
        .map((c) => ({ name: c.name!, order: typeof c.order === "number" ? c.order : 999 }));
      withOrder.sort((a, b) => a.order - b.order);
      const topCast = withOrder.slice(0, 20);
      for (const c of topCast) {
        actorCount.set(c.name, (actorCount.get(c.name) || 0) + 1);
      }
    } catch {
      continue;
    }
  }

  const toSortedSlices = (map: Map<string, number>, max: number): Slice[] =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, max);

  const favoriteActors = toSortedSlices(actorCount, 20);
  const favoriteDirectors = toSortedSlices(directorCount, 10);
  const favoriteGenres = toSortedSlices(genreCount, 10);

  return NextResponse.json({
    favoriteActors,
    favoriteDirectors,
    favoriteGenres,
  });
}
