import { NextResponse } from "next/server";
import {
  getCardById,
  removeCard,
  addStardust,
  getStardust,
  getListings,
} from "@/lib/data";
import { DISENCHANT_DUST } from "@/lib/alchemy";

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
  if (!card.isFoil) {
    return NextResponse.json(
      { error: "Only Holo cards can be disenchanted" },
      { status: 400 }
    );
  }

  const listings = getListings();
  const isListed = listings.some((l) => l.cardId === cardId);
  if (isListed) {
    return NextResponse.json(
      { error: "Cannot disenchant a card listed on the marketplace" },
      { status: 400 }
    );
  }

  const amount = DISENCHANT_DUST[card.rarity] ?? 0;
  if (amount <= 0) {
    return NextResponse.json(
      { error: "Invalid rarity for disenchant" },
      { status: 400 }
    );
  }

  removeCard(cardId);
  addStardust(userId, amount);
  const balance = getStardust(userId);

  return NextResponse.json({ balance, dustReceived: amount });
}
