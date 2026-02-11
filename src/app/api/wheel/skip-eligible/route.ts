import { NextResponse } from "next/server";
import { getUsers, getWinners, getProfile } from "@/lib/data";

/** GET /api/wheel/skip-eligible — Users with at least one skip available (for "whose skip" picker) */
export async function GET() {
  const users = getUsers();
  const winners = getWinners();
  const list: { id: string; name: string; skipsAvailable: number }[] = [];
  for (const user of users) {
    const totalWins = winners.filter((w) => w.submittedBy === user.name).length;
    const profile = getProfile(user.id);
    const skipsUsed = profile.skipsUsed || 0;
    const skipsAvailable = Math.max(0, totalWins - skipsUsed);
    if (skipsAvailable > 0) {
      list.push({ id: user.id, name: user.name, skipsAvailable });
    }
  }
  return NextResponse.json(list);
}
