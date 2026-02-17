import { NextResponse } from "next/server";
import {
  getCardById,
  updateCard,
  deductStardust,
  addStardust,
  getStardust,
  getListings,
  getCardFinish,
  nextFinishTier,
  CARD_FINISH_LABELS,
} from "@/lib/data";
import type { CardFinish } from "@/lib/data";
import { getUpgradeCost, getUpgradeSuccessChance } from "@/lib/alchemy";

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

  const currentFinish = getCardFinish(card);
  const targetFinish = nextFinishTier(currentFinish);
  if (!targetFinish) {
    return NextResponse.json(
      { error: `Card is already at maximum tier (${CARD_FINISH_LABELS[currentFinish]})` },
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

  const cost = getUpgradeCost(card.rarity, targetFinish);
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

  const successChance = getUpgradeSuccessChance(targetFinish);
  const success = Math.random() < successChance;
  if (success) {
    const updates: { isFoil: boolean; finish: CardFinish } = {
      isFoil: targetFinish !== "normal",
      finish: targetFinish,
    };
    const updated = updateCard(cardId, updates);
    if (!updated) {
      addStardust(userId, cost);
      return NextResponse.json(
        { error: "Failed to upgrade card" },
        { status: 500 }
      );
    }
  }

  // Track quest progress: pack_a_punch (regardless of success/fail, you attempted it)
  const { recordQuestProgress } = await import("@/lib/quests");
  recordQuestProgress(userId, "pack_a_punch", { rarity: card.rarity as "uncommon" | "rare" | "epic" | "legendary" });

  const newBalance = getStardust(userId);
  return NextResponse.json({
    balance: newBalance,
    success,
    targetFinish,
    cost,
    successChance: Math.round(successChance * 100),
  });
}
