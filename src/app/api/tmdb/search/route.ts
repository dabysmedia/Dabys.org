import { NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p";

interface TmdbRawResult {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  popularity?: number;
  vote_count?: number;
}

/**
 * Search TMDB movies. We fire two queries in parallel when the input
 * contains hyphens (e.g. "wall-e") — one as-is and one with hyphens
 * replaced by the middle-dot character (·) which TMDB uses in titles
 * like WALL·E. Results are merged, de-duped, and sorted by popularity
 * so the most well-known movies appear first.
 */
export async function GET(request: Request) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { results: [], error: "TMDB_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100);

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Build primary search URL
    const buildUrl = (query: string) => {
      const url = new URL("https://api.themoviedb.org/3/search/movie");
      url.searchParams.set("api_key", TMDB_API_KEY!);
      url.searchParams.set("query", query);
      url.searchParams.set("include_adult", "false");
      url.searchParams.set("language", "en-US");
      url.searchParams.set("page", "1");
      return url.toString();
    };

    // Fire searches in parallel: original query + middle-dot variant if hyphens present
    const queries = [q];
    if (q.includes("-")) {
      queries.push(q.replace(/-/g, "\u00B7")); // middle dot ·
    }

    const fetches = queries.map((query) =>
      fetch(buildUrl(query)).then((r) => r.json())
    );
    const responses = await Promise.all(fetches);

    // Merge and de-duplicate by ID
    const seen = new Set<number>();
    const merged: TmdbRawResult[] = [];

    for (const json of responses) {
      if (!json.results) continue;
      for (const m of json.results as TmdbRawResult[]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push(m);
        }
      }
    }

    // Sort by popularity descending so well-known movies appear first
    merged.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    // Return simplified results for autocomplete
    const results = merged.slice(0, 15).map((m) => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? m.release_date.slice(0, 4) : "",
      posterUrl: m.poster_path ? `${TMDB_IMG}/w185${m.poster_path}` : "",
      overview: (m.overview || "").slice(0, 200),
    }));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("TMDB search error", e);
    return NextResponse.json(
      { results: [], error: "Request failed" },
      { status: 500 }
    );
  }
}
