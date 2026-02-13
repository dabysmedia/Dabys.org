import { NextResponse } from "next/server";
import { getWinners, getCards, getCharacterPool } from "@/lib/data";
import {
  getPoolEntriesForMovie,
  getUserCollectedCharacterIdsForMovie,
  hasCompletedMovie,
} from "@/lib/cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const winnerId = searchParams.get("winnerId");
  const userId = searchParams.get("userId");

  if (!winnerId) {
    return NextResponse.json({ error: "winnerId required" }, { status: 400 });
  }

  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) {
    return NextResponse.json(
      { error: "Winner not found or has no TMDB data", poolEntries: [], ownedCharacterIds: [], ownedCards: [], completed: false },
      { status: 200 }
    );
  }

  const poolEntries = getPoolEntriesForMovie(winner.tmdbId);
  const ownedCharacterIds: string[] = userId ? Array.from(getUserCollectedCharacterIdsForMovie(userId, winner.tmdbId)) : [];
  const completed = userId ? hasCompletedMovie(userId, winnerId) : false;

  // Build ownedCards: for each owned characterId, get one card the user owns (main or pool alt-art)
  const pool = getCharacterPool();
  const ownedCards: ReturnType<typeof getCards>[number][] = [];
  if (userId) {
    const userCards = getCards(userId).filter((c) => c.movieTmdbId === winner.tmdbId);
    for (const charId of ownedCharacterIds) {
      const card = userCards.find(
        (c) => c.characterId === charId || pool.find((p) => p.characterId === c.characterId)?.altArtOfCharacterId === charId
      );
      if (card) ownedCards.push(card);
    }
  }

  return NextResponse.json({
    winnerId,
    movieTitle: winner.movieTitle ?? "",
    poolEntries,
    ownedCharacterIds,
    ownedCards,
    completed,
  });
}
