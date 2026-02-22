import { NextResponse } from "next/server";
import { claimScratchOffWin, getCredits } from "@/lib/data";

/** POST: claim scratch-off win (credits added when user reveals the win). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const claimKey = body.claimKey as string | undefined;

  if (!userId || !claimKey) {
    return NextResponse.json(
      { error: "userId and claimKey required" },
      { status: 400 }
    );
  }

  const payout = claimScratchOffWin(claimKey);
  if (payout === null) {
    return NextResponse.json(
      { error: "Invalid or already claimed" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    payout,
    netChange: payout,
    newBalance: getCredits(userId),
  });
}
