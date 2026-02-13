import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCharacterPool, saveCharacterPool, getWinners, migrateCommonToUncommon, updateCardsByCharacterId } from "@/lib/data";
import { cleanupGenericPoolEntries } from "@/lib/cards";
import type { CardType } from "@/lib/data";

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
    return NextResponse.json({ pool });
  }

  const pool = getCharacterPool();
  return NextResponse.json({ pool });
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
  const cardType: CardType = ["actor", "director", "character", "scene"].includes(body.cardType) ? body.cardType : "actor";
  const altArtOfCharacterId =
    typeof body.altArtOfCharacterId === "string" && body.altArtOfCharacterId.trim() !== ""
      ? body.altArtOfCharacterId.trim()
      : undefined;

  if (!actorName || !profilePath) {
    return NextResponse.json(
      { error: "actorName and profilePath are required" },
      { status: 400 }
    );
  }
  if (!winnerId) {
    return NextResponse.json(
      { error: "winnerId is required (select a winner/movie)" },
      { status: 400 }
    );
  }

  const winners = getWinners();
  const winner = winners.find((w) => w.id === winnerId);
  if (!winner) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }
  const movieTmdbId = winner.tmdbId ?? 0;
  const movieTitle = winner.movieTitle?.trim() || "Unknown";

  const pool = getCharacterPool();
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
  };
  pool.push(newEntry);
  saveCharacterPool(pool);
  return NextResponse.json(newEntry, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const characterId = body.characterId as string | undefined;
  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }

  const pool = getCharacterPool();
  const idx = pool.findIndex((c) => c.characterId === characterId);
  if (idx < 0) {
    return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
  }

  const updates: Partial<typeof pool[0]> = {};
  if (typeof body.actorName === "string") updates.actorName = body.actorName.trim();
  if (typeof body.characterName === "string") updates.characterName = body.characterName.trim() || "Unknown";
  if (typeof body.movieTitle === "string") updates.movieTitle = body.movieTitle.trim();
  if (typeof body.profilePath === "string") updates.profilePath = body.profilePath.trim();
  if (typeof body.movieTmdbId === "number") updates.movieTmdbId = body.movieTmdbId;
  else if (body.movieTmdbId !== undefined) updates.movieTmdbId = parseInt(String(body.movieTmdbId), 10) || 0;
  if (["uncommon", "rare", "epic", "legendary"].includes(body.rarity)) updates.rarity = body.rarity;
  if (["actor", "director", "character", "scene"].includes(body.cardType)) updates.cardType = body.cardType;
  if (typeof body.popularity === "number") updates.popularity = body.popularity;
  if (body.altArtOfCharacterId !== undefined) {
    updates.altArtOfCharacterId =
      typeof body.altArtOfCharacterId === "string" && body.altArtOfCharacterId.trim() !== ""
        ? body.altArtOfCharacterId.trim()
        : undefined;
  }

  pool[idx] = { ...pool[idx], ...updates };
  saveCharacterPool(pool);
  // Propagate pool changes to all existing cards with this characterId (so image/name/etc updates show site-wide; alt-art is pool-only)
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
  if (!characterId) {
    return NextResponse.json({ error: "characterId required" }, { status: 400 });
  }

  const pool = getCharacterPool();
  const filtered = pool.filter((c) => c.characterId !== characterId);
  if (filtered.length === pool.length) {
    return NextResponse.json({ error: "Pool entry not found" }, { status: 404 });
  }
  saveCharacterPool(filtered);
  return NextResponse.json({ success: true });
}
