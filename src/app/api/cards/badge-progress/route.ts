import { NextResponse } from "next/server";
import { getCompletedWinnerIds, getCompletedHoloWinnerIds } from "@/lib/cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const completedWinnerIds = getCompletedWinnerIds(userId);
  const completedHoloWinnerIds = getCompletedHoloWinnerIds(userId);
  return NextResponse.json({ completedWinnerIds, completedHoloWinnerIds });
}
