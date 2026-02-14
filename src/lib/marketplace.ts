import {
  getListing,
  removeListing,
  addListing,
  getListings,
  getCardById,
  transferCard,
  getCredits,
  deductCredits,
  addCredits,
  getBuyOrder,
  addBuyOrder,
  removeBuyOrder,
  getCharacterPool,
} from "@/lib/data";

export function listCard(
  userId: string,
  cardId: string,
  askingPrice: number
): { success: boolean; listing?: ReturnType<typeof addListing>; error?: string } {
  if (askingPrice < 1) return { success: false, error: "Price must be at least 1" };

  const card = getCardById(cardId);
  if (!card) return { success: false, error: "Card not found" };
  if (card.userId !== userId) return { success: false, error: "You don't own this card" };

  const listings = getListings();
  const alreadyListed = listings.some((l: { cardId: string }) => l.cardId === cardId);
  if (alreadyListed) return { success: false, error: "Card is already listed" };

  const listing = addListing({ cardId, sellerUserId: userId, askingPrice });
  return { success: true, listing };
}

export function delistCard(
  userId: string,
  listingId: string
): { success: boolean; error?: string } {
  const listing = getListing(listingId);
  if (!listing) return { success: false, error: "Listing not found" };
  if (listing.sellerUserId !== userId) return { success: false, error: "You don't own this listing" };

  removeListing(listingId);
  return { success: true };
}

export function buyListing(
  buyerUserId: string,
  listingId: string
): { success: boolean; card?: ReturnType<typeof getCardById>; error?: string } {
  const listing = getListing(listingId);
  if (!listing) return { success: false, error: "Listing not found" };
  if (listing.sellerUserId === buyerUserId) return { success: false, error: "You can't buy your own listing" };

  const balance = getCredits(buyerUserId);
  if (balance < listing.askingPrice) return { success: false, error: "Not enough credits" };

  const card = getCardById(listing.cardId);
  if (!card) return { success: false, error: "Card no longer exists" };
  if (card.userId !== listing.sellerUserId) return { success: false, error: "Card was sold" };

  const deducted = deductCredits(buyerUserId, listing.askingPrice, "marketplace_buy", {
    listingId,
    cardId: card.id,
    sellerUserId: listing.sellerUserId,
  });
  if (!deducted) return { success: false, error: "Failed to deduct credits" };

  addCredits(listing.sellerUserId, listing.askingPrice, "marketplace_sale", {
    listingId,
    cardId: card.id,
    buyerUserId,
  });

  transferCard(card.id, buyerUserId);
  removeListing(listingId);

  const updatedCard = getCardById(card.id);
  return { success: true, card: updatedCard };
}

// ──── Buy Orders ─────────────────────────────────────────

export function createBuyOrder(
  requesterUserId: string,
  characterId: string,
  offerPrice: number = 0
): { success: boolean; order?: ReturnType<typeof addBuyOrder>; error?: string } {
  const pool = getCharacterPool();
  const entry = pool.find((c) => c.characterId === characterId);
  if (!entry) return { success: false, error: "Character not found in pool" };

  const price = Math.max(0, Math.floor(offerPrice));
  if (price > 0) {
    const balance = getCredits(requesterUserId);
    if (balance < price) return { success: false, error: "Not enough credits for offer price" };
  }

  const order = addBuyOrder({ requesterUserId, characterId, offerPrice: price });
  return { success: true, order };
}

export function cancelBuyOrder(
  userId: string,
  orderId: string
): { success: boolean; error?: string } {
  const order = getBuyOrder(orderId);
  if (!order) return { success: false, error: "Order not found" };
  if (order.requesterUserId !== userId) return { success: false, error: "You can't cancel someone else's order" };

  removeBuyOrder(orderId);
  return { success: true };
}

export function fulfillBuyOrder(
  fulfillerUserId: string,
  orderId: string,
  cardId: string
): { success: boolean; error?: string } {
  const order = getBuyOrder(orderId);
  if (!order) return { success: false, error: "Order not found" };
  if (order.requesterUserId === fulfillerUserId) return { success: false, error: "You can't fulfill your own order" };

  const card = getCardById(cardId);
  if (!card) return { success: false, error: "Card not found" };
  if (card.userId !== fulfillerUserId) return { success: false, error: "You don't own this card" };
  if (card.characterId !== order.characterId) return { success: false, error: "Card doesn't match the order" };

  const listedCardIds = new Set(getListings().map((l) => l.cardId));
  if (listedCardIds.has(cardId)) return { success: false, error: "Card is listed on the marketplace" };

  if (order.offerPrice > 0) {
    const balance = getCredits(order.requesterUserId);
    if (balance < order.offerPrice) return { success: false, error: "Buyer no longer has enough credits" };

    const deducted = deductCredits(order.requesterUserId, order.offerPrice, "buy_order_fulfill", {
      orderId,
      cardId,
      fulfillerUserId,
    });
    if (!deducted) return { success: false, error: "Failed to deduct credits" };

    addCredits(fulfillerUserId, order.offerPrice, "buy_order_sale", {
      orderId,
      cardId,
      requesterUserId: order.requesterUserId,
    });
  }

  transferCard(cardId, order.requesterUserId);
  removeBuyOrder(orderId);

  return { success: true };
}
