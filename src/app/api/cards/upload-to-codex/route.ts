import { NextResponse } from "next/server";
import {
  getCardById,
  removeCard,
  addCodexUnlock,
  addCodexUnlockHolo,
  addCodexUnlockAltArt,
  addCodexUnlockBoys,
  getListings,
  getTradeBlock,
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCodexUnlockedAltArtCharacterIds,
  getCodexUnlockedBoysCharacterIds,
  getCharacterPool,
  getWinners,
  addSetCompletionQuest,
  addHoloSetCompletionQuest,
} from "@/lib/data";
import { hasCompletedMovie, hasCompletedMovieHoloCodex } from "@/lib/cards";

/** Upload a card to the codex: removes it from your collection and unlocks that slot. Legendaries re-enter the pool.
 * Main codex: you can upload both regular and holo per character (two slots). Holo requires regular to be in codex first.
 * Alt-arts and Boys tabs: one slot per character (lock-in). */
export async function POST(request: Request) {
  let body: { userId?: string; cardId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, cardId } = body;
  if (!userId || !cardId) {
    return NextResponse.json(
      { error: "userId and cardId required" },
      { status: 400 }
    );
  }

  const card = getCardById(cardId);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (card.userId !== userId) {
    return NextResponse.json({ error: "Not your card" }, { status: 403 });
  }

  const listings = getListings();
  const isListed = listings.some((l) => l.cardId === cardId);
  if (isListed) {
    return NextResponse.json(
      { error: "Unlist the card from the marketplace before uploading to the codex" },
      { status: 400 }
    );
  }

  const tradeBlock = getTradeBlock();
  const onTradeBlock = tradeBlock.some((e) => e.cardId === cardId && e.userId === userId);
  if (onTradeBlock) {
    return NextResponse.json(
      { error: "Remove the card from the trade block before uploading to the codex" },
      { status: 400 }
    );
  }

  const characterId = card.characterId;
  if (!characterId) {
    return NextResponse.json({ error: "Card has no character" }, { status: 400 });
  }

  const pool = getCharacterPool();
  const poolEntry = pool.find((e) => e.characterId === characterId);
  const isAltArt = (poolEntry?.altArtOfCharacterId ?? null) != null;
  const isBoys = (poolEntry?.cardType ?? "actor") === "character" && !isAltArt;
  const isMain = !isAltArt && !isBoys;

  if (isMain) {
    const regularIds = getCodexUnlockedCharacterIds(userId);
    const holoIds = getCodexUnlockedHoloCharacterIds(userId);
    const alreadyRegular = regularIds.includes(characterId);
    const alreadyHolo = holoIds.includes(characterId);
    if (card.isFoil) {
      if (!alreadyRegular) {
        return NextResponse.json(
          { error: "Upload the regular version to the codex first before upgrading to Holo" },
          { status: 400 }
        );
      }
      if (alreadyHolo) {
        return NextResponse.json(
          { error: "This character's Holo is already in your codex" },
          { status: 400 }
        );
      }
    } else {
      if (alreadyRegular) {
        return NextResponse.json(
          { error: "This character's regular card is already in your codex" },
          { status: 400 }
        );
      }
    }
  } else if (isAltArt) {
    const altArtIds = getCodexUnlockedAltArtCharacterIds(userId);
    if (altArtIds.includes(characterId)) {
      return NextResponse.json(
        { error: "This alt-art is already in your codex" },
        { status: 400 }
      );
    }
  } else if (isBoys) {
    const boysIds = getCodexUnlockedBoysCharacterIds(userId);
    if (boysIds.includes(characterId)) {
      return NextResponse.json(
        { error: "This Boys card is already in your codex" },
        { status: 400 }
      );
    }
  }

  removeCard(cardId);

  if (isMain) {
    if (card.isFoil) {
      addCodexUnlockHolo(userId, characterId);
    } else {
      addCodexUnlock(userId, characterId);
    }
  } else if (isAltArt) {
    addCodexUnlockAltArt(userId, characterId);
  } else if (isBoys) {
    addCodexUnlockBoys(userId, characterId);
  }

  // Track quest progress: upload_codex
  const { recordQuestProgress } = await import("@/lib/quests");
  recordQuestProgress(userId, "upload_codex");

  // Check if this upload completed a set — if so, add a claimable quest
  let setCompleted: { winnerId: string; movieTitle: string } | undefined;
  let holoSetCompleted: { winnerId: string; movieTitle: string } | undefined;
  const tmdbId = card.movieTmdbId;
  if (tmdbId) {
    const winner = getWinners().find((w) => w.tmdbId === tmdbId);
    if (winner) {
      if (hasCompletedMovie(userId, winner.id)) {
        const added = addSetCompletionQuest(userId, winner.id, winner.movieTitle ?? "");
        if (added) setCompleted = { winnerId: winner.id, movieTitle: winner.movieTitle ?? "" };
      }
      if (card.isFoil && hasCompletedMovieHoloCodex(userId, winner.id)) {
        const added = addHoloSetCompletionQuest(userId, winner.id, winner.movieTitle ?? "");
        if (added) holoSetCompleted = { winnerId: winner.id, movieTitle: winner.movieTitle ?? "" };
      }
    }
  }

  return NextResponse.json({
    ok: true,
    characterId,
    isFoil: card.isFoil ?? false,
    variant: isMain ? (card.isFoil ? "holo" : "regular") : isAltArt ? "altart" : "boys",
    ...(setCompleted && { setCompleted }),
    ...(holoSetCompleted && { holoSetCompleted }),
  });
}
