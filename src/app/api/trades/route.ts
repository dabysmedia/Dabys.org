import { NextResponse } from "next/server";
import { getTradesForUser, getCardById, addNotification } from "@/lib/data";
import { createTrade } from "@/lib/trades";
import { getDisplayedBadgeForUser } from "@/lib/cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const status = searchParams.get("status") as "pending" | "accepted" | "denied" | null;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const trades = getTradesForUser(userId, status || undefined);
  const enriched = trades.map((t) => ({
    ...t,
    offeredCards: t.offeredCardIds
      .map((id) => getCardById(id))
      .filter(Boolean),
    requestedCards: t.requestedCardIds
      .map((id) => getCardById(id))
      .filter(Boolean),
    initiatorDisplayedBadge: getDisplayedBadgeForUser(t.initiatorUserId),
    counterpartyDisplayedBadge: getDisplayedBadgeForUser(t.counterpartyUserId),
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const { initiatorUserId, counterpartyUserId, offeredCardIds, requestedCardIds, offeredCredits, requestedCredits } = body;

  if (!initiatorUserId || !counterpartyUserId) {
    return NextResponse.json(
      { error: "initiatorUserId and counterpartyUserId required" },
      { status: 400 }
    );
  }

  const offered = Array.isArray(offeredCardIds) ? offeredCardIds : [];
  const requested = Array.isArray(requestedCardIds) ? requestedCardIds : [];
  const offCr = Math.max(0, Math.floor(Number(offeredCredits) || 0));
  const reqCr = Math.max(0, Math.floor(Number(requestedCredits) || 0));

  if ((offered.length === 0 && offCr === 0) || (requested.length === 0 && reqCr === 0)) {
    return NextResponse.json(
      { error: "Each side must offer at least one card or credits" },
      { status: 400 }
    );
  }

  const initiatorName = body.initiatorName || "";
  const counterpartyName = body.counterpartyName || "";

  const result = createTrade(
    initiatorUserId,
    counterpartyUserId,
    offered,
    requested,
    initiatorName,
    counterpartyName,
    offCr,
    reqCr
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to create trade" },
      { status: 400 }
    );
  }

  // Notify the counterparty about the incoming trade
  const cardCount = offered.length + requested.length;
  addNotification({
    type: "trade_received",
    targetUserId: counterpartyUserId,
    message: `sent you a trade offer (${cardCount} card${cardCount !== 1 ? "s" : ""})`,
    actorUserId: initiatorUserId,
    actorName: initiatorName,
    meta: { tradeId: result.trade?.id },
  });

  return NextResponse.json({ trade: result.trade }, { status: 201 });
}
