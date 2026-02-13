import { NextResponse } from "next/server";
import {
  getCardById,
  updateCard,
  deductStardust,
  addStardust,
  getStardust,
  getListings,
} from "@/lib/data";
import { getPackAPunchCost } from "@/lib/alchemy";

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
  if (card.isFoil) {
    return NextResponse.json(
      { error: "Card is already a Holo" },
      { status: 400 }
    );
  }

  const listings = getListings();
  const isListed = listings.some((l) => l.cardId === cardId);
  if (isListed) {
    return NextResponse.json(
      { error: "Cannot Pack-A-Punch a card listed on the marketplace" },
      { status: 400 }
    );
  }

  const cost = getPackAPunchCost(card.rarity);
  const balance = getStardust(userId);
  if (balance < cost) {
    return NextResponse.json(
      {
        error: `Insufficient Stardust. Need ${cost}, have ${balance}.`,
      },
      { status: 400 }
    );
  }

  const deducted = deductStardust(userId, cost);
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct Stardust" },
      { status: 500 }
    );
  }

  const success = Math.random() < 0.5;
  if (success) {
    const updated = updateCard(cardId, { isFoil: true });
    if (!updated) {
      addStardust(userId, cost);
      return NextResponse.json(
        { error: "Failed to upgrade card" },
        { status: 500 }
      );
    }
  }

  const newBalance = getStardust(userId);
  return NextResponse.json({ balance: newBalance, success });
}
