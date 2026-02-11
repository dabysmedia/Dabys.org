import { NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p";

/**
 * Generate a Letterboxd film URL from a movie title and optional year.
 * Letterboxd slugs are lowercase, hyphenated, alphanumeric-only.
 * For disambiguation, the year is appended (e.g. /film/the-thing-1982/).
 */
function toLetterboxdUrl(title: string, year?: string): string {
  let slug = title
    .toLowerCase()
    .replace(/['']/g, "") // remove apostrophes
    .replace(/&/g, "and") // ampersand → and
    .replace(/[^a-z0-9\s-]/g, "") // strip non-alphanumeric
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens

  if (year) slug += `-${year}`;

  return `https://letterboxd.com/film/${slug}/`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Fetch movie details + videos in one request
    const url = new URL(`https://api.themoviedb.org/3/movie/${id}`);
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("append_to_response", "videos");
    url.searchParams.set("language", "en-US");

    const res = await fetch(url.toString());
    const m = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: m.status_message || "TMDB error" },
        { status: res.status }
      );
    }

    // Find YouTube trailer (prefer official trailers, then teasers, then any video)
    let trailerUrl = "";
    if (m.videos?.results?.length) {
      const videos: {
        key: string;
        site: string;
        type: string;
        official: boolean;
      }[] = m.videos.results;

      const ytVideos = videos.filter((v) => v.site === "YouTube");
      const trailer =
        ytVideos.find((v) => v.type === "Trailer" && v.official) ||
        ytVideos.find((v) => v.type === "Trailer") ||
        ytVideos.find((v) => v.type === "Teaser") ||
        ytVideos[0];

      if (trailer) {
        trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
      }
    }

    const year = m.release_date ? m.release_date.slice(0, 4) : "";
    const letterboxdUrl = toLetterboxdUrl(m.title, year);

    return NextResponse.json({
      tmdbId: m.id,
      title: m.title,
      year,
      overview: m.overview || "",
      posterUrl: m.poster_path
        ? `${TMDB_IMG}/w500${m.poster_path}`
        : "",
      backdropUrl: m.backdrop_path
        ? `${TMDB_IMG}/w1280${m.backdrop_path}`
        : "",
      trailerUrl,
      letterboxdUrl,
      genres: (m.genres || []).map((g: { name: string }) => g.name),
      runtime: m.runtime || 0,
    });
  } catch (e) {
    console.error("TMDB movie detail error", e);
    return NextResponse.json(
      { error: "Request failed" },
      { status: 500 }
    );
  }
}
