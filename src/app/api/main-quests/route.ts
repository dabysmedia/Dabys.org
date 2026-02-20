import { NextResponse } from "next/server";
import { getMainQuestProgress } from "@/lib/mainQuests";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const progress = getMainQuestProgress(userId);
  return NextResponse.json({ progress });
}
