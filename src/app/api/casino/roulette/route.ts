import { NextResponse } from "next/server";
import { deductCredits, addCredits, getCredits } from "@/lib/data";
import {
  spinRoulette,
  getRoulettePayout,
  isRed,
} from "@/lib/casino";

const MIN_BET = 5;
const MAX_BET = 500;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const betRaw = typeof body.bet === "number" ? Math.floor(body.bet) : undefined;
  const selection = body.selection; // "red" | "black" | number 0-36

  if (!userId || betRaw === undefined || betRaw < MIN_BET || betRaw > MAX_BET || betRaw % 5 !== 0) {
    return NextResponse.json(
      { error: `Bet must be a multiple of 5 between ${MIN_BET} and ${MAX_BET} credits` },
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

  const result = spinRoulette();
  const multiplier = getRoulettePayout(selectionParsed, result);
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
