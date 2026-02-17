import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCards,
  getCharacterPool,
  addCard,
  updateCard,
  removeCard,
  getUsers,
} from "@/lib/data";

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

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const cards = getCards(userId);
  return NextResponse.json(cards);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const characterId = body.characterId as string | undefined;
  const finish = ["normal", "holo", "prismatic", "darkMatter"].includes(body.finish) ? body.finish : (body.isFoil ? "holo" : "normal");

  if (!userId || !characterId) {
    return NextResponse.json(
      { error: "userId and characterId required" },
      { status: 400 }
    );
  }

  const pool = getCharacterPool().filter((c) => c.profilePath?.trim());
  const char = pool.find((c) => c.characterId === characterId);
  if (!char) {
    return NextResponse.json(
      { error: "Character not found in pool" },
      { status: 404 }
    );
  }

  const user = getUsers().find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isFoil = finish !== "normal";
  const card = addCard({
    userId,
    characterId: char.characterId,
    rarity: char.rarity,
    isFoil,
    finish,
    actorName: char.actorName,
    characterName: char.characterName,
    movieTitle: char.movieTitle,
    movieTmdbId: char.movieTmdbId,
    profilePath: char.profilePath,
    cardType: char.cardType ?? "actor",
  });

  return NextResponse.json(card, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const cardId = body.cardId as string | undefined;
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.actorName === "string") updates.actorName = body.actorName.trim();
  if (typeof body.characterName === "string") updates.characterName = body.characterName.trim();
  if (typeof body.movieTitle === "string") updates.movieTitle = body.movieTitle.trim();
  if (typeof body.profilePath === "string") updates.profilePath = body.profilePath.trim();
  if (typeof body.movieTmdbId === "number") updates.movieTmdbId = body.movieTmdbId;
  else if (body.movieTmdbId !== undefined) updates.movieTmdbId = parseInt(String(body.movieTmdbId), 10) || 0;
  if (["uncommon", "rare", "epic", "legendary"].includes(body.rarity)) updates.rarity = body.rarity;
  if (typeof body.isFoil === "boolean") updates.isFoil = body.isFoil;
  if (["normal", "holo", "prismatic", "darkMatter"].includes(body.finish)) {
    updates.finish = body.finish;
    updates.isFoil = body.finish !== "normal";
  }
  if (["actor", "director", "character", "scene"].includes(body.cardType)) updates.cardType = body.cardType;

  const updated = updateCard(cardId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("cardId");

  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  const ok = removeCard(cardId);
  if (!ok) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
