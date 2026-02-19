import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCharacterPool, saveCharacterPool, getPendingPool, getWinners, migrateCommonToUncommon, updateCardsByCharacterId, updatePendingPoolEntry, removePendingPoolEntry, addPendingPoolEntry, getAllowedCardTypeIds, getCustomCardTypes } from "@/lib/data";
import { cleanupGenericPoolEntries } from "@/lib/cards";
import type { CardType, CharacterPortrayal } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  migrateCommonToUncommon();

  const { searchParams } = new URL(request.url);
  if (searchParams.get("cleanup") === "1") {
    const pool = cleanupGenericPoolEntries();
    return NextResponse.json({ pool, pendingByWinner: getPendingPool() });
  }

  const pool = getCharacterPool();
  const pendingByWinner = getPendingPool();
  const customCardTypes = getCustomCardTypes();
  return NextResponse.json({ pool, pendingByWinner, customCardTypes });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const actorName = (body.actorName as string)?.trim();
  const characterName = (body.characterName as string)?.trim() || "Unknown";
  const profilePath = (body.profilePath as string)?.trim();
  const winnerId = (body.winnerId as string)?.trim();
  const rarity = ["uncommon", "rare", "epic", "legendary"].includes(body.rarity) ? body.rarity : "uncommon";
  const allowedIds = getAllowedCardTypeIds();
  const cardType = typeof body.cardType === "string" && allowedIds.includes(body.cardType) ? body.cardType : "actor";
  const altArtOfCharacterId =
    typeof body.altArtOfCharacterId === "string" && body.altArtOfCharacterId.trim() !== ""
      ? body.altArtOfCharacterId.trim()
      : undefined;
  const customSetId =
    typeof body.customSetId === "string" && body.customSetId.trim() !== ""
      ? body.customSetId.trim()
      : undefined;

  if (!actorName || !profilePath) {
    return NextResponse.json(
      { error: "actorName and profilePath are required" },
      { status: 400 }
    );
  }
  // Boys (character) and custom pool types do not require a winner/movie link
  const isCustomPoolType = cardType === "character" || getCustomCardTypes().some((t) => t.id === cardType);
  if (!isCustomPoolType && !winnerId) {
    return NextResponse.json(
      { error: "winnerId is required (select a winner/movie)" },
      { status: 400 }
    );
  }

  let movieTmdbId: number;
  let movieTitle: string;
  if (isCustomPoolType && !winnerId) {
    movieTmdbId = 0;
    movieTitle = (body.movieTitle as string)?.trim() || (cardType === "character" ? "Boys" : cardType);
  } else {
    const winners = getWinners();
    const winner = winners.find((w) => w.id === winnerId);
    if (!winner) {
      return NextResponse.json({ error: "Winner not found" }, { status: 404 });
    }
    movieTmdbId = winner.tmdbId ?? 0;
    movieTitle = winner.movieTitle?.trim() || "Unknown";
  }

  const characterId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const newEntry = {
    characterId,
    actorName,
    characterName,
    profilePath,
    movieTmdbId,
    movieTitle,
    popularity: 0,
    rarity,
    cardType,
    ...(altArtOfCharacterId != null && { altArtOfCharacterId }),
    ...(isCustomPoolType && customSetId != null && { customSetId }),
  };

  // Always add to pending first; admin pushes to pool when ready
  const bucketKey = isCustomPoolType ? cardType : winnerId;
  addPendingPoolEntry(bucketKey, newEntry);
  return NextResponse.json(newEntry, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const characterId = body.characterId as string | undefined;
  const winnerId = typeof body.winnerId === "string" ? body.winnerId.trim() : undefined;
  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }

  const updates: Partial<CharacterPortrayal> = {};
  if (typeof body.actorName === "string") updates.actorName = body.actorName.trim();
  if (typeof body.characterName === "string") updates.characterName = body.characterName.trim() || "Unknown";
  if (typeof body.movieTitle === "string") updates.movieTitle = body.movieTitle.trim();
  if (typeof body.profilePath === "string") updates.profilePath = body.profilePath.trim();
  if (typeof body.movieTmdbId === "number") updates.movieTmdbId = body.movieTmdbId;
  else if (body.movieTmdbId !== undefined) updates.movieTmdbId = parseInt(String(body.movieTmdbId), 10) || 0;
  if (["uncommon", "rare", "epic", "legendary"].includes(body.rarity)) updates.rarity = body.rarity as CharacterPortrayal["rarity"];
  if (typeof body.cardType === "string" && getAllowedCardTypeIds().includes(body.cardType)) updates.cardType = body.cardType as CharacterPortrayal["cardType"];
  if (typeof body.popularity === "number") updates.popularity = body.popularity;
  if (body.altArtOfCharacterId !== undefined) {
    updates.altArtOfCharacterId =
      typeof body.altArtOfCharacterId === "string" && body.altArtOfCharacterId.trim() !== ""
        ? body.altArtOfCharacterId.trim()
        : undefined;
  }
  if (body.customSetId !== undefined) {
    updates.customSetId =
      typeof body.customSetId === "string" && body.customSetId.trim() !== ""
        ? body.customSetId.trim()
        : undefined;
  }

  if (winnerId) {
    const updated = updatePendingPoolEntry(winnerId, characterId, updates);
    if (!updated) return NextResponse.json({ error: "Pending entry not found" }, { status: 404 });
    return NextResponse.json(updated);
  }

  const pool = getCharacterPool();
  const idx = pool.findIndex((c) => c.characterId === characterId);
  if (idx < 0) {
    return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
  }

  pool[idx] = { ...pool[idx], ...updates };
  saveCharacterPool(pool);
  const { popularity: _p, altArtOfCharacterId: _a, ...cardUpdates } = updates;
  if (Object.keys(cardUpdates).length > 0) {
    updateCardsByCharacterId(characterId, cardUpdates);
  }
  return NextResponse.json(pool[idx]);
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const characterId = searchParams.get("characterId");
  const winnerId = searchParams.get("winnerId");
  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }

  if (winnerId) {
    const removed = removePendingPoolEntry(winnerId, characterId);
    if (!removed) return NextResponse.json({ error: "Pending entry not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  const pool = getCharacterPool();
  const filtered = pool.filter((c) => c.characterId !== characterId);
  if (filtered.length === pool.length) {
    return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
  }
  saveCharacterPool(filtered);
  return NextResponse.json({ success: true });
}
