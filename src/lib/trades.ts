import {
  getCardById,
  transferCard,
  getListings,
  addTrade,
  getTradeById,
  updateTradeStatus,
  TradeOffer,
} from "@/lib/data";

export function createTrade(
  initiatorUserId: string,
  counterpartyUserId: string,
  offeredCardIds: string[],
  requestedCardIds: string[],
  initiatorName: string,
  counterpartyName: string
): { success: boolean; trade?: TradeOffer; error?: string } {
  if (initiatorUserId === counterpartyUserId) {
    return { success: false, error: "Cannot trade with yourself" };
  }
  if (!offeredCardIds.length || !requestedCardIds.length) {
    return { success: false, error: "Each side must offer at least one card" };
  }

  const listedCardIds = new Set(getListings().map((l) => l.cardId));

  for (const cardId of offeredCardIds) {
    const card = getCardById(cardId);
    if (!card) return { success: false, error: "Offered card not found" };
    if (card.userId !== initiatorUserId) return { success: false, error: "You don't own one of the offered cards" };
    if (listedCardIds.has(cardId)) return { success: false, error: "One of your offered cards is listed on the marketplace" };
  }

  for (const cardId of requestedCardIds) {
    const card = getCardById(cardId);
    if (!card) return { success: false, error: "Requested card not found" };
    if (card.userId !== counterpartyUserId) return { success: false, error: "Requested card is no longer available" };
    if (listedCardIds.has(cardId)) return { success: false, error: "One of the requested cards is listed on the marketplace" };
  }

  const trade = addTrade({
    initiatorUserId,
    initiatorName,
    counterpartyUserId,
    counterpartyName,
    offeredCardIds,
    requestedCardIds,
    status: "pending",
  });
  return { success: true, trade };
}

export function acceptTrade(tradeId: string, userId: string): { success: boolean; error?: string } {
  const trade = getTradeById(tradeId);
  if (!trade) return { success: false, error: "Trade not found" };
  if (trade.status !== "pending") return { success: false, error: "Trade is no longer pending" };
  if (trade.counterpartyUserId !== userId) return { success: false, error: "Only the recipient can accept this trade" };

  const listedCardIds = new Set(getListings().map((l) => l.cardId));

  for (const cardId of trade.offeredCardIds) {
    const card = getCardById(cardId);
    if (!card) return { success: false, error: "Offered card no longer exists" };
    if (card.userId !== trade.initiatorUserId) return { success: false, error: "Offered card ownership changed" };
    if (listedCardIds.has(cardId)) return { success: false, error: "One of the offered cards is now listed" };
  }

  for (const cardId of trade.requestedCardIds) {
    const card = getCardById(cardId);
    if (!card) return { success: false, error: "Requested card no longer exists" };
    if (card.userId !== trade.counterpartyUserId) return { success: false, error: "Requested card ownership changed" };
    if (listedCardIds.has(cardId)) return { success: false, error: "One of the requested cards is now listed" };
  }

  for (const cardId of trade.offeredCardIds) {
    transferCard(cardId, trade.counterpartyUserId);
  }
  for (const cardId of trade.requestedCardIds) {
    transferCard(cardId, trade.initiatorUserId);
  }

  updateTradeStatus(tradeId, "accepted");
  return { success: true };
}

export function denyTrade(tradeId: string, userId: string): { success: boolean; error?: string } {
  const trade = getTradeById(tradeId);
  if (!trade) return { success: false, error: "Trade not found" };
  if (trade.status !== "pending") return { success: false, error: "Trade is no longer pending" };
  if (trade.counterpartyUserId !== userId) return { success: false, error: "Only the recipient can deny this trade" };

  updateTradeStatus(tradeId, "denied");
  return { success: true };
}

export function cancelTrade(tradeId: string, userId: string): { success: boolean; error?: string } {
  const trade = getTradeById(tradeId);
  if (!trade) return { success: false, error: "Trade not found" };
  if (trade.status !== "pending") return { success: false, error: "Trade is no longer pending" };
  if (trade.initiatorUserId !== userId) return { success: false, error: "Only the sender can cancel this trade" };

  updateTradeStatus(tradeId, "denied");
  return { success: true };
}
