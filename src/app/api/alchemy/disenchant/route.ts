import { NextResponse } from "next/server";
import {
  getCardById,
  updateCard,
  addStardust,
  getStardust,
  getListings,
  getCardFinish,
  CARD_FINISH_LABELS,
} from "@/lib/data";
import { getDisenchantDust } from "@/lib/alchemy";

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

  const finish = getCardFinish(card);
  if (finish === "normal") {
    return NextResponse.json(
      { error: "Only enhanced cards (Holo, Prismatic, Dark Matter) can be disenchanted" },
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

  const amount = getDisenchantDust(card.rarity, finish);
  if (amount <= 0) {
    return NextResponse.json(
      { error: "Invalid rarity for disenchant" },
      { status: 400 }
    );
  }

  const cardRarity = card.rarity;
  const previousFinish = finish;
  const updated = updateCard(cardId, { isFoil: false, finish: "normal" });
  if (!updated) {
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
  addStardust(userId, amount);
  const balance = getStardust(userId);

  // Track quest progress: disenchant_holo
  const { recordQuestProgress } = await import("@/lib/quests");
  recordQuestProgress(userId, "disenchant_holo", { rarity: cardRarity as "uncommon" | "rare" | "epic" | "legendary" });

  return NextResponse.json({
    balance,
    dustReceived: amount,
    card: updated,
    previousFinish,
    previousFinishLabel: CARD_FINISH_LABELS[previousFinish],
  });
}
