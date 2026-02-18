import { NextResponse } from "next/server";
import {
  deductCredits,
  addCredits,
  getCredits,
  getBlackjackSession,
  saveBlackjackSession,
  removeBlackjackSession,
  type BlackjackSession,
  type BlackjackCard,
} from "@/lib/data";
import {
  createDeck,
  handValue,
  type Card,
} from "@/lib/casino";

const MIN_BET = 2;
const MAX_BET = 500;

function toDataCard(c: Card): BlackjackCard {
  return { suit: c.suit, rank: c.rank };
}

function fromDataCard(c: BlackjackCard): Card {
  return { suit: c.suit as Card["suit"], rank: c.rank as Card["rank"] };
}

function draw(deck: BlackjackCard[]): { card: BlackjackCard; rest: BlackjackCard[] } {
  const [card, ...rest] = deck;
  if (!card) throw new Error("Deck empty");
  return { card, rest };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const userId = body.userId as string | undefined;
  const action = body.action as string | undefined; // "deal" | "hit" | "stand"
  const betRaw = typeof body.bet === "number" ? Math.floor(body.bet) : undefined;

  if (!userId || !action) {
    return NextResponse.json(
      { error: "userId and action required" },
      { status: 400 }
    );
  }

  if (action === "deal") {
    if (betRaw === undefined || betRaw < MIN_BET || betRaw > MAX_BET || betRaw % 2 !== 0) {
      return NextResponse.json(
        { error: `Bet must be an even number between ${MIN_BET} and ${MAX_BET}` },
        { status: 400 }
      );
    }
    const existing = getBlackjackSession(userId);
    if (existing) {
      return NextResponse.json(
        { error: "You have an active hand. Hit or Stand first." },
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
    const deducted = deductCredits(userId, betRaw, "casino_blackjack", { bet: betRaw });
    if (!deducted) {
      return NextResponse.json(
        { error: "Failed to deduct credits" },
        { status: 400 }
      );
    }
    const deck = createDeck().map(toDataCard);
    const d1 = draw(deck);
    const d2 = draw(d1.rest);
    const d3 = draw(d2.rest);
    const d4 = draw(d3.rest);
    const session: BlackjackSession = {
      userId,
      deck: d4.rest,
      playerHand: [d1.card, d3.card],
      dealerHand: [d2.card, d4.card],
      bet: betRaw,
      status: "player_turn",
      createdAt: new Date().toISOString(),
    };
    saveBlackjackSession(session);

    const playerVal = handValue(session.playerHand.map(fromDataCard));
    const dealerShow = session.dealerHand[0];
    const dealerVal = handValue([fromDataCard(dealerShow)]);

    // Check for immediate blackjack
    if (playerVal === 21) {
      session.status = "dealer_turn";
      const dealerValFull = handValue(session.dealerHand.map(fromDataCard));
      if (dealerValFull === 21) {
        session.status = "resolved";
        session.result = "push";
        session.payout = 0;
        addCredits(userId, betRaw, "casino_blackjack_win", { bet: betRaw, result: "push" });
        removeBlackjackSession(userId);
        return NextResponse.json({
          action: "deal",
          session: null,
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          playerValue: 21,
          dealerValue: 21,
          result: "push",
          payout: 0,
          newBalance: getCredits(userId),
          netChange: 0,
        });
      }
      session.status = "resolved";
      session.result = "win";
      session.payout = Math.floor(betRaw * 2.5); // Blackjack pays 3:2 -> 2.5x
      addCredits(userId, session.payout, "casino_blackjack_win", {
        bet: betRaw,
        result: "win",
        payout: session.payout,
      });
      removeBlackjackSession(userId);
      return NextResponse.json({
        action: "deal",
        session: null,
        playerHand: session.playerHand,
        dealerHand: session.dealerHand,
        playerValue: 21,
        dealerValue: dealerValFull,
        result: "win",
        payout: session.payout,
        newBalance: getCredits(userId),
        netChange: session.payout - betRaw,
      });
    }

    return NextResponse.json({
      action: "deal",
      session: { status: session.status, bet: session.bet },
      playerHand: session.playerHand,
      dealerHand: [dealerShow, { suit: "?", rank: "?" }],
      playerValue: playerVal,
      dealerValue: dealerVal,
      result: null,
      newBalance: getCredits(userId),
    });
  }

  if (action === "hit" || action === "stand") {
    const session = getBlackjackSession(userId);
    if (!session || session.status !== "player_turn") {
      return NextResponse.json(
        { error: "No active hand. Deal first." },
        { status: 400 }
      );
    }

    if (action === "hit") {
      const { card, rest } = draw(session.deck);
      session.deck = rest;
      session.playerHand.push(card);
      const playerVal = handValue(session.playerHand.map(fromDataCard));
      if (playerVal > 21) {
        session.status = "resolved";
        session.result = "loss";
        session.payout = 0;
        removeBlackjackSession(userId);
        return NextResponse.json({
          action: "hit",
          session: null,
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          playerValue: playerVal,
          dealerValue: handValue(session.dealerHand.map(fromDataCard)),
          result: "loss",
          payout: 0,
          newBalance: getCredits(userId),
          netChange: -session.bet,
        });
      }
      saveBlackjackSession(session);
      return NextResponse.json({
        action: "hit",
        session: { status: session.status, bet: session.bet },
        playerHand: session.playerHand,
        dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
        playerValue: playerVal,
        dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
        result: null,
        newBalance: getCredits(userId),
      });
    }

    // stand
    session.status = "dealer_turn";
    let dealerVal = handValue(session.dealerHand.map(fromDataCard));
    while (dealerVal < 17) {
      const { card, rest } = draw(session.deck);
      session.deck = rest;
      session.dealerHand.push(card);
      dealerVal = handValue(session.dealerHand.map(fromDataCard));
    }
    const playerVal = handValue(session.playerHand.map(fromDataCard));

    session.status = "resolved";
    let result: "win" | "loss" | "push" = "push";
    let payout = 0;
    if (dealerVal > 21) {
      result = "win";
      payout = session.bet * 2;
    } else if (playerVal > dealerVal) {
      result = "win";
      payout = session.bet * 2;
    } else if (playerVal < dealerVal) {
      result = "loss";
    }
    session.result = result;
    session.payout = payout;

    if (payout > 0) {
      addCredits(userId, payout, "casino_blackjack_win", {
        bet: session.bet,
        result,
        payout,
      });
    } else if (result === "push") {
      addCredits(userId, session.bet, "casino_blackjack_push", { bet: session.bet });
    }
    removeBlackjackSession(userId);

    return NextResponse.json({
      action: "stand",
      session: null,
      playerHand: session.playerHand,
      dealerHand: session.dealerHand,
      playerValue: playerVal,
      dealerValue: dealerVal,
      result,
      payout: result === "push" ? session.bet : payout,
      newBalance: getCredits(userId),
      netChange: result === "push" ? 0 : payout - session.bet,
    });
  }

  return NextResponse.json(
    { error: "action must be deal, hit, or stand" },
    { status: 400 }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const session = getBlackjackSession(userId);
  if (!session) {
    return NextResponse.json({ session: null });
  }

  const dealerHidden = session.dealerHand.length > 1;
  return NextResponse.json({
    session: {
      status: session.status,
      bet: session.bet,
    },
    playerHand: session.playerHand,
    dealerHand: dealerHidden
      ? [session.dealerHand[0], { suit: "?", rank: "?" }]
      : session.dealerHand,
    playerValue: handValue(session.playerHand.map(fromDataCard)),
    dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
  });
}
