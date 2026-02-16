import { NextResponse } from "next/server";
import { acceptTrade } from "@/lib/trades";
import { getTradeById, getUsers, getWinners, addActivity } from "@/lib/data";
import { getCompletedWinnerIds } from "@/lib/cards";
import { recordQuestProgress } from "@/lib/quests";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tradeId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Get trade info before accepting to know both parties
  const trade = getTradeById(tradeId);

  // Snapshot completed sets before trade
  const completedBeforeInit = trade ? new Set(getCompletedWinnerIds(trade.initiatorUserId)) : new Set<string>();
  const completedBeforeCP = trade ? new Set(getCompletedWinnerIds(trade.counterpartyUserId)) : new Set<string>();

  const result = acceptTrade(tradeId, body.userId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to accept trade" },
      { status: 400 }
    );
  }

  // Track quest progress: complete_trade for both parties
  if (trade) {
    recordQuestProgress(trade.initiatorUserId, "complete_trade");
    recordQuestProgress(trade.counterpartyUserId, "complete_trade");

    // --- Activity logging ---
    const users = getUsers();
    const initiatorName = users.find((u) => u.id === trade.initiatorUserId)?.name || trade.initiatorName;
    const counterpartyName = users.find((u) => u.id === trade.counterpartyUserId)?.name || trade.counterpartyName;
    const totalCards = trade.offeredCardIds.length + trade.requestedCardIds.length;

    addActivity({
      type: "trade_complete",
      userId: trade.initiatorUserId,
      userName: initiatorName,
      message: `completed a trade with ${counterpartyName} (${totalCards} card${totalCards !== 1 ? "s" : ""})`,
      meta: { tradeId, counterpartyName, counterpartyUserId: trade.counterpartyUserId },
    });

    // Check for newly completed sets for both parties
    const winners = getWinners();
    for (const [userId, userName, before] of [
      [trade.initiatorUserId, initiatorName, completedBeforeInit],
      [trade.counterpartyUserId, counterpartyName, completedBeforeCP],
    ] as [string, string, Set<string>][]) {
      const after = getCompletedWinnerIds(userId);
      for (const winnerId of after) {
        if (!before.has(winnerId)) {
          const winner = winners.find((w) => w.id === winnerId);
          addActivity({
            type: "set_complete",
            userId,
            userName,
            message: `completed the ${winner?.movieTitle || "a movie"} set!`,
            meta: { winnerId, movieTitle: winner?.movieTitle },
          });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
