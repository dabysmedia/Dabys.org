import { NextResponse } from "next/server";
import {
  getCardById,
  updateCard,
  getListings,
  getCardFinish,
  deductPrisms,
  addPrisms,
  getPrisms,
  addStardust,
  getStardust,
  getAlchemySettings,
  CARD_FINISH_LABELS,
  getUsers,
  addEpicLegendaryTimelineEntry,
} from "@/lib/data";
import type { CardFinish } from "@/lib/data";
import { getPrismaticCraftChance } from "@/lib/alchemy";

export async function POST(request: Request) {
  let body: { userId?: string; cardId?: string; prismsToApply?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, cardId, prismsToApply } = body;
  if (!userId || !cardId || typeof prismsToApply !== "number") {
    return NextResponse.json(
      { error: "userId, cardId, and prismsToApply required" },
      { status: 400 }
    );
  }

  const settings = getAlchemySettings();

  if (prismsToApply < 1 || prismsToApply > settings.prismaticCraftMaxPrisms) {
    return NextResponse.json(
      { error: `Apply between 1 and ${settings.prismaticCraftMaxPrisms} prisms` },
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

  // Only legendary can be crafted to prismatic in the forge
  if (card.rarity !== "legendary") {
    return NextResponse.json(
      { error: "Only Legendary Holo cards can be crafted into Prismatic" },
      { status: 400 }
    );
  }

  const currentFinish = getCardFinish(card);
  if (currentFinish === "prismatic" || currentFinish === "darkMatter") {
    return NextResponse.json(
      { error: `Card is already ${CARD_FINISH_LABELS[currentFinish]}` },
      { status: 400 }
    );
  }

  const listings = getListings();
  if (listings.some((l) => l.cardId === cardId)) {
    return NextResponse.json(
      { error: "Cannot craft a card listed on the marketplace" },
      { status: 400 }
    );
  }

  // Check prism balance
  const prismBalance = getPrisms(userId);
  if (prismBalance < prismsToApply) {
    return NextResponse.json(
      { error: `Not enough Prisms. Need ${prismsToApply}, have ${prismBalance}.` },
      { status: 400 }
    );
  }

  // Deduct prisms
  const deducted = deductPrisms(userId, prismsToApply);
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct Prisms" },
      { status: 500 }
    );
  }

  // Roll for success
  const successChance = getPrismaticCraftChance(prismsToApply, settings);
  const success = Math.random() < (successChance / 100);

  if (success) {
    const updates: { isFoil: boolean; finish: CardFinish } = {
      isFoil: true,
      finish: "prismatic",
    };
    const updated = updateCard(cardId, updates);
    if (updated) {
      const users = getUsers();
      const userName = users.find((u) => u.id === userId)?.name || "Someone";
      addEpicLegendaryTimelineEntry({
        userId,
        userName,
        source: "prismatic_craft",
        rarity: "legendary",
        cardId,
        characterName: card.characterName,
        actorName: card.actorName,
        movieTitle: card.movieTitle,
      });
    }
    if (!updated) {
      addPrisms(userId, prismsToApply);
      return NextResponse.json(
        { error: "Failed to upgrade card" },
        { status: 500 }
      );
    }
  } else {
    // Failure: award stardust consolation
    const stardustReward = settings.prismaticCraftFailureStardust;
    if (stardustReward > 0) {
      addStardust(userId, stardustReward);
    }
  }

  const newPrismBalance = getPrisms(userId);
  const newStardustBalance = getStardust(userId);

  return NextResponse.json({
    success,
    successChance: Math.round(successChance),
    prismsUsed: prismsToApply,
    prismBalance: newPrismBalance,
    stardustBalance: newStardustBalance,
    stardustAwarded: success ? 0 : settings.prismaticCraftFailureStardust,
  });
}

