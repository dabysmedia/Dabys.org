import { NextResponse } from "next/server";
import { legendaryReroll } from "@/lib/cards";
import { getUsers, addActivity, addGlobalNotification } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Array.isArray(body.cardIds) || body.cardIds.length !== 2) {
    return NextResponse.json({ error: "cardIds must be an array of 2 legendary card IDs" }, { status: 400 });
  }

  const result = legendaryReroll(body.userId, body.cardIds);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Legendary reroll failed" },
      { status: 400 }
    );
  }

  recordQuestProgress(body.userId, "trade_up", { rarity: "legendary" });
  const { incrementUserLifetimeStat } = await import("@/lib/mainQuests");
  incrementUserLifetimeStat(body.userId, "tradeUpsByRarity", 1, "legendary");

  if (result.card) {
    const users = getUsers();
    const userName = users.find((u) => u.id === body.userId)?.name || "Someone";
    addActivity({
      type: "legendary_pull",
      userId: body.userId,
      userName,
      message: `rerolled a Legendary — ${result.card.characterName || result.card.actorName}`,
      meta: { cardId: result.card.id, characterName: result.card.characterName, actorName: result.card.actorName, movieTitle: result.card.movieTitle },
    });
    addGlobalNotification({
      type: "legendary_pull",
      message: `rerolled a Legendary — ${result.card.characterName || result.card.actorName}`,
      actorUserId: body.userId,
      actorName: userName,
      meta: { cardId: result.card.id, characterName: result.card.characterName, movieTitle: result.card.movieTitle },
    });
  }

  return NextResponse.json({ card: result.card });
}
