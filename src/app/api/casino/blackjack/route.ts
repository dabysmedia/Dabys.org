import { NextResponse } from "next/server";
import {
  deductCredits,
  addCredits,
  getCredits,
  getBlackjackSession,
  saveBlackjackSession,
  removeBlackjackSession,
  getCasinoGameSettings,
  type BlackjackSession,
  type BlackjackCard,
} from "@/lib/data";
import {
  createDeck,
  handValue,
  type Card,
} from "@/lib/casino";

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
    const { blackjack } = getCasinoGameSettings();
    const { minBet, maxBet } = blackjack;
    if (betRaw === undefined || betRaw < minBet || betRaw > maxBet || betRaw % 2 !== 0) {
      return NextResponse.json(
        { error: `Bet must be an even number between ${minBet} and ${maxBet}` },
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
    const dealerHasAce = dealerShow.rank === "A";

    // If dealer shows Ace, offer insurance before resolving
    if (dealerHasAce) {
      session.status = "insurance";
      saveBlackjackSession(session);
      return NextResponse.json({
        action: "deal",
        session: { status: "insurance", bet: session.bet, offerInsurance: true },
        playerHand: session.playerHand,
        dealerHand: [dealerShow, { suit: "?", rank: "?" }],
        playerValue: playerVal,
        dealerValue: dealerVal,
        result: null,
        newBalance: getCredits(userId),
      });
    }

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
      const { blackjackPayout } = getCasinoGameSettings().blackjack;
      session.payout = Math.floor(betRaw * (1 + blackjackPayout));
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

  if (action === "insurance") {
    const session = getBlackjackSession(userId);
    if (!session || session.status !== "insurance") {
      return NextResponse.json(
        { error: "Insurance not offered." },
        { status: 400 }
      );
    }
    const takeInsurance = !!body.takeInsurance;
    const insuranceAmount = takeInsurance ? Math.floor(session.bet / 2) : 0;
    if (takeInsurance && insuranceAmount > 0) {
      const balance = getCredits(userId);
      if (balance < insuranceAmount) {
        return NextResponse.json(
          { error: "Not enough credits for insurance." },
          { status: 400 }
        );
      }
      deductCredits(userId, insuranceAmount, "casino_blackjack", { bet: session.bet, insurance: insuranceAmount });
      session.insurance = insuranceAmount;
    }
    session.status = "player_turn";
    const dealerValFull = handValue(session.dealerHand.map(fromDataCard));
    const dealerHasBlackjack = session.dealerHand.length === 2 && dealerValFull === 21;
    if (dealerHasBlackjack) {
      session.status = "resolved";
      let payout = session.bet; // Main bet pushes
      if (session.insurance && session.insurance > 0) {
        const insurancePayout = session.insurance * 2;
        addCredits(userId, insurancePayout, "casino_blackjack_win", { bet: session.bet, insurance: session.insurance });
        payout += insurancePayout;
      }
      addCredits(userId, session.bet, "casino_blackjack_push", { bet: session.bet });
      removeBlackjackSession(userId);
      const playerVal = handValue(session.playerHand.map(fromDataCard));
      const netChg = (session.insurance ? session.insurance * 2 : 0) - (session.insurance || 0);
      return NextResponse.json({
        action: "insurance",
        session: null,
        playerHand: session.playerHand,
        dealerHand: session.dealerHand,
        playerValue: playerVal,
        dealerValue: dealerValFull,
        result: netChg > 0 ? "win" : "push",
        payout: netChg > 0 ? netChg : session.bet,
        newBalance: getCredits(userId),
        netChange: netChg,
      });
    }
    const playerVal = handValue(session.playerHand.map(fromDataCard));
    const playerHasBlackjack = session.playerHand.length === 2 && playerVal === 21;
    if (playerHasBlackjack) {
      session.status = "resolved";
      session.result = "win";
      const { blackjackPayout } = getCasinoGameSettings().blackjack;
      session.payout = Math.floor(session.bet * (1 + blackjackPayout));
      addCredits(userId, session.payout, "casino_blackjack_win", { bet: session.bet, result: "win" });
      removeBlackjackSession(userId);
      return NextResponse.json({
        action: "insurance",
        session: null,
        playerHand: session.playerHand,
        dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
        playerValue: 21,
        dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
        result: "win",
        payout: session.payout,
        newBalance: getCredits(userId),
        netChange: session.payout - session.bet,
      });
    }
    saveBlackjackSession(session);
    return NextResponse.json({
      action: "insurance",
      session: { status: "player_turn", bet: session.bet },
      playerHand: session.playerHand,
      dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
      playerValue: playerVal,
      dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
      result: null,
      newBalance: getCredits(userId),
    });
  }

  if (action === "split") {
    const session = getBlackjackSession(userId);
    if (!session || session.status !== "player_turn") {
      return NextResponse.json(
        { error: "No active hand. Cannot split." },
        { status: 400 }
      );
    }
    const hands = session.playerHands ?? [session.playerHand];
    if (hands.length !== 1 || session.playerHand.length !== 2) {
      return NextResponse.json(
        { error: "Can only split on initial two-card hand." },
        { status: 400 }
      );
    }
    const [c1, c2] = session.playerHand;
    const normRank = (r: string) => (["10", "J", "Q", "K"].includes(r) ? "10" : r);
    if (normRank(c1.rank) !== normRank(c2.rank)) {
      return NextResponse.json(
        { error: "Can only split pairs (same rank)." },
        { status: 400 }
      );
    }
    const balance = getCredits(userId);
    if (balance < session.bet) {
      return NextResponse.json(
        { error: "Not enough credits to split (need another bet)." },
        { status: 400 }
      );
    }
    deductCredits(userId, session.bet, "casino_blackjack", { bet: session.bet, action: "split" });
    const { card: card1, rest: deck1 } = draw(session.deck);
    const { card: card2, rest: deck2 } = draw(deck1);
    session.deck = deck2;
    session.playerHands = [[c1, card1], [c2, card2]];
    session.playerHand = session.playerHands[0];
    session.currentHandIndex = 0;
    saveBlackjackSession(session);
    const playerVal = handValue(session.playerHands[0].map(fromDataCard));
    return NextResponse.json({
      action: "split",
      session: { status: "player_turn", bet: session.bet, currentHandIndex: 0, playerHands: session.playerHands },
      playerHand: session.playerHands[0],
      playerHands: session.playerHands,
      dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
      playerValue: playerVal,
      dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
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

    const hands = session.playerHands ?? [session.playerHand];
    const handIdx = session.currentHandIndex ?? 0;
    const currentHand = hands[handIdx];
    const betPerHand = session.bet;

    if (action === "hit") {
      const { card, rest } = draw(session.deck);
      session.deck = rest;
      currentHand.push(card);
      if (hands.length > 1) {
        session.playerHands![handIdx] = currentHand;
        session.playerHand = currentHand;
      }
      const playerVal = handValue(currentHand.map(fromDataCard));
      if (playerVal > 21) {
        if (hands.length > 1 && handIdx < hands.length - 1) {
          session.currentHandIndex = handIdx + 1;
          session.playerHand = hands[handIdx + 1];
          saveBlackjackSession(session);
          return NextResponse.json({
            action: "hit",
            session: { status: "player_turn", bet: session.bet, currentHandIndex: handIdx + 1, playerHands: session.playerHands },
            playerHand: hands[handIdx + 1],
            playerHands: session.playerHands,
            dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
            playerValue: handValue(hands[handIdx + 1].map(fromDataCard)),
            dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
            result: null,
            newBalance: getCredits(userId),
          });
        }
        session.status = "resolved";
        session.result = "loss";
        session.payout = 0;
        removeBlackjackSession(userId);
        const totalBet = betPerHand * hands.length;
        return NextResponse.json({
          action: "hit",
          session: null,
          playerHand: currentHand,
          playerHands: hands.length > 1 ? session.playerHands : undefined,
          dealerHand: session.dealerHand,
          playerValue: playerVal,
          dealerValue: handValue(session.dealerHand.map(fromDataCard)),
          result: "loss",
          payout: 0,
          newBalance: getCredits(userId),
          netChange: -totalBet,
        });
      }
      saveBlackjackSession(session);
      return NextResponse.json({
        action: "hit",
        session: { status: session.status, bet: session.bet, currentHandIndex: handIdx, playerHands: hands.length > 1 ? session.playerHands : undefined },
        playerHand: currentHand,
        playerHands: hands.length > 1 ? session.playerHands : undefined,
        dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
        playerValue: playerVal,
        dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
        result: null,
        newBalance: getCredits(userId),
      });
    }

    // stand
    if (hands.length > 1 && handIdx < hands.length - 1) {
      session.currentHandIndex = handIdx + 1;
      session.playerHand = hands[handIdx + 1];
      saveBlackjackSession(session);
      return NextResponse.json({
        action: "stand",
        session: { status: "player_turn", bet: session.bet, currentHandIndex: handIdx + 1, playerHands: session.playerHands },
        playerHand: hands[handIdx + 1],
        playerHands: session.playerHands,
        dealerHand: [session.dealerHand[0], { suit: "?", rank: "?" }],
        playerValue: handValue(hands[handIdx + 1].map(fromDataCard)),
        dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
        result: null,
        newBalance: getCredits(userId),
      });
    }

    session.status = "dealer_turn";
    let dealerVal = handValue(session.dealerHand.map(fromDataCard));
    while (dealerVal < 17) {
      const { card, rest } = draw(session.deck);
      session.deck = rest;
      session.dealerHand.push(card);
      dealerVal = handValue(session.dealerHand.map(fromDataCard));
    }

    const allHands = session.playerHands ?? [session.playerHand];
    let totalPayout = 0;
    let netChange = 0;
    const perHandBet = session.bet;
    for (let i = 0; i < allHands.length; i++) {
      const playerVal = handValue(allHands[i].map(fromDataCard));
      let result: "win" | "loss" | "push" = "push";
      let payout = 0;
      if (playerVal > 21) {
        result = "loss";
      } else if (dealerVal > 21) {
        result = "win";
        payout = perHandBet * 2;
      } else if (playerVal > dealerVal) {
        result = "win";
        payout = perHandBet * 2;
      } else if (playerVal < dealerVal) {
        result = "loss";
      } else {
        payout = perHandBet;
      }
      if (payout > 0) {
        addCredits(userId, payout, "casino_blackjack_win", { bet: perHandBet, result, payout });
        totalPayout += payout;
      } else if (result === "push") {
        addCredits(userId, perHandBet, "casino_blackjack_push", { bet: perHandBet });
        totalPayout += perHandBet;
      }
    }
    const totalBet = session.bet * allHands.length;
    netChange = totalPayout - totalBet;
    session.status = "resolved";
    session.result = netChange > 0 ? "win" : netChange < 0 ? "loss" : "push";
    session.payout = totalPayout;
    removeBlackjackSession(userId);

    return NextResponse.json({
      action: "stand",
      session: null,
      playerHand: allHands[allHands.length - 1],
      playerHands: allHands.length > 1 ? allHands : undefined,
      dealerHand: session.dealerHand,
      playerValue: handValue(allHands[allHands.length - 1].map(fromDataCard)),
      dealerValue: dealerVal,
      result: session.result,
      payout: totalPayout,
      newBalance: getCredits(userId),
      netChange,
    });
  }

  return NextResponse.json(
    { error: "action must be deal, hit, stand, insurance, or split" },
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

  const hands = session.playerHands ?? [session.playerHand];
  const currentHand = hands[session.currentHandIndex ?? 0];
  const dealerHidden = session.dealerHand.length > 1 && session.status !== "resolved";
  return NextResponse.json({
    session: {
      status: session.status,
      bet: session.bet,
      offerInsurance: session.status === "insurance",
      currentHandIndex: session.currentHandIndex,
      playerHands: session.playerHands,
    },
    playerHand: currentHand,
    playerHands: session.playerHands,
    dealerHand: dealerHidden
      ? [session.dealerHand[0], { suit: "?", rank: "?" }]
      : session.dealerHand,
    playerValue: handValue(currentHand.map(fromDataCard)),
    dealerValue: handValue([fromDataCard(session.dealerHand[0])]),
  });
}
