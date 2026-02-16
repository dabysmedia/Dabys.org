import { NextResponse } from "next/server";
import { recordQuestProgress } from "@/lib/quests";
import type { QuestType, Rarity } from "@/lib/quests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const questType = body.questType as QuestType | undefined;
  const rarity = body.rarity as Rarity | undefined;
  const packIsFree = body.packIsFree === true;

  if (!userId || !questType) {
    return NextResponse.json({ error: "userId and questType required" }, { status: 400 });
  }

  const result = recordQuestProgress(userId, questType, { rarity, packIsFree });
  return NextResponse.json(result);
}
