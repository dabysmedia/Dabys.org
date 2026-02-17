import { NextResponse } from "next/server";
import { buyListing } from "@/lib/marketplace";
import { getCompletedWinnerIds } from "@/lib/cards";
import { getUsers, getListing, getWinners, addActivity, addNotification, addGlobalNotification, getSiteSettings } from "@/lib/data";

export async function POST(request: Request) {
  const settings = getSiteSettings();
  if (!settings.marketplaceEnabled) {
    return NextResponse.json(
      { error: "Marketplace is currently disabled" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (!body.userId || !body.listingId) {
    return NextResponse.json(
      { error: "userId and listingId required" },
      { status: 400 }
    );
  }

  // Snapshot before purchase
  const listing = getListing(body.listingId);
  const completedBefore = new Set(getCompletedWinnerIds(body.userId));

  const result = buyListing(body.userId, body.listingId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to buy" },
      { status: 400 }
    );
  }

  // --- Activity logging ---
  if (result.card && listing) {
    const users = getUsers();
    const buyerName = users.find((u) => u.id === body.userId)?.name || "Someone";
    const sellerName = users.find((u) => u.id === listing.sellerUserId)?.name || "Someone";

    addActivity({
      type: "market_sale",
      userId: listing.sellerUserId,
      userName: sellerName,
      message: `sold ${result.card.characterName || result.card.actorName} to ${buyerName} for ${listing.askingPrice}¢`,
      meta: {
        cardId: result.card.id,
        characterName: result.card.characterName,
        buyerUserId: body.userId,
        price: listing.askingPrice,
      },
    });

    // Personal notification to the seller
    addNotification({
      type: "marketplace_sold",
      targetUserId: listing.sellerUserId,
      message: `bought your ${result.card.characterName || result.card.actorName} for ${listing.askingPrice}¢`,
      actorUserId: body.userId,
      actorName: buyerName,
      meta: { cardId: result.card.id, price: listing.askingPrice },
    });

    // Global notification for marketplace sale
    addGlobalNotification({
      type: "market_sale",
      message: `sold ${result.card.characterName || result.card.actorName} to ${buyerName} for ${listing.askingPrice}¢`,
      actorUserId: listing.sellerUserId,
      actorName: sellerName,
      meta: { cardId: result.card.id, price: listing.askingPrice },
    });

    // Check for newly completed sets
    const completedAfter = getCompletedWinnerIds(body.userId);
    const winners = getWinners();
    for (const winnerId of completedAfter) {
      if (!completedBefore.has(winnerId)) {
        const winner = winners.find((w) => w.id === winnerId);
        addActivity({
          type: "set_complete",
          userId: body.userId,
          userName: buyerName,
          message: `completed the ${winner?.movieTitle || "a movie"} set!`,
          meta: { winnerId, movieTitle: winner?.movieTitle },
        });
        addGlobalNotification({
          type: "set_complete",
          message: `completed the ${winner?.movieTitle || "a movie"} set!`,
          actorUserId: body.userId,
          actorName: buyerName,
          meta: { winnerId, movieTitle: winner?.movieTitle },
        });
      }
    }
  }

  return NextResponse.json({ card: result.card });
}
