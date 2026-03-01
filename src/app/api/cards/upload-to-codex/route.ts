import { NextResponse } from "next/server";
import {
  getCardById,
  removeCard,
  cancelPendingTradesInvolvingCards,
  addCodexUnlock,
  addCodexUnlockHolo,
  addCodexUnlockPrismatic,
  addCodexUnlockDarkMatter,
  addCodexUnlockAltArt,
  addCodexUnlockBoys,
  getListings,
  getTradeBlock,
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCodexUnlockedPrismaticCharacterIds,
  getCodexUnlockedDarkMatterCharacterIds,
  getCodexUnlockedAltArtCharacterIds,
  getCodexUnlockedAltArtHoloCharacterIds,
  getCodexUnlockedAltArtPrismaticCharacterIds,
  getCodexUnlockedAltArtDarkMatterCharacterIds,
  getCodexUnlockedBoysCharacterIds,
  getCharacterPool,
  getWinners,
  getCardFinish,
  addSetCompletionQuest,
  addHoloSetCompletionQuest,
  addPrismaticSetCompletionQuest,
  addDarkMatterSetCompletionQuest,
  addCommunityCodexUnlock,
  addCommunitySetCompletionQuest,
  getCommunitySetById,
  getCommunityCodexUnlockedCharacterIds,
} from "@/lib/data";
import {
  hasCompletedMovie,
  hasCompletedMovieHoloCodex,
  hasCompletedMoviePrismaticCodex,
  hasCompletedMovieDarkMatterCodex,
  hasCompletedCommunitySet,
} from "@/lib/cards";

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
  const isCommunity = !!(poolEntry as { communitySetId?: string } | undefined)?.communitySetId;
  const isAltArt = (poolEntry?.altArtOfCharacterId ?? null) != null;
  const isBoys = (poolEntry?.cardType ?? "actor") === "character" && !isAltArt;
  const isMain = !isAltArt && !isBoys && !isCommunity;

  if (isCommunity) {
    const communitySetId = (poolEntry as { communitySetId?: string }).communitySetId!;
    const existingIds = getCommunityCodexUnlockedCharacterIds(userId, communitySetId);
    if (existingIds.includes(characterId)) {
      return NextResponse.json(
        { error: "This community card is already in your codex" },
        { status: 400 }
      );
    }
  } else if (isMain || isAltArt) {
    const regularIds = getCodexUnlockedCharacterIds(userId);
    const holoIds = getCodexUnlockedHoloCharacterIds(userId);
    const prismaticIds = getCodexUnlockedPrismaticCharacterIds(userId);
    const darkMatterIds = getCodexUnlockedDarkMatterCharacterIds(userId);
    const altArtIds = getCodexUnlockedAltArtCharacterIds(userId);
    const altArtHoloIds = getCodexUnlockedAltArtHoloCharacterIds(userId);
    const altArtPrismaticIds = getCodexUnlockedAltArtPrismaticCharacterIds(userId);
    const altArtDarkMatterIds = getCodexUnlockedAltArtDarkMatterCharacterIds(userId);
    const slotId = poolEntry?.altArtOfCharacterId ?? characterId;
    const hasRegularInSlot = regularIds.includes(slotId) || pool.some((e) => (e as { altArtOfCharacterId?: string }).altArtOfCharacterId === slotId && altArtIds.includes(e.characterId));
    const hasHoloInSlot = holoIds.includes(slotId) || pool.some((e) => (e as { altArtOfCharacterId?: string }).altArtOfCharacterId === slotId && altArtHoloIds.includes(e.characterId));
    const hasPrismaticInSlot = prismaticIds.includes(slotId) || pool.some((e) => (e as { altArtOfCharacterId?: string }).altArtOfCharacterId === slotId && altArtPrismaticIds.includes(e.characterId));
    const finish = getCardFinish(card);

    if (finish === "darkMatter") {
      if (!hasPrismaticInSlot) {
        return NextResponse.json(
          { error: "Upload the Radiant version to the codex first before upgrading to Dark Matter" },
          { status: 400 }
        );
      }
      if (isMain && darkMatterIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This character's Dark Matter is already in your codex" },
          { status: 400 }
        );
      }
      if (isAltArt && altArtDarkMatterIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This alt-art Dark Matter is already in your codex" },
          { status: 400 }
        );
      }
    } else if (finish === "prismatic") {
      if (!hasHoloInSlot) {
        return NextResponse.json(
          { error: "Upload the Holo version to the codex first before upgrading to Radiant" },
          { status: 400 }
        );
      }
      if (isMain && prismaticIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This character's Radiant is already in your codex" },
          { status: 400 }
        );
      }
      if (isAltArt && altArtPrismaticIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This alt-art Radiant is already in your codex" },
          { status: 400 }
        );
      }
    } else if (finish === "holo") {
      if (!hasRegularInSlot) {
        return NextResponse.json(
          { error: "Upload the regular version to the codex first before upgrading to Holo" },
          { status: 400 }
        );
      }
      if (isMain && holoIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This character's Holo is already in your codex" },
          { status: 400 }
        );
      }
      if (isAltArt && altArtHoloIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This alt-art Holo is already in your codex" },
          { status: 400 }
        );
      }
    } else {
      if (isMain && regularIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This character's regular card is already in your codex" },
          { status: 400 }
        );
      }
      if (isAltArt && altArtIds.includes(characterId)) {
        return NextResponse.json(
          { error: "This alt-art is already in your codex" },
          { status: 400 }
        );
      }
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
  cancelPendingTradesInvolvingCards([cardId]);

  const finish = getCardFinish(card);

  if (isMain) {
    switch (finish) {
      case "darkMatter":
        addCodexUnlockDarkMatter(userId, characterId);
        break;
      case "prismatic":
        addCodexUnlockPrismatic(userId, characterId);
        break;
      case "holo":
        addCodexUnlockHolo(userId, characterId);
        break;
      default:
        addCodexUnlock(userId, characterId);
        break;
    }
  } else if (isAltArt) {
    const altArtFinish = finish === "darkMatter" ? "darkMatter" : finish === "prismatic" ? "prismatic" : finish === "holo" ? "holo" : undefined;
    addCodexUnlockAltArt(userId, characterId, altArtFinish);
  } else if (isBoys) {
    addCodexUnlockBoys(userId, characterId);
  } else if (isCommunity) {
    const communitySetId = (poolEntry as { communitySetId?: string }).communitySetId!;
    addCommunityCodexUnlock(userId, communitySetId, characterId);
  }

  // Track quest progress: upload_codex
  const { recordQuestProgress } = await import("@/lib/quests");
  recordQuestProgress(userId, "upload_codex");

  // Check if this upload completed a set — if so, add a claimable quest
  let setCompleted: { winnerId: string; movieTitle: string } | undefined;
  let holoSetCompleted: { winnerId: string; movieTitle: string } | undefined;
  let prismaticSetCompleted: { winnerId: string; movieTitle: string } | undefined;
  let darkMatterSetCompleted: { winnerId: string; movieTitle: string } | undefined;
  let communitySetCompleted: { communitySetId: string; setName: string } | undefined;
  if (isCommunity) {
    const communitySetId = (poolEntry as { communitySetId?: string }).communitySetId!;
    if (hasCompletedCommunitySet(userId, communitySetId)) {
      const set = getCommunitySetById(communitySetId);
      const added = addCommunitySetCompletionQuest(userId, communitySetId, set?.creatorId ?? "");
      if (added && set) communitySetCompleted = { communitySetId, setName: set.name };
    }
  }
  const tmdbId = card.movieTmdbId;
  if (tmdbId) {
    const winner = getWinners().find((w) => w.tmdbId === tmdbId);
    if (winner) {
      if (hasCompletedMovie(userId, winner.id)) {
        const added = addSetCompletionQuest(userId, winner.id, winner.movieTitle ?? "");
        if (added) setCompleted = { winnerId: winner.id, movieTitle: winner.movieTitle ?? "" };
      }
      if ((finish === "holo" || finish === "prismatic" || finish === "darkMatter") && hasCompletedMovieHoloCodex(userId, winner.id)) {
        const added = addHoloSetCompletionQuest(userId, winner.id, winner.movieTitle ?? "");
        if (added) holoSetCompleted = { winnerId: winner.id, movieTitle: winner.movieTitle ?? "" };
      }
      if ((finish === "prismatic" || finish === "darkMatter") && hasCompletedMoviePrismaticCodex(userId, winner.id)) {
        const added = addPrismaticSetCompletionQuest(userId, winner.id, winner.movieTitle ?? "");
        if (added) prismaticSetCompleted = { winnerId: winner.id, movieTitle: winner.movieTitle ?? "" };
      }
      if (finish === "darkMatter" && hasCompletedMovieDarkMatterCodex(userId, winner.id)) {
        const added = addDarkMatterSetCompletionQuest(userId, winner.id, winner.movieTitle ?? "");
        if (added) darkMatterSetCompleted = { winnerId: winner.id, movieTitle: winner.movieTitle ?? "" };
      }
    }
  }

  const variantMap: Record<string, string> = {
    darkMatter: "darkMatter",
    prismatic: "prismatic",
    holo: "holo",
    normal: "regular",
  };

  return NextResponse.json({
    ok: true,
    characterId,
    isFoil: card.isFoil ?? false,
    finish,
    variant: isCommunity ? "community" : isMain ? (variantMap[finish] ?? "regular") : isAltArt ? (finish === "darkMatter" ? "altart_darkmatter" : finish === "prismatic" ? "altart_prismatic" : finish === "holo" ? "altart_holo" : "altart") : "boys",
    ...(isCommunity && { communitySetId: (poolEntry as { communitySetId?: string }).communitySetId }),
    ...(setCompleted && { setCompleted }),
    ...(holoSetCompleted && { holoSetCompleted }),
    ...(prismaticSetCompleted && { prismaticSetCompleted }),
    ...(darkMatterSetCompleted && { darkMatterSetCompleted }),
    ...(communitySetCompleted && { communitySetCompleted }),
  });
}
