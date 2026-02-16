import { NextResponse } from "next/server";
import { getUserDailyQuests } from "@/lib/quests";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();

  if (!userId || userId.length === 0) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Quests are stored per-user; this returns only this user's daily quests
  const dailyQuests = getUserDailyQuests(userId);
  return NextResponse.json(dailyQuests);
}
