import { NextResponse } from "next/server";
import { getWinners, getCards, getCharacterPool } from "@/lib/data";
import {
  getPoolEntriesForMovie,
  getUserCodexCharacterIdsForMovie,
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
  // Badge/set completion is from codex (discovered), not inventory.
  const discoveredSlots = userId ? getUserCodexCharacterIdsForMovie(userId, winner.tmdbId) : new Set<string>();
  const ownedCharacterIds: string[] = poolEntries
    .filter((e) => discoveredSlots.has(e.altArtOfCharacterId ?? e.characterId))
    .map((e) => e.characterId);
  const completed = userId ? hasCompletedMovie(userId, winnerId) : false;

  // ownedCards: cards in inventory for this movie (for thumbnails; may be fewer than discovered if user uploaded to codex)
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
