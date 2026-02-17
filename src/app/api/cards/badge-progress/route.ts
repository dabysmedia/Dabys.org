import { NextResponse } from "next/server";
import {
  getCompletedWinnerIds,
  getCompletedHoloWinnerIds,
  getCompletedPrismaticWinnerIds,
  getCompletedDarkMatterWinnerIds,
} from "@/lib/cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const completedWinnerIds = getCompletedWinnerIds(userId);
  const completedHoloWinnerIds = getCompletedHoloWinnerIds(userId);
  const completedPrismaticWinnerIds = getCompletedPrismaticWinnerIds(userId);
  const completedDarkMatterWinnerIds = getCompletedDarkMatterWinnerIds(userId);
  return NextResponse.json({
    completedWinnerIds,
    completedHoloWinnerIds,
    completedPrismaticWinnerIds,
    completedDarkMatterWinnerIds,
  });
}
