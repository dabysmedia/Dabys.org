"use client";

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CardDisplay } from "@/components/CardDisplay";
import { BadgePill } from "@/components/BadgePill";
import { DISENCHANT_DUST, getPackAPunchCost, getQuicksellCredits } from "@/lib/alchemy";
import { RARITY_BADGE } from "@/lib/constants";

interface User {
  id: string;
  name: string;
}

type CardType = "actor" | "director" | "character" | "scene";

interface Card {
  id: string;
  userId?: string;
  characterId?: string;
  rarity: string;
  isFoil: boolean;
  finish?: "normal" | "holo" | "prismatic" | "darkMatter";
  actorName: string;
  characterName: string;
  movieTitle: string;
  movieTmdbId?: number;
  profilePath: string;
  acquiredAt?: string;
  cardType?: CardType;
}

function cardLabelLines(card: Card): { title: string; subtitle: string } {
  const ct = card.cardType ?? "actor";
  if (ct === "director") return { title: card.actorName, subtitle: "Director" };
  if (ct === "scene") return { title: "Scene", subtitle: `from ${card.movieTitle}` };
  return { title: card.characterName, subtitle: card.actorName };
}

interface Listing {
  id: string;
  cardId: string;
  sellerUserId: string;
  sellerName: string;
  askingPrice: number;
  card: Card;
  sellerDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
}

type MarketplaceSubTab = "listings" | "orders";

interface BuyOrderEnriched {
  id: string;
  requesterUserId: string;
  requesterName: string;
  characterId: string;
  offerPrice: number;
  createdAt: string;
  poolEntry: {
    characterId: string;
    actorName: string;
    characterName: string;
    movieTitle: string;
    profilePath: string;
    rarity: string;
  } | null;
  requesterDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
}

const PACK_PRICE = 50;

function getTimeUntilMidnightUTC(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const ms = next.getTime() - now.getTime();
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function useMidnightUTCCountdown(active: boolean): string {
  const [countdown, setCountdown] = useState(() => getTimeUntilMidnightUTC());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setCountdown(getTimeUntilMidnightUTC()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return countdown;
}

type TabKey = "store" | "inventory" | "marketplace" | "trivia" | "trade" | "codex";
const TCG_TAB_STORAGE_KEY = "dabys_tcg_tab";
const TAB_KEYS: TabKey[] = ["store", "inventory", "marketplace", "trivia", "trade", "codex"];
type CodexSubTab = "codex" | "boys" | "badges";
type StoreSubTab = "packs" | "other";
/** Pool entry shape from /api/cards/character-pool (matches CharacterPortrayal). */
interface PoolEntry {
  characterId: string;
  actorName: string;
  characterName: string;
  movieTitle: string;
  movieTmdbId?: number;
  profilePath: string;
  rarity: string;
  cardType?: CardType;
  altArtOfCharacterId?: string;
}
type InventorySubTab = "tradeup" | "alchemy" | "quicksell";

interface TradeOfferEnriched {
  id: string;
  initiatorUserId: string;
  initiatorName: string;
  counterpartyUserId: string;
  counterpartyName: string;
  offeredCardIds: string[];
  requestedCardIds: string[];
  offeredCredits?: number;
  requestedCredits?: number;
  offeredCards: Card[];
  requestedCards: Card[];
  status: "pending" | "accepted" | "denied";
  createdAt: string;
  initiatorDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
  counterpartyDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
}

interface UserWithAvatar {
  id: string;
  name: string;
  avatarUrl?: string;
}

// Web Audio API sounds for trade-up (no assets, works everywhere)
let tradeUpAudioContext: AudioContext | null = null;
function getTradeUpAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!tradeUpAudioContext) tradeUpAudioContext = new AudioContext();
  return tradeUpAudioContext;
}
async function playTradeUpAdd() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch { /* ignore */ }
}
async function playTradeUpSubmit() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch { /* ignore */ }
}
async function playTradeUpReveal() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.08);
    osc.frequency.setValueAtTime(783.99, t + 0.16);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.setValueAtTime(0.12, t + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  } catch { /* ignore */ }
}
async function playTradeAcceptSound() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.06);
    osc.frequency.setValueAtTime(783.99, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.setValueAtTime(0.12, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
  } catch { /* ignore */ }
}
async function playTradeCreatedSound() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(554.37, t + 0.08);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
    gain.gain.setValueAtTime(0.1, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch { /* ignore */ }
}
async function playTradeDenySound() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.setValueAtTime(320, t + 0.08);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* ignore */ }
}
async function playPackFlipSound(step: number) {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "triangle";
    const base = 440;
    const freq = base + step * 60;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch { /* ignore */ }
}
// Alchemy bench sounds
async function playAlchemyBenchAdd() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(554.37, t);
    osc.frequency.setValueAtTime(659.25, t + 0.06);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* ignore */ }
}
async function playAlchemyBenchRemove() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.setValueAtTime(320, t + 0.06);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch { /* ignore */ }
}
async function playAlchemyDisenchantSuccess() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.06);
    osc.frequency.setValueAtTime(783.99, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
    gain.gain.setValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t);
    osc.stop(t + 0.28);
  } catch { /* ignore */ }
}
async function playIncomingTradeSound() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1108.73, t + 0.08);
    osc.frequency.setValueAtTime(1318.51, t + 0.16);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.setValueAtTime(0.12, t + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  } catch { /* ignore */ }
}

async function playAlchemyPackAPunchSuccess() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.08);
    osc.frequency.setValueAtTime(783.99, t + 0.16);
    osc.frequency.setValueAtTime(1046.5, t + 0.24);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
    gain.gain.setValueAtTime(0.1, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch { /* ignore */ }
}
async function playTrackedFoundSound() {
  const ctx = getTradeUpAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(659.25, t);
    osc1.frequency.setValueAtTime(880, t + 0.1);
    osc1.frequency.setValueAtTime(1046.5, t + 0.2);
    osc1.frequency.setValueAtTime(1318.51, t + 0.3);
    osc2.frequency.setValueAtTime(659.25, t);
    osc2.frequency.setValueAtTime(880, t + 0.1);
    osc2.frequency.setValueAtTime(1046.5, t + 0.2);
    osc2.frequency.setValueAtTime(1318.51, t + 0.3);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.03);
    gain.gain.setValueAtTime(0.14, t + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc1.start(t);
    osc1.stop(t + 0.55);
    osc2.start(t);
    osc2.stop(t + 0.55);
  } catch { /* ignore */ }
}

interface Winner {
  id: string;
  movieTitle: string;
  posterUrl: string;
  weekTheme?: string;
  tmdbId?: number;
}

interface Pack {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  cardsPerPack: number;
  allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
  allowedCardTypes: CardType[];
  maxPurchasesPerDay?: number;
  restockIntervalHours?: number;
  purchasesToday?: number;
  nextRestockAt?: string;
  discounted?: boolean;
  discountPercent?: number;
}

function formatRestockCountdown(nextRestockAt: string, now: number): string {
  const end = new Date(nextRestockAt).getTime();
  const left = Math.max(0, end - now);
  if (left <= 0) return "Resets soon";
  const h = Math.floor(left / (60 * 60 * 1000));
  const m = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
  const s = Math.floor((left % (60 * 1000)) / 1000);
  if (h > 0) return `Resets in ${h}h ${m}m`;
  if (m > 0) return `Resets in ${m}m ${s}s`;
  return `Resets in ${s}s`;
}

interface ShopItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  type: "badge" | "skip";
  skipAmount?: number;
  isActive: boolean;
  order: number;
}

function CardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabKey>("store");
  const [storeSubTab, setStoreSubTab] = useState<StoreSubTab>("packs");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [purchasingShopItemId, setPurchasingShopItemId] = useState<string | null>(null);
  const [inventorySubTab, setInventorySubTab] = useState<InventorySubTab>("tradeup");
  const [creditBalance, setCreditBalance] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [poolCount, setPoolCount] = useState(0);
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  const [newCards, setNewCards] = useState<Card[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [filterRarity, setFilterRarity] = useState<string>("");
  const [filterFoil, setFilterFoil] = useState<"all" | "foil" | "normal">("all");
  const [filterSort, setFilterSort] = useState<"recent" | "name" | "movie" | "type">("recent");
  const [filterCardType, setFilterCardType] = useState<"all" | "actor" | "character">("all");
  const [showListModal, setShowListModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [delistingId, setDelistingId] = useState<string | null>(null);
  const [marketplaceSubTab, setMarketplaceSubTab] = useState<MarketplaceSubTab>("listings");
  const [buyOrders, setBuyOrders] = useState<BuyOrderEnriched[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderCharacter, setSelectedOrderCharacter] = useState<PoolEntry | null>(null);
  const [orderOfferPrice, setOrderOfferPrice] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [fulfillingOrderId, setFulfillingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);

  interface TradeBlockEnriched {
    id: string;
    userId: string;
    userName: string;
    cardId: string;
    note: string;
    createdAt: string;
    card: Card;
  }
  const [tradeBlockEntries, setTradeBlockEntries] = useState<TradeBlockEnriched[]>([]);
  const [showTradeBlockModal, setShowTradeBlockModal] = useState(false);
  const [tradeBlockSelectedCard, setTradeBlockSelectedCard] = useState<Card | null>(null);
  const [tradeBlockNote, setTradeBlockNote] = useState("");
  const [tradeBlockPosting, setTradeBlockPosting] = useState(false);
  const [tradeBlockRemovingId, setTradeBlockRemovingId] = useState<string | null>(null);

  const [winners, setWinners] = useState<Winner[]>([]);
  const [triviaCompletedIds, setTriviaCompletedIds] = useState<Set<string>>(new Set());
  const [tradeUpSlots, setTradeUpSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [tradeUpAutofillError, setTradeUpAutofillError] = useState("");
  const [tradeUpAutofillErrorFading, setTradeUpAutofillErrorFading] = useState(false);
  const tradeUpAutofillErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tradingUp, setTradingUp] = useState(false);
  const [tradeUpResult, setTradeUpResult] = useState<Card | null>(null);
  const [tradeUpResultCredits, setTradeUpResultCredits] = useState<number | null>(null);
  const [tradeUpResultFading, setTradeUpResultFading] = useState(false);
  const [legendaryRerollSlots, setLegendaryRerollSlots] = useState<(string | null)[]>([null, null]);
  const [legendaryRerolling, setLegendaryRerolling] = useState(false);
  const [legendaryRerollResult, setLegendaryRerollResult] = useState<Card | null>(null);
  const [legendaryRerollResultFading, setLegendaryRerollResultFading] = useState(false);
  const [legendaryBlockShown, setLegendaryBlockShown] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [trades, setTrades] = useState<TradeOfferEnriched[]>([]);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeStep, setTradeStep] = useState<1 | 2 | 3>(1);
  const [tradeCounterparty, setTradeCounterparty] = useState<UserWithAvatar | null>(null);
  const [tradeOfferedIds, setTradeOfferedIds] = useState<Set<string>>(new Set());
  const [tradeRequestedIds, setTradeRequestedIds] = useState<Set<string>>(new Set());
  const [tradeOfferedCredits, setTradeOfferedCredits] = useState(0);
  const [tradeRequestedCredits, setTradeRequestedCredits] = useState(0);
  const [tradeUsers, setTradeUsers] = useState<UserWithAvatar[]>([]);
  const [counterpartyCards, setCounterpartyCards] = useState<Card[]>([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");
  const [tradeActionId, setTradeActionId] = useState<string | null>(null);
  const [tradeFeedback, setTradeFeedback] = useState<"accepted" | "denied" | "created" | null>(null);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [expandedReceivedTradeId, setExpandedReceivedTradeId] = useState<string | null>(null);
  const [expandedSentTradeId, setExpandedSentTradeId] = useState<string | null>(null);
  /** Deep-link from notification: expand this trade when trades have loaded */
  const [urlTradeId, setUrlTradeId] = useState<string | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeOfferEnriched[]>([]);
  const [expandedHistoryTradeId, setExpandedHistoryTradeId] = useState<string | null>(null);
  const [userAvatarMap, setUserAvatarMap] = useState<Record<string, string>>({});
  const [tcgInfoExpanded, setTcgInfoExpanded] = useState(false);
  const [stardust, setStardust] = useState(0);
  const [alchemyDisenchantingId, setAlchemyDisenchantingId] = useState<string | null>(null);
  const [alchemyPunchingId, setAlchemyPunchingId] = useState<string | null>(null);
  const [alchemyError, setAlchemyError] = useState("");
  const [alchemyBenchSlots, setAlchemyBenchSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [alchemySuccessFlash, setAlchemySuccessFlash] = useState(false);
  /** Card IDs currently shown as holo on the bench before removal (PAP success animation). */
  const [alchemyPunchHoloCardIds, setAlchemyPunchHoloCardIds] = useState<string[]>([]);
  /** Card IDs that just failed PAP — show red glow, then clear. */
  const [alchemyPunchFailedCardIds, setAlchemyPunchFailedCardIds] = useState<string[]>([]);
  const [alchemyErrorFading, setAlchemyErrorFading] = useState(false);
  const alchemyErrorClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quicksellBenchSlots, setQuicksellBenchSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [quicksellVendingId, setQuicksellVendingId] = useState<string | null>(null);
  const [quicksellError, setQuicksellError] = useState("");
  /** Fetched from /api/settings/quicksell so display reflects admin-configured prices. */
  const [quicksellPrices, setQuicksellPrices] = useState<{ quicksellUncommon: number; quicksellRare: number; quicksellEpic: number } | null>(null);
  const [stardustDelta, setStardustDelta] = useState<number | null>(null);
  const [stardustAnimClass, setStardustAnimClass] = useState("");
  const stardustPrevRef = useRef<number>(0);
  const stardustInitializedRef = useRef(false);
  const stardustAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prisms, setPrisms] = useState(0);
  const [prismDelta, setPrismDelta] = useState<number | null>(null);
  const [prismAnimClass, setPrismAnimClass] = useState("");
  const prismPrevRef = useRef<number>(0);
  const prismInitializedRef = useRef(false);
  const prismAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [alchemySettings, setAlchemySettings] = useState<{
    prismTransmuteEpicHoloCount: number;
    prismTransmuteSuccessChance: number;
    prismsPerTransmute: number;
    prismaticCraftBaseChance: number;
    prismaticCraftChancePerPrism: number;
    prismaticCraftMaxPrisms: number;
    prismaticCraftFailureStardust: number;
    epicHoloForgePrisms: number;
    holoUpgradeChance: number;
    prismaticUpgradeChance: number;
    darkMatterUpgradeChance: number;
  } | null>(null);
  const [prismaticCraftCardId, setPrismaticCraftCardId] = useState<string | null>(null);
  const [prismaticCraftPrisms, setPrismaticCraftPrisms] = useState(1);
  const [prismaticCraftLoading, setPrismaticCraftLoading] = useState(false);
  const [disenchantEpicForgeLoading, setDisenchantEpicForgeLoading] = useState(false);
  const [prismaticCraftResult, setPrismaticCraftResult] = useState<{ success: boolean; stardustAwarded: number } | null>(null);
  const [alchemySubTab, setAlchemySubTab] = useState<"bench" | "forge">("bench");
  const incomingTradeIdsRef = useRef<Set<string>>(new Set());
  const tradesPollInitializedRef = useRef(false);
  const acceptedSentTradeIdsRef = useRef<Set<string>>(new Set());
  const acceptedSentPollInitializedRef = useRef(false);

  const [discoveredCharacterIds, setDiscoveredCharacterIds] = useState<Set<string>>(new Set());
  const [discoveredHoloCharacterIds, setDiscoveredHoloCharacterIds] = useState<Set<string>>(new Set());
  const [discoveredPrismaticCharacterIds, setDiscoveredPrismaticCharacterIds] = useState<Set<string>>(new Set());
  const [discoveredDarkMatterCharacterIds, setDiscoveredDarkMatterCharacterIds] = useState<Set<string>>(new Set());
  const [discoveredAltArtCharacterIds, setDiscoveredAltArtCharacterIds] = useState<Set<string>>(new Set());
  const [discoveredAltArtHoloCharacterIds, setDiscoveredAltArtHoloCharacterIds] = useState<Set<string>>(new Set());
  const [discoveredBoysCharacterIds, setDiscoveredBoysCharacterIds] = useState<Set<string>>(new Set());
  const [showCodexUploadModal, setShowCodexUploadModal] = useState(false);
  const [codexUploadSelectedIds, setCodexUploadSelectedIds] = useState<Set<string>>(new Set());
  const [codexUploading, setCodexUploading] = useState(false);
  const [codexUploadProgress, setCodexUploadProgress] = useState(0);
  const [newlyUploadedToCodexCharacterIds, setNewlyUploadedToCodexCharacterIds] = useState<Set<string>>(new Set());
  const [codexUploadCompleteCount, setCodexUploadCompleteCount] = useState<number | null>(null);
  type CodexSortKey = "set" | "name" | "rarity";
  const [codexSort, setCodexSort] = useState<CodexSortKey>("set");
  type CodexUploadSortKey = "rarity" | "set" | "name";
  const [codexUploadSort, setCodexUploadSort] = useState<CodexUploadSortKey>("rarity");
  const [completedBadgeWinnerIds, setCompletedBadgeWinnerIds] = useState<Set<string>>(new Set());
  const [completedHoloBadgeWinnerIds, setCompletedHoloBadgeWinnerIds] = useState<Set<string>>(new Set());
  const [completedPrismaticBadgeWinnerIds, setCompletedPrismaticBadgeWinnerIds] = useState<Set<string>>(new Set());
  const [completedDarkMatterBadgeWinnerIds, setCompletedDarkMatterBadgeWinnerIds] = useState<Set<string>>(new Set());
  const [expandedCodexStack, setExpandedCodexStack] = useState<string | null>(null);
  const [codexSubTab, setCodexSubTab] = useState<CodexSubTab>("codex");
  const [codexInspectClosing, setCodexInspectClosing] = useState(false);
  const [prismaticForgeUnlocked, setPrismaticForgeUnlocked] = useState(false);
  const [showPrestigeCodexConfirm, setShowPrestigeCodexConfirm] = useState(false);
  const [prestigeCodexLoading, setPrestigeCodexLoading] = useState(false);
  const [inspectedCodexCard, setInspectedCodexCard] = useState<{
    id: string;
    rarity: string;
    isFoil: boolean;
    finish?: "normal" | "holo" | "prismatic" | "darkMatter";
    actorName: string;
    characterName: string;
    movieTitle: string;
    profilePath: string;
    cardType?: CardType;
    isAltArt?: boolean;
  } | null>(null);
  const TRACKED_CHARS_KEY = "tcg-tracked-character-ids";
  const MAX_TRACKED = 10;
  const [trackedCharacterIds, setTrackedCharacterIds] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("tcg-tracked-character-ids") : null;
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.slice(0, 10) : []);
    } catch { return new Set(); }
  });
  function toggleTrackCharacter(characterId: string) {
    setTrackedCharacterIds((prev) => {
      const next = new Set(prev);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else if (next.size < MAX_TRACKED) {
        next.add(characterId);
      }
      localStorage.setItem(TRACKED_CHARS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function untrackCharacterId(characterId: string) {
    setTrackedCharacterIds((prev) => {
      if (!prev.has(characterId)) return prev;
      const next = new Set(prev);
      next.delete(characterId);
      localStorage.setItem(TRACKED_CHARS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const CODEX_SOUND_MUTED_KEY = "dabys_codex_sound_muted";
  const [codexSoundMuted, setCodexSoundMuted] = useState<boolean>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(CODEX_SOUND_MUTED_KEY) : null;
      return raw === "1";
    } catch {
      return false;
    }
  });
  function toggleCodexSoundMuted() {
    setCodexSoundMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CODEX_SOUND_MUTED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const codexUploadCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codexLoadingAudioRef = useRef<HTMLAudioElement | null>(null);
  const codexSkipRequestedRef = useRef(false);
  const codexAnimationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabScrollPositions = useRef<Record<string, number>>({});

  const SEEN_CARDS_KEY = "dabys-seen-cards";
  const NEW_CARD_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const [seenCardIds, setSeenCardIds] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(SEEN_CARDS_KEY) : null;
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const markCardSeen = useCallback((cardId: string) => {
    setSeenCardIds((prev) => {
      if (prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.add(cardId);
      try {
        localStorage.setItem(SEEN_CARDS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const hasSoldOutPack = packs.some(
    (p) =>
      p.maxPurchasesPerDay != null &&
      p.maxPurchasesPerDay > 0 &&
      (p.purchasesToday ?? 0) >= p.maxPurchasesPerDay
  );
  const midnightCountdown = useMidnightUTCCountdown(tab === "store" && hasSoldOutPack);
  const [restockCountdownNow, setRestockCountdownNow] = useState(() => Date.now());
  const hasIntervalRestock = packs.some((p) => p.nextRestockAt != null);
  useEffect(() => {
    if (tab !== "store" || !hasIntervalRestock) return;
    const t = setInterval(() => setRestockCountdownNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tab, hasIntervalRestock]);

  function setPAPFailureErrorAndFade(message: string) {
    if (alchemyErrorClearTimeoutRef.current) {
      clearTimeout(alchemyErrorClearTimeoutRef.current);
      alchemyErrorClearTimeoutRef.current = null;
    }
    setAlchemyErrorFading(false);
    setAlchemyError(message);
    alchemyErrorClearTimeoutRef.current = setTimeout(() => {
      setAlchemyErrorFading(true);
      alchemyErrorClearTimeoutRef.current = setTimeout(() => {
        setAlchemyError("");
        setAlchemyErrorFading(false);
        alchemyErrorClearTimeoutRef.current = null;
      }, 500);
    }, 4500);
  }

  const myListedCardIds = useMemo(() => new Set(
    listings.filter((l) => l.sellerUserId === user?.id).map((l) => l.cardId)
  ), [listings, user?.id]);

  const myTradeBlockCardIds = useMemo(() => new Set(
    tradeBlockEntries.filter((e) => e.userId === user?.id).map((e) => e.cardId)
  ), [tradeBlockEntries, user?.id]);

  const loadData = useCallback(async () => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    const u = JSON.parse(cached) as User;

    const [creditsRes, cardsRes, poolRes, listingsRes, ordersRes, winnersRes, attemptsRes, packsRes, tradesRes, acceptedTradesRes, deniedTradesRes, usersRes, stardustRes, shopItemsRes, codexRes, badgeProgressRes, quicksellPricesRes, settingsRes, tradeBlockRes, prismsRes, alchemySettingsRes] = await Promise.all([
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/cards/character-pool?codex=1"),
      fetch("/api/marketplace"),
      fetch("/api/marketplace/orders"),
      fetch("/api/winners"),
      fetch(`/api/trivia/attempts?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards/packs?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/trades?userId=${encodeURIComponent(u.id)}&status=pending`),
      fetch(`/api/trades?userId=${encodeURIComponent(u.id)}&status=accepted`),
      fetch(`/api/trades?userId=${encodeURIComponent(u.id)}&status=denied`),
      fetch("/api/users?includeProfile=1"),
      fetch(`/api/alchemy/stardust?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/shop/items"),
      fetch(`/api/cards/codex?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards/badge-progress?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/settings/quicksell"),
      fetch("/api/settings"),
      fetch("/api/trade-block"),
      fetch(`/api/alchemy/prisms?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/admin/alchemy-settings"),
    ]);

    if (creditsRes.ok) {
      const d = await creditsRes.json();
      if (typeof d?.balance === "number") setCreditBalance(d.balance);
    }
    if (cardsRes.ok) setCards(await cardsRes.json());
    if (poolRes.ok) {
      const poolData = await poolRes.json();
      setPoolCount(poolData?.count ?? 0);
      setPoolEntries(poolData?.pool ?? []);
    }
    if (listingsRes.ok) setListings(await listingsRes.json());
    if (ordersRes.ok) setBuyOrders(await ordersRes.json());
    if (winnersRes.ok) {
      const w: Winner[] = await winnersRes.json();
      setWinners(w.filter((x) => x.tmdbId));
    }
    if (attemptsRes.ok) {
      const att: { attempts: { winnerId: string }[] } = await attemptsRes.json();
      setTriviaCompletedIds(new Set((att.attempts || []).map((a) => a.winnerId)));
    }
    if (packsRes.ok) {
      const d = await packsRes.json();
      setPacks(d.packs || []);
    }
    if (tradesRes.ok) setTrades(await tradesRes.json());
    let acceptedList: TradeOfferEnriched[] = [];
    if (acceptedTradesRes.ok) {
      acceptedList = (await acceptedTradesRes.json()) as TradeOfferEnriched[];
      const sentAcceptedIds = new Set(
        (acceptedList || []).filter((t) => t.initiatorUserId === u.id).map((t) => t.id)
      );
      if (!acceptedSentPollInitializedRef.current) {
        acceptedSentPollInitializedRef.current = true;
        acceptedSentTradeIdsRef.current = sentAcceptedIds;
      } else {
        const prev = acceptedSentTradeIdsRef.current;
        const hasNewAccepted = [...sentAcceptedIds].some((id) => !prev.has(id));
        if (hasNewAccepted) playTradeAcceptSound();
        acceptedSentTradeIdsRef.current = sentAcceptedIds;
      }
    }
    let deniedList: TradeOfferEnriched[] = [];
    if (deniedTradesRes.ok) deniedList = (await deniedTradesRes.json()) as TradeOfferEnriched[];
    setTradeHistory(
      [...acceptedList, ...deniedList].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
    if (usersRes.ok) {
      const usersWithProfile = await usersRes.json() as { id: string; name: string; avatarUrl?: string }[];
      setUserAvatarMap(usersWithProfile.reduce((acc, x) => ({ ...acc, [x.id]: x.avatarUrl || "" }), {}));
    }
    if (stardustRes.ok) {
      const d = await stardustRes.json();
      const newBalance = typeof d?.balance === "number" ? d.balance : 0;
      const prev = stardustPrevRef.current;
      stardustPrevRef.current = newBalance;
      setStardust(newBalance);
      if (stardustInitializedRef.current) {
        const delta = newBalance - prev;
        if (delta !== 0) {
          stardustAnimTimeoutRef.current && clearTimeout(stardustAnimTimeoutRef.current);
          setStardustDelta(delta);
          setStardustAnimClass(delta > 0 ? "stardust-animate-add" : "stardust-animate-subtract");
          stardustAnimTimeoutRef.current = setTimeout(() => {
            setStardustDelta(null);
            setStardustAnimClass("");
            stardustAnimTimeoutRef.current = null;
          }, 900);
        }
      }
      stardustInitializedRef.current = true;
    }
    if (prismsRes.ok) {
      const d = await prismsRes.json();
      const newBalance = typeof d?.balance === "number" ? d.balance : 0;
      const prev = prismPrevRef.current;
      prismPrevRef.current = newBalance;
      setPrisms(newBalance);
      if (prismInitializedRef.current) {
        const delta = newBalance - prev;
        if (delta !== 0) {
          prismAnimTimeoutRef.current && clearTimeout(prismAnimTimeoutRef.current);
          setPrismDelta(delta);
          setPrismAnimClass(delta > 0 ? "stardust-animate-add" : "stardust-animate-subtract");
          prismAnimTimeoutRef.current = setTimeout(() => {
            setPrismDelta(null);
            setPrismAnimClass("");
            prismAnimTimeoutRef.current = null;
          }, 900);
        }
      }
      prismInitializedRef.current = true;
    }
    if (alchemySettingsRes.ok) {
      const d = await alchemySettingsRes.json();
      setAlchemySettings(d);
    }
    if (shopItemsRes.ok) {
      const d = await shopItemsRes.json();
      setShopItems(d.items ?? []);
    }
    if (quicksellPricesRes.ok) {
      const d = await quicksellPricesRes.json();
      if (typeof d?.quicksellUncommon === "number" && typeof d?.quicksellRare === "number" && typeof d?.quicksellEpic === "number") {
        setQuicksellPrices({ quicksellUncommon: d.quicksellUncommon, quicksellRare: d.quicksellRare, quicksellEpic: d.quicksellEpic });
      }
    }
    if (codexRes.ok) {
      const d = await codexRes.json();
      setDiscoveredCharacterIds(new Set(Array.isArray(d.characterIds) ? d.characterIds : []));
      setDiscoveredHoloCharacterIds(new Set(Array.isArray(d.holoCharacterIds) ? d.holoCharacterIds : []));
      setDiscoveredPrismaticCharacterIds(new Set(Array.isArray(d.prismaticCharacterIds) ? d.prismaticCharacterIds : []));
      setDiscoveredDarkMatterCharacterIds(new Set(Array.isArray(d.darkMatterCharacterIds) ? d.darkMatterCharacterIds : []));
      setDiscoveredAltArtCharacterIds(new Set(Array.isArray(d.altArtCharacterIds) ? d.altArtCharacterIds : []));
      setDiscoveredAltArtHoloCharacterIds(new Set(Array.isArray(d.altArtHoloCharacterIds) ? d.altArtHoloCharacterIds : []));
      setDiscoveredBoysCharacterIds(new Set(Array.isArray(d.boysCharacterIds) ? d.boysCharacterIds : []));
      setPrismaticForgeUnlocked(d.prismaticForgeUnlocked === true);
    }
    if (badgeProgressRes.ok) {
      const d = await badgeProgressRes.json();
      setCompletedBadgeWinnerIds(new Set(Array.isArray(d.completedWinnerIds) ? d.completedWinnerIds : []));
      setCompletedHoloBadgeWinnerIds(new Set(Array.isArray(d.completedHoloWinnerIds) ? d.completedHoloWinnerIds : []));
      setCompletedPrismaticBadgeWinnerIds(new Set(Array.isArray(d.completedPrismaticWinnerIds) ? d.completedPrismaticWinnerIds : []));
      setCompletedDarkMatterBadgeWinnerIds(new Set(Array.isArray(d.completedDarkMatterWinnerIds) ? d.completedDarkMatterWinnerIds : []));
    }
    if (settingsRes.ok) {
      const d = await settingsRes.json();
      setMarketplaceEnabled(d.marketplaceEnabled ?? true);
    }
    if (tradeBlockRes.ok) {
      const d = await tradeBlockRes.json();
      setTradeBlockEntries(d.entries ?? []);
    }
  }, []);

  const getUserId = useCallback((): string | null => {
    try {
      const cached = localStorage.getItem("dabys_user");
      if (!cached) return null;
      return (JSON.parse(cached) as User).id;
    } catch { return null; }
  }, []);

  const refreshCredits = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const res = await fetch(`/api/credits?userId=${encodeURIComponent(uid)}`);
    if (res.ok) { const d = await res.json(); if (typeof d?.balance === "number") setCreditBalance(d.balance); }
  }, [getUserId]);

  const refreshCards = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const res = await fetch(`/api/cards?userId=${encodeURIComponent(uid)}`);
    if (res.ok) setCards(await res.json());
  }, [getUserId]);

  const refreshStardust = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const res = await fetch(`/api/alchemy/stardust?userId=${encodeURIComponent(uid)}`);
    if (res.ok) {
      const d = await res.json();
      const newBalance = typeof d?.balance === "number" ? d.balance : 0;
      const prev = stardustPrevRef.current;
      stardustPrevRef.current = newBalance;
      setStardust(newBalance);
      if (stardustInitializedRef.current) {
        const delta = newBalance - prev;
        if (delta !== 0) {
          stardustAnimTimeoutRef.current && clearTimeout(stardustAnimTimeoutRef.current);
          setStardustDelta(delta);
          setStardustAnimClass(delta > 0 ? "stardust-animate-add" : "stardust-animate-subtract");
          stardustAnimTimeoutRef.current = setTimeout(() => {
            setStardustDelta(null);
            setStardustAnimClass("");
            stardustAnimTimeoutRef.current = null;
          }, 900);
        }
      }
      stardustInitializedRef.current = true;
    }
  }, [getUserId]);

  const refreshPrisms = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const res = await fetch(`/api/alchemy/prisms?userId=${encodeURIComponent(uid)}`);
    if (res.ok) {
      const d = await res.json();
      const newBalance = typeof d?.balance === "number" ? d.balance : 0;
      const prev = prismPrevRef.current;
      prismPrevRef.current = newBalance;
      setPrisms(newBalance);
      if (prismInitializedRef.current) {
        const delta = newBalance - prev;
        if (delta !== 0) {
          prismAnimTimeoutRef.current && clearTimeout(prismAnimTimeoutRef.current);
          setPrismDelta(delta);
          setPrismAnimClass(delta > 0 ? "stardust-animate-add" : "stardust-animate-subtract");
          prismAnimTimeoutRef.current = setTimeout(() => {
            setPrismDelta(null);
            setPrismAnimClass("");
            prismAnimTimeoutRef.current = null;
          }, 900);
        }
      }
      prismInitializedRef.current = true;
    }
  }, [getUserId]);

  const refreshTrades = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const [tradesRes, acceptedTradesRes, deniedTradesRes] = await Promise.all([
      fetch(`/api/trades?userId=${encodeURIComponent(uid)}&status=pending`),
      fetch(`/api/trades?userId=${encodeURIComponent(uid)}&status=accepted`),
      fetch(`/api/trades?userId=${encodeURIComponent(uid)}&status=denied`),
    ]);
    if (tradesRes.ok) setTrades(await tradesRes.json());
    let acceptedList: TradeOfferEnriched[] = [];
    if (acceptedTradesRes.ok) {
      acceptedList = (await acceptedTradesRes.json()) as TradeOfferEnriched[];
      const sentAcceptedIds = new Set(
        (acceptedList || []).filter((t) => t.initiatorUserId === uid).map((t) => t.id)
      );
      if (!acceptedSentPollInitializedRef.current) {
        acceptedSentPollInitializedRef.current = true;
        acceptedSentTradeIdsRef.current = sentAcceptedIds;
      } else {
        const prevIds = acceptedSentTradeIdsRef.current;
        const hasNewAccepted = [...sentAcceptedIds].some((id) => !prevIds.has(id));
        if (hasNewAccepted) playTradeAcceptSound();
        acceptedSentTradeIdsRef.current = sentAcceptedIds;
      }
    }
    let deniedList: TradeOfferEnriched[] = [];
    if (deniedTradesRes.ok) deniedList = (await deniedTradesRes.json()) as TradeOfferEnriched[];
    setTradeHistory(
      [...acceptedList, ...deniedList].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }, [getUserId]);

  const refreshMarketplace = useCallback(async () => {
    const res = await fetch("/api/marketplace");
    if (res.ok) setListings(await res.json());
  }, []);

  const refreshMarketplaceOrders = useCallback(async () => {
    const res = await fetch("/api/marketplace/orders");
    if (res.ok) setBuyOrders(await res.json());
  }, []);

  const refreshPacks = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const res = await fetch(`/api/cards/packs?userId=${encodeURIComponent(uid)}`);
    if (res.ok) { const d = await res.json(); setPacks(d.packs || []); }
  }, [getUserId]);

  const refreshCodex = useCallback(async () => {
    const uid = getUserId();
    if (!uid) return;
    const [codexRes, badgeProgressRes] = await Promise.all([
      fetch(`/api/cards/codex?userId=${encodeURIComponent(uid)}`),
      fetch(`/api/cards/badge-progress?userId=${encodeURIComponent(uid)}`),
    ]);
    if (codexRes.ok) {
      const d = await codexRes.json();
      setDiscoveredCharacterIds(new Set(Array.isArray(d.characterIds) ? d.characterIds : []));
      setDiscoveredHoloCharacterIds(new Set(Array.isArray(d.holoCharacterIds) ? d.holoCharacterIds : []));
      setDiscoveredPrismaticCharacterIds(new Set(Array.isArray(d.prismaticCharacterIds) ? d.prismaticCharacterIds : []));
      setDiscoveredDarkMatterCharacterIds(new Set(Array.isArray(d.darkMatterCharacterIds) ? d.darkMatterCharacterIds : []));
      setDiscoveredAltArtCharacterIds(new Set(Array.isArray(d.altArtCharacterIds) ? d.altArtCharacterIds : []));
      setDiscoveredAltArtHoloCharacterIds(new Set(Array.isArray(d.altArtHoloCharacterIds) ? d.altArtHoloCharacterIds : []));
      setDiscoveredBoysCharacterIds(new Set(Array.isArray(d.boysCharacterIds) ? d.boysCharacterIds : []));
      setPrismaticForgeUnlocked(d.prismaticForgeUnlocked === true);
    }
    if (badgeProgressRes.ok) {
      const d = await badgeProgressRes.json();
      setCompletedBadgeWinnerIds(new Set(Array.isArray(d.completedWinnerIds) ? d.completedWinnerIds : []));
      setCompletedHoloBadgeWinnerIds(new Set(Array.isArray(d.completedHoloWinnerIds) ? d.completedHoloWinnerIds : []));
      setCompletedPrismaticBadgeWinnerIds(new Set(Array.isArray(d.completedPrismaticWinnerIds) ? d.completedPrismaticWinnerIds : []));
      setCompletedDarkMatterBadgeWinnerIds(new Set(Array.isArray(d.completedDarkMatterWinnerIds) ? d.completedDarkMatterWinnerIds : []));
    }
  }, [getUserId]);

  const refreshShop = useCallback(async () => {
    const res = await fetch("/api/shop/items");
    if (res.ok) { const d = await res.json(); setShopItems(d.items ?? []); }
  }, []);

  const refreshTradeBlock = useCallback(async () => {
    const res = await fetch("/api/trade-block");
    if (res.ok) { const d = await res.json(); setTradeBlockEntries(d.entries ?? []); }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    let u: User;
    try {
      u = JSON.parse(cached);
      setUser(u);
    } catch {
      router.replace("/login");
      return;
    }
    loadData().finally(() => setLoading(false));
  }, [router, loadData]);

  useEffect(() => {
    if (searchParams.get("alchemy") === "1") {
      setTab("inventory");
      setInventorySubTab("alchemy");
    }
    if (searchParams.get("quicksell") === "1") {
      setTab("inventory");
      setInventorySubTab("quicksell");
    }

    // Deep-link: open Trade tab and expand a specific trade (e.g. from notification)
    const tradeIdFromUrl = searchParams.get("trade");
    if (tradeIdFromUrl) {
      setTab("trade");
      setUrlTradeId(tradeIdFromUrl);
    }

    // Deep-link: open trade modal pre-selecting a counterparty
    const tradeWithId = searchParams.get("tradeWith");
    if (tradeWithId && user) {
      setTab("trade");
      setEditingTradeId(null);
      setShowTradeModal(true);
      setTradeStep(1);
      setTradeOfferedIds(new Set());
      setTradeRequestedIds(new Set());
      setTradeOfferedCredits(0);
      setTradeRequestedCredits(0);
      setCounterpartyCards([]);
      setTradeError("");
      fetch("/api/users?includeProfile=1")
        .then((r) => r.json())
        .then((data: UserWithAvatar[]) => {
          const others = data.filter((u) => u.id !== user.id);
          setTradeUsers(others);
          const target = others.find((u) => u.id === tradeWithId);
          if (target) {
            setTradeCounterparty(target);
            setTradeStep(2);
          }
        })
        .catch(() => setTradeUsers([]));
    }
  }, [searchParams, user?.id]);

  // When trades have loaded and we have a URL trade id, expand that trade
  useEffect(() => {
    if (!urlTradeId || !user?.id || trades.length === 0) return;
    const t = trades.find((x) => x.id === urlTradeId);
    if (t) {
      if (t.counterpartyUserId === user.id) {
        setExpandedReceivedTradeId(urlTradeId);
      } else if (t.initiatorUserId === user.id) {
        setExpandedSentTradeId(urlTradeId);
      }
    }
    setUrlTradeId(null);
  }, [trades, urlTradeId, user?.id]);

  // Restore last selected tab when returning to TCG page
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TCG_TAB_STORAGE_KEY);
      if (saved && TAB_KEYS.includes(saved as TabKey)) setTab(saved as TabKey);
    } catch {
      /* ignore */
    }
  }, []);

  // If marketplace gets disabled while user is on that tab, switch them to store
  useEffect(() => {
    if (!marketplaceEnabled && tab === "marketplace") {
      setTab("store");
    }
  }, [marketplaceEnabled, tab]);

  // Remember current tab when it changes (skip first run on mount so we don't overwrite restored value)
  const isFirstTabEffectRun = useRef(true);
  useEffect(() => {
    if (isFirstTabEffectRun.current) {
      isFirstTabEffectRun.current = false;
      return;
    }
    try {
      sessionStorage.setItem(TCG_TAB_STORAGE_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    const handler = () => { refreshCredits(); };
    window.addEventListener("dabys-credits-refresh", handler);
    return () => window.removeEventListener("dabys-credits-refresh", handler);
  }, [refreshCredits]);

  // Keep incoming-trade refs in sync and notify header (red dot); sound only on accept
  useEffect(() => {
    if (!user) return;
    const incoming = trades.filter((t) => t.counterpartyUserId === user.id);
    const ids = new Set(incoming.map((t) => t.id));
    if (!tradesPollInitializedRef.current) {
      tradesPollInitializedRef.current = true;
      incomingTradeIdsRef.current = ids;
      window.dispatchEvent(new CustomEvent("dabys-incoming-trades", { detail: { hasIncoming: incoming.length > 0 } }));
      return;
    }
    incomingTradeIdsRef.current = ids;
    window.dispatchEvent(new CustomEvent("dabys-incoming-trades", { detail: { hasIncoming: incoming.length > 0 } }));
  }, [trades, user]);

  // Listen for trade poll events from Header (single source of polling) and also poll accepted trades
  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    const u = JSON.parse(cached) as { id: string };
    const onTradesPoll = (e: Event) => {
      const detail = (e as CustomEvent<{ pending: TradeOfferEnriched[] }>).detail;
      if (detail?.pending) setTrades(Array.isArray(detail.pending) ? detail.pending : []);
    };
    const checkAccepted = () => {
      fetch(`/api/trades?userId=${encodeURIComponent(u.id)}&status=accepted`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: TradeOfferEnriched[]) => {
          const list = Array.isArray(data) ? data : [];
          const sentAcceptedIds = new Set(list.filter((t) => t.initiatorUserId === u.id).map((t) => t.id));
          if (!acceptedSentPollInitializedRef.current) {
            acceptedSentPollInitializedRef.current = true;
            acceptedSentTradeIdsRef.current = sentAcceptedIds;
          } else {
            const prev = acceptedSentTradeIdsRef.current;
            const hasNewAccepted = [...sentAcceptedIds].some((id) => !prev.has(id));
            if (hasNewAccepted) playTradeAcceptSound();
            acceptedSentTradeIdsRef.current = sentAcceptedIds;
          }
        })
        .catch(() => {});
    };
    checkAccepted();
    let id = setInterval(checkAccepted, 20000);
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        checkAccepted();
        id = setInterval(checkAccepted, 20000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("dabys-trades-poll", onTradesPoll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("dabys-trades-poll", onTradesPoll);
    };
  }, []);

  useEffect(() => {
    return () => {
      stardustAnimTimeoutRef.current && clearTimeout(stardustAnimTimeoutRef.current);
      prismAnimTimeoutRef.current && clearTimeout(prismAnimTimeoutRef.current);
      codexUploadCompleteTimeoutRef.current && clearTimeout(codexUploadCompleteTimeoutRef.current);
    };
  }, []);

  const tradeUpHasResult = tradeUpResult || tradeUpResultCredits != null;
  useEffect(() => {
    if (!tradeUpHasResult) return;
    setTradeUpResultFading(false);
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    const fadeTimer = setTimeout(() => {
      setTradeUpResultFading(true);
      clearTimer = setTimeout(() => {
        setTradeUpResult(null);
        setTradeUpResultCredits(null);
        setTradeUpResultFading(false);
      }, 500);
    }, 5000);
    return () => {
      clearTimeout(fadeTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [tradeUpHasResult]);

  useEffect(() => {
    if (!newCards || newCards.length === 0) {
      setRevealCount(0);
      return;
    }
    setRevealCount(0);
    let trackedSoundPlayed = false;
    newCards.forEach((card, idx) => {
      const delay = idx * 220;
      setTimeout(() => {
        setRevealCount((prev) => {
          const next = prev < idx + 1 ? idx + 1 : prev;
          if (next === idx + 1) {
            const isTrackedPull = card.characterId && trackedCharacterIds.has(card.characterId);
            if (isTrackedPull && !trackedSoundPlayed) {
              trackedSoundPlayed = true;
              void playTrackedFoundSound();
            } else {
              void playPackFlipSound(idx);
            }
          }
          return next;
        });
      }, delay);
    });
  }, [newCards]);

  // Lock body scroll when pack reveal is open so the page underneath doesn't scroll (fixes mobile overlap/input issues)
  useEffect(() => {
    if (!newCards || newCards.length === 0) return;
    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevLeft = document.body.style.left;
    const prevRight = document.body.style.right;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.left = prevLeft;
      document.body.style.right = prevRight;
      window.scrollTo(0, scrollY);
    };
  }, [newCards]);

  const TRADE_UP_NEXT: Record<string, string> = { uncommon: "rare", rare: "epic", epic: "legendary" };
  const SLOT_EMPTY_STYLE: Record<string, string> = {
    uncommon: "border-dashed border-green-500/40 bg-white/[0.04] hover:border-green-500/60 hover:bg-white/[0.06]",
    rare: "border-dashed border-blue-500/40 bg-white/[0.04] hover:border-blue-500/60 hover:bg-white/[0.06]",
    epic: "border-dashed border-purple-500/40 bg-white/[0.04] hover:border-purple-500/60 hover:bg-white/[0.06]",
    legendary: "border-dashed border-amber-500/40 bg-white/[0.04] hover:border-amber-500/60 hover:bg-white/[0.06]",
  };
  const SLOT_OUTPUT_STYLE: Record<string, string> = {
    uncommon: "border-blue-500/50 bg-white/[0.04]",
    rare: "border-purple-500/50 bg-white/[0.04]",
    epic: "border-amber-500/50 bg-white/[0.04]",
    legendary: "border-amber-500/60 bg-white/[0.04]",
  };
  const SLOT_FILLED_STYLE: Record<string, string> = {
    uncommon: "border-green-500/50 bg-green-500/10 hover:border-green-500/70",
    rare: "border-blue-500/50 bg-blue-500/10 hover:border-blue-500/70",
    epic: "border-purple-500/50 bg-purple-500/10 hover:border-purple-500/70",
    legendary: "border-amber-500/50 bg-amber-500/10 hover:border-amber-500/70",
  };
  const tradeUpCardIds = tradeUpSlots.filter((id): id is string => id != null);
  const tradeUpCards = cards.filter((c) => c.id && tradeUpCardIds.includes(c.id));
  const currentRarity = tradeUpCards[0]?.rarity;
  const canTradeUp =
    tradeUpCardIds.length === 4 &&
    tradeUpCards.length === 4 &&
    tradeUpCards.every((c) => c.rarity === tradeUpCards[0]?.rarity) &&
    tradeUpCards.every((c) => (c.cardType ?? "actor") === (tradeUpCards[0]?.cardType ?? "actor")) &&
    TRADE_UP_NEXT[tradeUpCards[0]?.rarity || ""];

  async function handleTradeUp() {
    if (!user || !canTradeUp || tradingUp) return;
    playTradeUpSubmit();
    setTradingUp(true);
    try {
      const payload = { userId: user.id, cardIds: tradeUpCardIds };
      const res = await fetch("/api/cards/trade-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        playTradeUpReveal();
        if (tradeUpAutofillErrorTimeoutRef.current) {
          clearTimeout(tradeUpAutofillErrorTimeoutRef.current);
          tradeUpAutofillErrorTimeoutRef.current = null;
        }
        setTradeUpAutofillError("");
        setTradeUpAutofillErrorFading(false);
        setTradeUpSlots([null, null, null, null]);
        if (data.card) {
          setTradeUpResult(data.card);
          setTradeUpResultCredits(null);
        } else if (typeof data.credits === "number") {
          setTradeUpResult(null);
          setTradeUpResultCredits(data.credits);
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: data.credits } }));
        }
        await Promise.all([refreshCards(), refreshCredits(), refreshStardust()]);
      } else {
        alert(data.error || "Trade up failed");
      }
    } catch (e) {
      alert("Trade up failed");
    } finally {
      setTradingUp(false);
    }
  }

  function addToTradeUpSlot(cardId: string) {
    if (tradeUpAutofillErrorTimeoutRef.current) {
      clearTimeout(tradeUpAutofillErrorTimeoutRef.current);
      tradeUpAutofillErrorTimeoutRef.current = null;
    }
    setTradeUpAutofillError("");
    setTradeUpAutofillErrorFading(false);
    if (myListedCardIds.has(cardId)) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.rarity === "legendary") {
      setLegendaryBlockShown(true);
      setTimeout(() => setLegendaryBlockShown(false), 2500);
      return;
    }
    const filled = tradeUpSlots.filter((id): id is string => id != null);
    if (filled.includes(cardId)) return;
    if (filled.length >= 4) return;
    const firstCard = filled[0] ? cards.find((c) => c.id === filled[0]) : null;
    if (firstCard && card.rarity !== firstCard.rarity) return;
    playTradeUpAdd();
    setTradeUpSlots((prev) => {
      const next = [...prev];
      const idx = next.findIndex((id) => id == null);
      if (idx >= 0) next[idx] = cardId;
      return next;
    });
  }

  function removeFromTradeUpSlot(cardId: string) {
    if (tradeUpAutofillErrorTimeoutRef.current) {
      clearTimeout(tradeUpAutofillErrorTimeoutRef.current);
      tradeUpAutofillErrorTimeoutRef.current = null;
    }
    setTradeUpAutofillError("");
    setTradeUpAutofillErrorFading(false);
    setTradeUpSlots((prev) => prev.map((id) => (id === cardId ? null : id)));
  }

  const RARITY_ORDER = ["uncommon", "rare", "epic"] as const;

  function getTradeUpEligible(codexOnly: boolean, cardPool: Card[] = cards) {
    const filled = tradeUpSlots.filter((id): id is string => id != null);
    const firstCard = filled[0] ? cards.find((c) => c.id === filled[0]) : null;
    const targetRarity = firstCard?.rarity;
    const targetCardType = firstCard ? (firstCard.cardType ?? "actor") : null;
    return cardPool.filter((c) =>
      c.id &&
      !myListedCardIds.has(c.id) &&
      c.rarity !== "legendary" &&
      !filled.includes(c.id) &&
      (!codexOnly || isCardSlotAlreadyInCodex(c)) &&
      (!targetRarity || c.rarity === targetRarity) &&
      (!targetCardType || (c.cardType ?? "actor") === targetCardType)
    );
  }

  function findBestGroup(eligible: Card[], slotsNeeded: number): Card[] {
    const groups = new Map<string, Card[]>();
    for (const c of eligible) {
      const key = `${c.rarity}:${c.cardType ?? "actor"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    for (const r of RARITY_ORDER) {
      for (const [key, group] of groups) {
        if (key.startsWith(r + ":") && group.length >= slotsNeeded) return group.slice(0, slotsNeeded);
      }
    }
    return [];
  }

  function canCodexdFillTradeUp(): boolean {
    const filled = tradeUpSlots.filter((id): id is string => id != null);
    if (filled.length >= 4) return false;
    const slotsNeeded = 4 - filled.length;
    const eligible = getTradeUpEligible(true, filteredInventoryCards);
    if (filled.length > 0) return eligible.length >= slotsNeeded;
    return findBestGroup(eligible, 4).length >= 4;
  }

  function fillTradeUpWithCodexd() {
    const filled = tradeUpSlots.filter((id): id is string => id != null);
    if (filled.length >= 4) return;
    const slotsNeeded = 4 - filled.length;
    const eligible = getTradeUpEligible(true, filteredInventoryCards);
    let toAdd: Card[];
    if (filled.length > 0) {
      if (eligible.length < slotsNeeded) return;
      toAdd = eligible.slice(0, slotsNeeded);
    } else {
      toAdd = findBestGroup(eligible, 4);
      if (toAdd.length < 4) return;
    }
    setTradeUpSlots((prev) => {
      const next = [...prev];
      for (const card of toAdd) {
        const idx = next.findIndex((id) => id == null);
        if (idx >= 0) next[idx] = card.id!;
      }
      return next;
    });
  }

  function setTradeUpAutofillErrorWithFade(message: string) {
    if (tradeUpAutofillErrorTimeoutRef.current) {
      clearTimeout(tradeUpAutofillErrorTimeoutRef.current);
      tradeUpAutofillErrorTimeoutRef.current = null;
    }
    setTradeUpAutofillErrorFading(false);
    setTradeUpAutofillError(message);
    tradeUpAutofillErrorTimeoutRef.current = setTimeout(() => {
      setTradeUpAutofillErrorFading(true);
      tradeUpAutofillErrorTimeoutRef.current = setTimeout(() => {
        setTradeUpAutofillError("");
        setTradeUpAutofillErrorFading(false);
        tradeUpAutofillErrorTimeoutRef.current = null;
      }, 500);
    }, 3000);
  }

  function autoFillTradeUp() {
    if (tradeUpAutofillErrorTimeoutRef.current) {
      clearTimeout(tradeUpAutofillErrorTimeoutRef.current);
      tradeUpAutofillErrorTimeoutRef.current = null;
    }
    setTradeUpAutofillError("");
    setTradeUpAutofillErrorFading(false);
    const filled = tradeUpSlots.filter((id): id is string => id != null);
    if (filled.length >= 4) return;
    const slotsNeeded = 4 - filled.length;
    const eligible = getTradeUpEligible(false, filteredInventoryCards);
    let toAdd: Card[];
    if (filled.length > 0) {
      const firstCard = cards.find((c) => c.id === filled[0]);
      const rarity = firstCard?.rarity ?? "matching";
      const cardType = firstCard ? (firstCard.cardType ?? "actor") : "actor";
      if (eligible.length < slotsNeeded) {
        setTradeUpAutofillErrorWithFade(`Not enough eligible cards. Need ${slotsNeeded} more ${rarity} ${cardType} cards. Cards listed on the marketplace or already in slots can't be used.`);
        return;
      }
      toAdd = eligible.slice(0, slotsNeeded);
    } else {
      toAdd = findBestGroup(eligible, 4);
      if (toAdd.length < 4) {
        setTradeUpAutofillErrorWithFade("No trade-up possible. You need 4 cards of the same rarity (uncommon, rare, or epic) and same type. Legendary cards and cards listed on the marketplace can't be used.");
        return;
      }
    }
    setTradeUpSlots((prev) => {
      const next = [...prev];
      for (const card of toAdd) {
        const idx = next.findIndex((id) => id == null);
        if (idx >= 0) next[idx] = card.id!;
      }
      return next;
    });
  }

  const legendaryRerollCardIds = legendaryRerollSlots.filter((id): id is string => id != null);
  const legendaryRerollCards = cards.filter((c) => c.id && legendaryRerollCardIds.includes(c.id));
  const showLegendaryReroll = legendaryRerollCardIds.length > 0 || legendaryBlockShown;
  const canLegendaryReroll =
    legendaryRerollCardIds.length === 2 &&
    legendaryRerollCards.length === 2 &&
    legendaryRerollCards.every((c) => c.rarity === "legendary") &&
    legendaryRerollCards.every((c) => (c.cardType ?? "actor") === (legendaryRerollCards[0]?.cardType ?? "actor"));

  function addToLegendaryReroll(cardId: string) {
    if (myListedCardIds.has(cardId)) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.rarity !== "legendary") return;
    const filled = legendaryRerollSlots.filter((id): id is string => id != null);
    if (filled.includes(cardId)) return;
    if (filled.length >= 2) return;
    const firstCard = filled[0] ? cards.find((c) => c.id === filled[0]) : null;
    if (firstCard && (card.cardType ?? "actor") !== (firstCard.cardType ?? "actor")) return;
    playTradeUpAdd();
    setLegendaryRerollSlots((prev) => {
      const next = [...prev];
      const idx = next.findIndex((id) => id == null);
      if (idx >= 0) next[idx] = cardId;
      return next;
    });
  }

  function removeFromLegendaryReroll(cardId: string) {
    setLegendaryRerollSlots((prev) => prev.map((id) => (id === cardId ? null : id)));
  }

  async function handleLegendaryReroll() {
    if (!user || !canLegendaryReroll || legendaryRerolling) return;
    playTradeUpSubmit();
    setLegendaryRerolling(true);
    try {
      const res = await fetch("/api/cards/legendary-reroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardIds: legendaryRerollCardIds }),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        playTradeUpReveal();
        setLegendaryRerollSlots([null, null]);
        setLegendaryRerollResult(data.card);
        await Promise.all([refreshCards(), refreshCredits(), refreshStardust()]);
      } else {
        alert(data.error || "Legendary reroll failed");
      }
    } catch {
      alert("Legendary reroll failed");
    } finally {
      setLegendaryRerolling(false);
    }
  }

  function getDustForRarity(rarity: string): number {
    return DISENCHANT_DUST[rarity] ?? 0;
  }

  async function handleAlchemyDisenchant(card: Card) {
    if (!user) return;
    const dust = getDustForRarity(card.rarity);
    if (!confirm(`Remove Holo for ${dust} Stardust? The card stays in your collection as a normal card.`)) return;
    setAlchemyError("");
    setAlchemyDisenchantingId(card.id);
    try {
      const res = await fetch("/api/alchemy/disenchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardId: card.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlchemyErrorFading(false);
        setAlchemyError(data?.error ?? "Remove Holo failed");
        return;
      }
      playAlchemyDisenchantSuccess();
      setAlchemySuccessFlash(true);
      setTimeout(() => setAlchemySuccessFlash(false), 500);
      setAlchemyBenchSlots((prev) => prev.map((id) => (id === card.id ? null : id)));
      await Promise.all([refreshCards(), refreshStardust()]);
    } finally {
      setAlchemyDisenchantingId(null);
    }
  }

  async function handleAlchemyPackAPunch(card: Card) {
    if (!user) return;
    const cost = getPackAPunchCost(card.rarity);
    if (stardust < cost) {
      setAlchemyErrorFading(false);
      setAlchemyError(`You need ${cost} Stardust. You have ${stardust}.`);
      return;
    }
    if (!confirm(`Spend ${cost} Stardust to attempt Pack-A-Punch? 50% success rate — Stardust is consumed either way.`)) return;
    setAlchemyError("");
    setAlchemyPunchingId(card.id);
    try {
      const res = await fetch("/api/alchemy/pack-a-punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardId: card.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlchemyErrorFading(false);
        setAlchemyError(data?.error ?? "Pack-A-Punch failed");
        return;
      }
      if (data.success) {
        playAlchemyPackAPunchSuccess();
        setAlchemyPunchHoloCardIds([card.id]);
        setTimeout(() => {
          setAlchemyBenchSlots((prev) => prev.map((id) => (id === card.id ? null : id)));
          setAlchemyPunchHoloCardIds([]);
          Promise.all([refreshCards(), refreshStardust()]);
        }, 1100);
      } else {
        setAlchemyPunchFailedCardIds([card.id]);
        setPAPFailureErrorAndFade("Pack-A-Punch failed — Stardust consumed. Try again!");
        await Promise.all([refreshCards(), refreshStardust()]);
        setTimeout(() => setAlchemyPunchFailedCardIds([]), 900);
      }
    } finally {
      setAlchemyPunchingId(null);
    }
  }

  const alchemyBenchCardIds = alchemyBenchSlots.filter((id): id is string => id != null);
  const alchemyBenchCards = cards.filter((c) => c.id && alchemyBenchCardIds.includes(c.id));
  const alchemyBenchType = alchemyBenchCards[0]?.isFoil === true ? "foil" : alchemyBenchCards[0]?.isFoil === false ? "normal" : null;

  function addToAlchemyBench(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || alchemyBenchCardIds.includes(cardId)) return;
    if (alchemyBenchCardIds.length >= 5) return;
    if (alchemyBenchType !== null && card.isFoil !== (alchemyBenchType === "foil")) return;
    playAlchemyBenchAdd();
    setAlchemyBenchSlots((prev) => {
      const next = [...prev];
      const idx = next.findIndex((id) => id == null);
      if (idx >= 0) next[idx] = cardId;
      return next;
    });
  }

  function removeFromAlchemyBench(cardId: string) {
    setAlchemyBenchSlots((prev) => prev.map((id) => (id === cardId ? null : id)));
    playAlchemyBenchRemove();
  }

  const quicksellBenchCardIds = quicksellBenchSlots.filter((id): id is string => id != null);
  const quicksellBenchCards = cards.filter((c) => c.id && quicksellBenchCardIds.includes(c.id));

  function addToQuicksellBench(cardId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || quicksellBenchCardIds.includes(cardId)) return;
    if (quicksellBenchCardIds.length >= 5) return;
    if (card.rarity === "legendary") return;
    setQuicksellBenchSlots((prev) => {
      const next = [...prev];
      const idx = next.findIndex((id) => id == null);
      if (idx >= 0) next[idx] = cardId;
      return next;
    });
  }

  function removeFromQuicksellBench(cardId: string) {
    setQuicksellBenchSlots((prev) => prev.map((id) => (id === cardId ? null : id)));
  }

  function canCodexdFillQuicksell(): boolean {
    const filled = quicksellBenchSlots.filter((id): id is string => id != null);
    if (filled.length >= 5) return false;
    const slotsNeeded = 5 - filled.length;
    const eligible = filteredInventoryCards.filter((c) =>
      c.id &&
      !myListedCardIds.has(c.id) &&
      c.rarity !== "legendary" &&
      !filled.includes(c.id) &&
      isCardSlotAlreadyInCodex(c)
    );
    return eligible.length >= slotsNeeded;
  }

  function autoFillQuicksell() {
    const filled = quicksellBenchSlots.filter((id): id is string => id != null);
    if (filled.length >= 5) return;
    const eligible = filteredInventoryCards.filter((c) =>
      c.id &&
      !myListedCardIds.has(c.id) &&
      c.rarity !== "legendary" &&
      !filled.includes(c.id)
    );
    const emptyCount = 5 - filled.length;
    const toAdd = eligible.slice(0, emptyCount);
    setQuicksellBenchSlots((prev) => {
      const next = [...prev];
      for (const card of toAdd) {
        const idx = next.findIndex((id) => id == null);
        if (idx >= 0) next[idx] = card.id!;
      }
      return next;
    });
  }

  function fillQuicksellWithCodexd() {
    const filled = quicksellBenchSlots.filter((id): id is string => id != null);
    if (filled.length >= 5) return;
    const eligible = filteredInventoryCards.filter((c) =>
      c.id &&
      !myListedCardIds.has(c.id) &&
      c.rarity !== "legendary" &&
      !filled.includes(c.id) &&
      isCardSlotAlreadyInCodex(c)
    );
    const emptyCount = 5 - filled.length;
    const toAdd = eligible.slice(0, emptyCount);
    setQuicksellBenchSlots((prev) => {
      const next = [...prev];
      for (const card of toAdd) {
        const idx = next.findIndex((id) => id == null);
        if (idx >= 0) next[idx] = card.id!;
      }
      return next;
    });
  }

  /** Credits for quicksell display/confirm: use admin-configured prices when loaded, else defaults. */
  function getQuicksellCreditsForDisplay(rarity: string): number {
    if (rarity === "legendary") return 0;
    if (quicksellPrices) {
      if (rarity === "uncommon") return quicksellPrices.quicksellUncommon;
      if (rarity === "rare") return quicksellPrices.quicksellRare;
      if (rarity === "epic") return quicksellPrices.quicksellEpic;
    }
    return getQuicksellCredits(rarity);
  }

  async function handleQuicksellAll() {
    if (!user || quicksellBenchCards.length === 0) return;
    const totalCr = quicksellBenchCards.reduce((sum, c) => sum + getQuicksellCreditsForDisplay(c.rarity), 0);
    if (!confirm(`Vendor ${quicksellBenchCards.length} card(s) for ${totalCr} credits? This cannot be undone.`)) return;
    setQuicksellError("");
    setQuicksellVendingId("_all");
    try {
      const res = await fetch("/api/alchemy/quicksell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardIds: quicksellBenchCardIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuicksellError(data?.error ?? "Quicksell failed");
        return;
      }
      setQuicksellBenchSlots([null, null, null, null, null]);
      const received = typeof data?.creditsReceived === "number" ? data.creditsReceived : totalCr;
      window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: received } }));
      await Promise.all([refreshCards(), refreshCredits()]);
    } finally {
      setQuicksellVendingId(null);
    }
  }

  async function handleAlchemyDisenchantAll() {
    if (!user || alchemyBenchCards.length === 0) return;
    const totalDust = alchemyBenchCards.reduce((sum, c) => sum + getDustForRarity(c.rarity), 0);
    if (!confirm(`Remove Holo from ${alchemyBenchCards.length} card(s) for ${totalDust} Stardust? Cards stay in your collection as normals.`)) return;
    setAlchemyError("");
    setAlchemyDisenchantingId("_all");
    try {
      for (const card of alchemyBenchCards) {
        const res = await fetch("/api/alchemy/disenchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, cardId: card.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAlchemyErrorFading(false);
          setAlchemyError(data?.error ?? "Remove Holo failed");
          return;
        }
      }
      playAlchemyDisenchantSuccess();
      setAlchemySuccessFlash(true);
      setTimeout(() => setAlchemySuccessFlash(false), 500);
      setAlchemyBenchSlots([null, null, null, null, null]);
      await Promise.all([refreshCards(), refreshStardust()]);
    } finally {
      setAlchemyDisenchantingId(null);
    }
  }

  async function handleAlchemyPackAPunchAll() {
    if (!user || alchemyBenchCards.length === 0) return;
    const totalCost = alchemyBenchCards.reduce((sum, c) => sum + getPackAPunchCost(c.rarity), 0);
    if (stardust < totalCost) {
      setAlchemyErrorFading(false);
      setAlchemyError(`You need ${totalCost} Stardust. You have ${stardust}.`);
      return;
    }
    if (!confirm(`Spend ${totalCost} Stardust to Pack-A-Punch ${alchemyBenchCards.length} card(s)? 50% success per card — Stardust is consumed either way.`)) return;
    setAlchemyError("");
    setAlchemyPunchingId("_all");
    try {
      const succeededIds: string[] = [];
      const failedIds: string[] = [];
      for (const card of alchemyBenchCards) {
        const res = await fetch("/api/alchemy/pack-a-punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, cardId: card.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAlchemyErrorFading(false);
          setAlchemyError(data?.error ?? "Pack-A-Punch failed");
          await Promise.all([refreshCards(), refreshStardust()]);
          return;
        }
        if (data.success) succeededIds.push(card.id);
        else failedIds.push(card.id);
      }
      if (succeededIds.length > 0) {
        playAlchemyPackAPunchSuccess();
        setAlchemyPunchHoloCardIds(succeededIds);
        setTimeout(() => {
          setAlchemyBenchSlots((prev) => prev.map((id) => (id != null && succeededIds.includes(id) ? null : id)));
          setAlchemyPunchHoloCardIds([]);
          Promise.all([refreshCards(), refreshStardust()]);
        }, 1200);
      }
      const failedCount = failedIds.length;
      if (failedCount > 0) {
        setAlchemyPunchFailedCardIds(failedIds);
        setPAPFailureErrorAndFade(`${failedCount} Pack-A-Punch attempt(s) failed — Stardust consumed.`);
        setTimeout(() => setAlchemyPunchFailedCardIds([]), 900);
      }
      if (succeededIds.length === 0 || failedCount > 0) {
        await Promise.all([refreshCards(), refreshStardust()]);
      }
    } finally {
      setAlchemyPunchingId(null);
    }
  }

  // Prismatic craft: apply prisms to craft a prismatic card
  async function handlePrismaticCraft() {
    if (!user || !prismaticCraftCardId || !alchemySettings) return;
    const card = cards.find((c) => c.id === prismaticCraftCardId);
    if (!card) return;
    const amount = prismaticCraftPrisms;
    if (prisms < amount) {
      setAlchemyErrorFading(false);
      setAlchemyError(`Not enough Prisms. Need ${amount}, have ${prisms}.`);
      return;
    }
    const chance = Math.min(100, alchemySettings.prismaticCraftBaseChance + amount * alchemySettings.prismaticCraftChancePerPrism);
    if (!confirm(`Apply ${amount} Prism(s) for a ${chance}% chance to craft Prismatic? Prisms are consumed. Failure awards ${alchemySettings.prismaticCraftFailureStardust} Stardust.`)) return;
    setAlchemyError("");
    setPrismaticCraftLoading(true);
    setPrismaticCraftResult(null);
    try {
      const res = await fetch("/api/alchemy/prismatic-craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardId: prismaticCraftCardId, prismsToApply: amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlchemyErrorFading(false);
        setAlchemyError(data?.error ?? "Prismatic craft failed");
        return;
      }
      setPrismaticCraftResult({ success: data.success, stardustAwarded: data.stardustAwarded ?? 0 });
      if (data.success) {
        playAlchemyPackAPunchSuccess();
        setAlchemySuccessFlash(true);
        setTimeout(() => setAlchemySuccessFlash(false), 500);
        setPrismaticCraftCardId(null);
      } else {
        setPAPFailureErrorAndFade(`Prismatic craft failed — ${data.stardustAwarded ?? 0} Stardust consolation awarded.`);
      }
      await Promise.all([refreshCards(), refreshPrisms(), refreshStardust()]);
    } finally {
      setPrismaticCraftLoading(false);
    }
  }

  // Disenchant one Epic Holo in the forge for prisms (card destroyed)
  async function handleDisenchantEpicForge() {
    if (!user || !prismaticCraftCardId || !alchemySettings) return;
    const card = cards.find((c) => c.id === prismaticCraftCardId);
    if (!card || card.rarity !== "epic") return;
    const amount = alchemySettings.epicHoloForgePrisms ?? 1;
    if (!confirm(`Destroy this Epic Holo for ${amount} Prism(s)? Card is permanently removed.`)) return;
    setAlchemyError("");
    setDisenchantEpicForgeLoading(true);
    try {
      const res = await fetch("/api/alchemy/disenchant-epic-forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardId: prismaticCraftCardId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlchemyErrorFading(false);
        setAlchemyError(data?.error ?? "Disenchant failed");
        return;
      }
      setPrismaticCraftCardId(null);
      setPrismaticCraftResult(null);
      await Promise.all([refreshCards(), refreshPrisms()]);
    } finally {
      setDisenchantEpicForgeLoading(false);
    }
  }

  async function handleBuyPack(pack: Pack) {
    const effectivePrice =
      pack.discounted &&
      typeof pack.discountPercent === "number" &&
      pack.discountPercent > 0
        ? Math.floor(pack.price * (1 - pack.discountPercent / 100))
        : pack.price;
    if (!user || creditBalance < effectivePrice || buyingPackId) return;
    setBuyingPackId(pack.id);
    try {
      const res = await fetch("/api/cards/buy-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, packId: pack.id }),
      });
      const data = await res.json();
      if (res.ok && data.cards) {
        setNewCards(data.cards);
        await Promise.all([refreshCards(), refreshCredits(), refreshPacks()]);
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: -effectivePrice } }));
      } else {
        alert(data.error || "Failed to buy pack");
      }
    } catch {
      alert("Failed to buy pack");
    } finally {
      setBuyingPackId(null);
    }
  }

  function isCardSlotAlreadyInCodex(card: { characterId?: string | null; isFoil?: boolean; finish?: "normal" | "holo" | "prismatic" | "darkMatter" }): boolean {
    if (!card.characterId) return false;
    const entry = poolEntries.find((e) => e.characterId === card.characterId);
    if (!entry) return false;
    const isAltArt = (entry.altArtOfCharacterId ?? null) != null;
    const isBoys = (entry.cardType ?? "actor") === "character" && !isAltArt;
    const isMain = !isAltArt && !isBoys;
    if (isMain) {
      if (!card.isFoil) return discoveredCharacterIds.has(card.characterId);
      const f = card.finish ?? (card.isFoil ? "holo" : "normal");
      if (f === "darkMatter") return discoveredDarkMatterCharacterIds.has(card.characterId);
      if (f === "prismatic") return discoveredPrismaticCharacterIds.has(card.characterId);
      return discoveredHoloCharacterIds.has(card.characterId);
    }
    if (isAltArt) return discoveredAltArtCharacterIds.has(card.characterId);
    if (isBoys) return discoveredBoysCharacterIds.has(card.characterId);
    return false;
  }

  /** True if this is a main foil card, the regular version IS in the codex, and the holo slot is NOT yet filled. */
  function isHoloUpgradeEligible(card: { characterId?: string | null; isFoil?: boolean }): boolean {
    if (!card.characterId || !card.isFoil) return false;
    const entry = poolEntries.find((e) => e.characterId === card.characterId);
    if (!entry) return false;
    const isAltArt = (entry.altArtOfCharacterId ?? null) != null;
    const isBoys = (entry.cardType ?? "actor") === "character" && !isAltArt;
    const isMain = !isAltArt && !isBoys;
    if (!isMain) return false;
    return discoveredCharacterIds.has(card.characterId) && !discoveredHoloCharacterIds.has(card.characterId);
  }

  /** True if this is a main foil card but the regular version is NOT yet in the codex (holo upload blocked). */
  function isHoloMissingRegularPrereq(card: { characterId?: string | null; isFoil?: boolean }): boolean {
    if (!card.characterId || !card.isFoil) return false;
    const entry = poolEntries.find((e) => e.characterId === card.characterId);
    if (!entry) return false;
    const isAltArt = (entry.altArtOfCharacterId ?? null) != null;
    const isBoys = (entry.cardType ?? "actor") === "character" && !isAltArt;
    const isMain = !isAltArt && !isBoys;
    if (!isMain) return false;
    return !discoveredCharacterIds.has(card.characterId);
  }

  function isAltArtCard(card: { characterId?: string | null }): boolean {
    if (!card.characterId) return false;
    const entry = poolEntries.find((e) => e.characterId === card.characterId);
    return (entry?.altArtOfCharacterId ?? null) != null;
  }

  /** Unique key for the codex slot this card would fill (one upload per slot). */
  function getCodexSlotKey(card: { characterId?: string | null; isFoil?: boolean }): string | null {
    if (!card.characterId) return null;
    const entry = poolEntries.find((e) => e.characterId === card.characterId);
    if (!entry) return null;
    const isAltArt = (entry.altArtOfCharacterId ?? null) != null;
    const isBoys = (entry.cardType ?? "actor") === "character" && !isAltArt;
    const isMain = !isAltArt && !isBoys;
    if (isMain) return card.isFoil ? `holo:${card.characterId}` : `regular:${card.characterId}`;
    if (isAltArt) return `altart:${card.characterId}`;
    if (isBoys) return `boys:${card.characterId}`;
    return null;
  }

  async function handleCodexUploadSelected() {
    if (!user || codexUploadSelectedIds.size === 0) return;
    const eligible = [...codexUploadSelectedIds].filter((cardId) => {
      const c = cards.find((x) => x.id === cardId);
      return c && c.characterId != null && !myTradeBlockCardIds.has(cardId) && !isCardSlotAlreadyInCodex(c) && !isHoloMissingRegularPrereq(c);
    });
    // One card per codex slot — never upload duplicates (e.g. multiple copies of same character regular).
    const seenSlots = new Set<string>();
    const list: string[] = [];
    for (const cardId of eligible) {
      const c = cards.find((x) => x.id === cardId)!;
      const key = getCodexSlotKey(c);
      if (key && !seenSlots.has(key)) {
        seenSlots.add(key);
        list.push(cardId);
      }
    }
    if (list.length === 0) return;
    codexSkipRequestedRef.current = false;
    setCodexUploading(true);
    setCodexUploadProgress(0);
    const codexAudio = !codexSoundMuted
      ? (() => {
          if (!codexLoadingAudioRef.current) codexLoadingAudioRef.current = new Audio("/data/codex-loading.mp3");
          const a = codexLoadingAudioRef.current;
          a.loop = true;
          a.play().catch(() => {});
          return a;
        })()
      : null;

    const startTime = Date.now();
    const ANIMATION_MS = 3000;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        codexSkipRequestedRef.current = true;
        if (codexAnimationIntervalRef.current) {
          clearInterval(codexAnimationIntervalRef.current);
          codexAnimationIntervalRef.current = null;
        }
        setCodexUploadProgress(100);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    codexAnimationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / ANIMATION_MS) * 100));
      setCodexUploadProgress(pct);
      if (pct >= 100 && codexAnimationIntervalRef.current) {
        clearInterval(codexAnimationIntervalRef.current);
        codexAnimationIntervalRef.current = null;
      }
    }, 50);

    let uploadedCount = 0;
    for (let i = 0; i < list.length; i++) {
      const cardId = list[i];
      try {
        const res = await fetch("/api/cards/upload-to-codex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, cardId }),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.characterId) {
          uploadedCount++;
          const variant = data.variant ?? (data.isFoil ? "holo" : "regular");
          if (variant === "regular") setDiscoveredCharacterIds((prev) => new Set([...prev, data.characterId]));
          else if (variant === "holo") setDiscoveredHoloCharacterIds((prev) => new Set([...prev, data.characterId]));
          else if (variant === "altart") {
            setDiscoveredAltArtCharacterIds((prev) => new Set([...prev, data.characterId]));
            if (data.finish === "holo" || data.isFoil) setDiscoveredAltArtHoloCharacterIds((prev) => new Set([...prev, data.characterId]));
          } else if (variant === "boys") setDiscoveredBoysCharacterIds((prev) => new Set([...prev, data.characterId]));
          setNewlyUploadedToCodexCharacterIds((prev) => new Set([...prev, data.characterId]));
          untrackCharacterId(data.characterId);
          if (variant === "boys") untrackCharacterId(`boys:${data.characterId}`);
          if (data.setCompleted || data.holoSetCompleted) window.dispatchEvent(new CustomEvent("dabys-quests-refresh"));
        }
      } catch {
        /* skip failed */
      }
    }

    while (Date.now() - startTime < ANIMATION_MS && !codexSkipRequestedRef.current) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (codexAnimationIntervalRef.current) {
      clearInterval(codexAnimationIntervalRef.current);
      codexAnimationIntervalRef.current = null;
    }
    setCodexUploadProgress(100);
    window.removeEventListener("keydown", onKeyDown);

    if (codexAudio) {
      codexAudio.pause();
      codexAudio.currentTime = 0;
    }
    if (uploadedCount > 0) {
      setCodexUploadCompleteCount(uploadedCount);
      if (!codexSoundMuted) {
        const completeSound = new Audio("/data/codex-complete.mp3");
        completeSound.play().catch(() => {});
      }
      if (codexUploadCompleteTimeoutRef.current) clearTimeout(codexUploadCompleteTimeoutRef.current);
      codexUploadCompleteTimeoutRef.current = setTimeout(() => {
        setCodexUploadCompleteCount(null);
        codexUploadCompleteTimeoutRef.current = null;
      }, 3200);
    }
    setCodexUploading(false);
    setCodexUploadProgress(0);
    setCodexUploadSelectedIds(new Set());
    setShowCodexUploadModal(false);
    await Promise.all([refreshCards(), refreshCodex()]);
  }

  function toggleCodexUploadSelection(cardId: string) {
    setCodexUploadSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  async function handlePurchaseShopItem(item: ShopItem) {
    if (!user || creditBalance < item.price || purchasingShopItemId) return;
    setPurchasingShopItemId(item.id);
    try {
      const res = await fetch("/api/shop/purchase-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, itemId: item.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (typeof data.balance === "number") setCreditBalance(data.balance);
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh"));
        await Promise.all([refreshCredits(), refreshShop()]);
      } else {
        alert(data.error || "Purchase failed");
      }
    } catch {
      alert("Purchase failed");
    } finally {
      setPurchasingShopItemId(null);
    }
  }

  async function handleBuyListing(listingId: string) {
    if (!user) return;
    const listing = listings.find((l) => l.id === listingId);
    setBuyingId(listingId);
    try {
      const res = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, listingId }),
      });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([refreshCards(), refreshCredits(), refreshMarketplace()]);
        const delta = listing ? -listing.askingPrice : undefined;
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
      } else {
        alert(data.error || "Failed to buy");
      }
    } catch {
      alert("Failed to buy");
    } finally {
      setBuyingId(null);
    }
  }

  async function handleDelist(listingId: string) {
    if (!user) return;
    setDelistingId(listingId);
    try {
      const res = await fetch(`/api/marketplace/list/${listingId}?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      if (res.ok) await refreshMarketplace();
      else {
        const data = await res.json();
        alert(data.error || "Failed to delist");
      }
    } catch {
      alert("Failed to delist");
    } finally {
      setDelistingId(null);
    }
  }

  async function handleCreateOrder() {
    if (!user || !selectedOrderCharacter) return;
    const price = orderOfferPrice.trim() === "" ? 0 : parseInt(orderOfferPrice, 10);
    if (orderOfferPrice.trim() !== "" && (isNaN(price) || price < 0)) {
      alert("Enter a valid offer price (0 or more)");
      return;
    }
    setCreatingOrder(true);
    try {
      const res = await fetch("/api/marketplace/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          characterId: selectedOrderCharacter.characterId,
          offerPrice: price,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowOrderModal(false);
        setSelectedOrderCharacter(null);
        setOrderOfferPrice("");
        await refreshMarketplaceOrders();
      } else {
        alert(data.error || "Failed to create order");
      }
    } catch {
      alert("Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  }

  async function handleFulfillOrder(orderId: string, cardId: string) {
    if (!user) return;
    setFulfillingOrderId(orderId);
    try {
      const res = await fetch(`/api/marketplace/orders/${orderId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardId }),
      });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([refreshCards(), refreshCredits(), refreshMarketplace(), refreshMarketplaceOrders()]);
        playTradeAcceptSound();
      } else {
        alert(data.error || "Failed to fulfill order");
      }
    } catch {
      alert("Failed to fulfill order");
    } finally {
      setFulfillingOrderId(null);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!user) return;
    setCancellingOrderId(orderId);
    try {
      const res = await fetch(`/api/marketplace/orders/${orderId}?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      if (res.ok) await refreshMarketplaceOrders();
      else {
        const data = await res.json();
        alert(data.error || "Failed to cancel order");
      }
    } catch {
      alert("Failed to cancel order");
    } finally {
      setCancellingOrderId(null);
    }
  }

  async function handleListCard() {
    if (!user || !selectedCard || !listPrice) return;
    const price = parseInt(listPrice, 10);
    if (isNaN(price) || price < 1) {
      alert("Enter a valid price (at least 1)");
      return;
    }
    setListing(true);
    try {
      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cardId: selectedCard.id, askingPrice: price }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowListModal(false);
        setSelectedCard(null);
        setListPrice("");
        await Promise.all([refreshCards(), refreshMarketplace()]);
      } else {
        alert(data.error || "Failed to list");
      }
    } catch {
      alert("Failed to list");
    } finally {
      setListing(false);
    }
  }

  function openTradeModal() {
    setEditingTradeId(null);
    setShowTradeModal(true);
    setTradeStep(1);
    setTradeCounterparty(null);
    setTradeOfferedIds(new Set());
    setTradeRequestedIds(new Set());
    setTradeOfferedCredits(0);
    setTradeRequestedCredits(0);
    setCounterpartyCards([]);
    setTradeError("");
    fetch("/api/users?includeProfile=1")
      .then((r) => r.json())
      .then((data: UserWithAvatar[]) => setTradeUsers(data.filter((u) => u.id !== user?.id)))
      .catch(() => setTradeUsers([]));
  }

  function openEditTrade(t: TradeOfferEnriched) {
    setEditingTradeId(t.id);
    setShowTradeModal(true);
    setTradeStep(2);
    setTradeCounterparty({ id: t.initiatorUserId, name: t.initiatorName ?? "Unknown" });
    setTradeOfferedIds(new Set(t.requestedCardIds));
    setTradeRequestedIds(new Set(t.offeredCardIds));
    setTradeOfferedCredits(t.requestedCredits ?? 0);
    setTradeRequestedCredits(t.offeredCredits ?? 0);
    setTradeError("");
    fetch("/api/users?includeProfile=1")
      .then((r) => r.json())
      .then((data: UserWithAvatar[]) => setTradeUsers(data.filter((u) => u.id !== user?.id)))
      .catch(() => setTradeUsers([]));
  }

  useEffect(() => {
    if (!showTradeModal || !tradeCounterparty) return;
    fetch(`/api/cards?userId=${encodeURIComponent(tradeCounterparty.id)}`)
      .then((r) => r.json())
      .then((data: Card[]) => setCounterpartyCards(data))
      .catch(() => setCounterpartyCards([]));
  }, [showTradeModal, tradeCounterparty?.id]);

  const pendingTradeOfferedIds = useMemo(() => new Set(
    trades.filter((t) => t.initiatorUserId === user?.id && t.status === "pending").flatMap((t) => t.offeredCardIds)
  ), [trades, user?.id]);
  const availableForOffer = useMemo(() => cards.filter(
    (c) => !myListedCardIds.has(c.id!) && !pendingTradeOfferedIds.has(c.id!)
  ), [cards, myListedCardIds, pendingTradeOfferedIds]);
  const counterpartyListedIds = useMemo(() => new Set(
    listings.filter((l) => l.sellerUserId === tradeCounterparty?.id).map((l) => l.cardId)
  ), [listings, tradeCounterparty?.id]);
  const availableToRequest = useMemo(() => counterpartyCards.filter((c) => !counterpartyListedIds.has(c.id!)), [counterpartyCards, counterpartyListedIds]);

  function toggleTradeOffer(cardId: string) {
    setTradeOfferedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }
  function toggleTradeRequest(cardId: string) {
    setTradeRequestedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  async function handleSendTrade() {
    const hasOffer = tradeOfferedIds.size > 0 || (tradeOfferedCredits > 0 && Number.isFinite(tradeOfferedCredits));
    const hasRequest = tradeRequestedIds.size > 0 || (tradeRequestedCredits > 0 && Number.isFinite(tradeRequestedCredits));
    if (!user || !tradeCounterparty || !hasOffer || !hasRequest) return;
    const offCr = Math.max(0, Math.floor(tradeOfferedCredits || 0));
    if (offCr > creditBalance) {
      setTradeError("Not enough credits for your offer");
      return;
    }
    setTradeLoading(true);
    setTradeError("");
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiatorUserId: user.id,
          initiatorName: user.name,
          counterpartyUserId: tradeCounterparty.id,
          counterpartyName: tradeCounterparty.name,
          offeredCardIds: Array.from(tradeOfferedIds),
          requestedCardIds: Array.from(tradeRequestedIds),
          offeredCredits: Math.max(0, Math.floor(tradeOfferedCredits || 0)),
          requestedCredits: Math.max(0, Math.floor(tradeRequestedCredits || 0)),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        playTradeCreatedSound();
        setTradeFeedback("created");
        setShowTradeModal(false);
        if (editingTradeId && user) {
          fetch(`/api/trades/${editingTradeId}/deny`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          }).catch(() => {});
          setEditingTradeId(null);
        }
        await refreshTrades();
        setTimeout(() => setTradeFeedback(null), 2200);
      } else {
        setTradeError(data.error || "Failed to send offer");
      }
    } catch {
      setTradeError("Failed to send offer");
    } finally {
      setTradeLoading(false);
    }
  }

  async function handleAcceptTrade(tradeId: string) {
    if (!user) return;
    setTradeActionId(tradeId);
    try {
      const res = await fetch(`/api/trades/${tradeId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        playTradeAcceptSound();
        setTradeFeedback("accepted");
        setExpandedReceivedTradeId(null);
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh"));
        await Promise.all([refreshCards(), refreshCredits(), refreshTrades()]);
        setTimeout(() => setTradeFeedback(null), 2200);
      } else {
        alert(data.error || "Failed to accept");
      }
    } catch {
      alert("Failed to accept trade");
    } finally {
      setTradeActionId(null);
    }
  }

  async function handleDenyTrade(tradeId: string) {
    if (!user) return;
    setTradeActionId(tradeId);
    try {
      const res = await fetch(`/api/trades/${tradeId}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        playTradeDenySound();
        setTradeFeedback("denied");
        setExpandedReceivedTradeId(null);
        await refreshTrades();
        setTimeout(() => setTradeFeedback(null), 2200);
      } else {
        alert(data.error || "Failed to deny");
      }
    } catch {
      alert("Failed to deny trade");
    } finally {
      setTradeActionId(null);
    }
  }

  async function handleCancelTrade(tradeId: string) {
    if (!user) return;
    setTradeActionId(tradeId);
    try {
      const res = await fetch(`/api/trades/${tradeId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) await refreshTrades();
      else alert(data.error || "Failed to cancel");
    } catch {
      alert("Failed to cancel trade");
    } finally {
      setTradeActionId(null);
    }
  }

  const sentTrades = useMemo(() => trades.filter((t) => t.initiatorUserId === user?.id), [trades, user?.id]);
  const receivedTrades = useMemo(() => trades.filter((t) => t.counterpartyUserId === user?.id), [trades, user?.id]);

  const listedCardIds = useMemo(() => new Set(listings.map((l) => l.cardId)), [listings]);
  const availableToList = useMemo(() => cards.filter((c) => !listedCardIds.has(c.id)), [cards, listedCardIds]);

  const filteredInventoryCards = useMemo(() => {
    const cardTypeKey = (c: Card) => (c.cardType ?? "actor") as string;
    return cards
      .filter((c) => filterCardType === "all" || (filterCardType === "actor" && cardTypeKey(c) !== "character") || (filterCardType === "character" && cardTypeKey(c) === "character"))
      .filter((c) => !filterRarity || c.rarity === filterRarity)
      .filter((c) => filterFoil === "all" || (filterFoil === "foil" && c.isFoil) || (filterFoil === "normal" && !c.isFoil))
      .sort((a, b) => {
        const typeOrder = (t: string) => (t === "character" ? 1 : 0);
        const secondary = () => {
          if (filterSort === "recent" || filterSort === "type") {
            const at = new Date(a.acquiredAt ?? 0).getTime();
            const bt = new Date(b.acquiredAt ?? 0).getTime();
            return bt - at;
          }
          if (filterSort === "name") {
            return (a.actorName || "").localeCompare(b.actorName || "", undefined, { sensitivity: "base" });
          }
          if (filterSort === "movie") {
            const m = (a.movieTitle || "").localeCompare(b.movieTitle || "", undefined, { sensitivity: "base" });
            return m !== 0 ? m : (a.actorName || "").localeCompare(b.actorName || "", undefined, { sensitivity: "base" });
          }
          return 0;
        };
        if (filterSort === "type") {
          const ta = typeOrder(cardTypeKey(a));
          const tb = typeOrder(cardTypeKey(b));
          return ta !== tb ? ta - tb : secondary();
        }
        return secondary();
      });
  }, [cards, filterCardType, filterRarity, filterFoil, filterSort]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "store", label: "Shop" },
    { key: "inventory", label: "Inventory" },
    ...(marketplaceEnabled ? [{ key: "marketplace" as TabKey, label: "Marketplace" }] : []),
    { key: "trivia", label: "Trivia" },
    { key: "trade", label: "Trade" },
    { key: "codex", label: "Codex" },
  ];

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10">
        <main className="min-w-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white/90 mb-2">Trading Card Game</h1>
            <p className="text-white/50 text-sm">
              Buy packs, manage your inventory, trade on the marketplace, and earn credits from Trivia and quests.
            </p>
          </div>
          <div className="relative flex-shrink-0 group self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setTcgInfoExpanded((prev) => !prev)}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-sm hover:border-amber-300 hover:bg-amber-500/30 hover:text-amber-200 hover:scale-110 transition-all duration-200 cursor-pointer"
              aria-label="How the TCG works"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </button>
            <div
              className={`absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-white/20 bg-white/[0.08] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 text-left transition-all duration-200 pointer-events-none group-hover:pointer-events-auto ${
                tcgInfoExpanded ? "visible opacity-100 pointer-events-auto" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
              }`}
              role="tooltip"
            >
              <p className="text-sm font-semibold text-amber-300 mb-2">How the TCG works</p>
              <p className="text-xs text-white/70 leading-relaxed mb-2">
                <strong className="text-amber-300/95">Credits:</strong> Trivia + quests. <strong className="text-amber-300/95">Store:</strong> Buy packs. <strong className="text-amber-300/95">Trade up:</strong> 4 same-rarity, same-type cards → 1 next rarity (Epic→Legendary: 33% card, 67% credits). <strong className="text-amber-300/95">Alchemy:</strong> Disenchant foils for Stardust or Pack-A-Punch normals to Holo. <strong className="text-amber-300/95">Quicksell:</strong> Vendor non-legendary for credits.
              </p>
              <p className="text-xs text-white/70 leading-relaxed mb-2">
                <strong className="text-amber-300/95">Marketplace</strong> & <strong className="text-amber-300/95">Trade</strong>: buy/sell and trade with others.
              </p>
              <p className="text-xs text-white/70 leading-relaxed mb-2">
                <strong className="text-amber-300/95">Codex:</strong> Upload to discover (card leaves collection; legendaries re-enter pool). Complete a set for <strong className="text-amber-300/95">badges</strong> (normal → Holo → Prismatic → Dark Matter).
              </p>
              <p className="text-xs text-white/50 leading-relaxed">
                New cards weekly from winning movies.
              </p>
              {tcgInfoExpanded && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setTcgInfoExpanded(false); }}
                  className="mt-3 text-[10px] text-amber-300/80 hover:text-amber-300 cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>

        {/* In-page tabs — wrap on mobile (2 per row) for proper scaling; single row + scroll from sm up */}
        <div className="min-w-0 mb-6 sm:mb-8">
          <div className="flex flex-wrap gap-2 sm:gap-1 sm:flex-nowrap sm:border-b sm:border-white/[0.08] sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 sm:overflow-x-auto sm:overflow-y-hidden scrollbar-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  tabScrollPositions.current[tab] = window.scrollY;
                  setTab(t.key);
                  requestAnimationFrame(() => {
                    window.scrollTo(0, tabScrollPositions.current[t.key] ?? 0);
                  });
                }}
                className={`flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-none min-h-[48px] sm:min-h-[44px] px-4 py-3.5 sm:py-3 rounded-xl sm:rounded-none text-base sm:text-sm font-medium transition-all cursor-pointer relative touch-manipulation ${
                  tab === t.key
                    ? "bg-purple-500/20 text-amber-400 ring-2 ring-amber-400/50 sm:ring-0 sm:bg-transparent sm:border-b-2 sm:border-amber-400 sm:-mb-px"
                    : "bg-white/[0.06] text-white/40 hover:bg-white/[0.08] hover:text-white/70 sm:bg-transparent"
                }`}
              >
                {t.label}
                {t.key === "trade" && receivedTrades.length > 0 && (
                  <span className="absolute top-2.5 right-3 sm:top-1.5 sm:right-1.5 w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full bg-red-500/50 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.4)]" aria-label="Incoming trades" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Store: Packs | Other */}
        {tab === "store" && (
          <>
            <div className="min-w-0 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto overflow-y-hidden scrollbar-tabs">
              <div className="flex gap-0 flex-nowrap w-max min-w-full rounded-t-lg border border-white/[0.12] border-b-0 bg-white/[0.04] p-0.5 mb-0">
              <button
                type="button"
                onClick={() => setStoreSubTab("packs")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  storeSubTab === "packs"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Packs
              </button>
              <button
                type="button"
                onClick={() => setStoreSubTab("other")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  storeSubTab === "other"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Other
              </button>
              </div>
            </div>

            {storeSubTab === "packs" && (
            <div className="rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
              {poolCount < 5 && (
                <p className="text-amber-400/70 text-xs mb-4">
                  No winning movies with TMDB data yet. Win some movies to unlock cards!
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map((pack) => {
                const effectivePrice =
                  pack.discounted &&
                  typeof pack.discountPercent === "number" &&
                  pack.discountPercent > 0
                    ? Math.floor(pack.price * (1 - pack.discountPercent / 100))
                    : pack.price;
                const atDailyLimit =
                  typeof pack.maxPurchasesPerDay === "number" &&
                  pack.maxPurchasesPerDay > 0 &&
                  (pack.purchasesToday ?? 0) >= pack.maxPurchasesPerDay;
                const disabled =
                  atDailyLimit ||
                  poolCount < pack.cardsPerPack ||
                  (effectivePrice > 0 && creditBalance < effectivePrice) ||
                  buyingPackId === pack.id;
                const needCredits = effectivePrice > 0 && creditBalance < effectivePrice ? effectivePrice - creditBalance : 0;
                const rarityText =
                  pack.allowedRarities && pack.allowedRarities.length < 4
                    ? pack.allowedRarities.join(", ")
                    : "All rarities";
                const typeText =
                  pack.allowedCardTypes && pack.allowedCardTypes.length < 4
                    ? pack.allowedCardTypes.join(", ")
                    : "All card types";
                return (
                  <div
                    key={pack.id}
                    className={`relative rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-2xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] group transform transition-all duration-300 ${
                      atDailyLimit
                        ? "hover:translate-y-0"
                        : "hover:-translate-y-1.5 hover:shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
                    }`}
                  >
                    <div className="relative w-full">
                      {pack.discounted && (
                        <div className="absolute top-3 left-3 z-10 pointer-events-none">
                          <span className="inline-block px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-xs font-bold uppercase tracking-wider shadow-lg border border-red-400/50">
                            Sale{typeof pack.discountPercent === "number" && pack.discountPercent > 0 ? ` ${pack.discountPercent}%` : ""}
                          </span>
                        </div>
                      )}
                      {atDailyLimit && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                          <span className="w-full py-3 text-center bg-rose-950/55 backdrop-blur-md text-white/95 text-xs font-medium tracking-[0.25em] uppercase border-y border-rose-900/40 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
                            Sold out
                          </span>
                        </div>
                      )}
                      {pack.imageUrl ? (
                        <img
                          src={pack.imageUrl}
                          alt={pack.name}
                          className={`w-full h-auto object-contain block transition-transform duration-500 group-hover:scale-[1.02] ${atDailyLimit ? "grayscale opacity-70" : ""}`}
                        />
                      ) : (
                        <div className="w-full h-40 flex items-center justify-center text-white/20 text-lg">
                          No artwork
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent group-hover:from-black/70 group-hover:via-black/10" />
                      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white/90 truncate">
                            {pack.name}
                          </p>
                          <p className="text-xs text-white/60">
                            {pack.cardsPerPack} cards per pack
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {effectivePrice < pack.price ? (
                            <>
                              <span className="text-white/40 text-xs line-through">{pack.price} cr</span>
                              <span className="px-3 py-1 rounded-full bg-sky-400/20 text-sky-50 text-xs font-semibold shadow-sm border border-sky-400/40 transition-colors duration-200 group-hover:bg-sky-400/40 group-hover:border-sky-300/70">
                                {effectivePrice} cr
                              </span>
                            </>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-sky-400/20 text-sky-50 text-xs font-semibold shadow-sm border border-sky-400/40 transition-colors duration-200 group-hover:bg-sky-400/40 group-hover:border-sky-300/70">
                              {pack.price} cr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 space-y-3 ${atDailyLimit ? "opacity-70" : ""}`}>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.12]">
                          {rarityText}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.12]">
                          {typeText}
                        </span>
                      </div>
                      <button
                        onClick={() => !atDailyLimit && handleBuyPack(pack)}
                        disabled={disabled}
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                          atDailyLimit
                            ? "border-white/20 bg-white/[0.06] text-white/50 cursor-not-allowed"
                            : "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:border-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {buyingPackId === pack.id ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Opening...
                          </>
                        ) : atDailyLimit ? (
                          <span className="text-white/50">
                            {pack.nextRestockAt
                              ? formatRestockCountdown(pack.nextRestockAt, restockCountdownNow)
                              : `Resets in ${midnightCountdown}`}
                          </span>
                        ) : poolCount < pack.cardsPerPack ? (
                          "Need more cards in pool"
                        ) : needCredits > 0 ? (
                          `Need ${needCredits} more credits`
                        ) : (
                          "Buy Pack"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {packs.length === 0 && (
                <p className="text-white/50 text-sm text-center col-span-full py-4">
                  No packs are available in the shop right now. Check back later!
                </p>
              )}
              </div>
            </div>
            )}

            {storeSubTab === "other" && (
              <div className="rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {shopItems.length === 0 ? (
                  <p className="text-white/50 text-sm text-center col-span-full py-4">
                    No items in the shop right now. Check back later!
                  </p>
                ) : (
                  shopItems.map((item) => {
                    const disabled = !user || creditBalance < item.price || purchasingShopItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="relative rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.3)] overflow-hidden border border-white/[0.08] flex flex-col"
                      >
                        <div className="relative w-full aspect-square">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover object-center"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-sm bg-white/[0.03]">
                              {item.type === "badge" ? "Badge" : "Skip"}
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between gap-1">
                            <p className="text-[10px] font-semibold text-white/95 truncate min-w-0">{item.name}</p>
                            <span className="px-1.5 py-0.5 rounded bg-sky-400/25 text-sky-50 text-[10px] font-semibold border border-sky-400/40 shrink-0">
                              {item.price} cr
                            </span>
                          </div>
                        </div>
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => handlePurchaseShopItem(item)}
                            disabled={disabled}
                            className="w-full px-2 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-200 text-[11px] font-semibold hover:border-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                          >
                            {purchasingShopItemId === item.id ? (
                              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : creditBalance < item.price ? (
                              `+${item.price - creditBalance} cr`
                            ) : (
                              "Purchase"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
            )}

            {newCards && newCards.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] touch-none overscroll-contain"
                  onClick={() => setNewCards(null)}
                  onTouchMove={(e) => e.preventDefault()}
                  aria-hidden
                />
                <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center p-3 pt-[calc(var(--header-height)+0.5rem)] sm:pt-4 sm:px-4 sm:p-4 pointer-events-none">
                  <div className="relative w-full max-w-[min(360px,92vw)] sm:max-w-4xl max-h-[calc(100dvh-var(--header-height)-1rem)] sm:max-h-none rounded-2xl border border-white/[0.18] bg-white/[0.06] backdrop-blur-md shadow-[0_22px_70px_rgba(0,0,0,0.85)] p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex flex-col pointer-events-auto overscroll-contain">
                    <div className="relative flex-shrink-0">
                    {/* Mobile: sticky close X so you can always dismiss */}
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => { setNewCards(null); setRevealCount(0); }}
                      className="sm:hidden absolute top-0 right-0 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/15 active:bg-white/20 touch-manipulation select-none"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <h2 className="text-base sm:text-lg font-semibold text-white/90 mb-3 sm:mb-4 text-center">
                      You got
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 max-sm:mx-auto">
                      {newCards.map((card, i) => {
                        const revealed = i < revealCount;
                        const isTrackedPull = revealed && card.characterId && trackedCharacterIds.has(card.characterId);
                        return (
                          <div key={card.id} className="relative">
                            {!revealed && (
                              <div className="aspect-[2/3] rounded-xl border border-white/[0.18] bg-white/[0.06] flex items-center justify-center text-2xl sm:text-3xl font-semibold text-white/40">
                                ?
                              </div>
                            )}
                            {revealed && (
                              <div className={`card-reveal ${isTrackedPull ? "tracked-card-found" : ""}`}>
                                <CardDisplay card={card} />
                                {isTrackedPull && (
                                  <div className="absolute inset-x-0 top-0 z-20 flex justify-center pt-2 pointer-events-none">
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-amber-950 text-[10px] font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(245,158,11,0.6)] animate-pulse">
                                      Tracked
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 sm:mt-6 flex justify-center flex-shrink-0 max-sm:sticky max-sm:bottom-0 max-sm:pt-4 max-sm:pb-[env(safe-area-inset-bottom,0)] max-sm:bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent max-sm:-mx-4 max-sm:-mb-4 max-sm:px-4 max-sm:rounded-b-2xl">
                      <button
                        type="button"
                        onClick={() => {
                          setNewCards(null);
                          setRevealCount(0);
                        }}
                        className="w-full max-w-[280px] sm:w-auto min-h-[48px] sm:min-h-0 px-6 sm:px-5 py-3 sm:py-2.5 rounded-xl border border-white/25 bg-white/[0.06] text-base sm:text-sm font-medium text-white/85 hover:bg-white/[0.1] hover:text-white active:bg-white/[0.12] transition-colors cursor-pointer touch-manipulation select-none"
                      >
                        Close
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Inventory */}
        {tab === "inventory" && (
          <div>
            {/* Browser-style sub-tabs: Trade up | Alchemy */}
            <div className="min-w-0 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto overflow-y-hidden scrollbar-tabs">
              <div className="flex gap-0 flex-nowrap w-max min-w-full rounded-t-lg rounded-tl-none rounded-tr-none border border-white/[0.12] border-b-0 bg-white/[0.04] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setInventorySubTab("tradeup");
                  router.replace("/cards", { scroll: false });
                }}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  inventorySubTab === "tradeup"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Trade up
              </button>
              <button
                type="button"
                onClick={() => {
                  setInventorySubTab("alchemy");
                  router.replace("/cards?alchemy=1", { scroll: false });
                }}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  inventorySubTab === "alchemy"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Alchemy
              </button>
              <button
                type="button"
                onClick={() => {
                  setInventorySubTab("quicksell");
                  router.replace("/cards?quicksell=1", { scroll: false });
                }}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  inventorySubTab === "quicksell"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Quicksell
              </button>
              </div>
            </div>

            {inventorySubTab === "tradeup" && (
            <>
            {(tradeUpResult || tradeUpResultCredits != null) && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setTradeUpResult(null);
                    setTradeUpResultCredits(null);
                  }
                }}
                role="presentation"
              >
                <div
                  className={`w-full max-w-sm rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 transition-opacity duration-500 tradeup-result-in ${
                    tradeUpResultFading ? "opacity-0" : "opacity-100"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-center text-lg font-semibold text-amber-400/90 mb-4">Trade Up Result</h2>
                  <div className="flex flex-col items-center gap-4">
                    {tradeUpResult ? (
                      <>
                        <div className="w-36 mx-auto relative">
                          <div className={tradeUpResult.characterId && (trackedCharacterIds.has(tradeUpResult.characterId) || ((tradeUpResult.cardType ?? "actor") === "character" && trackedCharacterIds.has(`boys:${tradeUpResult.characterId}`))) ? "tracked-card-found" : ""}>
                            <CardDisplay card={tradeUpResult} />
                            {tradeUpResult.characterId && (trackedCharacterIds.has(tradeUpResult.characterId) || ((tradeUpResult.cardType ?? "actor") === "character" && trackedCharacterIds.has(`boys:${tradeUpResult.characterId}`))) && (
                              <div className="absolute inset-x-0 top-0 z-20 flex justify-center pt-2 pointer-events-none">
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-amber-950 text-[10px] font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(245,158,11,0.6)] animate-pulse">
                                  Tracked
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-white/60 text-center capitalize">
                          {tradeUpResult.rarity} card
                        </p>
                      </>
                    ) : tradeUpResultCredits != null ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl font-bold text-amber-400">{tradeUpResultCredits}</span>
                        <p className="text-sm text-white/60 text-center">credits</p>
                      </div>
                    ) : null}
                    <button
                      onClick={() => {
                        setTradeUpResult(null);
                        setTradeUpResultCredits(null);
                      }}
                      className="px-4 py-2 rounded-lg border border-white/20 text-amber-400/90 text-sm font-medium hover:bg-white/[0.06] hover:border-amber-400/50 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showLegendaryReroll && legendaryBlockShown && (
              <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border-2 border-amber-500/60 bg-amber-500/15 px-4 py-3 backdrop-blur-sm">
                <svg className="h-6 w-6 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-amber-300">Legendaries go in the Legendary Reroll below</span>
              </div>
            )}
            {!showLegendaryReroll && (
            <>
            {/* Trade Up - frosted glass section */}
            <div className="rounded-2xl rounded-tl-none rounded-tr-none border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-2">
              <h2 className="text-lg font-semibold text-amber-400/90 mb-2">Trade Up</h2>
              <p className="text-sm text-white/60 mb-4">
                4 same-rarity, same-type cards → 1 next rarity. Epic→Legendary: 33% card, 67% credits. Use Legendary Reroll for 2 legendaries.
              </p>
              {tradeUpAutofillError && (
                <div className={`mb-4 rounded-xl border border-red-500/40 bg-red-500/15 backdrop-blur-sm px-4 py-3 text-red-300 text-sm transition-opacity duration-500 ${tradeUpAutofillErrorFading ? "opacity-0" : "opacity-100"}`}>
                  {tradeUpAutofillError}
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                {/* Input slots - 4 cards */}
                <div className="flex gap-2">
                  {tradeUpSlots.map((cardId, i) => {
                    const slotCard = cardId ? cards.find((x) => x.id === cardId) : null;
                    const filledStyle = slotCard?.rarity ? (SLOT_FILLED_STYLE[slotCard.rarity] ?? SLOT_FILLED_STYLE.uncommon) : "";
                    return (
                      <div
                        key={`${cardId ?? "empty"}-${i}`}
                        className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-200 ${
                          cardId
                            ? `group ${filledStyle} tradeup-slot-pop`
                            : currentRarity ? SLOT_EMPTY_STYLE[currentRarity] ?? SLOT_EMPTY_STYLE.uncommon : "border-dashed border-amber-500/40 bg-white/[0.04] hover:border-amber-500/60 hover:bg-white/[0.06]"
                        }`}
                        onClick={() => cardId && removeFromTradeUpSlot(cardId)}
                      >
                        {cardId ? (
                          <div className="w-full h-full relative bg-black/20 transition-all duration-200 group-hover:opacity-60 group-hover:grayscale">
                            {(() => {
                              const c = slotCard;
                              if (!c) return null;
                              return (
                                <>
                                  {c.profilePath ? (
                                    <img src={c.profilePath} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">
                                      {(c.actorName || "?")[0]}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/40 text-center px-1">Empty</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Arrow */}
                <div className="flex items-center justify-center text-amber-400/80 text-2xl font-bold tradeup-arrow-pulse">
                  →
                </div>
                {/* Output slot */}
                <div className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                  canTradeUp ? "bg-amber-500/20 border-amber-400/60 animate-pulse" : currentRarity ? SLOT_OUTPUT_STYLE[currentRarity] ?? SLOT_OUTPUT_STYLE.uncommon : "bg-white/[0.04] border-amber-500/40"
                }`}>
                  {canTradeUp ? (
                    currentRarity === "epic" ? (
                      <span className="text-[9px] sm:text-[10px] text-amber-400 font-medium text-center px-1 leading-tight">
                        <span className="block font-semibold">33% Legendary</span>
                        <span className="block mt-0.5 text-white/70">67% 100 credits</span>
                      </span>
                    ) : (
                      <span className="text-xs text-amber-400 font-medium text-center px-1">
                        1 {TRADE_UP_NEXT[tradeUpCards[0]?.rarity || ""]}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-white/40 text-center px-1">?</span>
                  )}
                </div>
                </div>
                <div className="w-[180px] shrink-0 flex items-center justify-end">
                  {canTradeUp ? (
                    <button
                      onClick={() => handleTradeUp()}
                      disabled={tradingUp}
                      className="px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-semibold hover:border-amber-500/50 hover:bg-amber-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                    >
                      {tradingUp ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </span>
                      ) : (
                        "Submit Trade Up"
                      )}
                    </button>
                  ) : canCodexdFillTradeUp() ? (
                    <button
                      onClick={fillTradeUpWithCodexd}
                      className="px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold hover:border-amber-500/50 hover:bg-amber-500/15 transition-all cursor-pointer backdrop-blur-md flex items-center gap-1.5 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Add Codex&apos;d
                    </button>
                  ) : (
                    <button
                      onClick={autoFillTradeUp}
                      className="px-5 py-2.5 rounded-xl border border-white/[0.18] bg-white/[0.06] text-white/80 font-semibold hover:bg-white/[0.1] hover:border-white/25 transition-all cursor-pointer backdrop-blur-md flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Auto-fill
                    </button>
                  )}
                </div>
              </div>
            </div>
            </>
            )}

            {/* Legendary Reroll — shown when user has cards in reroll slots or clicked a legendary (replaces trade-up window) */}
            {showLegendaryReroll && (
            <div className="rounded-2xl rounded-tl-none rounded-tr-none border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-8">
              <h2 className="text-lg font-semibold text-amber-400/90 mb-1">Legendary Reroll</h2>
              <p className="text-sm text-white/60 mb-4">
                2 legendaries → 1 new legendary.
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex gap-2">
                  {legendaryRerollSlots.map((cardId, i) => {
                    const slotCard = cardId ? cards.find((x) => x.id === cardId) : null;
                    return (
                      <div
                        key={`reroll-${cardId ?? "empty"}-${i}`}
                        className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-200 ${
                          cardId
                            ? `group ${SLOT_FILLED_STYLE.legendary} tradeup-slot-pop`
                            : "border-dashed border-amber-500/40 bg-white/[0.04] hover:border-amber-500/60 hover:bg-white/[0.06]"
                        }`}
                        onClick={() => cardId && removeFromLegendaryReroll(cardId)}
                      >
                        {cardId && slotCard ? (
                          <div className="w-full h-full relative bg-black/20 transition-all duration-200 group-hover:opacity-60 group-hover:grayscale">
                            {slotCard.profilePath ? (
                              <img src={slotCard.profilePath} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">
                                {(slotCard.actorName || "?")[0]}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/40 text-center px-1">Empty</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center text-amber-400/80 text-2xl font-bold tradeup-arrow-pulse">
                  →
                </div>
                <div className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                  canLegendaryReroll ? "bg-amber-500/20 border-amber-400/60 animate-pulse" : "bg-white/[0.04] border-amber-500/40"
                }`}>
                  {canLegendaryReroll ? (
                    <span className="text-xs text-amber-400 font-medium text-center px-1">1 Legendary</span>
                  ) : (
                    <span className="text-[10px] text-white/40 text-center px-1">?</span>
                  )}
                </div>
                {canLegendaryReroll && (
                  <button
                    onClick={() => handleLegendaryReroll()}
                    disabled={legendaryRerolling}
                    className="ml-auto px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-semibold hover:border-amber-500/50 hover:bg-amber-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                  >
                    {legendaryRerolling ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Rerolling...
                      </span>
                    ) : (
                      "Reroll"
                    )}
                  </button>
                )}
              </div>
            </div>
            )}

            {/* Legendary Reroll Result Modal */}
            {legendaryRerollResult && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setLegendaryRerollResultFading(true);
                    setTimeout(() => {
                      setLegendaryRerollResult(null);
                      setLegendaryRerollResultFading(false);
                    }, 500);
                  }
                }}
                role="presentation"
              >
                <div
                  className={`w-full max-w-sm rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 transition-opacity duration-500 tradeup-result-in ${
                    legendaryRerollResultFading ? "opacity-0" : "opacity-100"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-center text-lg font-semibold text-amber-400/90 mb-4">Legendary Reroll</h2>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-36 mx-auto">
                      <CardDisplay card={legendaryRerollResult} />
                    </div>
                    <p className="text-sm text-white/60 text-center capitalize">
                      {legendaryRerollResult.rarity} card
                    </p>
                    <button
                      onClick={() => {
                        setLegendaryRerollResultFading(true);
                        setTimeout(() => {
                          setLegendaryRerollResult(null);
                          setLegendaryRerollResultFading(false);
                        }, 500);
                      }}
                      className="px-4 py-2 rounded-lg border border-white/20 text-amber-400/90 text-sm font-medium hover:bg-white/[0.06] hover:border-amber-400/50 transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
            )}

            {inventorySubTab === "alchemy" && (
              <>
                {/* Alchemy: title + toggle (Bench | Prismatic Forge) — active = teal, inactive = dark */}
                <div className="rounded-2xl rounded-tl-none rounded-tr-none border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-2 transition-all duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-lg font-semibold text-amber-400/90">Alchemy</h2>
                      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
                        <button
                          type="button"
                          onClick={() => setAlchemySubTab("bench")}
                          className={`min-h-[32px] px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                            alchemySubTab === "bench"
                              ? "bg-cyan-500/25 text-white border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                              : "bg-transparent text-white/50 hover:text-white/70 border border-transparent"
                          }`}
                        >
                          Bench
                        </button>
                        {prismaticForgeUnlocked && (
                          <button
                            type="button"
                            onClick={() => setAlchemySubTab("forge")}
                            className={`min-h-[32px] px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                              alchemySubTab === "forge"
                                ? "bg-cyan-500/25 text-white border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                                : "bg-transparent text-white/50 hover:text-white/70 border border-transparent"
                            }`}
                          >
                            Prismatic Forge
                            {prismaticCraftCardId && <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm flex items-center gap-1.5 relative">
                        <span className="text-white/50">Prisms:</span>
                        <span className={`tabular-nums font-semibold text-cyan-200 relative ${prismAnimClass}`}>
                          {prisms}
                          {prismDelta !== null && (
                            <span
                              className={`absolute -top-1 left-[100%] ml-0.5 min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-bold stardust-delta-pop pointer-events-none whitespace-nowrap ${
                                prismDelta > 0 ? "text-cyan-300 bg-cyan-500/25" : "text-red-300 bg-red-500/25"
                              }`}
                            >
                              {prismDelta > 0 ? `+${prismDelta}` : prismDelta}
                            </span>
                          )}
                        </span>
                        <span className="ml-0.5 text-cyan-400/80" aria-hidden>◆</span>
                      </span>
                      <span className="text-sm text-amber-400/80 flex items-center gap-1.5 relative">
                        <span className="text-white/50">Stardust:</span>
                        <span className={`tabular-nums font-semibold text-amber-200 relative ${stardustAnimClass}`}>
                          {stardust}
                          {stardustDelta !== null && (
                            <span
                              className={`absolute -top-1 left-[100%] ml-0.5 min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-bold stardust-delta-pop pointer-events-none whitespace-nowrap ${
                                stardustDelta > 0 ? "text-amber-300 bg-amber-500/25" : "text-purple-300 bg-purple-500/25"
                              }`}
                            >
                              {stardustDelta > 0 ? `+${stardustDelta}` : stardustDelta}
                            </span>
                          )}
                        </span>
                        <span className="stardust-star-rainbow ml-0.5" aria-hidden>★</span>
                      </span>
                    </div>
                  </div>

                  <div>
                  {alchemySubTab === "bench" && (
                  <>
                  <p className="text-sm text-white/60 mb-4">
                    Foils → disenchant for Stardust (card becomes normal). Normals → Pack-A-Punch to Holo (costs Stardust, chance-based). Same type only. Forge tab: Prismatic crafting.
                  </p>
                  <div className={`flex items-center gap-4 mb-4 transition-all duration-300 ${alchemySuccessFlash ? "alchemy-success-flash" : ""}`}>
                    <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                    <div className="flex gap-2">
                      {alchemyBenchSlots.map((cardId, i) => {
                        const benchCard = cardId ? cards.find((c) => c.id === cardId) : null;
                        const showAsHolo = cardId != null && alchemyPunchHoloCardIds.includes(cardId);
                        const showAsFailed = cardId != null && alchemyPunchFailedCardIds.includes(cardId);
                        return (
                          <div
                            key={`${cardId ?? "empty"}-${i}`}
                            className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                              cardId && benchCard
                                ? `${SLOT_FILLED_STYLE[benchCard.rarity] ?? SLOT_FILLED_STYLE.uncommon} alchemy-bench-slot-pop group ${showAsHolo ? "ring-2 ring-indigo-400/50 ring-inset alchemy-card-success-flash" : ""} ${showAsFailed ? "ring-2 ring-red-400/60 ring-inset alchemy-card-fail-flash" : ""}`
                                : "border-dashed hover:opacity-90"
                            }`}
                            style={!cardId ? {
                              borderColor: "transparent",
                              background: "linear-gradient(rgb(28,28,33), rgb(28,28,33)) padding-box, conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444) border-box",
                            } : undefined}
                            onClick={() => !showAsHolo && cardId && removeFromAlchemyBench(cardId)}
                          >
                            {cardId && benchCard ? (
                              <div className="w-full h-full relative bg-black/20 transition-all duration-200 group-hover:opacity-60 group-hover:grayscale">
                                {benchCard.profilePath ? (
                                  <img
                                    src={benchCard.profilePath}
                                    alt=""
                                    className={`w-full h-full object-cover ${showAsHolo ? "holo-sheen" : ""}`}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">
                                    {(benchCard.actorName || "?")[0]}
                                  </div>
                                )}
                                {showAsHolo && (
                                  <div className="absolute inset-0 card-holo-hover pointer-events-none z-[2]" />
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-white/40 text-center px-1">Empty</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                    <div className="w-[220px] shrink-0 flex flex-col items-end justify-center gap-2">
                      {alchemyBenchType === "foil" && alchemyBenchCards.length > 0 ? (
                        <>
                          <span className="text-xs text-white/50 text-right">
                            Holo → Remove Holo from all for {alchemyBenchCards.reduce((sum, c) => sum + getDustForRarity(c.rarity), 0)} Stardust
                          </span>
                          <button
                            onClick={() => handleAlchemyDisenchantAll()}
                            disabled={alchemyDisenchantingId === "_all"}
                            className="px-5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {alchemyDisenchantingId === "_all" ? <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin inline-block" /> : "Remove Holo from all"}
                          </button>
                        </>
                      ) : alchemyBenchType === "normal" && alchemyBenchCards.length > 0 ? (
                        <>
                          <span className="text-xs text-white/50 text-right">
                            Normal → Pack-A-Punch all ({alchemyBenchCards.reduce((sum, c) => sum + getPackAPunchCost(c.rarity), 0)} Stardust)
                          </span>
                          <button
                            onClick={() => handleAlchemyPackAPunchAll()}
                            disabled={alchemyPunchingId === "_all" || stardust < alchemyBenchCards.reduce((sum, c) => sum + getPackAPunchCost(c.rarity), 0)}
                            className="px-5 py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/15 text-purple-300 font-semibold hover:bg-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {alchemyPunchingId === "_all" ? <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin inline-block" /> : "Pack-A-Punch all"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-white/40 text-right">Add cards from inventory below. Holos or normals only (same type).</span>
                      )}
                    </div>
                  </div>
                  </>
                  )}

                {alchemySubTab === "forge" && (
                  <>
                    {!prismaticForgeUnlocked ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                        <p className="text-amber-200/90 font-medium mb-1">Prismatic Forge is locked</p>
                        <p className="text-white/70 text-sm">Complete 50% of sets in holo finish in the Codex, then use <strong>Prestige Codex</strong> to reset your TCG account and unlock the Prismatic Forge permanently.</p>
                      </div>
                    ) : (
                  <>
                    <p className="text-sm text-white/60 mb-4">
                      Place a Holo Epic or Holo Legendary below. Epic Holo → disenchant for Prisms. Legendary Holo → apply Prisms to craft Prismatic.
                      {alchemySettings && <> Legendary failure awards {alchemySettings.prismaticCraftFailureStardust} Stardust; Prisms are consumed.</>}
                    </p>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                        <div className="flex gap-2">
                          <div
                            className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                              prismaticCraftCardId
                                ? `${SLOT_FILLED_STYLE[cards.find((c) => c.id === prismaticCraftCardId)?.rarity ?? "uncommon"] ?? SLOT_FILLED_STYLE.uncommon} group`
                                : "border-dashed hover:opacity-90"
                            }`}
                            style={!prismaticCraftCardId ? {
                              borderColor: "transparent",
                              background: "linear-gradient(rgb(28,28,33), rgb(28,28,33)) padding-box, conic-gradient(from 180deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4) border-box",
                            } : undefined}
                            onClick={() => {
                              if (prismaticCraftCardId) {
                                setPrismaticCraftCardId(null);
                                setPrismaticCraftResult(null);
                              }
                            }}
                          >
                            {prismaticCraftCardId ? (() => {
                              const c = cards.find((cc) => cc.id === prismaticCraftCardId);
                              if (!c) return <span className="text-[10px] text-white/40">?</span>;
                              return (
                                <div className="w-full h-full relative bg-black/20 group-hover:opacity-60 group-hover:grayscale transition-all">
                                  {c.profilePath ? (
                                    <img src={c.profilePath} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">{(c.actorName || "?")[0]}</div>
                                  )}
                                </div>
                              );
                            })() : (
                              <span className="text-[10px] text-white/40 text-center px-1">Holo Epic+</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-[220px] shrink-0 flex flex-col items-end justify-center gap-2">
                        {prismaticCraftCardId && alchemySettings ? (() => {
                          const forgeCard = cards.find((c) => c.id === prismaticCraftCardId);
                          const isEpic = forgeCard?.rarity === "epic";
                          const isLegendary = forgeCard?.rarity === "legendary";
                          if (isEpic) {
                            const prismsAwarded = alchemySettings.epicHoloForgePrisms ?? 1;
                            return (
                              <>
                                <span className="text-xs text-white/50 text-right">
                                  Epic Holo → {prismsAwarded} Prism(s)
                                </span>
                                <button
                                  onClick={() => handleDisenchantEpicForge()}
                                  disabled={disenchantEpicForgeLoading}
                                  className="px-5 py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 font-semibold hover:bg-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {disenchantEpicForgeLoading ? <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin inline-block" /> : "Disenchant for Prisms"}
                                </button>
                              </>
                            );
                          }
                          if (isLegendary) {
                            return (
                              <>
                                <span className="text-xs text-white/50 text-right">
                                  Prisms: {prismaticCraftPrisms}
                                </span>
                                <span className="text-xs text-cyan-300/70 text-right">
                                  Success: {Math.min(100, alchemySettings.prismaticCraftBaseChance + prismaticCraftPrisms * alchemySettings.prismaticCraftChancePerPrism)}%
                                </span>
                                <input
                                  type="range"
                                  min={1}
                                  max={Math.min(alchemySettings.prismaticCraftMaxPrisms, prisms || 1)}
                                  value={prismaticCraftPrisms}
                                  onChange={(e) => setPrismaticCraftPrisms(Number(e.target.value))}
                                  className="w-full accent-cyan-500"
                                />
                                <button
                                  onClick={() => handlePrismaticCraft()}
                                  disabled={prismaticCraftLoading || prisms < prismaticCraftPrisms}
                                  className="px-5 py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 font-semibold hover:bg-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {prismaticCraftLoading ? <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin inline-block" /> : "Craft Prismatic"}
                                </button>
                                {prismaticCraftResult && (
                                  <span className={`text-xs font-medium text-right ${prismaticCraftResult.success ? "text-green-400" : "text-red-400"}`}>
                                    {prismaticCraftResult.success ? "Prismatic crafted!" : `Failed — +${prismaticCraftResult.stardustAwarded} Stardust`}
                                  </span>
                                )}
                              </>
                            );
                          }
                          return null;
                        })(                        ) : (
                          <span className="text-xs text-white/40 text-right">Click a Holo Epic or Holo Legendary from your inventory to place it here.</span>
                        )}
                      </div>
                    </div>
                  </>
                    )}
                  </>
                )}
                  </div>
                </div>
                {alchemyError && (
                  <div
                    className={`mb-8 rounded-xl border border-red-500/40 bg-red-500/15 backdrop-blur-sm px-4 py-3 text-red-300 text-sm transition-opacity duration-500 ${alchemyErrorFading ? "opacity-0" : "opacity-100"}`}
                  >
                    {alchemyError}
                  </div>
                )}
              </>
            )}

            {inventorySubTab === "quicksell" && (
              <>
                <div className="rounded-2xl rounded-tl-none rounded-tr-none border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-2">
                  <h2 className="text-lg font-semibold text-amber-400/90 mb-2">Quicksell</h2>
                  <p className="text-sm text-white/60 mb-4">
                    Vendor up to 5 non-legendary cards for credits (by rarity).
                  </p>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex flex-wrap items-center gap-4 flex-1 min-w-0">
                    <div className="flex gap-2">
                      {quicksellBenchSlots.map((cardId, i) => {
                        const benchCard = cardId ? cards.find((c) => c.id === cardId) : null;
                        return (
                          <div
                            key={`${cardId ?? "empty"}-${i}`}
                            className={`w-20 h-28 sm:w-24 sm:h-36 flex-shrink-0 rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                              cardId && benchCard
                                ? `${SLOT_FILLED_STYLE[benchCard.rarity] ?? SLOT_FILLED_STYLE.uncommon} group`
                                : "border-sky-400/50 bg-sky-500/10 hover:border-sky-300/60 hover:bg-sky-500/20"
                            }`}
                            onClick={() => cardId && removeFromQuicksellBench(cardId)}
                          >
                            {cardId && benchCard ? (
                              <div className="w-full h-full relative bg-black/20 transition-all duration-200 group-hover:opacity-60 group-hover:grayscale">
                                {benchCard.profilePath ? (
                                  <img src={benchCard.profilePath} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">
                                    {(benchCard.actorName || "?")[0]}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="flex flex-col items-center justify-center gap-1 text-sky-300/90" aria-hidden>
                                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 7v10M9 10h6M9 14h6" />
                                </svg>
                                <span className="text-[10px] font-bold text-sky-300/90">cr</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                    <div className="w-[180px] shrink-0 flex flex-col items-end justify-center gap-2">
                      {quicksellBenchCards.length > 0 ? (
                        <>
                          <span className="text-xs text-white/50 text-right">
                            Vendor all for {quicksellBenchCards.reduce((sum, c) => sum + getQuicksellCreditsForDisplay(c.rarity), 0)} credits
                          </span>
                          <button
                            onClick={() => handleQuicksellAll()}
                            disabled={quicksellVendingId === "_all"}
                            className="px-5 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/15 text-sky-300 font-semibold hover:bg-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                          >
                            {quicksellVendingId === "_all" ? <span className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin inline-block" /> : "Vendor all"}
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-white/50 text-right">Add cards from inventory below.</span>
                          {canCodexdFillQuicksell() ? (
                            <button
                              onClick={fillQuicksellWithCodexd}
                              className="px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold hover:border-amber-500/50 hover:bg-amber-500/15 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                              Add Codex&apos;d
                            </button>
                          ) : (
                            <button
                              onClick={autoFillQuicksell}
                              className="px-5 py-2.5 rounded-xl border border-white/[0.18] bg-white/[0.06] text-white/80 font-semibold hover:bg-white/[0.1] hover:border-white/25 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                              Auto-fill
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {quicksellError && (
                  <div className="mb-8 rounded-xl border border-red-500/40 bg-red-500/15 backdrop-blur-sm px-4 py-3 text-red-300 text-sm">
                    {quicksellError}
                  </div>
                )}
              </>
            )}

            {/* Your inventory - always visible */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 mt-8">
              <h2 className="text-lg font-semibold text-white/90">Your inventory ({cards.length})</h2>
              <div className="flex items-center gap-3">
                <select
                  value={filterCardType}
                  onChange={(e) => setFilterCardType(e.target.value as "all" | "actor" | "character")}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 cursor-pointer"
                >
                  <option value="all">All types</option>
                  <option value="actor">Actor</option>
                  <option value="character">Boys</option>
                </select>
                <select
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 cursor-pointer"
                >
                  <option value="">All rarities</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
                <select
                  value={filterFoil}
                  onChange={(e) => setFilterFoil(e.target.value as "all" | "foil" | "normal")}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="foil">Holo only</option>
                  <option value="normal">Normal only</option>
                </select>
                <select
                  value={filterSort}
                  onChange={(e) => setFilterSort(e.target.value as "recent" | "name" | "movie" | "type")}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 cursor-pointer"
                >
                  <option value="recent">Most recent</option>
                  <option value="name">Name</option>
                  <option value="movie">Movie</option>
                  <option value="type">Type</option>
                </select>
              </div>
            </div>
            {cards.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No cards yet. Buy a pack in Shop to get started!</p>
              </div>
            ) : (() => {
              const filtered = filteredInventoryCards;

              /* ── Stacking: group identical cards ── */
              const stackKeyFn = (c: Card) =>
                `${c.characterId ?? ""}\x00${c.rarity}\x00${c.isFoil ? "f" : "n"}\x00${c.cardType ?? "actor"}`;

              type DisplayItem =
                | { kind: "single"; card: Card }
                | { kind: "stack"; stackKey: string; cards: Card[] };

              function buildDisplayItems(cardList: Card[]): DisplayItem[] {
                const listedIds = new Set(Array.from(myListedCardIds));
                const groups = new Map<string, Card[]>();
                const groupPositions = new Map<string, number>();
                const result: (DisplayItem | null)[] = [];

                for (const c of cardList) {
                  if (listedIds.has(c.id!)) {
                    result.push({ kind: "single", card: c });
                  } else {
                    const k = stackKeyFn(c);
                    if (!groups.has(k)) {
                      groups.set(k, []);
                      groupPositions.set(k, result.length);
                      result.push(null);
                    }
                    groups.get(k)!.push(c);
                  }
                }

                for (const [k, cards] of groups) {
                  const idx = groupPositions.get(k)!;
                  result[idx] = cards.length === 1
                    ? { kind: "single", card: cards[0] }
                    : { kind: "stack", stackKey: k, cards };
                }
                return result as DisplayItem[];
              }

              /* ── Single card renderer (unchanged logic) ── */
              const renderCard = (card: Card) => {
                const inSlots = tradeUpCardIds.includes(card.id!);
                const inRerollSlots = legendaryRerollCardIds.includes(card.id!);
                const onAlchemyBench = alchemyBenchCardIds.includes(card.id!);
                const onQuicksellBench = quicksellBenchCardIds.includes(card.id!);
                const onPrismaticForge = prismaticCraftCardId === card.id;
                const cardFinish = card.finish ?? (card.isFoil ? "holo" : "normal");
                const canAddPrismaticForge = prismaticForgeUnlocked && inventorySubTab === "alchemy" && alchemySubTab === "forge" && !myListedCardIds.has(card.id!) && !onAlchemyBench && !onPrismaticForge && !prismaticCraftCardId && card.isFoil && (card.rarity === "epic" || card.rarity === "legendary") && cardFinish !== "prismatic" && cardFinish !== "darkMatter";
                const canAddTradeUp = card.rarity !== "legendary" && !myListedCardIds.has(card.id!) && !inSlots && tradeUpCardIds.length < 4 && (tradeUpCards.length === 0 || (card.rarity === tradeUpCards[0]?.rarity && (card.cardType ?? "actor") === (tradeUpCards[0]?.cardType ?? "actor")));
                const canAddReroll = inventorySubTab === "tradeup" && card.rarity === "legendary" && !myListedCardIds.has(card.id!) && !inRerollSlots && legendaryRerollCardIds.length < 2 && (legendaryRerollCards.length === 0 || (card.cardType ?? "actor") === (legendaryRerollCards[0]?.cardType ?? "actor"));
                const canAddAlchemy = inventorySubTab === "alchemy" && alchemySubTab === "bench" && !myListedCardIds.has(card.id!) && !onAlchemyBench && alchemyBenchCardIds.length < 5 && (alchemyBenchType === null || (alchemyBenchType === "foil" && card.isFoil) || (alchemyBenchType === "normal" && !card.isFoil));
                const canAddQuicksell = inventorySubTab === "quicksell" && card.rarity !== "legendary" && !myListedCardIds.has(card.id!) && !onQuicksellBench && quicksellBenchCardIds.length < 5;
                const ineligibleTradeUp = inventorySubTab === "tradeup" && !canAddTradeUp && !canAddReroll && !inSlots && !inRerollSlots && (tradeUpCardIds.length > 0 || legendaryRerollCardIds.length > 0);
                const ineligibleAlchemy = alchemyBenchCardIds.length > 0 && !canAddAlchemy && !onAlchemyBench && !canAddPrismaticForge && !onPrismaticForge && inventorySubTab === "alchemy";
                const ineligibleQuicksell = quicksellBenchCardIds.length > 0 && !canAddQuicksell && !onQuicksellBench && inventorySubTab === "quicksell";
                const ineligible = ineligibleTradeUp || ineligibleAlchemy || ineligibleQuicksell;
                const isNewCard = card.acquiredAt && (Date.now() - new Date(card.acquiredAt).getTime() < NEW_CARD_DAYS_MS);
                const showNewDot = isNewCard && card.id && !seenCardIds.has(card.id);
                const handleClick = () => {
                  if (inventorySubTab === "alchemy") {
                    if (onAlchemyBench && card.id) { removeFromAlchemyBench(card.id); return; }
                    if (onPrismaticForge && card.id) { setPrismaticCraftCardId(null); setPrismaticCraftResult(null); return; }
                    if (canAddAlchemy && card.id) { addToAlchemyBench(card.id); return; }
                    if (canAddPrismaticForge && card.id) {
                      setPrismaticCraftCardId(card.id);
                      setPrismaticCraftPrisms(1);
                      setPrismaticCraftResult(null);
                      setShowPrismaticForgeTab(true);
                      setAlchemySubTab("forge");
                      return;
                    }
                    return;
                  }
                  if (inventorySubTab === "quicksell") {
                    if (onQuicksellBench && card.id) { removeFromQuicksellBench(card.id); return; }
                    if (canAddQuicksell && card.id) addToQuicksellBench(card.id);
                    return;
                  }
                  if (inRerollSlots && card.id) { removeFromLegendaryReroll(card.id); return; }
                  if (canAddReroll && card.id) { addToLegendaryReroll(card.id); return; }
                  if (inSlots && card.id) { removeFromTradeUpSlot(card.id); return; }
                  if (canAddTradeUp && card.id) addToTradeUpSlot(card.id!);
                };
                const isSelectable = (canAddTradeUp && inventorySubTab === "tradeup") || (canAddReroll && inventorySubTab === "tradeup") || (canAddAlchemy && inventorySubTab === "alchemy") || (canAddPrismaticForge && inventorySubTab === "alchemy") || (canAddQuicksell && inventorySubTab === "quicksell");
                const isOnBench = (inSlots && inventorySubTab === "tradeup") || (inRerollSlots && inventorySubTab === "tradeup") || (onAlchemyBench && inventorySubTab === "alchemy") || (onPrismaticForge && inventorySubTab === "alchemy") || (onQuicksellBench && inventorySubTab === "quicksell");
                const isTrackedCard = card.characterId && (trackedCharacterIds.has(card.characterId) || ((card.cardType ?? "actor") === "character" && trackedCharacterIds.has(`boys:${card.characterId}`)));
                return (
                  <div
                    key={card.id}
                    onClick={handleClick}
                    onMouseEnter={() => showNewDot && card.id && markCardSeen(card.id)}
                    className={`relative transition-opacity duration-200 ${
                      isSelectable || isOnBench || (card.rarity === "legendary" && inventorySubTab === "tradeup") ? "cursor-pointer" : ""
                    } ${ineligible ? "opacity-40 grayscale" : ""}`}
                  >
                    {showNewDot && (
                      <span className="absolute top-1 left-1 z-10 w-3 h-3 rounded-full bg-red-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.5)]" aria-label="New card" />
                    )}
                    {inSlots && inventorySubTab === "tradeup" && (
                      <span className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">
                        ✓
                      </span>
                    )}
                    {onAlchemyBench && inventorySubTab === "alchemy" && (
                      <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-purple-500/90 text-white text-[10px] font-bold">
                        In bench
                      </span>
                    )}
                    {onPrismaticForge && inventorySubTab === "alchemy" && (
                      <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-cyan-500/90 text-white text-[10px] font-bold">
                        In forge
                      </span>
                    )}
                    {onQuicksellBench && inventorySubTab === "quicksell" && (
                      <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-sky-500/90 text-white text-[10px] font-bold">
                        Quicksell
                      </span>
                    )}
                    {myListedCardIds.has(card.id!) && (
                      <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-xl text-xs text-white/60">
                        Listed
                      </span>
                    )}
                    <div className={`relative rounded-xl ${isTrackedCard ? "ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]" : ""}`}>
                      {isTrackedCard && (
                        <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded bg-amber-500/90 text-amber-950 text-[9px] font-bold uppercase tracking-wider pointer-events-none">
                          Tracked
                        </span>
                      )}
                      <CardDisplay card={{ ...card, isAltArt: isAltArtCard(card) }} inCodex={isCardSlotAlreadyInCodex(card)} selectable={isSelectable} />
                    </div>
                  </div>
                );
              };

              /* ── Stack renderer: cascade visual + count ── */
              const renderStackGroup = (stackKey: string, stackCards: Card[]) => {
                const benchIdsSet = new Set([
                  ...tradeUpCardIds,
                  ...legendaryRerollCardIds,
                  ...alchemyBenchCardIds,
                  ...quicksellBenchCardIds,
                ]);
                const freeCards = stackCards.filter(c => !benchIdsSet.has(c.id!));
                const freeCount = freeCards.length;

                if (freeCount === 0) return null;

                const front = freeCards[0];
                const totalCascadeLayers = Math.min(stackCards.length - 1, 3);
                const cascadeLayers = Math.min(freeCount - 1, 3);

                const findEligible = (): { card: Card; target: "tradeup" | "reroll" | "alchemy" | "quicksell" } | null => {
                  for (const c of stackCards) {
                    if (myListedCardIds.has(c.id!)) continue;
                    if (inventorySubTab === "alchemy") {
                      if (alchemySubTab === "forge") {
                        const finish = c.finish ?? (c.isFoil ? "holo" : "normal");
                        if (!prismaticCraftCardId && c.isFoil && (c.rarity === "epic" || c.rarity === "legendary") && finish !== "prismatic" && finish !== "darkMatter") return { card: c, target: "alchemy" };
                      } else {
                        if (!alchemyBenchCardIds.includes(c.id!) && alchemyBenchCardIds.length < 5 && (alchemyBenchType === null || (alchemyBenchType === "foil" && c.isFoil) || (alchemyBenchType === "normal" && !c.isFoil))) return { card: c, target: "alchemy" };
                      }
                    } else if (inventorySubTab === "quicksell") {
                      if (c.rarity !== "legendary" && !quicksellBenchCardIds.includes(c.id!) && quicksellBenchCardIds.length < 5) return { card: c, target: "quicksell" };
                    } else {
                      if (c.rarity === "legendary" && !legendaryRerollCardIds.includes(c.id!) && legendaryRerollCardIds.length < 2 && (legendaryRerollCards.length === 0 || (c.cardType ?? "actor") === (legendaryRerollCards[0]?.cardType ?? "actor"))) return { card: c, target: "reroll" };
                      if (c.rarity !== "legendary" && !tradeUpCardIds.includes(c.id!) && tradeUpCardIds.length < 4 && (tradeUpCards.length === 0 || (c.rarity === tradeUpCards[0]?.rarity && (c.cardType ?? "actor") === (tradeUpCards[0]?.cardType ?? "actor")))) return { card: c, target: "tradeup" };
                    }
                  }
                  return null;
                };

                const eligibleResult = findEligible();
                const canAct = eligibleResult !== null;
                const isIneligible = (() => {
                  if (inventorySubTab === "tradeup") return (tradeUpCardIds.length > 0 || legendaryRerollCardIds.length > 0) && !canAct;
                  if (inventorySubTab === "alchemy") return (alchemySubTab === "bench" ? alchemyBenchCardIds.length > 0 : !!prismaticCraftCardId) && !canAct;
                  if (inventorySubTab === "quicksell") return quicksellBenchCardIds.length > 0 && !canAct;
                  return false;
                })();
                const anyNew = freeCards.some((c) => c.acquiredAt && (Date.now() - new Date(c.acquiredAt).getTime() < NEW_CARD_DAYS_MS) && c.id && !seenCardIds.has(c.id));

                const handleStackClick = () => {
                  if (!eligibleResult) return;
                  const { card: eligible, target } = eligibleResult;
                  if (target === "alchemy") {
                    if (alchemySubTab === "forge") {
                      setPrismaticCraftCardId(eligible.id!);
                      setPrismaticCraftPrisms(1);
                      setPrismaticCraftResult(null);
                      setShowPrismaticForgeTab(true);
                      setAlchemySubTab("forge");
                    } else {
                      addToAlchemyBench(eligible.id!);
                    }
                  }
                  else if (target === "quicksell") addToQuicksellBench(eligible.id!);
                  else if (target === "reroll") addToLegendaryReroll(eligible.id!);
                  else addToTradeUpSlot(eligible.id!);
                };

                const handleMouseEnter = () => {
                  for (const c of freeCards) {
                    const isNew = c.acquiredAt && (Date.now() - new Date(c.acquiredAt).getTime() < NEW_CARD_DAYS_MS);
                    if (isNew && c.id && !seenCardIds.has(c.id)) markCardSeen(c.id);
                  }
                };

                const cascadeOffset = totalCascadeLayers * 3;

                return (
                  <div
                    key={stackKey}
                    className={`relative transition-opacity duration-200 ${
                      canAct ? "cursor-pointer" : ""
                    } ${isIneligible ? "opacity-40 grayscale" : ""}`}
                    style={{ marginBottom: cascadeOffset, marginRight: cascadeOffset }}
                    onClick={handleStackClick}
                    onMouseEnter={handleMouseEnter}
                  >
                    {/* Cascade shadow layers */}
                    {Array.from({ length: cascadeLayers }, (_, i) => {
                      const layer = cascadeLayers - i;
                      const offset = layer * 3;
                      const opacity = 0.02 + (i * 0.01);
                      const borderOpacity = 0.04 + (i * 0.015);
                      return (
                        <div
                          key={i}
                          className="absolute inset-0 rounded-xl"
                          style={{
                            transform: `translate(${offset}px, ${offset}px)`,
                            background: `rgba(255,255,255,${opacity})`,
                            border: `1px solid rgba(255,255,255,${borderOpacity})`,
                            zIndex: i,
                          }}
                        />
                      );
                    })}

                    {/* Front card */}
                    <div
                      className="relative"
                      style={{ zIndex: cascadeLayers + 1 }}
                    >
                      {(() => {
                        const isTrackedFront = front.characterId && (trackedCharacterIds.has(front.characterId) || ((front.cardType ?? "actor") === "character" && trackedCharacterIds.has(`boys:${front.characterId}`)));
                        return (
                          <div className={`relative rounded-xl ${isTrackedFront ? "ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]" : ""}`}>
                            {isTrackedFront && (
                              <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded bg-amber-500/90 text-amber-950 text-[9px] font-bold uppercase tracking-wider pointer-events-none">
                                Tracked
                              </span>
                            )}
                            <CardDisplay card={{ ...front, isAltArt: isAltArtCard(front) }} inCodex={isCardSlotAlreadyInCodex(front)} selectable={canAct} />
                          </div>
                        );
                      })()}
                    </div>

                    {/* New card dot */}
                    {anyNew && (
                      <span
                        className="absolute top-1 left-1 w-3 h-3 rounded-full bg-red-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        style={{ zIndex: cascadeLayers + 2 }}
                        aria-label="New card"
                      />
                    )}

                    {/* Stack count badge */}
                    <div
                      className="absolute flex items-center justify-center rounded-full bg-black/70 border border-white/20 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                      style={{ top: -8, right: -8 + cascadeOffset, minWidth: 24, height: 24, padding: '0 6px', zIndex: cascadeLayers + 3 }}
                    >
                      <span className="text-[11px] font-bold text-white/90 tabular-nums">×{freeCount}</span>
                    </div>
                  </div>
                );
              };

              /* ── Render a display item (single or stack) ── */
              const renderDisplayItem = (item: DisplayItem) => {
                if (item.kind === "stack") return renderStackGroup(item.stackKey, item.cards);
                return renderCard(item.card);
              };

              const gridClasses = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";
              if (filterSort === "type") {
                const byType = filtered.reduce((acc, c) => {
                  const t = (c.cardType ?? "actor") === "character" ? "Boys" : "Actor";
                  if (!acc[t]) acc[t] = [];
                  acc[t].push(c);
                  return acc;
                }, {} as Record<string, Card[]>);
                const typeOrder = ["Actor", "Boys"];
                return (
                  <div className="flex flex-col gap-8">
                    {typeOrder.filter((t) => byType[t]?.length).map((typeLabel) => (
                      <div key={typeLabel}>
                        <h3 className="text-sm font-medium text-white/70 mb-3">{typeLabel} ({byType[typeLabel].length})</h3>
                        <div className={gridClasses}>
                          {buildDisplayItems(byType[typeLabel]).map(renderDisplayItem)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              if (filterSort === "movie") {
                const byMovie = filtered.reduce((acc, c) => {
                  const m = c.movieTitle || "Unknown";
                  if (!acc[m]) acc[m] = [];
                  acc[m].push(c);
                  return acc;
                }, {} as Record<string, Card[]>);
                return (
                  <div className="flex flex-col gap-8">
                    {Object.entries(byMovie).map(([movieTitle, movieCards]) => (
                      <div key={movieTitle}>
                        <h3 className="text-sm font-medium text-white/70 mb-3">{movieTitle}</h3>
                        <div className={gridClasses}>
                          {buildDisplayItems(movieCards).map(renderDisplayItem)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className={gridClasses}>
                  {buildDisplayItems(filtered).map(renderDisplayItem)}
                </div>
              );
            })()}
          </div>
        )}

        {/* Marketplace */}
        {tab === "marketplace" && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <p className="text-white/50 text-sm">
                {marketplaceSubTab === "listings" ? "Buy and sell cards." : "Request a card; owners can fulfill in one click."}
              </p>
              {marketplaceSubTab === "listings" ? (
                <button
                  onClick={() => setShowListModal(true)}
                  className="px-4 py-2.5 rounded-xl border border-cyan-500/50 bg-cyan-500/20 backdrop-blur-md text-cyan-300 font-medium hover:border-cyan-400 hover:bg-cyan-500/30 transition-colors cursor-pointer"
                >
                  List a Card
                </button>
              ) : (
                <button
                  onClick={() => { setSelectedOrderCharacter(null); setOrderOfferPrice(""); setShowOrderModal(true); }}
                  className="px-4 py-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/20 backdrop-blur-md text-emerald-300 font-medium hover:border-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  Request a Card
                </button>
              )}
            </div>

            <div className="min-w-0 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto overflow-y-hidden scrollbar-tabs">
              <div className="flex gap-0 flex-nowrap w-max min-w-full rounded-t-lg border border-white/[0.12] border-b-0 bg-white/[0.04] p-0.5 mb-0">
              <button
                type="button"
                onClick={() => setMarketplaceSubTab("listings")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  marketplaceSubTab === "listings"
                    ? "bg-white/[0.08] text-white border-b border-transparent"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                Listings
              </button>
              <button
                type="button"
                onClick={() => setMarketplaceSubTab("orders")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  marketplaceSubTab === "orders"
                    ? "bg-white/[0.08] text-white border-b border-transparent"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                Orders
              </button>
              </div>
            </div>

            {marketplaceSubTab === "listings" && (
              <>
            {listings.length === 0 ? (
              <div className="rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No cards for sale yet. List your first card!</p>
              </div>
            ) : (
              <div className="rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {listings.map((listing) => (
                  <div key={listing.id} className="flex flex-col rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden">
                    <CardDisplay card={{ ...listing.card, isAltArt: isAltArtCard(listing.card) }} inCodex={isCardSlotAlreadyInCodex(listing.card)} />
                    <div className="border-t border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] text-white/40 truncate flex items-center gap-1.5 flex-wrap min-w-0">
                          by{" "}
                          <Link href={`/profile/${listing.sellerUserId}`} className="text-white/60 hover:text-sky-300 transition-colors truncate">
                            {listing.sellerName}
                          </Link>
                          {listing.sellerDisplayedBadge && <BadgePill movieTitle={listing.sellerDisplayedBadge.movieTitle} isHolo={listing.sellerDisplayedBadge.isHolo} />}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-400/10 backdrop-blur-md border border-sky-400/20 shadow-[0_2px_8px_rgba(0,0,0,0.15)] shrink-0">
                          <svg className="w-4 h-4 shrink-0 text-sky-300/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sky-300 font-bold text-sm tabular-nums">{listing.askingPrice}</span>
                          <span className="text-sky-300/70 text-xs font-semibold">cr</span>
                        </span>
                      </div>
                      {listing.sellerUserId === user.id ? (
                        <button
                          onClick={() => handleDelist(listing.id)}
                          disabled={delistingId === listing.id}
                          className="w-full px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          {delistingId === listing.id ? "Delisting..." : "Delist"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyListing(listing.id)}
                          disabled={creditBalance < listing.askingPrice || buyingId === listing.id}
                          className="w-full px-3 py-2 rounded-lg border border-amber-500/50 bg-amber-500/20 backdrop-blur-md text-amber-300 text-sm font-medium hover:border-amber-400 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          {buyingId === listing.id ? "Buying..." : "Buy"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}

            {showListModal && (
              <>
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => !listing && setShowListModal(false)} aria-hidden />
                <div
                  className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-[var(--background)] shadow-2xl overflow-hidden flex flex-col"
                  role="dialog"
                  aria-label="List a card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 flex flex-col flex-1 min-h-0 overflow-auto">
                    <h3 className="text-lg font-bold text-white/90 mb-4 shrink-0">List a Card</h3>
                    {!selectedCard ? (
                      <div className="flex-1 min-h-0 overflow-auto pr-1">
                        {availableToList.length === 0 ? (
                          <p className="text-white/40 text-sm">No cards available to list. Buy packs in Shop to get cards!</p>
                        ) : (
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {availableToList.map((card) => (
                              <button
                                key={card.id}
                                onClick={() => setSelectedCard(card)}
                                className="w-full max-w-[100px] mx-auto rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-white/60 focus:ring-white/60 transition-all cursor-pointer text-left"
                              >
                                <CardDisplay card={{ ...card, isAltArt: isAltArtCard(card) }} inCodex={isCardSlotAlreadyInCodex(card)} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-full flex justify-between items-center mb-4">
                          <span className="text-sm text-white/60">Listing this card</span>
                          <button
                            onClick={() => setSelectedCard(null)}
                            className="text-xs text-amber-400/80 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            Change card
                          </button>
                        </div>
                        <div className="w-32 mx-auto mb-6">
                          <CardDisplay card={selectedCard ? { ...selectedCard, isAltArt: isAltArtCard(selectedCard) } : undefined!} inCodex={selectedCard ? isCardSlotAlreadyInCodex(selectedCard) : false} />
                        </div>
                        <label className="block text-sm text-white/60 mb-2 w-full">Asking price (credits)</label>
                        <input
                          type="number"
                          min={1}
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 mb-4"
                          placeholder="e.g. 50"
                        />
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => { setSelectedCard(null); setListPrice(""); setShowListModal(false); }}
                            className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => selectedCard && handleListCard()}
                            disabled={listing || !listPrice || parseInt(listPrice, 10) < 1}
                            className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 disabled:opacity-40 cursor-pointer"
                          >
                            {listing ? "Listing..." : "List"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
              </>
            )}

            {marketplaceSubTab === "orders" && (
              <>
            {buyOrders.length === 0 ? (
              <div className="rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No buy orders yet. Be the first to request a card!</p>
              </div>
            ) : (
              <div className="rounded-b-2xl rounded-t-none border border-t-0 border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
                <div className="space-y-4">
                {buyOrders.map((order) => {
                  const myCardsForOrder = order.poolEntry
                    ? cards.filter(
                        (c) =>
                          c.characterId === order.characterId &&
                          !myListedCardIds.has(c.id)
                      )
                    : [];
                  const canFulfill = myCardsForOrder.length > 0 && order.requesterUserId !== user?.id;
                  const isMine = order.requesterUserId === user?.id;

                  return (
                    <div
                      key={order.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/20 bg-white/[0.06] backdrop-blur-xl p-4"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {order.poolEntry ? (
                          <div className="w-16 h-24 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                            <img
                              src={order.poolEntry.profilePath}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center text-white/30 text-xs">
                            ?
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-white/90 font-medium truncate">
                            {order.poolEntry?.characterName ?? "Unknown"} {order.poolEntry && <span className="text-white/50">· {order.poolEntry.actorName}</span>}
                          </p>
                          <p className="text-white/50 text-sm truncate">{order.poolEntry?.movieTitle ?? ""}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Link
                              href={`/profile/${order.requesterUserId}`}
                              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              {order.requesterName}
                            </Link>
                            {order.requesterDisplayedBadge && (
                              <BadgePill movieTitle={order.requesterDisplayedBadge.movieTitle} isHolo={order.requesterDisplayedBadge.isHolo} />
                            )}
                            {order.offerPrice > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {order.offerPrice} cr
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {isMine ? (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={cancellingOrderId === order.id}
                            className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            {cancellingOrderId === order.id ? "Cancelling..." : "Cancel"}
                          </button>
                        ) : canFulfill ? (
                          <button
                            onClick={() => handleFulfillOrder(order.id, myCardsForOrder[0].id)}
                            disabled={fulfillingOrderId === order.id}
                            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            {fulfillingOrderId === order.id ? "Trading..." : "Trade to them"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {showOrderModal && (
              <>
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => !creatingOrder && setShowOrderModal(false)} aria-hidden />
                <div
                  className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-[var(--background)] shadow-2xl overflow-hidden flex flex-col"
                  role="dialog"
                  aria-label="Request a card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 flex flex-col flex-1 min-h-0 overflow-auto">
                    <h3 className="text-lg font-bold text-white/90 mb-4 shrink-0">Request a Card</h3>
                    <p className="text-white/50 text-sm mb-4">Pick a card; owners can fulfill and get your offered credits.</p>
                    {!selectedOrderCharacter ? (
                      <div className="flex-1 min-h-0 overflow-auto pr-1">
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {poolEntries
                          .filter((p) => p.profilePath?.trim())
                          .map((entry) => (
                            <button
                              key={entry.characterId}
                              onClick={() => setSelectedOrderCharacter(entry)}
                              className="w-full max-w-[100px] mx-auto rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-emerald-500/60 focus:ring-emerald-500/60 transition-all cursor-pointer text-left"
                            >
                              <CardDisplay card={{ ...entry, isFoil: false, isAltArt: !!entry.altArtOfCharacterId }} inCodex={isCardSlotAlreadyInCodex({ ...entry, isFoil: false })} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-full flex justify-between items-center mb-4">
                          <span className="text-sm text-white/60">Requesting this card</span>
                          <button
                            onClick={() => { setSelectedOrderCharacter(null); setOrderOfferPrice(""); }}
                            className="text-xs text-emerald-400/80 hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                        <div className="w-32 mx-auto mb-6">
                          <CardDisplay card={selectedOrderCharacter ? { ...selectedOrderCharacter, isFoil: false, isAltArt: !!selectedOrderCharacter.altArtOfCharacterId } : undefined!} inCodex={selectedOrderCharacter ? isCardSlotAlreadyInCodex({ ...selectedOrderCharacter, isFoil: false }) : false} />
                        </div>
                        <label className="block text-sm text-white/60 mb-2 w-full">Credits to offer (optional, 0 = free request)</label>
                        <input
                          type="number"
                          min={0}
                          value={orderOfferPrice}
                          onChange={(e) => setOrderOfferPrice(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-emerald-500/40 mb-4"
                          placeholder="0"
                        />
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => { setSelectedOrderCharacter(null); setOrderOfferPrice(""); setShowOrderModal(false); }}
                            className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateOrder}
                            disabled={creatingOrder || (orderOfferPrice.trim() !== "" && (isNaN(parseInt(orderOfferPrice, 10)) || parseInt(orderOfferPrice, 10) < 0)) || (orderOfferPrice.trim() !== "" && creditBalance < parseInt(orderOfferPrice, 10))}
                            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-40 cursor-pointer"
                          >
                            {creatingOrder ? "Creating..." : "Request"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
              </>
            )}
          </>
        )}

        {/* Trivia */}
        {tab === "trivia" && (
          <div>
            <p className="text-white/50 text-sm mb-6">
              Play trivia on winning movies for credits (once per movie). Quests give more.
            </p>
            {winners.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No movies with trivia yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {winners.map((w) => {
                  const completed = triviaCompletedIds.has(w.id);
                  return (
                    <Link
                      key={w.id}
                      href={`/winners/${w.id}`}
                      className={`rounded-xl border overflow-hidden bg-white/[0.02] transition-transform border-white/[0.08] group ${
                        completed ? "opacity-50 grayscale hover:opacity-60 hover:grayscale-[0.3]" : "hover:scale-[1.02] hover:border-purple-500/30"
                      }`}
                    >
                      <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                        {w.posterUrl ? (
                          <img
                            src={w.posterUrl}
                            alt={w.movieTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl font-bold">
                            {w.movieTitle.charAt(0)}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                        <span className="absolute bottom-2 left-2 right-2 text-[10px] font-medium text-white/80 truncate">
                          {w.movieTitle}
                        </span>
                        {completed ? (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/90 text-black">
                            ✓ Done
                          </span>
                        ) : (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/90 text-white">
                            Play
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Trade feedback toast */}
        {tradeFeedback && (
          <div
            className={`fixed left-1/2 top-24 z-50 -translate-x-1/2 trade-feedback-toast pointer-events-none ${
              tradeFeedback === "accepted"
                ? "rounded-xl border border-green-500/40 bg-green-500/20 backdrop-blur-xl px-6 py-4 shadow-[0_8px_32px_rgba(34,197,94,0.25)]"
                : tradeFeedback === "created"
                  ? "rounded-xl border border-amber-500/40 bg-amber-500/20 backdrop-blur-xl px-6 py-4 shadow-[0_8px_32px_rgba(251,191,36,0.25)]"
                  : "rounded-xl border border-white/20 bg-white/[0.08] backdrop-blur-xl px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            }`}
          >
            <p className={`text-sm font-semibold ${
              tradeFeedback === "accepted" ? "text-green-300" :
              tradeFeedback === "created" ? "text-amber-300" : "text-white/80"
            }`}>
              {tradeFeedback === "accepted" ? "Trade accepted!" : tradeFeedback === "created" ? "Offer sent!" : "Offer denied"}
            </p>
          </div>
        )}

        {/* Trade */}
        {tab === "trade" && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <p className="text-white/50 text-sm">
                Trade cards with other users. List cards on the trade block, send offers, and accept or deny incoming trades.
              </p>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => { setTradeBlockSelectedCard(null); setTradeBlockNote(""); setShowTradeBlockModal(true); }}
                  className="px-4 py-2.5 rounded-xl border border-teal-500/50 bg-teal-500/20 backdrop-blur-md text-teal-300 font-medium hover:border-teal-400 hover:bg-teal-500/30 transition-colors cursor-pointer"
                >
                  List on Trade Block
                </button>
                <button
                  onClick={openTradeModal}
                  className="px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-medium hover:border-amber-500/50 hover:bg-amber-500/15 transition-colors cursor-pointer"
                >
                  Start Trade
                </button>
              </div>
            </div>

            {/* Trade Block section */}
            <div className="mb-10">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">Trade Block</h3>
              {tradeBlockEntries.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center">
                  <p className="text-white/40 text-sm mb-2">No cards on the trade block yet.</p>
                  <p className="text-white/30 text-xs">List cards you&apos;re willing to trade so others can browse and send you offers.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {tradeBlockEntries.map((entry) => {
                      const isOwn = entry.userId === user?.id;
                      return (
                        <div key={entry.id} className="flex flex-col rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden">
                          <CardDisplay card={{ ...entry.card, isAltArt: false }} />
                          <div className="border-t border-white/10 bg-white/[0.02] p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Link href={`/profile/${entry.userId}`} className="text-[10px] text-white/60 hover:text-sky-300 transition-colors truncate">
                                {entry.userName}
                              </Link>
                            </div>
                            {entry.note && (
                              <p className="text-[10px] text-white/40 mb-2 line-clamp-2 italic">&quot;{entry.note}&quot;</p>
                            )}
                            {isOwn ? (
                              <button
                                onClick={async () => {
                                  setTradeBlockRemovingId(entry.id);
                                  try {
                                    const res = await fetch("/api/trade-block", {
                                      method: "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ userId: user?.id, entryId: entry.id }),
                                    });
                                    if (res.ok) await refreshTradeBlock();
                                  } catch { /* ignore */ }
                                  setTradeBlockRemovingId(null);
                                }}
                                disabled={tradeBlockRemovingId === entry.id}
                                className="w-full px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
                              >
                                {tradeBlockRemovingId === entry.id ? "Removing..." : "Remove"}
                              </button>
                            ) : (
                              <Link
                                href={`/cards?tradeWith=${entry.userId}`}
                                className="block w-full px-3 py-2 rounded-lg border border-amber-500/50 bg-amber-500/20 backdrop-blur-md text-amber-300 text-sm font-medium text-center hover:border-amber-400 hover:bg-amber-500/30 transition-colors"
                              >
                                Offer Trade
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sent offers — compact by default, expand on View */}
            {sentTrades.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">Sent</h3>
                <div className="space-y-2">
                  {sentTrades.map((t) => {
                    const expanded = expandedSentTradeId === t.id;
                    const offerSummary = `${t.offeredCards.length} card${t.offeredCards.length !== 1 ? "s" : ""}${(t.offeredCredits ?? 0) > 0 ? ` + ${t.offeredCredits} cr` : ""}`;
                    const requestSummary = `${t.requestedCards.length} card${t.requestedCards.length !== 1 ? "s" : ""}${(t.requestedCredits ?? 0) > 0 ? ` + ${t.requestedCredits} cr` : ""}`;
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-2xl overflow-hidden"
                      >
                        {!expanded ? (
                          <div className="flex items-center gap-3 p-3 min-h-0">
                            {t.counterpartyUserId && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Link href={`/profile/${t.counterpartyUserId}`} className="flex items-center gap-2 hover:opacity-80">
                                  {userAvatarMap[t.counterpartyUserId] ? (
                                    <img src={userAvatarMap[t.counterpartyUserId]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                      {t.counterpartyName?.charAt(0) || "?"}
                                    </div>
                                  )}
                                  <span className="text-sm font-medium text-white/80">{t.counterpartyName || "Unknown"}</span>
                                </Link>
                                {t.counterpartyDisplayedBadge && <BadgePill movieTitle={t.counterpartyDisplayedBadge.movieTitle} isHolo={t.counterpartyDisplayedBadge.isHolo} />}
                              </div>
                            )}
                            <div className="flex-1 flex justify-center items-center min-w-0 py-0.5">
                              <div className="flex items-center gap-2 flex-nowrap">
                                <div className="flex gap-1 shrink-0 items-center">
                                  {t.offeredCards.slice(0, 3).map((c) => (
                                    <div key={c.id} className="w-8 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                  {t.offeredCards.length > 3 && <span className="text-[10px] text-white/40">+{t.offeredCards.length - 3}</span>}
                                  {(t.offeredCredits ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{(t.offeredCredits ?? 0)} cr</span>}
                                </div>
                                <span className="text-white/30 text-xs shrink-0">→</span>
                                <div className="flex gap-1 shrink-0 items-center">
                                  {t.requestedCards.slice(0, 3).map((c) => (
                                    <div key={c.id} className="w-8 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                  {t.requestedCards.length > 3 && <span className="text-[10px] text-white/40">+{t.requestedCards.length - 3}</span>}
                                  {(t.requestedCredits ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{(t.requestedCredits ?? 0)} cr</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => setExpandedSentTradeId(t.id)} className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/80 text-sm hover:bg-white/10 cursor-pointer">View</button>
                              <button onClick={() => handleCancelTrade(t.id)} disabled={tradeActionId === t.id} className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/15 disabled:opacity-40 cursor-pointer">{tradeActionId === t.id ? "..." : "Cancel"}</button>
                            </div>
                          </div>
                        ) : (
                          /* Expanded trade view */
                          <div>
                            <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/[0.08]">
                              <span className="text-sm font-medium text-white/90">Trade with {t.counterpartyName || "Unknown"}</span>
                              <button onClick={() => setExpandedSentTradeId(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer transition-colors" aria-label="Close">&times;</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] min-h-[180px]">
                              {/* You give */}
                              <div className="p-4 bg-black/15 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
                                  {user?.id && (userAvatarMap[user.id] ? <img src={userAvatarMap[user.id]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{user.name?.charAt(0) || "?"}</div>)}
                                  <span className="text-[11px] font-semibold text-red-400/70 uppercase tracking-widest">You give</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 flex-1 content-start">
                                  {t.offeredCards.map((c) => (
                                    <div key={c.id} className="max-w-[80px]"><CardDisplay card={c} compact /></div>
                                  ))}
                                </div>
                                {(t.offeredCredits ?? 0) > 0 && <div className="mt-3 pt-2 border-t border-white/[0.06]"><span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">{(t.offeredCredits ?? 0)} credits</span></div>}
                              </div>
                              {/* Divider */}
                              <div className="hidden sm:flex flex-col items-center justify-center px-3 bg-black/20">
                                <svg className="w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                              </div>
                              {/* You receive */}
                              <div className="p-4 bg-black/15 flex flex-col border-t sm:border-t-0 border-white/[0.06]">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
                                  {t.counterpartyUserId && (userAvatarMap[t.counterpartyUserId] ? <img src={userAvatarMap[t.counterpartyUserId]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{(t.counterpartyName || "?")[0]}</div>)}
                                  <span className="text-[11px] font-semibold text-green-400/70 uppercase tracking-widest">You receive</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 flex-1 content-start">
                                  {t.requestedCards.map((c) => (
                                    <div key={c.id} className="max-w-[80px]"><CardDisplay card={c} compact /></div>
                                  ))}
                                </div>
                                {(t.requestedCredits ?? 0) > 0 && <div className="mt-3 pt-2 border-t border-white/[0.06]"><span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">{(t.requestedCredits ?? 0)} credits</span></div>}
                              </div>
                            </div>
                            <div className="px-4 py-3 bg-black/25 border-t border-white/[0.08] flex flex-wrap gap-2">
                              <button onClick={() => setExpandedSentTradeId(null)} className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] text-white/60 text-sm hover:bg-white/[0.08] cursor-pointer transition-colors">Collapse</button>
                              <button onClick={() => handleCancelTrade(t.id)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-red-500/25 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/15 disabled:opacity-40 cursor-pointer transition-colors">{tradeActionId === t.id ? "Cancelling..." : "Cancel offer"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Received offers — compact by default, View trade expands to clear detail + Accept / Edit / Deny */}
            {receivedTrades.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">Received</h3>
                <div className="space-y-2">
                  {receivedTrades.map((t) => {
                    const expanded = expandedReceivedTradeId === t.id;
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-2xl overflow-hidden"
                      >
                        {!expanded ? (
                          <div className="flex items-center gap-3 p-3 min-h-0">
                            {t.initiatorUserId && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Link href={`/profile/${t.initiatorUserId}`} className="flex items-center gap-2 hover:opacity-80">
                                  {userAvatarMap[t.initiatorUserId] ? (
                                    <img src={userAvatarMap[t.initiatorUserId]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                      {t.initiatorName?.charAt(0) || "?"}
                                    </div>
                                  )}
                                  <span className="text-sm font-medium text-white/80">{t.initiatorName || "Unknown"}</span>
                                </Link>
                                {t.initiatorDisplayedBadge && <BadgePill movieTitle={t.initiatorDisplayedBadge.movieTitle} isHolo={t.initiatorDisplayedBadge.isHolo} />}
                              </div>
                            )}
                            <div className="flex-1 flex justify-center items-center min-w-0 py-0.5">
                              <div className="flex items-center gap-2 flex-nowrap">
                                <div className="flex gap-1 shrink-0 items-center">
                                  {t.offeredCards.slice(0, 3).map((c) => (
                                    <div key={c.id} className="w-8 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                  {t.offeredCards.length > 3 && <span className="text-[10px] text-white/40">+{t.offeredCards.length - 3}</span>}
                                  {(t.offeredCredits ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{(t.offeredCredits ?? 0)} cr</span>}
                                </div>
                                <span className="text-white/30 text-xs shrink-0">→</span>
                                <div className="flex gap-1 shrink-0 items-center">
                                  {t.requestedCards.slice(0, 3).map((c) => (
                                    <div key={c.id} className="w-8 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                  {t.requestedCards.length > 3 && <span className="text-[10px] text-white/40">+{t.requestedCards.length - 3}</span>}
                                  {(t.requestedCredits ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{(t.requestedCredits ?? 0)} cr</span>}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setExpandedReceivedTradeId(t.id)}
                              className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm hover:bg-amber-500/20 cursor-pointer shrink-0"
                            >
                              View trade
                            </button>
                          </div>
                        ) : (
                          /* Expanded received trade view */
                          <div>
                            <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/[0.08]">
                              <div className="flex items-center gap-2">
                                <Link href={`/profile/${t.initiatorUserId}`} className="flex items-center gap-2 hover:opacity-80 shrink-0">
                                  {t.initiatorUserId && (userAvatarMap[t.initiatorUserId] ? <img src={userAvatarMap[t.initiatorUserId]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{(t.initiatorName || "?")[0]}</div>)}
                                  <span className="text-sm font-medium text-white/90">{t.initiatorName || "Unknown"}</span>
                                </Link>
                                {t.initiatorDisplayedBadge && <BadgePill movieTitle={t.initiatorDisplayedBadge.movieTitle} isHolo={t.initiatorDisplayedBadge.isHolo} />}
                                <span className="text-white/30 text-xs">wants to trade</span>
                              </div>
                              <button onClick={() => setExpandedReceivedTradeId(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer transition-colors" aria-label="Close">&times;</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] min-h-[180px]">
                              {/* They give (you get) */}
                              <div className="p-4 bg-black/15 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
                                  <span className="text-[11px] font-semibold text-green-400/70 uppercase tracking-widest">You receive</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 flex-1 content-start">
                                  {t.offeredCards.map((c) => (
                                    <div key={c.id} className="max-w-[80px]"><CardDisplay card={c} compact /></div>
                                  ))}
                                </div>
                                {(t.offeredCredits ?? 0) > 0 && <div className="mt-3 pt-2 border-t border-white/[0.06]"><span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">{(t.offeredCredits ?? 0)} credits</span></div>}
                              </div>
                              {/* Divider */}
                              <div className="hidden sm:flex flex-col items-center justify-center px-3 bg-black/20">
                                <svg className="w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                              </div>
                              {/* You give */}
                              <div className="p-4 bg-black/15 flex flex-col border-t sm:border-t-0 border-white/[0.06]">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
                                  <span className="text-[11px] font-semibold text-red-400/70 uppercase tracking-widest">You give</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 flex-1 content-start">
                                  {t.requestedCards.map((c) => (
                                    <div key={c.id} className="max-w-[80px]"><CardDisplay card={c} compact /></div>
                                  ))}
                                </div>
                                {(t.requestedCredits ?? 0) > 0 && <div className="mt-3 pt-2 border-t border-white/[0.06]"><span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">{(t.requestedCredits ?? 0)} credits</span></div>}
                              </div>
                            </div>
                            <div className="px-4 py-3 bg-black/25 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
                              <button onClick={() => setExpandedReceivedTradeId(null)} className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] text-white/60 text-sm hover:bg-white/[0.08] cursor-pointer transition-colors">Collapse</button>
                              <div className="flex-1" />
                              <button onClick={() => handleDenyTrade(t.id)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-red-500/25 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/15 disabled:opacity-40 cursor-pointer transition-colors">Decline</button>
                              <button onClick={() => openEditTrade(t)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400 text-sm hover:bg-amber-500/15 disabled:opacity-40 cursor-pointer transition-colors">Counter</button>
                              <button onClick={() => handleAcceptTrade(t.id)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/15 text-green-400 text-sm font-medium hover:bg-green-500/25 disabled:opacity-40 cursor-pointer transition-colors">{tradeActionId === t.id ? "..." : "Accept"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sentTrades.length === 0 && receivedTrades.length === 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm mb-2">No pending trades.</p>
                <p className="text-white/30 text-xs">Click &quot;Start Trade&quot; to send an offer to another user.</p>
              </div>
            )}

            {/* History — past transactions (accepted / declined) */}
            {tradeHistory.length > 0 && (
              <div className="mt-10 mb-8">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">History</h3>
                <p className="text-white/40 text-xs mb-4">Your past trade transactions (accepted and declined).</p>
                <div className="space-y-2">
                  {tradeHistory.map((t) => {
                    const expanded = expandedHistoryTradeId === t.id;
                    const isSent = t.initiatorUserId === user?.id;
                    const otherUserId = isSent ? t.counterpartyUserId : t.initiatorUserId;
                    const otherName = isSent ? t.counterpartyName : t.initiatorName;
                    const otherBadge = isSent ? t.counterpartyDisplayedBadge : t.initiatorDisplayedBadge;
                    const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString(undefined, { dateStyle: "short" }) : "";
                    const timeStr = t.createdAt ? new Date(t.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl border border-white/[0.12] bg-white/[0.04] backdrop-blur-2xl overflow-hidden"
                      >
                        {!expanded ? (
                          <div className="flex items-center gap-3 p-3 min-h-0">
                            <div className="flex items-center gap-2 shrink-0">
                              <Link href={`/profile/${otherUserId}`} className="flex items-center gap-2 hover:opacity-80">
                                {userAvatarMap[otherUserId] ? (
                                  <img src={userAvatarMap[otherUserId]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                    {otherName?.charAt(0) || "?"}
                                  </div>
                                )}
                                <span className="text-sm font-medium text-white/80">{otherName || "Unknown"}</span>
                              </Link>
                              {otherBadge && <BadgePill movieTitle={otherBadge.movieTitle} isHolo={otherBadge.isHolo} />}
                            </div>
                            <div className="flex-1 flex justify-center items-center min-w-0 py-0.5">
                              <div className="flex items-center gap-2 flex-nowrap">
                                <div className="flex gap-1 shrink-0 items-center">
                                  {t.offeredCards.slice(0, 3).map((c) => (
                                    <div key={c.id} className="w-8 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                  {t.offeredCards.length > 3 && <span className="text-[10px] text-white/40">+{t.offeredCards.length - 3}</span>}
                                  {(t.offeredCredits ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{(t.offeredCredits ?? 0)} cr</span>}
                                </div>
                                <span className="text-white/30 text-xs shrink-0">↔</span>
                                <div className="flex gap-1 shrink-0 items-center">
                                  {t.requestedCards.slice(0, 3).map((c) => (
                                    <div key={c.id} className="w-8 h-10 rounded overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                  {t.requestedCards.length > 3 && <span className="text-[10px] text-white/40">+{t.requestedCards.length - 3}</span>}
                                  {(t.requestedCredits ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">{(t.requestedCredits ?? 0)} cr</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-white/40 text-xs whitespace-nowrap">{dateStr} {timeStr}</span>
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${t.status === "accepted" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/25"}`}>
                                {t.status === "accepted" ? "Accepted" : "Declined"}
                              </span>
                              <button onClick={() => setExpandedHistoryTradeId(t.id)} className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/80 text-sm hover:bg-white/10 cursor-pointer">View</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between px-4 py-3 bg-black/30 border-b border-white/[0.08]">
                              <span className="text-sm font-medium text-white/90">Trade with {otherName || "Unknown"} · {dateStr} {timeStr}</span>
                              <button onClick={() => setExpandedHistoryTradeId(null)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer transition-colors" aria-label="Close">&times;</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] min-h-[180px]">
                              <div className="p-4 bg-black/15 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
                                  {isSent && user?.id && (userAvatarMap[user.id] ? <img src={userAvatarMap[user.id]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{user?.name?.charAt(0) || "?"}</div>)}
                                  {!isSent && (userAvatarMap[otherUserId] ? <img src={userAvatarMap[otherUserId]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{(otherName || "?")[0]}</div>)}
                                  <span className="text-[11px] font-semibold text-red-400/70 uppercase tracking-widest">{isSent ? "You gave" : "They gave"}</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 flex-1 content-start">
                                  {t.offeredCards.map((c) => (
                                    <div key={c.id} className="max-w-[80px]"><CardDisplay card={c} compact /></div>
                                  ))}
                                </div>
                                {(t.offeredCredits ?? 0) > 0 && <div className="mt-3 pt-2 border-t border-white/[0.06]"><span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">{(t.offeredCredits ?? 0)} credits</span></div>}
                              </div>
                              <div className="hidden sm:flex flex-col items-center justify-center px-3 bg-black/20">
                                <svg className="w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                              </div>
                              <div className="p-4 bg-black/15 flex flex-col border-t sm:border-t-0 border-white/[0.06]">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
                                  {!isSent && user?.id && (userAvatarMap[user.id] ? <img src={userAvatarMap[user.id]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{user?.name?.charAt(0) || "?"}</div>)}
                                  {isSent && (userAvatarMap[otherUserId] ? <img src={userAvatarMap[otherUserId]} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{(otherName || "?")[0]}</div>)}
                                  <span className="text-[11px] font-semibold text-green-400/70 uppercase tracking-widest">{isSent ? "You received" : "You gave"}</span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 flex-1 content-start">
                                  {t.requestedCards.map((c) => (
                                    <div key={c.id} className="max-w-[80px]"><CardDisplay card={c} compact /></div>
                                  ))}
                                </div>
                                {(t.requestedCredits ?? 0) > 0 && <div className="mt-3 pt-2 border-t border-white/[0.06]"><span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">{(t.requestedCredits ?? 0)} credits</span></div>}
                              </div>
                            </div>
                            <div className="px-4 py-3 bg-black/25 border-t border-white/[0.08] flex flex-wrap gap-2 items-center">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${t.status === "accepted" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/25"}`}>
                                {t.status === "accepted" ? "Accepted" : "Declined"}
                              </span>
                              <button onClick={() => setExpandedHistoryTradeId(null)} className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] text-white/60 text-sm hover:bg-white/[0.08] cursor-pointer transition-colors">Collapse</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trade Block - List Card Modal */}
            {showTradeBlockModal && (
                  <>
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => !tradeBlockPosting && setShowTradeBlockModal(false)} aria-hidden />
                    <div
                      className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-[var(--background)] shadow-2xl overflow-hidden flex flex-col"
                      role="dialog"
                      aria-label="List a card on the trade block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-6 flex flex-col flex-1 min-h-0 overflow-auto">
                        <h3 className="text-lg font-bold text-white/90 mb-2 shrink-0">List a Card on the Trade Block</h3>
                        <p className="text-white/50 text-sm mb-4">List a card; others can send offers.</p>
                        {!tradeBlockSelectedCard ? (
                          <div className="flex-1 min-h-0 overflow-auto pr-1">
                            {(() => {
                              const tradeBlockCardIds = new Set(tradeBlockEntries.filter((e) => e.userId === user?.id).map((e) => e.cardId));
                              const available = cards.filter(
                                (c) => !myListedCardIds.has(c.id) && !tradeBlockCardIds.has(c.id)
                              );
                              return available.length === 0 ? (
                                <p className="text-white/40 text-sm">No cards available to list.</p>
                              ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                  {available.map((card) => (
                                    <button
                                      key={card.id}
                                      onClick={() => setTradeBlockSelectedCard(card)}
                                      className="w-full max-w-[100px] mx-auto rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-teal-500/60 focus:ring-teal-500/60 transition-all cursor-pointer text-left"
                                    >
                                      <CardDisplay card={card} />
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="w-full flex justify-between items-center mb-4">
                              <span className="text-sm text-white/60">Listing this card</span>
                              <button
                                onClick={() => setTradeBlockSelectedCard(null)}
                                className="text-xs text-teal-400/80 hover:text-teal-400 transition-colors cursor-pointer"
                              >
                                Change card
                              </button>
                            </div>
                            <div className="w-32 mx-auto mb-6">
                              <CardDisplay card={tradeBlockSelectedCard} />
                            </div>
                            <label className="block text-sm text-white/60 mb-2 w-full">Note (optional, max 100 chars)</label>
                            <input
                              type="text"
                              maxLength={100}
                              value={tradeBlockNote}
                              onChange={(e) => setTradeBlockNote(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-teal-500/40 mb-4"
                              placeholder='e.g. "Looking for legendaries"'
                            />
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => { setTradeBlockSelectedCard(null); setTradeBlockNote(""); setShowTradeBlockModal(false); }}
                                className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  if (!tradeBlockSelectedCard || !user) return;
                                  setTradeBlockPosting(true);
                                  try {
                                    const res = await fetch("/api/trade-block", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        userId: user.id,
                                        cardId: tradeBlockSelectedCard.id,
                                        note: tradeBlockNote.trim(),
                                      }),
                                    });
                                    if (res.ok) {
                                      await refreshTradeBlock();
                                      setTradeBlockSelectedCard(null);
                                      setTradeBlockNote("");
                                      setShowTradeBlockModal(false);
                                    }
                                  } catch { /* ignore */ }
                                  setTradeBlockPosting(false);
                                }}
                                disabled={tradeBlockPosting}
                                className="flex-1 px-4 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-500 disabled:opacity-40 cursor-pointer"
                              >
                                {tradeBlockPosting ? "Listing..." : "List on Trade Block"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
          </>
        )}

        {/* Codex — upload, then sub-tabs (Codex | Badges), then content */}
        {tab === "codex" && (
          <div>
            <div className="flex flex-col items-center gap-3 mb-4">
              <p className="text-white/50 text-sm text-center max-w-xl">
                Upload cards to discover them (card leaves collection; legendaries re-enter pool). Complete a set for badge tiers.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodexUploadModal(true);
                    setCodexUploadSelectedIds(new Set());
                  }}
                  className="px-6 py-2 rounded-xl border-2 border-cyan-500/50 bg-cyan-500/20 text-cyan-300 font-bold hover:border-cyan-400 hover:bg-cyan-500/30 transition-colors cursor-pointer"
                >
                  Upload to Codex
                </button>
                <button
                  type="button"
                  onClick={toggleCodexSoundMuted}
                  className={`p-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                    codexSoundMuted
                      ? "border-white/30 bg-white/10 text-white/50 hover:bg-white/15 hover:text-white/60"
                      : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/25"
                  }`}
                  title={codexSoundMuted ? "Unmute codex upload sound" : "Mute codex upload sound"}
                  aria-label={codexSoundMuted ? "Unmute codex upload sound" : "Mute codex upload sound"}
                >
                  {codexSoundMuted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
                {winners.length > 0 && completedHoloBadgeWinnerIds.size >= Math.ceil(winners.length * 0.5) && (
                  <button
                    type="button"
                    onClick={() => setShowPrestigeCodexConfirm(true)}
                    className="px-6 py-2 rounded-xl border-2 border-amber-500/50 bg-amber-500/20 text-amber-300 font-bold hover:border-amber-400 hover:bg-amber-500/30 transition-colors cursor-pointer"
                  >
                    Prestige Codex
                  </button>
                )}
              </div>
            </div>
            {showPrestigeCodexConfirm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/95 to-yellow-950/95 backdrop-blur-xl shadow-xl max-w-md w-full p-6 text-center">
                  <h3 className="text-lg font-bold text-amber-200 mb-2">Prestige Codex</h3>
                  <p className="text-white/80 text-sm mb-4">
                    Reset your TCG account to fresh (all cards, credits, codex, stardust, prisms, etc. will be cleared) and <strong>unlock the Prismatic Forge</strong> permanently. This cannot be undone.
                  </p>
                  <p className="text-amber-200/90 text-sm mb-6">Are you sure you want to prestige?</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => !prestigeCodexLoading && setShowPrestigeCodexConfirm(false)}
                      disabled={prestigeCodexLoading}
                      className="px-5 py-2.5 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/10 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (prestigeCodexLoading) return;
                        const uid = getUserId();
                        if (!uid) return;
                        setPrestigeCodexLoading(true);
                        try {
                          const res = await fetch("/api/cards/prestige-codex", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: uid }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok) {
                            setShowPrestigeCodexConfirm(false);
                            setPrismaticForgeUnlocked(true);
                            window.location.reload();
                          } else {
                            alert(data.error || "Prestige failed");
                          }
                        } finally {
                          setPrestigeCodexLoading(false);
                        }
                      }}
                      disabled={prestigeCodexLoading}
                      className="px-5 py-2.5 rounded-xl border-2 border-amber-500/60 bg-amber-500/30 text-amber-100 font-bold hover:bg-amber-500/40 disabled:opacity-50"
                    >
                      {prestigeCodexLoading ? "Prestiging…" : "Yes, Prestige"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="min-w-0 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto overflow-y-hidden scrollbar-tabs">
              <div className="flex gap-0 flex-nowrap w-max min-w-full rounded-t-lg border border-white/[0.12] border-b-0 bg-white/[0.04] p-0.5">
              <button
                type="button"
                onClick={() => setCodexSubTab("codex")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  codexSubTab === "codex"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Codex
              </button>
              <button
                type="button"
                onClick={() => setCodexSubTab("boys")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  codexSubTab === "boys"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Boys
              </button>
              <button
                type="button"
                onClick={() => setCodexSubTab("badges")}
                className={`min-h-[44px] px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-t-md transition-all cursor-pointer touch-manipulation whitespace-nowrap ${
                  codexSubTab === "badges"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Badges
              </button>
              </div>
            </div>

            {codexSubTab === "codex" && (() => {
              const mainEntries = poolEntries.filter((e) => !e.altArtOfCharacterId && (e.cardType ?? "actor") !== "character");
              const altArtMap = new Map<string, PoolEntry[]>();
              for (const e of poolEntries) {
                if (e.altArtOfCharacterId) {
                  if (!altArtMap.has(e.altArtOfCharacterId)) altArtMap.set(e.altArtOfCharacterId, []);
                  altArtMap.get(e.altArtOfCharacterId)!.push(e);
                }
              }
              return (
          <>
            {mainEntries.length === 0 ? (
              <div className="rounded-t-none rounded-b-2xl border border-white/[0.08] border-t-0 bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No cards in the pool yet.</p>
              </div>
            ) : (
              <div className="rounded-t-none rounded-b-2xl border border-white/[0.08] border-t-0 bg-white/[0.03] backdrop-blur-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <span className="text-white/50 text-sm">Sort:</span>
                  <div className="flex flex-wrap gap-2">
                    {(["rarity", "set", "name"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCodexSort(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          codexSort === key
                            ? "bg-amber-500/20 border border-amber-400/50 text-amber-300"
                            : "bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/[0.1] hover:text-white/90"
                        }`}
                      >
                        {key === "set" ? "Set" : key === "name" ? "Name" : "Rarity"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {(() => {
                    const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                    const renderEntry = (entry: PoolEntry) => {
                      const altArts = altArtMap.get(entry.characterId) ?? [];
                      const discoveredAltArts = altArts.filter(a => discoveredAltArtCharacterIds.has(a.characterId));
                      const mainDiscovered =
                        discoveredCharacterIds.has(entry.characterId) ||
                        discoveredHoloCharacterIds.has(entry.characterId);
                      const slotDiscovered = mainDiscovered || discoveredAltArts.length > 0;

                      if (!slotDiscovered) {
                        const isTrackedChar = trackedCharacterIds.has(entry.characterId);
                        return (
                          <div
                            key={entry.characterId}
                            className={`group/missing relative rounded-xl overflow-hidden border flex flex-col items-center justify-center transition-colors ${
                              isTrackedChar
                                ? "border-amber-400/40 bg-amber-500/[0.06]"
                                : "border-white/10 bg-white/[0.04] hover:border-white/20"
                            }`}
                            style={{ aspectRatio: "2 / 3.35" }}
                          >
                            <div className={`flex flex-col items-center justify-center gap-2 ${isTrackedChar ? "text-amber-400/50" : "text-white/25"}`}>
                              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span className="text-xs font-medium">?</span>
                            </div>
                            {isTrackedChar && (
                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-500/80 text-[9px] font-bold text-amber-950 uppercase tracking-wider">
                                Tracked
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleTrackCharacter(entry.characterId); }}
                              className={`absolute bottom-1.5 inset-x-1.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                                isTrackedChar
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/30 opacity-100"
                                  : "bg-white/[0.06] text-white/40 border border-white/10 opacity-0 group-hover/missing:opacity-100"
                              }`}
                              title={isTrackedChar ? "Untrack" : trackedCharacterIds.size < MAX_TRACKED ? "Track (notify when you pull)" : `Limit (${MAX_TRACKED})`}
                              disabled={!isTrackedChar && trackedCharacterIds.size >= MAX_TRACKED}
                            >
                              {isTrackedChar ? "Untrack" : "Track"}
                            </button>
                          </div>
                        );
                      }

                      type CodexVariant = { poolEntry: PoolEntry; isAlt: boolean; codexCard: { id: string; rarity: string; isFoil: boolean; finish?: "normal" | "holo" | "prismatic" | "darkMatter"; actorName: string; characterName: string; movieTitle: string; profilePath: string; cardType?: CardType; isAltArt: boolean } };
                      const variants: CodexVariant[] = [];
                      const hasDarkMatter = discoveredDarkMatterCharacterIds.has(entry.characterId);
                      const hasPrismatic = discoveredPrismaticCharacterIds.has(entry.characterId);
                      const hasHolo = discoveredHoloCharacterIds.has(entry.characterId);
                      const codexFinish: "normal" | "holo" | "prismatic" | "darkMatter" = hasDarkMatter ? "darkMatter" : hasPrismatic ? "prismatic" : hasHolo ? "holo" : "normal";
                      if (mainDiscovered) {
                        variants.push({
                          poolEntry: entry,
                          isAlt: false,
                          codexCard: {
                            id: entry.characterId,
                            rarity: entry.rarity,
                            isFoil: codexFinish !== "normal",
                            finish: codexFinish,
                            actorName: entry.actorName ?? "",
                            characterName: entry.characterName ?? "",
                            movieTitle: entry.movieTitle ?? "",
                            profilePath: entry.profilePath ?? "",
                            cardType: entry.cardType,
                            isAltArt: false,
                          },
                        });
                      }
                      for (const alt of discoveredAltArts) {
                        const altHolo = discoveredAltArtHoloCharacterIds.has(alt.characterId);
                        variants.push({
                          poolEntry: alt,
                          isAlt: true,
                          codexCard: {
                            id: alt.characterId,
                            rarity: alt.rarity,
                            isFoil: altHolo,
                            finish: altHolo ? "holo" : "normal",
                            actorName: alt.actorName ?? "",
                            characterName: alt.characterName ?? "",
                            movieTitle: alt.movieTitle ?? "",
                            profilePath: alt.profilePath ?? "",
                            cardType: alt.cardType,
                            isAltArt: true,
                          },
                        });
                      }

                      if (variants.length <= 1) {
                        const v = variants[0];
                        const isNewlyUploaded =
                          newlyUploadedToCodexCharacterIds.has(v.poolEntry.characterId) ||
                          (v.poolEntry.altArtOfCharacterId != null && newlyUploadedToCodexCharacterIds.has(v.poolEntry.altArtOfCharacterId));
                        const clearNewDot = () => {
                          if (!isNewlyUploaded) return;
                          setNewlyUploadedToCodexCharacterIds((prev) => {
                            const next = new Set(prev);
                            next.delete(v.poolEntry.characterId);
                            if (v.poolEntry.altArtOfCharacterId != null) next.delete(v.poolEntry.altArtOfCharacterId);
                            return next;
                          });
                        };
                        const isTrackedCodex = trackedCharacterIds.has(entry.characterId);
                        return (
                          <div
                            key={entry.characterId}
                            role="button"
                            tabIndex={0}
                            onClick={() => setInspectedCodexCard(v.codexCard)}
                            onKeyDown={(e) => e.key === "Enter" && setInspectedCodexCard(v.codexCard)}
                            className={`relative cursor-pointer group/codexcard ${isNewlyUploaded ? "codex-card-reveal" : ""} focus:outline-none`}
                            onMouseEnter={clearNewDot}
                            aria-label={`Inspect ${v.codexCard.characterName || v.codexCard.actorName}`}
                          >
                            {isNewlyUploaded && (
                              <span className="absolute top-1 left-1 z-10 w-3 h-3 rounded-full bg-red-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.5)] pointer-events-none" aria-label="Newly added to codex" />
                            )}
                            {isTrackedCodex && (
                              <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-amber-500/80 text-[9px] font-bold text-amber-950 uppercase tracking-wider pointer-events-none">
                                Tracked
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleTrackCharacter(entry.characterId); }}
                              className={`absolute bottom-1.5 inset-x-1.5 z-10 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer opacity-0 group-hover/codexcard:opacity-100 ${
                                isTrackedCodex
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                                  : "bg-white/[0.08] text-white/70 border border-white/20 hover:bg-white/[0.12]"
                              }`}
                              title={isTrackedCodex ? "Untrack" : trackedCharacterIds.size < MAX_TRACKED ? "Track (notify when you pull)" : `Limit (${MAX_TRACKED})`}
                              disabled={!isTrackedCodex && trackedCharacterIds.size >= MAX_TRACKED}
                            >
                              {isTrackedCodex ? "Untrack" : "Track"}
                            </button>
                            <CardDisplay card={v.codexCard} selectable />
                          </div>
                        );
                      }

                      const isExpanded = expandedCodexStack === entry.characterId;
                      const cascadeLayers = Math.min(variants.length - 1, 3);
                      const cascadeOffset = cascadeLayers * 3;
                      const anyNewlyUploaded = variants.some(v =>
                        newlyUploadedToCodexCharacterIds.has(v.poolEntry.characterId) ||
                        (v.poolEntry.altArtOfCharacterId != null && newlyUploadedToCodexCharacterIds.has(v.poolEntry.altArtOfCharacterId))
                      );
                      const isTrackedStack = trackedCharacterIds.has(entry.characterId);

                      return (
                        <div
                          key={entry.characterId}
                          className="relative group/codexstack"
                          style={{
                            zIndex: isExpanded ? 20 : "auto",
                            marginBottom: isExpanded ? 0 : cascadeOffset,
                            marginRight: isExpanded ? 0 : cascadeOffset,
                            transition: "margin 300ms ease-out",
                          }}
                          onMouseEnter={() => setExpandedCodexStack(entry.characterId)}
                          onMouseLeave={() => setExpandedCodexStack(null)}
                        >
                          {Array.from({ length: cascadeLayers }, (_, i) => {
                            const layer = cascadeLayers - i;
                            const offset = layer * 3;
                            return (
                              <div
                                key={`shadow-${i}`}
                                className="absolute inset-0 rounded-xl pointer-events-none"
                                style={{
                                  transform: `translate(${offset}px, ${offset}px)`,
                                  background: `rgba(255,255,255,${0.02 + i * 0.01})`,
                                  border: `1px solid rgba(255,255,255,${0.04 + i * 0.015})`,
                                  zIndex: i,
                                  opacity: isExpanded ? 0 : 1,
                                  transition: "opacity 200ms ease-out",
                                }}
                              />
                            );
                          })}

                          {variants.map((v, idx) => (
                            <div
                              key={v.poolEntry.characterId}
                              role="button"
                              tabIndex={0}
                              className="relative cursor-pointer focus:outline-none"
                              style={{
                                position: idx === 0 ? "relative" : "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateX(${isExpanded ? idx * 55 : 0}%)`,
                                zIndex: isExpanded ? variants.length + 1 - idx : cascadeLayers + 1,
                                opacity: !isExpanded && idx > 0 ? 0 : 1,
                                transition: "transform 300ms ease-out, opacity 200ms ease-out",
                              }}
                              onClick={() => setInspectedCodexCard(v.codexCard)}
                              onKeyDown={(e) => e.key === "Enter" && setInspectedCodexCard(v.codexCard)}
                              aria-label={`Inspect ${v.codexCard.characterName || v.codexCard.actorName}${v.isAlt ? " (Alt-Art)" : ""}`}
                            >
                              <CardDisplay card={v.codexCard} selectable />
                            </div>
                          ))}

                          {anyNewlyUploaded && (
                            <span
                              className="absolute top-1 left-1 w-3 h-3 rounded-full bg-red-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.5)] pointer-events-none"
                              style={{ zIndex: variants.length + 2 }}
                              aria-label="Newly added to codex"
                            />
                          )}

                          <div
                            className="absolute flex items-center justify-center rounded-full bg-black/70 border border-white/20 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                            style={{
                              top: -8,
                              right: isExpanded ? -8 : -8 + cascadeOffset,
                              minWidth: 24,
                              height: 24,
                              padding: "0 6px",
                              zIndex: variants.length + 3,
                              opacity: isExpanded ? 0 : 1,
                              transition: "opacity 200ms ease-out, right 300ms ease-out",
                            }}
                          >
                            <span className="text-[11px] font-bold text-white/90 tabular-nums">{variants.length} arts</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleTrackCharacter(entry.characterId); }}
                            className={`absolute bottom-1.5 left-1.5 right-1.5 z-[10] py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer opacity-0 group-hover/codexstack:opacity-100 ${
                              isTrackedStack
                                ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                                : "bg-white/[0.08] text-white/70 border border-white/20 hover:bg-white/[0.12]"
                            }`}
                            style={{ zIndex: variants.length + 4 }}
                            title={isTrackedStack ? "Untrack" : trackedCharacterIds.size < MAX_TRACKED ? "Track (notify when you pull)" : `Limit (${MAX_TRACKED})`}
                            disabled={!isTrackedStack && trackedCharacterIds.size >= MAX_TRACKED}
                          >
                            {isTrackedStack ? "Untrack" : "Track"}
                          </button>
                        </div>
                      );
                    };
                    if (codexSort === "set") {
                      const key = (e: PoolEntry) => e.movieTmdbId ?? e.movieTitle;
                      const bySet = new Map<string | number, PoolEntry[]>();
                      for (const entry of mainEntries) {
                        const k = key(entry);
                        if (!bySet.has(k)) bySet.set(k, []);
                        bySet.get(k)!.push(entry);
                      }
                      const discoveredCount = (entries: PoolEntry[]) => {
                        let n = 0;
                        for (const e of entries) {
                          if (discoveredCharacterIds.has(e.characterId) || discoveredHoloCharacterIds.has(e.characterId)) {
                            n++;
                            continue;
                          }
                          const alts = altArtMap.get(e.characterId);
                          if (alts?.some(a => discoveredAltArtCharacterIds.has(a.characterId))) n++;
                        }
                        return n;
                      };
                      const setRarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                      const tierOrder = { darkMatter: 4, prismatic: 3, holo: 2, normal: 1 };
                      const sets = Array.from(bySet.entries())
                        .map(([k, entries]) => {
                          const title = entries[0]?.movieTitle ?? String(k);
                          const sortedEntries = [...entries].sort(
                            (a, b) => (setRarityOrder[b.rarity] ?? 0) - (setRarityOrder[a.rarity] ?? 0)
                          );
                          const winner = winners.find((w) => w.movieTitle === title);
                          const isComplete = winner ? completedBadgeWinnerIds.has(winner.id) : false;
                          const isHoloComplete = winner ? completedHoloBadgeWinnerIds.has(winner.id) : false;
                          const isPrismaticComplete = winner ? completedPrismaticBadgeWinnerIds.has(winner.id) : false;
                          const isDarkMatterComplete = winner ? completedDarkMatterBadgeWinnerIds.has(winner.id) : false;
                          const badgeTier: "normal" | "holo" | "prismatic" | "darkMatter" = isDarkMatterComplete
                            ? "darkMatter"
                            : isPrismaticComplete
                              ? "prismatic"
                              : isHoloComplete
                                ? "holo"
                                : isComplete
                                  ? "normal"
                                  : "normal";
                          return {
                            title,
                            entries: sortedEntries,
                            completedCount: discoveredCount(entries),
                            isComplete,
                            isHoloComplete,
                            isPrismaticComplete,
                            isDarkMatterComplete,
                            badgeTier,
                          };
                        })
                        .sort((a, b) => {
                          const aTier = tierOrder[a.badgeTier];
                          const bTier = tierOrder[b.badgeTier];
                          if (aTier !== bTier) return bTier - aTier;
                          if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
                          if (a.completedCount !== b.completedCount) return b.completedCount - a.completedCount;
                          return a.title.localeCompare(b.title);
                        });
                      return sets.flatMap((set, setIndex) => {
                        const setWrapperClass = set.badgeTier === "darkMatter"
                          ? "col-span-full rounded-xl dark-matter-set-complete bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 mb-4"
                          : set.badgeTier === "prismatic"
                            ? "col-span-full rounded-xl prismatic-set-complete bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 mb-4"
                            : set.badgeTier === "holo"
                              ? "col-span-full rounded-xl holo-set-complete bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 mb-4"
                              : set.isComplete
                                ? "col-span-full rounded-xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/15 to-amber-600/5 shadow-[0_0_20px_rgba(245,158,11,0.12)] ring-2 ring-amber-400/25 p-4 mb-4"
                                : "col-span-full";
                        const tierLabel = set.badgeTier === "darkMatter" ? "Dark Matter" : set.badgeTier === "prismatic" ? "Prismatic" : set.badgeTier === "holo" ? "Holo" : "Complete";
                        const titleClass = set.badgeTier !== "normal" ? "text-white/90" : set.isComplete ? "text-amber-200" : "text-white/70";
                        const tierTagClass = set.badgeTier === "darkMatter"
                          ? "bg-violet-900/90 border border-violet-400/50 text-violet-200"
                          : set.badgeTier === "prismatic"
                            ? "bg-amber-400/90 border border-amber-300/50 text-amber-950"
                            : set.badgeTier === "holo"
                              ? "text-white border border-white/40"
                              : "bg-amber-500/90 text-amber-950";
                        const tierTagStyle = set.badgeTier === "holo" ? {
                          background: "linear-gradient(135deg, #ff6b6b, #ffd93d, #6bff6b, #6bd5ff, #b96bff, #ff6bb5)",
                          backgroundSize: "200% 200%",
                          animation: "holo-badge-shift 3s ease infinite",
                        } : undefined;
                        return [
                          setIndex > 0 ? (
                            <div key={`codex-break-${setIndex}`} className="col-span-full border-t border-white/10 mt-1 mb-3" aria-hidden />
                          ) : null,
                          <div key={`codex-set-wrap-${setIndex}`} className={setWrapperClass}>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`text-sm font-semibold ${titleClass}`}>
                                {set.title}
                              </span>
                              {set.isComplete ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm ${tierTagClass}`}
                                  style={tierTagStyle}
                                >
                                  {tierLabel}
                                </span>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                              {set.entries.map((entry) => renderEntry(entry))}
                            </div>
                          </div>,
                        ];
                      });
                    }
                    const sorted =
                      codexSort === "name"
                        ? [...mainEntries].sort((a, b) =>
                            (a.characterName || a.actorName || "").localeCompare(b.characterName || b.actorName || "")
                          )
                        : [...mainEntries].sort(
                            (a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0)
                          );
                    return sorted.map((entry) => renderEntry(entry));
                  })()}
                </div>
              </div>
            )}
          </>
            );
            })()}

            {codexSubTab === "boys" && (() => {
              const boysEntries = poolEntries.filter((e) => (e.cardType ?? "actor") === "character" && !e.altArtOfCharacterId);
              return (
          <>
            {boysEntries.length === 0 ? (
              <div className="rounded-t-none rounded-b-2xl border border-white/[0.08] border-t-0 bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No Boys cards in the pool yet.</p>
              </div>
            ) : (
              <div className="rounded-t-none rounded-b-2xl border border-white/[0.08] border-t-0 bg-white/[0.03] backdrop-blur-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <span className="text-white/50 text-sm">Sort:</span>
                  <div className="flex flex-wrap gap-2">
                    {(["rarity", "set", "name"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCodexSort(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          codexSort === key
                            ? "bg-amber-500/20 border border-amber-400/50 text-amber-300"
                            : "bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/[0.1] hover:text-white/90"
                        }`}
                      >
                        {key === "set" ? "Set" : key === "name" ? "Name" : "Rarity"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {(() => {
                    const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                    const renderEntry = (entry: PoolEntry) => {
                      const discovered = discoveredBoysCharacterIds.has(entry.characterId);
                      if (!discovered) {
                        const isTrackedBoys = trackedCharacterIds.has(`boys:${entry.characterId}`);
                        return (
                          <div
                            key={entry.characterId}
                            className={`group/missing relative rounded-xl overflow-hidden border flex flex-col items-center justify-center transition-colors ${
                              isTrackedBoys
                                ? "border-amber-400/40 bg-amber-500/[0.06]"
                                : "border-white/10 bg-white/[0.04] hover:border-white/20"
                            }`}
                            style={{ aspectRatio: "2 / 3.35" }}
                          >
                            <div className={`flex flex-col items-center justify-center gap-2 ${isTrackedBoys ? "text-amber-400/50" : "text-white/25"}`}>
                              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span className="text-xs font-medium">?</span>
                            </div>
                            {isTrackedBoys && (
                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-500/80 text-[9px] font-bold text-amber-950 uppercase tracking-wider">
                                Tracked
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleTrackCharacter(`boys:${entry.characterId}`); }}
                              className={`absolute bottom-1.5 inset-x-1.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                                isTrackedBoys
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/30 opacity-100"
                                  : "bg-white/[0.06] text-white/40 border border-white/10 opacity-0 group-hover/missing:opacity-100"
                              }`}
                              title={isTrackedBoys ? "Untrack" : trackedCharacterIds.size < MAX_TRACKED ? "Track (notify when you pull)" : `Limit (${MAX_TRACKED})`}
                              disabled={!isTrackedBoys && trackedCharacterIds.size >= MAX_TRACKED}
                            >
                              {isTrackedBoys ? "Untrack" : "Track"}
                            </button>
                          </div>
                        );
                      }
                      const codexCard = {
                        id: entry.characterId,
                        rarity: entry.rarity,
                        isFoil: false,
                        actorName: entry.actorName ?? "",
                        characterName: entry.characterName ?? "",
                        movieTitle: entry.movieTitle ?? "",
                        profilePath: entry.profilePath ?? "",
                        cardType: entry.cardType,
                        isAltArt: !!entry.altArtOfCharacterId,
                      };
                      const isNewlyUploaded = newlyUploadedToCodexCharacterIds.has(entry.characterId);
                      const clearNewDot = () => {
                        if (!isNewlyUploaded) return;
                        setNewlyUploadedToCodexCharacterIds((prev) => {
                          const next = new Set(prev);
                          next.delete(entry.characterId);
                          return next;
                        });
                      };
                      const boysTrackKey = `boys:${entry.characterId}`;
                      const isTrackedBoysCodex = trackedCharacterIds.has(boysTrackKey);
                      return (
                        <div
                          key={entry.characterId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setInspectedCodexCard(codexCard)}
                          onKeyDown={(e) => e.key === "Enter" && setInspectedCodexCard(codexCard)}
                          className={`relative cursor-pointer group/boyscodex ${isNewlyUploaded ? "codex-card-reveal" : ""} focus:outline-none`}
                          onMouseEnter={clearNewDot}
                          aria-label={`Inspect ${codexCard.characterName || codexCard.actorName}`}
                        >
                          {isNewlyUploaded && (
                            <span className="absolute top-1 left-1 z-10 w-3 h-3 rounded-full bg-red-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.5)] pointer-events-none" aria-label="Newly added to codex" />
                          )}
                          {isTrackedBoysCodex && (
                            <span className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-amber-500/80 text-[9px] font-bold text-amber-950 uppercase tracking-wider pointer-events-none">
                              Tracked
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleTrackCharacter(boysTrackKey); }}
                            className={`absolute bottom-1.5 inset-x-1.5 z-10 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer opacity-0 group-hover/boyscodex:opacity-100 ${
                              isTrackedBoysCodex
                                ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                                : "bg-white/[0.08] text-white/70 border border-white/20 hover:bg-white/[0.12]"
                            }`}
                            title={isTrackedBoysCodex ? "Untrack" : trackedCharacterIds.size < MAX_TRACKED ? "Track (notify when you pull)" : `Limit (${MAX_TRACKED})`}
                            disabled={!isTrackedBoysCodex && trackedCharacterIds.size >= MAX_TRACKED}
                          >
                            {isTrackedBoysCodex ? "Untrack" : "Track"}
                          </button>
                          <CardDisplay card={codexCard} selectable />
                        </div>
                      );
                    };
                    if (codexSort === "set") {
                      const key = (e: PoolEntry) => e.movieTmdbId ?? e.movieTitle;
                      const bySet = new Map<string | number, PoolEntry[]>();
                      for (const entry of boysEntries) {
                        const k = key(entry);
                        if (!bySet.has(k)) bySet.set(k, []);
                        bySet.get(k)!.push(entry);
                      }
                      const discoveredCount = (entries: PoolEntry[]) => entries.filter((e) => discoveredBoysCharacterIds.has(e.characterId)).length;
                      const sets = Array.from(bySet.entries())
                        .map(([k, entries]) => ({
                          title: entries[0]?.movieTitle ?? String(k),
                          entries,
                          completedCount: discoveredCount(entries),
                        }))
                        .sort((a, b) => {
                          if (a.completedCount !== b.completedCount) return b.completedCount - a.completedCount;
                          return a.title.localeCompare(b.title);
                        });
                      return sets.flatMap((set, setIndex) => [
                        setIndex > 0 ? (
                          <div key={`boys-break-${setIndex}`} className="col-span-full border-t border-white/10 mt-1 mb-3" aria-hidden />
                        ) : null,
                        <div key={`boys-set-title-${setIndex}`} className="col-span-full text-sm font-semibold text-white/70 mb-2">
                          {set.title}
                        </div>,
                        ...set.entries.map((entry) => renderEntry(entry)),
                      ]);
                    }
                    const sorted =
                      codexSort === "name"
                        ? [...boysEntries].sort((a, b) =>
                            ((a.characterName || a.actorName) ?? "").localeCompare((b.characterName || b.actorName) ?? "")
                          )
                        : [...boysEntries].sort(
                            (a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0)
                          );
                    return sorted.map((entry) => renderEntry(entry));
                  })()}
                </div>
              </div>
            )}
          </>
            );
            })()}

            {/* Codex card inspect overlay — centered, large scale; animated enter/exit */}
            {tab === "codex" && (codexSubTab === "codex" || codexSubTab === "boys") && inspectedCodexCard && (
              <>
                <div
                  className={`fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm cursor-pointer transition-opacity duration-200 ${codexInspectClosing ? "opacity-0" : "opacity-100"}`}
                  onClick={() => !codexInspectClosing && setCodexInspectClosing(true)}
                  aria-hidden
                />
                <div
                  className="fixed inset-0 z-[56] pointer-events-none flex items-center justify-center p-8"
                  aria-modal
                  aria-label="Inspect card"
                >
                  <div
                    onAnimationEnd={(e) => {
                      if (e.animationName === "codex-inspect-exit") {
                        setInspectedCodexCard(null);
                        setCodexInspectClosing(false);
                      }
                    }}
                    className={`pointer-events-auto w-full max-w-[min(22rem,85vw)] cursor-default rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.08)] ${codexInspectClosing ? "codex-inspect-exit" : "codex-inspect-enter"}`}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                  >
                    <CardDisplay card={inspectedCodexCard} inspect />
                  </div>
                </div>
                <p className={`fixed bottom-8 left-1/2 z-[56] -translate-x-1/2 pointer-events-none text-sm text-white/60 transition-opacity duration-200 ${codexInspectClosing ? "opacity-0" : "opacity-100"}`}>
                  Click outside to close
                </p>
              </>
            )}

            {codexSubTab === "badges" && (
          <div className="rounded-t-none rounded-b-2xl border border-white/[0.08] border-t-0 bg-white/[0.03] backdrop-blur-xl p-6">
            <p className="text-white/50 text-sm mb-6">
              Collect achievements by completing each set in the Codex (discover all cards for a movie).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...winners]
                .sort((a, b) => {
                  const tierOrder = { darkMatter: 4, prismatic: 3, holo: 2, normal: 1 };
                  const tier = (w: { id: string }) =>
                    completedDarkMatterBadgeWinnerIds.has(w.id) ? "darkMatter" : completedPrismaticBadgeWinnerIds.has(w.id) ? "prismatic" : completedHoloBadgeWinnerIds.has(w.id) ? "holo" : completedBadgeWinnerIds.has(w.id) ? "normal" : null;
                  const aTier = tier(a);
                  const bTier = tier(b);
                  if (aTier && !bTier) return -1;
                  if (!aTier && bTier) return 1;
                  if (aTier && bTier && aTier !== bTier) return (tierOrder[bTier] ?? 0) - (tierOrder[aTier] ?? 0);
                  return 0;
                })
                .map((w) => {
                const collected = completedBadgeWinnerIds.has(w.id);
                const badgeTier: "normal" | "holo" | "prismatic" | "darkMatter" = collected
                  ? (completedDarkMatterBadgeWinnerIds.has(w.id) ? "darkMatter" : completedPrismaticBadgeWinnerIds.has(w.id) ? "prismatic" : completedHoloBadgeWinnerIds.has(w.id) ? "holo" : "normal")
                  : "normal";
                const collectedWrapperClass = collected
                  ? badgeTier === "darkMatter"
                    ? "dark-matter-set-complete bg-gradient-to-b from-white/[0.06] to-white/[0.02]"
                    : badgeTier === "prismatic"
                      ? "prismatic-set-complete bg-gradient-to-b from-white/[0.06] to-white/[0.02]"
                      : badgeTier === "holo"
                        ? "holo-set-complete bg-gradient-to-b from-white/[0.06] to-white/[0.02]"
                        : "border-amber-400/60 bg-gradient-to-b from-amber-500/20 to-amber-600/5 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-2 ring-amber-400/30"
                  : "border-white/10 bg-white/[0.04]";
                const tierTagClass = badgeTier === "darkMatter"
                  ? "bg-violet-900/90 border border-violet-400/50 text-violet-200"
                  : badgeTier === "prismatic"
                    ? "bg-amber-400/90 border border-amber-300/50 text-amber-950"
                    : badgeTier === "holo"
                      ? "text-white border border-white/40"
                      : "bg-amber-500/90 text-amber-950";
                const tierTagStyle = badgeTier === "holo" ? {
                  background: "linear-gradient(135deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                  boxShadow: "0 0 6px rgba(255,255,255,0.4)",
                } : undefined;
                const tierLabel = badgeTier === "darkMatter" ? "Dark Matter" : badgeTier === "prismatic" ? "Prismatic" : badgeTier === "holo" ? "Holo" : "Complete";
                const checkBgClass = badgeTier === "darkMatter" ? "bg-violet-400" : badgeTier === "prismatic" ? "bg-amber-300" : badgeTier === "holo" ? "bg-white/90" : "bg-amber-400";
                const checkTextClass = badgeTier === "darkMatter" ? "text-violet-950" : badgeTier === "prismatic" ? "text-amber-950" : badgeTier === "holo" ? "text-violet-900" : "text-amber-950";
                const fallbackIconClass = badgeTier === "darkMatter" ? "text-violet-400/80" : badgeTier === "prismatic" ? "text-amber-300/80" : badgeTier === "holo" ? "text-white/80" : "text-amber-400/80";
                return (
                  <Link
                    key={w.id}
                    href={`/winners/${w.id}`}
                    className={`block rounded-xl overflow-hidden border-2 transition-all hover:ring-2 hover:ring-amber-400/40 ${collectedWrapperClass}`}
                    style={{ aspectRatio: "1" }}
                  >
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-3">
                      {collected ? (
                        w.posterUrl ? (
                          <>
                            <img
                              src={w.posterUrl}
                              alt=""
                              className="w-full h-full object-cover absolute inset-0"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          </>
                        ) : (
                          <div className={`w-full h-full absolute inset-0 flex items-center justify-center ${badgeTier === "normal" ? "bg-amber-500/20" : "bg-white/[0.06]"}`}>
                            <svg className={`w-10 h-10 ${fallbackIconClass}`} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
                          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="text-xs font-medium">?</span>
                        </div>
                      )}
                      {collected && (
                        <span className="relative z-10 text-xs font-medium text-center line-clamp-2 mt-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {w.movieTitle || "Set"}
                        </span>
                      )}
                      {collected && (
                        <>
                          <span className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center ${checkBgClass}`} aria-hidden>
                            <svg className={`w-3 h-3 ${checkTextClass}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          </span>
                          <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm ${tierTagClass}`} style={tierTagStyle} aria-hidden>
                            {tierLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            {winners.length === 0 && (
              <p className="text-white/40 text-sm text-center py-8">No sets yet. Win some movies to unlock badge achievements.</p>
            )}
              </div>
            )}
          </div>
        )}

        {/* Codex upload modal — select inventory cards to upload */}
        {showCodexUploadModal && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !codexUploading && setShowCodexUploadModal(false)}
              aria-hidden
            />
            <div
              className="fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col"
              style={{
                top: "calc(var(--header-height) + 0.5rem)",
                maxHeight: "calc(100vh - var(--header-height) - 1rem)",
              }}
              role="dialog"
              aria-label="Upload to Codex"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                <h3 className="text-lg font-bold text-white/90">Your inventory — select cards to upload to Codex</h3>
                <button
                  type="button"
                  onClick={() => !codexUploading && setShowCodexUploadModal(false)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Thin progress bar inside modal — light blue glow */}
              {codexUploading && (
                <div className="shrink-0 px-6 pt-1 pb-2">
                  <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-all duration-300 ease-out"
                      style={{
                        width: `${codexUploadProgress}%`,
                        boxShadow: "0 0 12px rgba(34, 211, 238, 0.6), 0 0 24px rgba(34, 211, 238, 0.35)",
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="p-6 overflow-y-auto flex-1 min-h-0 scrollbar-codex-modal pr-1">
                {cards.filter((c) => !myListedCardIds.has(c.id!) && !myTradeBlockCardIds.has(c.id!)).length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">No cards available to upload (unlist from marketplace and remove from trade block first).</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <span className="text-white/50 text-sm">Sort:</span>
                      <div className="flex flex-wrap gap-2">
                        {(["rarity", "set", "name"] as const).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setCodexUploadSort(key)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                              codexUploadSort === key
                                ? "bg-cyan-500/20 border border-cyan-400/50 text-cyan-300"
                                : "bg-white/[0.06] border border-white/[0.12] text-white/70 hover:bg-white/[0.1] hover:text-white/90"
                            }`}
                          >
                            {key === "set" ? "Set" : key === "name" ? "Name" : "Rarity"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                    {(() => {
                      const rarityOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1 };
                      const filtered = cards.filter((c) => !myListedCardIds.has(c.id!) && !myTradeBlockCardIds.has(c.id!));
                      const sorted =
                        codexUploadSort === "set"
                          ? [...filtered].sort((a, b) => (a.movieTitle ?? "").localeCompare(b.movieTitle ?? ""))
                          : codexUploadSort === "name"
                            ? [...filtered].sort((a, b) => ((a.characterName || a.actorName) ?? "").localeCompare((b.characterName || b.actorName) ?? ""))
                            : [...filtered].sort((a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0));
                      return sorted.map((card) => {
                        const selected = card.id != null && codexUploadSelectedIds.has(card.id);
                        const alreadyInCodex = isCardSlotAlreadyInCodex(card);
                        const needsRegular = isHoloMissingRegularPrereq(card);
                        const isDisabled = alreadyInCodex || needsRegular;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => !isDisabled && card.id && toggleCodexUploadSelection(card.id)}
                            disabled={isDisabled}
                            title={needsRegular ? "Upload regular version first" : undefined}
                            className={`relative text-left rounded-xl overflow-hidden transition-all border-2 ${
                              isDisabled
                                ? "opacity-60 cursor-not-allowed border-white/5 grayscale"
                                : "cursor-pointer " + (selected ? "ring-2 ring-cyan-400/35 border-cyan-400/30 backdrop-blur-sm bg-cyan-500/[0.08]" : "border-white/10 hover:border-white/25")
                            }`}
                          >
                            <div className="w-full max-w-[140px] mx-auto">
                              <CardDisplay card={{ ...card, isAltArt: isAltArtCard(card) }} inCodex={alreadyInCodex} />
                            </div>
                            {alreadyInCodex && (
                              <span className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 rounded-xl">
                                <span className="text-[10px] uppercase tracking-wider text-white/80 font-medium px-2 py-1 rounded bg-white/10">In Codex</span>
                              </span>
                            )}
                            {needsRegular && !alreadyInCodex && (
                              <span className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 rounded-xl">
                                <span className="text-[10px] uppercase tracking-wider text-amber-300/90 font-medium px-2 py-1 rounded bg-black/40 text-center leading-tight">Regular needed first</span>
                              </span>
                            )}
                            {selected && !isDisabled && (
                              <span className="absolute top-1 right-1 w-6 h-6 rounded-full bg-cyan-400/50 backdrop-blur-md border border-white/20 text-white/90 text-xs font-bold flex items-center justify-center z-10 shadow-[0_0_12px_rgba(34,211,238,0.2)]">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                    </div>
                  </>
                )}
              </div>
              <div className="px-6 py-4 border-t border-white/10 shrink-0 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/50">
                    {codexUploadSelectedIds.size} selected
                  </span>
                  {(() => {
                    const eligibleCards = cards.filter(
                      (c) => c.id != null && !myListedCardIds.has(c.id) && !myTradeBlockCardIds.has(c.id) && c.characterId != null && !isCardSlotAlreadyInCodex(c) && !isHoloMissingRegularPrereq(c)
                    );
                    const onePerSlot: string[] = [];
                    const seenSlots = new Set<string>();
                    for (const c of eligibleCards) {
                      const key = getCodexSlotKey(c);
                      if (key && !seenSlots.has(key)) {
                        seenSlots.add(key);
                        onePerSlot.push(c.id!);
                      }
                    }
                    const eligibleCount = onePerSlot.length;
                    if (eligibleCount === 0 || codexUploading) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setCodexUploadSelectedIds(new Set(onePerSlot))}
                        className="text-sm text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        Add all {eligibleCount} eligible
                      </button>
                    );
                  })()}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => !codexUploading && setShowCodexUploadModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/20 bg-white/[0.06] text-white/80 hover:bg-white/[0.08] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCodexUploadSelected}
                    disabled={codexUploadSelectedIds.size === 0 || codexUploading}
                    className="px-6 py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 font-medium hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {codexUploading ? "Uploading…" : `Upload ${codexUploadSelectedIds.size} to Codex`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Codex upload complete popup */}
        {codexUploadCompleteCount !== null && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm cursor-pointer"
              onClick={() => {
                setCodexUploadCompleteCount(null);
                if (codexUploadCompleteTimeoutRef.current) {
                  clearTimeout(codexUploadCompleteTimeoutRef.current);
                  codexUploadCompleteTimeoutRef.current = null;
                }
              }}
              aria-hidden
            />
            <div
              className="fixed left-1/2 top-1/2 z-[61] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-400/40 bg-gradient-to-b from-cyan-950/95 to-sky-950/95 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.25),0_8px_32px_rgba(0,0,0,0.4)] px-10 py-8 text-center animate-[codex-card-reveal_0.4s_ease-out_both] cursor-pointer"
              role="alert"
              aria-live="polite"
              onClick={() => {
                setCodexUploadCompleteCount(null);
                if (codexUploadCompleteTimeoutRef.current) {
                  clearTimeout(codexUploadCompleteTimeoutRef.current);
                  codexUploadCompleteTimeoutRef.current = null;
                }
              }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-cyan-400/20 border-2 border-cyan-400/60 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                  <svg className="w-8 h-8 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-white/95">
                {codexUploadCompleteCount} {codexUploadCompleteCount === 1 ? "Card" : "Cards"} Uploaded to Codex
              </p>
              <p className="text-sm text-cyan-300/80 mt-1">Click anywhere to close</p>
            </div>
          </>
        )}

        {/* Start Trade modal */}
        {showTradeModal && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => !tradeLoading && setShowTradeModal(false)}
              aria-hidden
            />
            <div
              className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0c0c18]/95 backdrop-blur-2xl shadow-[0_8px_48px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col ${tradeStep === 1 ? "max-w-3xl max-h-[70vh]" : "max-w-[90rem] h-[min(85vh,820px)]"}`}
              role="dialog"
              aria-label="Start trade"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30 shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white/90">
                    {tradeStep === 1 ? "Start Trade" : `Trading with ${tradeCounterparty?.name}`}
                  </h3>
                  {tradeStep >= 2 && tradeCounterparty && (
                    <button
                      onClick={() => { setTradeStep(1); setTradeCounterparty(null); setTradeOfferedIds(new Set()); setTradeRequestedIds(new Set()); setTradeOfferedCredits(0); setTradeRequestedCredits(0); setCounterpartyCards([]); }}
                      className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      Change user
                    </button>
                  )}
                </div>
                <button
                  onClick={() => !tradeLoading && setShowTradeModal(false)}
                  className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] cursor-pointer transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step 1: User picker */}
              {tradeStep === 1 && (
                <div className="p-6 overflow-auto flex-1">
                  <p className="text-white/50 text-sm mb-4">Choose a user to trade with.</p>
                  {tradeUsers.length === 0 ? (
                    <p className="text-white/40 text-sm">No other users yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {tradeUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => { setTradeCounterparty(u); setTradeStep(2); }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:border-amber-500/40 hover:bg-amber-500/10 transition-all cursor-pointer text-left group"
                        >
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-white/10 group-hover:border-amber-500/30 transition-colors" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {u.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm font-medium text-white/90 truncate">{u.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2+: Unified 3-column trading view */}
              {tradeStep >= 2 && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] overflow-hidden">

                    {/* Left: Your inventory */}
                    <div className="flex flex-col min-h-0 lg:border-r border-white/[0.08] order-2 lg:order-1">
                      <div className="px-4 py-3 border-b border-white/[0.08] bg-white/[0.015] shrink-0">
                        <div className="flex items-center gap-2">
                          {user?.id && (userAvatarMap[user.id] ? <img src={userAvatarMap[user.id]} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" /> : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">{user.name?.charAt(0) || "?"}</div>)}
                          <h4 className="text-sm font-semibold text-white/70">Your Collection</h4>
                        </div>
                        <p className="text-[11px] text-white/25 mt-1">{availableForOffer.length} cards &mdash; click to add to trade</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 scrollbar-autocomplete">
                        {availableForOffer.length === 0 ? (
                          <p className="text-white/25 text-xs text-center py-8">No cards available to offer.</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
                            {availableForOffer.map((c) => {
                              const selected = tradeOfferedIds.has(c.id!);
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => toggleTradeOffer(c.id!)}
                                  className={`relative rounded-xl overflow-hidden ring-2 transition-all cursor-pointer ${selected ? "ring-red-400/60 scale-[0.92] opacity-40" : "ring-transparent hover:ring-white/25 hover:scale-[1.03]"}`}
                                >
                                  <CardDisplay card={c} compact />
                                  {selected && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                      <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">In Trade</span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Center: The Trade */}
                    <div className="flex flex-col min-h-0 bg-black/20 overflow-hidden order-1 lg:order-2 border-b lg:border-b-0 border-white/[0.08]">
                      <div className="px-4 py-3 border-b border-white/[0.08] bg-gradient-to-r from-red-500/[0.04] via-amber-500/[0.08] to-green-500/[0.04] shrink-0 text-center">
                        <h4 className="text-sm font-bold text-amber-400/90 tracking-wide uppercase">The Trade</h4>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {/* You Give */}
                        <div className="p-4 border-b border-white/[0.05]">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
                            <h5 className="text-[11px] font-semibold text-red-400/80 uppercase tracking-widest">You Give</h5>
                          </div>
                          <div className="min-h-[90px] rounded-xl border-2 border-dashed border-white/[0.06] bg-white/[0.015] p-2">
                            {(() => {
                              const offeredCards = availableForOffer.filter(c => tradeOfferedIds.has(c.id!));
                              return offeredCards.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                  {offeredCards.map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => toggleTradeOffer(c.id!)}
                                      className="relative rounded-xl overflow-hidden ring-1 ring-red-500/20 hover:ring-red-400/50 transition-all cursor-pointer group"
                                    >
                                      <CardDisplay card={c} compact />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                        <span className="text-white/0 group-hover:text-white/90 text-lg font-light transition-colors">&times;</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full min-h-[70px]">
                                  <p className="text-white/15 text-xs text-center">Click cards from your collection</p>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[11px] text-amber-400/50 font-medium shrink-0">Credits:</span>
                            <input
                              type="number"
                              min={0}
                              max={creditBalance}
                              value={tradeOfferedCredits || ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                setTradeOfferedCredits(isNaN(v) ? 0 : Math.max(0, v));
                              }}
                              placeholder="0"
                              className="w-20 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-amber-300 text-xs outline-none focus:border-amber-500/40 placeholder-white/15 transition-colors"
                            />
                            <span className="text-[10px] text-white/20">/ {creditBalance}</span>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 px-4 py-2 bg-black/10">
                          <div className="flex-1 h-px bg-gradient-to-r from-red-500/15 to-transparent" />
                          <svg className="w-4 h-4 text-white/15 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                          <div className="flex-1 h-px bg-gradient-to-l from-green-500/15 to-transparent" />
                        </div>

                        {/* You Get */}
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
                            <h5 className="text-[11px] font-semibold text-green-400/80 uppercase tracking-widest">You Get</h5>
                          </div>
                          <div className="min-h-[90px] rounded-xl border-2 border-dashed border-white/[0.06] bg-white/[0.015] p-2">
                            {(() => {
                              const requestedCards = availableToRequest.filter(c => tradeRequestedIds.has(c.id!));
                              return requestedCards.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                  {requestedCards.map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => toggleTradeRequest(c.id!)}
                                      className="relative rounded-xl overflow-hidden ring-1 ring-green-500/20 hover:ring-green-400/50 transition-all cursor-pointer group"
                                    >
                                      <CardDisplay card={c} compact />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                        <span className="text-white/0 group-hover:text-white/90 text-lg font-light transition-colors">&times;</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full min-h-[70px]">
                                  <p className="text-white/15 text-xs text-center">Click cards from their collection</p>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[11px] text-amber-400/50 font-medium shrink-0">Credits:</span>
                            <input
                              type="number"
                              min={0}
                              value={tradeRequestedCredits || ""}
                              onChange={(e) => {
                                const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                setTradeRequestedCredits(isNaN(v) ? 0 : Math.max(0, v));
                              }}
                              placeholder="0"
                              className="w-20 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-amber-300 text-xs outline-none focus:border-amber-500/40 placeholder-white/15 transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Send button */}
                      <div className="px-4 py-3.5 border-t border-white/[0.08] bg-black/30 shrink-0">
                        {tradeError && <p className="text-red-400 text-xs mb-2">{tradeError}</p>}
                        <button
                          onClick={() => handleSendTrade()}
                          disabled={tradeLoading || (tradeOfferedIds.size === 0 && tradeOfferedCredits <= 0) || (tradeRequestedIds.size === 0 && tradeRequestedCredits <= 0)}
                          className="w-full px-4 py-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-amber-600/15 text-amber-400 font-semibold text-sm hover:border-amber-500/50 hover:from-amber-500/25 hover:to-amber-600/25 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                        >
                          {tradeLoading ? "Sending..." : editingTradeId ? "Send Counter-Offer" : "Send Trade Offer"}
                        </button>
                      </div>
                    </div>

                    {/* Right: Their inventory */}
                    <div className="flex flex-col min-h-0 lg:border-l border-white/[0.08] order-3 lg:order-3">
                      <div className="px-4 py-3 border-b border-white/[0.08] bg-white/[0.015] shrink-0">
                        <div className="flex items-center gap-2">
                          {tradeCounterparty && (userAvatarMap[tradeCounterparty.id] ? <img src={userAvatarMap[tradeCounterparty.id]} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" /> : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">{(tradeCounterparty?.name || "?")[0]}</div>)}
                          <h4 className="text-sm font-semibold text-white/70">{tradeCounterparty?.name}&apos;s Collection</h4>
                        </div>
                        <p className="text-[11px] text-white/25 mt-1">{availableToRequest.length} cards &mdash; click to add to trade</p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 scrollbar-autocomplete">
                        {availableToRequest.length === 0 ? (
                          <p className="text-white/25 text-xs text-center py-8">{tradeCounterparty?.name} has no cards available.</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
                            {availableToRequest.map((c) => {
                              const selected = tradeRequestedIds.has(c.id!);
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => toggleTradeRequest(c.id!)}
                                  className={`relative rounded-xl overflow-hidden ring-2 transition-all cursor-pointer ${selected ? "ring-green-400/60 scale-[0.92] opacity-40" : "ring-transparent hover:ring-white/25 hover:scale-[1.03]"}`}
                                >
                                  <CardDisplay card={c} compact />
                                  {selected && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                                      <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">In Trade</span>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </>
        )}

          </div>
      </main>
      </div>
    </div>
  );
}

export default function CardsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      }
    >
      <CardsContent />
    </Suspense>
  );
}
