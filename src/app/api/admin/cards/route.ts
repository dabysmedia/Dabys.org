import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCards,
  getCharacterPool,
  addCard,
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
  const isFoil = !!body.isFoil;

  if (!userId || !characterId) {
    return NextResponse.json(
      { error: "userId and characterId required" },
      { status: 400 }
    );
  }

  const pool = getCharacterPool();
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

  const card = addCard({
    userId,
    characterId: char.characterId,
    rarity: char.rarity,
    isFoil,
    actorName: char.actorName,
    characterName: char.characterName,
    movieTitle: char.movieTitle,
    movieTmdbId: char.movieTmdbId,
    profilePath: char.profilePath,
  });

  return NextResponse.json(card, { status: 201 });
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
