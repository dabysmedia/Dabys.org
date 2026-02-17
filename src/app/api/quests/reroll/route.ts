import { NextResponse } from "next/server";
import { rerollQuest } from "@/lib/quests";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const questIndex = typeof body.questIndex === "number" ? body.questIndex : undefined;

  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (questIndex === undefined || questIndex < 0) {
    return NextResponse.json({ error: "questIndex required (0-based)" }, { status: 400 });
  }

  const result = rerollQuest(userId, questIndex);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Reroll failed" },
      { status: 400 }
    );
  }
  return NextResponse.json({
    success: true,
    quests: result.quests,
    rerollsRemaining: result.rerollsRemaining,
  });
}
