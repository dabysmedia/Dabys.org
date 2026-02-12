import { NextResponse } from "next/server";
import {
  getWheel,
  saveWheel,
  getProfile,
  saveProfile,
  getUsers,
  getWinners,
} from "@/lib/data";

/** POST /api/wheel/skip — Use someone's skip: charge their skip and clear wheel result */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = getProfile(userId);
  const winners = getWinners();
  const totalWins = winners.filter((w) => w.submittedBy === user.name).length;
  const skipsUsed = profile.skipsUsed || 0;
  const skipsAvailable = Math.max(0, totalWins - skipsUsed);
  if (skipsAvailable <= 0) {
    return NextResponse.json(
      { error: "This user has no skips available" },
      { status: 400 }
    );
  }

  profile.skipsUsed = skipsUsed + 1;
  saveProfile(profile);

  const wheel = getWheel();
  wheel.lastResult = null;
  wheel.lastSpunAt = null;
  wheel.winnerIndex = null;
  wheel.spinning = false;
  wheel.spinStartedAt = null;
  wheel.fullSpins = null;
  wheel.duration = null;
  wheel.lastConfirmedResult = null;
  wheel.lastConfirmedAt = null;
  saveWheel(wheel);

  return NextResponse.json({ success: true, wheel });
}
