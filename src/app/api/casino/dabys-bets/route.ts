import { NextResponse } from "next/server";
import {
  getDabysBetsEvents,
  getDabysBetsEvent,
  deductCredits,
  addCredits,
  getCredits,
} from "@/lib/data";
import { resolveDabysBetWinner } from "@/lib/casino";

export async function GET() {
  const events = getDabysBetsEvents(true);
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const eventId = body.eventId as string | undefined;
  const side = body.side as string | undefined; // "A" or "B"
  const betRaw = typeof body.bet === "number" ? Math.floor(body.bet) : undefined;

  if (!userId || !eventId || !side || betRaw === undefined || betRaw < 1) {
    return NextResponse.json(
      { error: "userId, eventId, side (A or B), and bet required" },
      { status: 400 }
    );
  }

  if (side !== "A" && side !== "B") {
    return NextResponse.json(
      { error: "side must be 'A' or 'B'" },
      { status: 400 }
    );
  }

  const event = getDabysBetsEvent(eventId);
  if (!event) {
    return NextResponse.json(
      { error: "Event not found" },
      { status: 404 }
    );
  }

  if (!event.isActive) {
    return NextResponse.json(
      { error: "Event is not accepting bets" },
      { status: 400 }
    );
  }

  if (betRaw < event.minBet || betRaw > event.maxBet) {
    return NextResponse.json(
      { error: `Bet must be between ${event.minBet} and ${event.maxBet} credits` },
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

  const deducted = deductCredits(userId, betRaw, "casino_dabys_bets", {
    eventId,
    side,
    bet: betRaw,
  });
  if (!deducted) {
    return NextResponse.json(
      { error: "Failed to deduct credits" },
      { status: 400 }
    );
  }

  const winner = resolveDabysBetWinner(event.oddsA, event.oddsB);
  const userWon = winner === side;
  const odds = side === "A" ? event.oddsA : event.oddsB;
  const payout = userWon ? Math.floor(betRaw * odds) : 0;

  if (payout > 0) {
    addCredits(userId, payout, "casino_dabys_bets_win", {
      eventId,
      side,
      bet: betRaw,
      winner,
      payout,
    });
  }

  const newBalance = getCredits(userId);
  const netChange = payout - betRaw;

  return NextResponse.json({
    eventId,
    eventTitle: event.title,
    side,
    bet: betRaw,
    winner,
    userWon,
    payout,
    newBalance,
    netChange,
  });
}
