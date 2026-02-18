import { NextResponse } from "next/server";
import {
  getWinners,
  wipeUserInventory,
  clearCodexForUser,
  setPrismaticForgeUnlocked,
} from "@/lib/data";
import { getCompletedHoloWinnerIds } from "@/lib/cards";

/** Prestige Codex: requires 50% of sets completed in holo. Resets user TCG to fresh and unlocks Prismatic Forge. */
export async function POST(request: Request) {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const winners = getWinners().filter((w) => w.tmdbId);
  const totalSets = winners.length;
  if (totalSets === 0) {
    return NextResponse.json(
      { error: "No sets available" },
      { status: 400 }
    );
  }

  const completedHoloWinnerIds = getCompletedHoloWinnerIds(userId);
  const completedHoloSets = completedHoloWinnerIds.length;
  const halfSets = Math.ceil(totalSets * 0.5);
  if (completedHoloSets < halfSets) {
    return NextResponse.json(
      {
        error: `Prestige requires 50% of sets completed in holo finish. You have ${completedHoloSets}/${totalSets} (need ${halfSets}).`,
      },
      { status: 400 }
    );
  }

  wipeUserInventory(userId);
  clearCodexForUser(userId);
  setPrismaticForgeUnlocked(userId, true);

  return NextResponse.json({
    success: true,
    message: "Prestige complete. Your TCG account has been reset; Prismatic Forge is now unlocked.",
  });
}
