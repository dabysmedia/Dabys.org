import { NextResponse } from "next/server";
import { claimQuestReward, claimAllQuestRewards } from "@/lib/quests";
import { addCredits, addStardust } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const questIndex = typeof body.questIndex === "number" ? body.questIndex : undefined;
  const claimAll = body.claimAll === true;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (claimAll) {
    const result = claimAllQuestRewards(userId);
    if (!result.success) {
      return NextResponse.json({ error: "No unclaimed completed quests" }, { status: 400 });
    }

    // Award the rewards
    if (result.rewardType === "stardust") {
      addStardust(userId, result.totalReward);
    } else {
      addCredits(userId, result.totalReward, "daily_quest_reward", { claimedCount: result.claimedCount });
    }

    // Award all-quests-complete bonus if applicable
    const bonus = result.allCompleteBonus ?? 0;
    if (bonus > 0) {
      addCredits(userId, bonus, "daily_quest_all_complete_bonus", {});
    }

    return NextResponse.json({
      success: true,
      totalReward: result.totalReward,
      rewardType: result.rewardType,
      claimedCount: result.claimedCount,
      allCompleteBonus: bonus > 0 ? bonus : undefined,
    });
  }

  if (questIndex === undefined) {
    return NextResponse.json({ error: "questIndex or claimAll required" }, { status: 400 });
  }

  const result = claimQuestReward(userId, questIndex);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Award the reward
  if (result.rewardType === "stardust") {
    addStardust(userId, result.reward!);
  } else {
    addCredits(userId, result.reward!, "daily_quest_reward", { questIndex });
  }

  // Award all-quests-complete bonus if applicable (e.g. this was the last quest)
  const bonus = result.allCompleteBonus ?? 0;
  if (bonus > 0) {
    addCredits(userId, bonus, "daily_quest_all_complete_bonus", {});
  }

  return NextResponse.json({
    success: true,
    reward: result.reward,
    rewardType: result.rewardType,
    allCompleteBonus: bonus > 0 ? bonus : undefined,
  });
}
