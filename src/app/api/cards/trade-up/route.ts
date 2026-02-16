import { NextResponse } from "next/server";
import { tradeUp } from "@/lib/cards";
import { getCardById, getUsers, addActivity } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";
import type { Rarity } from "@/lib/quests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Array.isArray(body.cardIds)) {
    return NextResponse.json({ error: "cardIds must be an array of 4 card IDs" }, { status: 400 });
  }

  // Capture the input rarity before trade-up consumes the cards
  let inputRarity: Rarity | undefined;
  if (body.cardIds.length > 0) {
    const firstCard = getCardById(body.cardIds[0]);
    if (firstCard) inputRarity = firstCard.rarity as Rarity;
  }

  const result = tradeUp(body.userId, body.cardIds);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Trade up failed" },
      { status: 400 }
    );
  }

  // Track quest progress: trade_up with the input rarity
  recordQuestProgress(body.userId, "trade_up", { rarity: inputRarity });

  // Log legendary pulls from trade-up
  if (result.card && result.card.rarity === "legendary") {
    const users = getUsers();
    const userName = users.find((u) => u.id === body.userId)?.name || "Someone";
    addActivity({
      type: "legendary_pull",
      userId: body.userId,
      userName,
      message: `forged a Legendary via trade-up — ${result.card.characterName || result.card.actorName}`,
      meta: { cardId: result.card.id, characterName: result.card.characterName, actorName: result.card.actorName, movieTitle: result.card.movieTitle },
    });
  }

  return NextResponse.json(
    result.credits != null ? { credits: result.credits } : { card: result.card }
  );
}
