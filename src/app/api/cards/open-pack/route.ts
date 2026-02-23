import { NextResponse } from "next/server";
import { openPack, getCompletedWinnerIds } from "@/lib/cards";
import { getPacks, getUsers, getWinners, addActivity, addGlobalNotification, addEpicLegendaryTimelineEntry, notifyAcquirerIfTracked } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";
import { incrementUserLifetimeStat } from "@/lib/mainQuests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const unopenedPackId = typeof body.unopenedPackId === "string" ? body.unopenedPackId : undefined;
  if (!unopenedPackId) {
    return NextResponse.json({ error: "unopenedPackId is required" }, { status: 400 });
  }

  const completedBefore = new Set(getCompletedWinnerIds(body.userId));

  const result = openPack(body.userId, unopenedPackId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to open pack" },
      { status: 400 }
    );
  }

  recordQuestProgress(body.userId, "open_pack", { packIsFree: true });
  incrementUserLifetimeStat(body.userId, "packsOpened");

  if (result.cards) {
    for (const card of result.cards) {
      recordQuestProgress(body.userId, "find_rarity_in_pack", { rarity: card.rarity });
    }
  }

  const users = getUsers();
  const userName = users.find((u) => u.id === body.userId)?.name || "Someone";

  if (result.cards) {
    for (const card of result.cards) {
      if (card.characterId) {
        const displayName = card.characterName || card.actorName || "this card";
        notifyAcquirerIfTracked(body.userId, card.characterId, displayName);
      }
      if (card.rarity === "epic" || card.rarity === "legendary") {
        addEpicLegendaryTimelineEntry({
          userId: body.userId,
          userName,
          source: "pull",
          rarity: card.rarity as "epic" | "legendary",
          cardId: card.id,
          characterName: card.characterName,
          actorName: card.actorName,
          movieTitle: card.movieTitle,
        });
      }
    }
    for (const card of result.cards) {
      if (card.rarity === "legendary") {
        addActivity({
          type: "legendary_pull",
          userId: body.userId,
          userName,
          message: `pulled a Legendary — ${card.characterName || card.actorName}`,
          meta: { cardId: card.id, characterName: card.characterName, actorName: card.actorName, movieTitle: card.movieTitle },
        });
        addGlobalNotification({
          type: "legendary_pull",
          message: `pulled a Legendary — ${card.characterName || card.actorName}`,
          actorUserId: body.userId,
          actorName: userName,
          meta: { cardId: card.id, characterName: card.characterName, movieTitle: card.movieTitle },
        });
      }
    }

    const completedAfter = getCompletedWinnerIds(body.userId);
    const winners = getWinners();
    for (const winnerId of completedAfter) {
      if (!completedBefore.has(winnerId)) {
        const winner = winners.find((w) => w.id === winnerId);
        addActivity({
          type: "set_complete",
          userId: body.userId,
          userName,
          message: `completed the ${winner?.movieTitle || "a movie"} set!`,
          meta: { winnerId, movieTitle: winner?.movieTitle },
        });
        addGlobalNotification({
          type: "set_complete",
          message: `completed the ${winner?.movieTitle || "a movie"} set!`,
          actorUserId: body.userId,
          actorName: userName,
          meta: { winnerId, movieTitle: winner?.movieTitle },
        });
      }
    }
  }

  return NextResponse.json({ cards: result.cards });
}
