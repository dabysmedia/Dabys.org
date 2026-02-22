import { NextResponse } from "next/server";
import { deductCredits, addCredits, getCredits, getCasinoGameSettings } from "@/lib/data";
import {
  spinRoulette,
  getRoulettePayout,
  isRed,
} from "@/lib/casino";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const betRaw = typeof body.bet === "number" ? Math.floor(body.bet) : undefined;
  const selection = body.selection; // "red" | "black" | number 0-36

  const settings = getCasinoGameSettings();
  const { roulette } = settings;
  const { minBet, maxBet, betStep } = roulette;

  if (!userId || betRaw === undefined || betRaw < minBet || betRaw > maxBet || betRaw % betStep !== 0) {
    return NextResponse.json(
      { error: `Bet must be a multiple of ${betStep} between ${minBet} and ${maxBet} credits` },
      { status: 400 }
    );
  }

  let selectionParsed: "red" | "black" | number;
  if (selection === "red" || selection === "black") {
    selectionParsed = selection;
  } else if (typeof selection === "number" && selection >= 0 && selection <= 36) {
    selectionParsed = Math.floor(selection);
  } else {
    return NextResponse.json(
      { error: "selection must be 'red', 'black', or a number 0-36" },
      { status: 400 }
    );
  }

  const balance = getCredits(userId);
  if (balance < betRaw) {
    return NextResponse.json(
      { error: "Not enough credits" },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, betRaw, "casino_roulette", {
    bet: betRaw,
    selection: selectionParsed,
  });
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct credits" },
      { status: 400 }
    );
  }

  const { colorPayout, straightPayout } = roulette;
  const result = spinRoulette();
  const multiplier = getRoulettePayout(selectionParsed, result, colorPayout, straightPayout);
  const payout = multiplier > 0 ? betRaw * multiplier : 0;

  if (payout > 0) {
    addCredits(userId, payout, "casino_roulette_win", {
      bet: betRaw,
      selection: selectionParsed,
      result,
      payout,
    });
  }

  const newBalance = getCredits(userId);
  const netChange = payout - betRaw;

  return NextResponse.json({
    result,
    resultColor: result === 0 ? "green" : isRed(result) ? "red" : "black",
    selection: selectionParsed,
    payout,
    win: payout > 0,
    newBalance,
    netChange,
  });
}
