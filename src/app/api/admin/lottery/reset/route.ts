import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentDrawId, clearLotteryTicketsForDraw } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST: Clear all tickets for the current draw. Resets prize pool to starting pool. */
export async function POST() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const drawId = getCurrentDrawId();
  const removed = clearLotteryTicketsForDraw(drawId);

  return NextResponse.json({
    success: true,
    drawId,
    removed,
    message: `Cleared ${removed} ticket${removed === 1 ? "" : "s"} for draw ${drawId}`,
  });
}
