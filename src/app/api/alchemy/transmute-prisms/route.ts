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
  let body: { userId?: string; cardIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, cardIds } = body;
  if (!userId || !Array.isArray(cardIds) || cardIds.length === 0) {
    return NextResponse.json(
      { error: "userId and cardIds[] required" },
      { status: 400 }
    );
  }

  const settings = getAlchemySettings();
  const requiredCount = settings.prismTransmuteEpicHoloCount;

  if (cardIds.length !== requiredCount) {
    return NextResponse.json(
      { error: `Exactly ${requiredCount} Epic Holo cards required` },
      { status: 400 }
    );
  }

  const uniqueIds = [...new Set(cardIds)];
  if (uniqueIds.length !== requiredCount) {
    return NextResponse.json(
      { error: `Select ${requiredCount} different cards` },
      { status: 400 }
    );
  }

  const listedCardIds = new Set(getListings().map((l) => l.cardId));
  const cards: ReturnType<typeof getCardById>[] = [];

  for (const id of uniqueIds) {
    const card = getCardById(id);
    if (!card || card.userId !== userId) {
      return NextResponse.json(
        { error: "You don't own one or more of these cards" },
        { status: 403 }
      );
    }
    if (listedCardIds.has(id)) {
      return NextResponse.json(
        { error: "Cannot transmute cards listed on the marketplace" },
        { status: 400 }
      );
    }
    const finish = getCardFinish(card!);
    if (finish !== "holo") {
      return NextResponse.json(
        { error: "All cards must be Holo finish" },
        { status: 400 }
      );
    }
    if (card.rarity !== "epic" && card.rarity !== "legendary") {
      return NextResponse.json(
        { error: "All cards must be Epic or Legendary rarity" },
        { status: 400 }
      );
    }
    cards.push(card);
  }

  // Destroy the cards
  for (const card of cards) {
    if (card) removeCard(card.id);
  }

  // Roll for prism
  const successChance = settings.prismTransmuteSuccessChance / 100;
  const success = Math.random() < successChance;
  let prismsAwarded = 0;

  if (success) {
    prismsAwarded = settings.prismsPerTransmute;
    addPrisms(userId, prismsAwarded);
  }

  const prismBalance = getPrisms(userId);

  return NextResponse.json({
    success,
    prismsAwarded,
    prismBalance,
    cardsDestroyed: cards.length,
    successChance: Math.round(successChance * 100),
  });
}
