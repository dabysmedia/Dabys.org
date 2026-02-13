import {
  getCardById,
  transferCard,
  getListings,
  addTrade,
  getTradeById,
  updateTradeStatus,
  getCredits,
  deductCredits,
  addCredits,
  TradeOffer,
} from "@/lib/data";

export function createTrade(
  initiatorUserId: string,
  counterpartyUserId: string,
  offeredCardIds: string[],
  requestedCardIds: string[],
  initiatorName: string,
  counterpartyName: string,
  offeredCredits: number = 0,
  requestedCredits: number = 0
): { success: boolean; trade?: TradeOffer; error?: string } {
  if (initiatorUserId === counterpartyUserId) {
    return { success: false, error: "Cannot trade with yourself" };
  }
  const offered = offeredCardIds.length > 0 || (offeredCredits > 0 && Number.isFinite(offeredCredits));
  const requested = requestedCardIds.length > 0 || (requestedCredits > 0 && Number.isFinite(requestedCredits));
  if (!offered || !requested) {
    return { success: false, error: "Each side must offer at least one card or credits" };
  }

  const offCr = Math.max(0, Math.floor(offeredCredits || 0));
  const reqCr = Math.max(0, Math.floor(requestedCredits || 0));

  if (offCr > 0) {
    const balance = getCredits(initiatorUserId);
    if (balance < offCr) return { success: false, error: "Not enough credits for your offer" };
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
    offeredCredits: offCr,
    requestedCredits: reqCr,
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

  // Offered cards: skip any that no longer exist (e.g. data reset); only transfer those that exist and pass checks
  const transferableOfferedIds: string[] = [];
  for (const cardId of trade.offeredCardIds) {
    const card = getCardById(cardId);
    if (!card) continue; // card no longer exists, skip
    if (card.userId !== trade.initiatorUserId) return { success: false, error: "Offered card ownership changed" };
    if (listedCardIds.has(cardId)) return { success: false, error: "One of the offered cards is now listed" };
    transferableOfferedIds.push(cardId);
  }

  for (const cardId of trade.requestedCardIds) {
    const card = getCardById(cardId);
    if (!card) return { success: false, error: "Requested card no longer exists" };
    if (card.userId !== trade.counterpartyUserId) return { success: false, error: "Requested card ownership changed" };
    if (listedCardIds.has(cardId)) return { success: false, error: "One of the requested cards is now listed" };
  }

  const offCr = Math.max(0, Math.floor(trade.offeredCredits ?? 0));
  const reqCr = Math.max(0, Math.floor(trade.requestedCredits ?? 0));
  const hasOfferSide = transferableOfferedIds.length > 0 || offCr > 0;
  const hasRequestSide = trade.requestedCardIds.length > 0 || reqCr > 0;
  if (!hasOfferSide && !hasRequestSide) return { success: false, error: "Nothing left to receive from this offer" };

  if (offCr > 0) {
    const initBalance = getCredits(trade.initiatorUserId);
    if (initBalance < offCr) return { success: false, error: "Initiator no longer has enough credits" };
  }
  if (reqCr > 0) {
    const cpBalance = getCredits(trade.counterpartyUserId);
    if (cpBalance < reqCr) return { success: false, error: "Not enough credits for this trade" };
  }

  for (const cardId of transferableOfferedIds) {
    transferCard(cardId, trade.counterpartyUserId);
  }
  for (const cardId of trade.requestedCardIds) {
    transferCard(cardId, trade.initiatorUserId);
  }

  if (offCr > 0) {
    deductCredits(trade.initiatorUserId, offCr, "trade", { tradeId, direction: "offered" });
    addCredits(trade.counterpartyUserId, offCr, "trade", { tradeId, direction: "received" });
  }
  if (reqCr > 0) {
    deductCredits(trade.counterpartyUserId, reqCr, "trade", { tradeId, direction: "offered" });
    addCredits(trade.initiatorUserId, reqCr, "trade", { tradeId, direction: "received" });
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
