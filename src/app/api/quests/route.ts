import { NextResponse } from "next/server";
import { getUserDailyQuests, getQuestSettings, getWeeklySubmitVoteQuests } from "@/lib/quests";
import { getSetCompletionQuests, getCommunitySetCompletionQuests, getCommunitySetById } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();

  if (!userId || userId.length === 0) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const dailyQuests = getUserDailyQuests(userId);
  const weeklyQuests = getWeeklySubmitVoteQuests(userId);
  const setCompletionQuests = getSetCompletionQuests(userId);
  const rawCommunityQuests = getCommunitySetCompletionQuests(userId);
  const communitySetCompletionQuests = rawCommunityQuests.map((q) => {
    const set = getCommunitySetById(q.communitySetId);
    return { ...q, setName: set?.name ?? "Community Set" };
  });
  const { resetHourUTC } = getQuestSettings();
  return NextResponse.json({
    ...dailyQuests,
    weeklyQuests,
    setCompletionQuests,
    communitySetCompletionQuests,
    resetHourUTC,
  });
}
