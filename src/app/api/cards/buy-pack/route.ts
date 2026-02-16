import { NextResponse } from "next/server";
import { buyPack } from "@/lib/cards";
import { getPacks } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId : undefined;
  if (!packId) {
    return NextResponse.json({ error: "packId is required" }, { status: 400 });
  }

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

  // Track quest progress: find_rarity_in_pack (check each card's rarity)
  if (result.cards) {
    for (const card of result.cards) {
      recordQuestProgress(body.userId, "find_rarity_in_pack", { rarity: card.rarity });
    }
  }

  return NextResponse.json({ cards: result.cards });
}
