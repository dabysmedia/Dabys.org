import { NextResponse } from "next/server";
import {
  getCardById,
  removeCard,
  getListings,
  getCardFinish,
  addPrisms,
  getPrisms,
  getAlchemySettings,
} from "@/lib/data";

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
  if (card.rarity !== "epic") {
    return NextResponse.json(
      { error: "Only Epic Holo cards can be disenchanted for prisms in the forge" },
      { status: 400 }
    );
  }
  const finish = getCardFinish(card);
  if (finish !== "holo") {
    return NextResponse.json(
      { error: "Card must be Holo to disenchant for prisms" },
      { status: 400 }
    );
  }
  const listings = getListings();
  if (listings.some((l) => l.cardId === cardId)) {
    return NextResponse.json(
      { error: "Cannot disenchant a card listed on the marketplace" },
      { status: 400 }
    );
  }

  const settings = getAlchemySettings();
  const prismsAwarded = settings.epicHoloForgePrisms ?? 1;

  removeCard(cardId);
  if (prismsAwarded > 0) {
    addPrisms(userId, prismsAwarded);
  }

  const prismBalance = getPrisms(userId);
  return NextResponse.json({
    prismsAwarded,
    prismBalance,
  });
}
