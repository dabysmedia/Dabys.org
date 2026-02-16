import { NextResponse } from "next/server";
import { fulfillBuyOrder } from "@/lib/marketplace";
import { getCompletedWinnerIds } from "@/lib/cards";
import { getUsers, getBuyOrder, getCardById, getWinners, addActivity, addNotification, addGlobalNotification } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.userId || !body.cardId) {
    return NextResponse.json(
      { error: "userId and cardId required" },
      { status: 400 }
    );
  }

  // Snapshot before fulfill
  const order = getBuyOrder(orderId);
  const card = getCardById(body.cardId);
  const completedBefore = order ? new Set(getCompletedWinnerIds(order.requesterUserId)) : new Set<string>();

  const result = fulfillBuyOrder(body.userId, orderId, body.cardId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to fulfill order" },
      { status: 400 }
    );
  }

  // --- Activity logging ---
  if (order && card) {
    const users = getUsers();
    const fulfillerName = users.find((u) => u.id === body.userId)?.name || "Someone";
    const requesterName = users.find((u) => u.id === order.requesterUserId)?.name || "Someone";

    addActivity({
      type: "market_order_filled",
      userId: body.userId,
      userName: fulfillerName,
      message: `filled ${requesterName}'s buy order for ${card.characterName || card.actorName}${order.offerPrice > 0 ? ` (${order.offerPrice}¢)` : ""}`,
      meta: {
        orderId,
        cardId: body.cardId,
        requesterUserId: order.requesterUserId,
        price: order.offerPrice,
      },
    });

    // Personal notification to the requester
    addNotification({
      type: "buy_order_filled",
      targetUserId: order.requesterUserId,
      message: `filled your buy order for ${card.characterName || card.actorName}${order.offerPrice > 0 ? ` (${order.offerPrice}¢)` : ""}`,
      actorUserId: body.userId,
      actorName: fulfillerName,
      meta: { orderId, cardId: body.cardId, price: order.offerPrice },
    });

    // Global notification for order fill
    addGlobalNotification({
      type: "market_order_filled",
      message: `filled ${requesterName}'s buy order for ${card.characterName || card.actorName}${order.offerPrice > 0 ? ` (${order.offerPrice}¢)` : ""}`,
      actorUserId: body.userId,
      actorName: fulfillerName,
      meta: { orderId, cardId: body.cardId },
    });

    // Check for newly completed sets for the requester
    const completedAfter = getCompletedWinnerIds(order.requesterUserId);
    const winners = getWinners();
    for (const winnerId of completedAfter) {
      if (!completedBefore.has(winnerId)) {
        const winner = winners.find((w) => w.id === winnerId);
        addActivity({
          type: "set_complete",
          userId: order.requesterUserId,
          userName: requesterName,
          message: `completed the ${winner?.movieTitle || "a movie"} set!`,
          meta: { winnerId, movieTitle: winner?.movieTitle },
        });
        addGlobalNotification({
          type: "set_complete",
          message: `completed the ${winner?.movieTitle || "a movie"} set!`,
          actorUserId: order.requesterUserId,
          actorName: requesterName,
          meta: { winnerId, movieTitle: winner?.movieTitle },
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
