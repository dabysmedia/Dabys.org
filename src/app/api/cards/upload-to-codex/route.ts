import { NextResponse } from "next/server";
import { getCardById, removeCard, addCodexUnlock, getListings, getCodexUnlockedCharacterIds } from "@/lib/data";

/** Upload a card to the codex: removes it from your collection and unlocks that character in the codex. Legendaries (1-of-1) re-enter the pool. */
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

  const characterId = card.characterId;
  if (!characterId) {
    return NextResponse.json({ error: "Card has no character" }, { status: 400 });
  }

  const alreadyInCodex = getCodexUnlockedCharacterIds(userId).includes(characterId);
  if (alreadyInCodex) {
    return NextResponse.json(
      { error: "This character is already in your codex" },
      { status: 400 }
    );
  }

  removeCard(cardId);
  addCodexUnlock(userId, characterId);

  return NextResponse.json({ ok: true, characterId });
}
