import { NextResponse } from "next/server";
import { deductCredits, getCredits, getLotterySettings, createScratchOffClaim, getScratchOffTicketsToday, getScratchOffDailyLimit } from "@/lib/data";
import { pickScratchOffPanels, getScratchOffPayout } from "@/lib/casino";

/** POST: purchase scratch-off ticket(s). 12 panels, match 3+ of same symbol to win. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const count = typeof body.count === "number" ? Math.floor(body.count) : 1;

  if (!userId) {
    return NextResponse.json(
      { error: "userId required" },
      { status: 400 }
    );
  }

  if (count < 1 || count > 5) {
    return NextResponse.json(
      { error: "Count must be between 1 and 5" },
      { status: 400 }
    );
  }

  const { scratchOff } = getLotterySettings();
  const { cost, paytable, winChanceDenom } = scratchOff;
  const totalCost = count * cost;
  const balance = getCredits(userId);
  const ticketsToday = getScratchOffTicketsToday(userId);
  const limit = getScratchOffDailyLimit();

  if (ticketsToday >= limit) {
    return NextResponse.json(
      { error: "Daily scratch-off limit reached (20/day per person)" },
      { status: 400 }
    );
  }

  if (ticketsToday + count > limit) {
    return NextResponse.json(
      { error: `Can only buy ${limit - ticketsToday} more today (20/day per person)` },
      { status: 400 }
    );
  }

  if (balance < totalCost) {
    return NextResponse.json(
      { error: "Not enough credits" },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, totalCost, "scratch_off", { count });
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct credits" },
      { status: 400 }
    );
  }

  const tickets: { panels: string[]; payout: number; win: boolean; claimKey?: string }[] = [];

  for (let i = 0; i < count; i++) {
    const panels = pickScratchOffPanels(winChanceDenom ?? { JACKPOT: 200, DIAMOND: 100, GOLD: 50, STAR: 25, CLOVER: 15, LUCKY: 10 });
    const payout = getScratchOffPayout(panels, cost, paytable);
    let claimKey: string | undefined;
    if (payout > 0) {
      claimKey = createScratchOffClaim(userId, payout);
    }
    tickets.push({
      panels,
      payout,
      win: payout > 0,
      claimKey,
    });
  }

  return NextResponse.json({
    success: true,
    tickets,
    totalCost,
    newBalance: getCredits(userId),
  });
}
