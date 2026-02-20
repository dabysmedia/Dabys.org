import { NextResponse } from "next/server";
import { buyPack, getCompletedWinnerIds } from "@/lib/cards";
import { getPacks, getUsers, getWinners, addActivity, addGlobalNotification } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";
import { incrementUserLifetimeStat } from "@/lib/mainQuests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId : undefined;
  if (!packId) {
    return NextResponse.json({ error: "packId is required" }, { status: 400 });
  }

  // Snapshot completed sets BEFORE opening the pack
  const completedBefore = new Set(getCompletedWinnerIds(body.userId));

  const result = buyPack(body.userId, packId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to buy pack" },
      { status: 400 }
    );
  }

  // Track quest progress: open_pack (skip free packs)
  const allPacks = getPacks();
  const pack = allPacks.find((p) => p.id === packId);
  const isFree = !!pack?.isFree;
  recordQuestProgress(body.userId, "open_pack", { packIsFree: isFree });
  if (!isFree) incrementUserLifetimeStat(body.userId, "packsOpened");

  // Track quest progress: find_rarity_in_pack (check each card's rarity)
  if (result.cards) {
    for (const card of result.cards) {
      recordQuestProgress(body.userId, "find_rarity_in_pack", { rarity: card.rarity });
    }
  }

  // --- Activity logging ---
  const users = getUsers();
  const userName = users.find((u) => u.id === body.userId)?.name || "Someone";

  if (result.cards) {
    // Log legendary pulls
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

    // Check for newly completed sets
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
