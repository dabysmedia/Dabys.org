import { NextResponse } from "next/server";
import { acceptTrade } from "@/lib/trades";
import { getTradeById } from "@/lib/data";
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
  }

  return NextResponse.json({ success: true });
}
