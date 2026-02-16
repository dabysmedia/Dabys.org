import { NextResponse } from "next/server";
import { getQuestSettings, saveQuestSettings } from "@/lib/quests";
import type { QuestSettings } from "@/lib/quests";

export async function GET() {
  const settings = getQuestSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const current = getQuestSettings();

  const settings: QuestSettings = {
    dailyQuestCount: typeof body.dailyQuestCount === "number" ? Math.max(1, Math.min(20, body.dailyQuestCount)) : current.dailyQuestCount,
    allQuestsCompleteBonus: typeof body.allQuestsCompleteBonus === "number" ? Math.max(0, body.allQuestsCompleteBonus) : current.allQuestsCompleteBonus,
    resetHourUTC: typeof body.resetHourUTC === "number" ? Math.max(0, Math.min(23, Math.floor(body.resetHourUTC))) : current.resetHourUTC,
    questDefinitions: body.questDefinitions ?? current.questDefinitions,
  };

  saveQuestSettings(settings);
  return NextResponse.json({ success: true, settings });
}
