import { NextResponse } from "next/server";
import { getWinners } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";

interface Slice { name: string; count: number; profileUrl?: string }

export async function GET() {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { favoriteActors: [], favoriteDirectors: [], favoriteGenres: [], error: "TMDB not configured" },
      { status: 200 }
    );
  }

  const winners = getWinners().filter((w) => w.tmdbId != null);
  const actorCount = new Map<string, { count: number; profilePath?: string }>();
  const directorCount = new Map<string, { count: number; profilePath?: string }>();
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
        for (const c of cred.crew as { job?: string; name?: string; profile_path?: string }[]) {
          if (c.job === "Director" && c.name) {
            const cur = directorCount.get(c.name);
            directorCount.set(c.name, {
              count: (cur?.count || 0) + 1,
              profilePath: cur?.profilePath ?? (c.profile_path || undefined),
            });
          }
        }
      }

      const cast = (cred?.cast && Array.isArray(cred.cast)) ? (cred.cast as { name?: string; order?: number; profile_path?: string }[]) : [];
      const withOrder = cast
        .filter((c) => c && typeof c.name === "string" && c.name.trim() !== "")
        .map((c) => ({ name: c.name!, order: typeof c.order === "number" ? c.order : 999, profilePath: c.profile_path }));
      withOrder.sort((a, b) => a.order - b.order);
      const topCast = withOrder.slice(0, 20);
      for (const c of topCast) {
        const cur = actorCount.get(c.name);
        actorCount.set(c.name, {
          count: (cur?.count || 0) + 1,
          profilePath: cur?.profilePath ?? (c.profilePath || undefined),
        });
      }
    } catch {
      continue;
    }
  }

  const toSlices = (
    map: Map<string, { count: number; profilePath?: string }>,
    max: number
  ): Slice[] =>
    Array.from(map.entries())
      .map(([name, { count, profilePath }]) => ({
        name,
        count,
        profileUrl: profilePath ? `${TMDB_IMG}${profilePath}` : undefined,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, max);

  const favoriteActors = toSlices(actorCount, 20);
  const favoriteDirectors = toSlices(directorCount, 10);
  const favoriteGenres = Array.from(genreCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    favoriteActors,
    favoriteDirectors,
    favoriteGenres,
  });
}
