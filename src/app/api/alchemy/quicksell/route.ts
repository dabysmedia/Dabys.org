import { NextResponse } from "next/server";
import {
  getCardById,
  removeCard,
  addCredits,
  getCredits,
  getListings,
} from "@/lib/data";
import { getQuicksellCredits } from "@/lib/alchemy";

export async function POST(request: Request) {
  let body: { userId?: string; cardIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, cardIds } = body;
  if (!userId || !Array.isArray(cardIds) || cardIds.length === 0) {
    return NextResponse.json(
      { error: "userId and non-empty cardIds array required" },
      { status: 400 }
    );
  }

  const listings = getListings();
  let totalCredits = 0;
  const toRemove: string[] = [];

  for (const cardId of cardIds) {
    const card = getCardById(cardId);
    if (!card) {
      return NextResponse.json({ error: `Card not found: ${cardId}` }, { status: 404 });
    }
    if (card.userId !== userId) {
      return NextResponse.json({ error: "Not your card" }, { status: 403 });
    }
    if (listings.some((l) => l.cardId === cardId)) {
      return NextResponse.json(
        { error: "Cannot quicksell a card listed on the marketplace" },
        { status: 400 }
      );
    }
    if (card.rarity === "legendary") {
      return NextResponse.json(
        { error: "Legendary cards cannot be quicksold" },
        { status: 400 }
      );
    }
    const cr = getQuicksellCredits(card.rarity);
    if (cr <= 0) {
      return NextResponse.json(
        { error: `Invalid rarity for quicksell: ${card.rarity}` },
        { status: 400 }
      );
    }
    totalCredits += cr;
    toRemove.push(cardId);
  }

  for (const cardId of toRemove) {
    removeCard(cardId);
  }
  addCredits(userId, totalCredits, "quicksell", { cardIds: toRemove });
  const balance = getCredits(userId);

  return NextResponse.json({ balance, creditsReceived: totalCredits });
}
