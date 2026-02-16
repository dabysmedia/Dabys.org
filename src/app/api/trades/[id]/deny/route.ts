import { NextResponse } from "next/server";
import { denyTrade } from "@/lib/trades";
import { getTradeById, getUsers, addNotification } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tradeId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Get trade info before denying
  const trade = getTradeById(tradeId);

  const result = denyTrade(tradeId, body.userId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to deny trade" },
      { status: 400 }
    );
  }

  // Notify the trade initiator that their trade was denied
  if (trade) {
    const users = getUsers();
    const counterpartyName = users.find((u) => u.id === trade.counterpartyUserId)?.name || trade.counterpartyName;
    addNotification({
      type: "trade_denied",
      targetUserId: trade.initiatorUserId,
      message: `declined your trade offer`,
      actorUserId: trade.counterpartyUserId,
      actorName: counterpartyName,
      meta: { tradeId },
    });
  }

  return NextResponse.json({ success: true });
}
