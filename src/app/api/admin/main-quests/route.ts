import { NextResponse } from "next/server";
import { getMainQuestDefinitions, saveMainQuestDefinitions } from "@/lib/mainQuests";
import type { MainQuestDefinition } from "@/lib/mainQuests";

export async function GET() {
  const definitions = getMainQuestDefinitions();
  return NextResponse.json({ definitions });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const definitions = Array.isArray(body.definitions) ? body.definitions : [];

  const validated: MainQuestDefinition[] = definitions
    .filter((d: unknown) => d && typeof d === "object" && typeof (d as MainQuestDefinition).id === "string")
    .map((d: Record<string, unknown>) => ({
      id: String(d.id),
      type: String(d.type || "open_packs"),
      targetCount: Math.max(1, Math.floor(Number(d.targetCount) || 1)),
      reward: Math.max(0, Math.floor(Number(d.reward) || 0)),
      rewardType: d.rewardType === "stardust" ? "stardust" : "credits",
      label: String(d.label || ""),
      description: String(d.description || ""),
      rarity: ["uncommon", "rare", "epic", "legendary"].includes(String(d.rarity || "")) ? (d.rarity as "uncommon" | "rare" | "epic" | "legendary") : undefined,
      order: typeof d.order === "number" ? d.order : undefined,
    }));

  saveMainQuestDefinitions(validated);
  return NextResponse.json({ success: true, definitions: validated });
}
