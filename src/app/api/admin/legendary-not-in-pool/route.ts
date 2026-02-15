import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLegendaryCardsInInventory, getCharacterPool, getCardById, saveCharacterPool } from "@/lib/data";
import type { CharacterPortrayal } from "@/lib/data";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const cards = getLegendaryCardsInInventory();
  return NextResponse.json({ cards }, { headers: { "Cache-Control": "no-store" } });
}

/** Add this legendary card's character back to the character pool. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  let body: { cardId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { cardId } = body;
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  const card = getCardById(cardId);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (card.rarity !== "legendary") {
    return NextResponse.json({ error: "Only legendary cards can be returned to the pool" }, { status: 400 });
  }

  const pool = getCharacterPool();
  if (pool.some((c) => c.characterId === card.characterId)) {
    return NextResponse.json({ error: "Character already in pool" }, { status: 400 });
  }

  const entry: CharacterPortrayal = {
    characterId: card.characterId,
    actorName: card.actorName ?? "",
    characterName: card.characterName ?? "",
    profilePath: card.profilePath ?? "",
    movieTmdbId: card.movieTmdbId ?? 0,
    movieTitle: card.movieTitle ?? "",
    popularity: 0,
    rarity: "legendary",
    cardType: (card.cardType ?? "actor") as CharacterPortrayal["cardType"],
  };
  pool.push(entry);
  saveCharacterPool(pool);
  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
