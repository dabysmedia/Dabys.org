import { NextResponse } from "next/server";
import { deductCredits, addCredits, getCredits, getCasinoGameSettings } from "@/lib/data";
import {
  pickSlotSymbols,
  getSlotsPayout,
  type SlotSymbol,
} from "@/lib/casino";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const bet = typeof body.bet === "number" ? Math.floor(body.bet) : undefined;

  const settings = getCasinoGameSettings();
  const { slots } = settings;
  const { minBet, maxBet, validBets } = slots;

  if (!userId || bet === undefined || bet < minBet || bet > maxBet) {
    return NextResponse.json(
      { error: `Bet must be between ${minBet} and ${maxBet} credits` },
      { status: 400 }
    );
  }

  if (!validBets.includes(bet)) {
    return NextResponse.json(
      { error: `Bet must be one of: ${validBets.join(", ")}` },
      { status: 400 }
    );
  }

  const balance = getCredits(userId);
  if (balance < bet) {
    return NextResponse.json(
      { error: "Not enough credits" },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, bet, "casino_slots", { bet });
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct credits" },
      { status: 400 }
    );
  }

  const { paytable, paytable2oak } = slots;
  const symbols = pickSlotSymbols();
  const payout = getSlotsPayout(symbols, bet, paytable, paytable2oak);

  if (payout > 0) {
    addCredits(userId, payout, "casino_slots_win", {
      bet,
      symbols: [...symbols],
      payout,
    });
  }

  const newBalance = getCredits(userId);
  const netChange = payout - bet;

  return NextResponse.json({
    symbols: symbols as string[],
    payout,
    bet,
    win: payout > 0,
    newBalance,
    netChange,
  });
}
