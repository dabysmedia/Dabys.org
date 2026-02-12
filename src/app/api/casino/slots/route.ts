import { NextResponse } from "next/server";
import { deductCredits, addCredits, getCredits } from "@/lib/data";
import {
  pickSlotSymbols,
  getSlotsPayout,
  type SlotSymbol,
} from "@/lib/casino";

const MIN_BET = 5;
const MAX_BET = 100;
const VALID_BETS = [5, 10, 25, 50, 100];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const bet = typeof body.bet === "number" ? Math.floor(body.bet) : undefined;

  if (!userId || bet === undefined || bet < MIN_BET || bet > MAX_BET) {
    return NextResponse.json(
      { error: `Bet must be between ${MIN_BET} and ${MAX_BET} credits` },
      { status: 400 }
    );
  }

  if (!VALID_BETS.includes(bet)) {
    return NextResponse.json(
      { error: `Bet must be one of: ${VALID_BETS.join(", ")}` },
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

  const symbols = pickSlotSymbols();
  const payout = getSlotsPayout(symbols, bet);

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
