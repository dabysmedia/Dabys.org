import { NextResponse } from "next/server";
import { getMainQuestProgress, claimMainQuest } from "@/lib/mainQuests";
import { addCredits, addStardust } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const questId = typeof body.questId === "string" ? body.questId.trim() : "";

  if (!userId || !questId) {
    return NextResponse.json({ error: "userId and questId required" }, { status: 400 });
  }

  const progress = getMainQuestProgress(userId);
  const item = progress.find((p) => p.definition.id === questId);
  if (!item) {
    return NextResponse.json({ error: "Quest not found" }, { status: 404 });
  }
  if (!item.completed) {
    return NextResponse.json({ error: "Quest not yet completed" }, { status: 400 });
  }
  if (item.claimed) {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 });
  }

  const claimed = claimMainQuest(userId, questId);
  if (!claimed) {
    return NextResponse.json({ error: "Failed to claim" }, { status: 500 });
  }

  const { reward, rewardType } = item.definition;
  if (rewardType === "stardust") {
    addStardust(userId, reward);
  } else {
    addCredits(userId, reward, "main_quest", { questId });
  }

  return NextResponse.json({
    success: true,
    reward,
    rewardType,
  });
}
