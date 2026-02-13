"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { CardDisplay } from "@/components/CardDisplay";
import { BadgePill } from "@/components/BadgePill";
import { DISENCHANT_DUST, getPackAPunchCost } from "@/lib/alchemy";
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
  sellerDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean; badgeAppearance?: { primaryColor?: string; secondaryColor?: string; icon?: string; glow?: boolean } } | null;
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

type TabKey = "store" | "collection" | "marketplace" | "trivia" | "trade";
type CollectionSubTab = "tradeup" | "alchemy";

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
  initiatorDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean; badgeAppearance?: { primaryColor?: string; secondaryColor?: string; icon?: string; glow?: boolean } } | null;
  counterpartyDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean; badgeAppearance?: { primaryColor?: string; secondaryColor?: string; icon?: string; glow?: boolean } } | null;
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
  purchasesToday?: number;
}

type ShopItemType = "badge" | "skip";
interface ShopItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  type: ShopItemType;
  skipAmount?: number;
  isActive: boolean;
  order: number;
}

function CardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabKey>("store");
  const [collectionSubTab, setCollectionSubTab] = useState<CollectionSubTab>("tradeup");
  const [creditBalance, setCreditBalance] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [poolCount, setPoolCount] = useState(0);
  const [newCards, setNewCards] = useState<Card[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [filterRarity, setFilterRarity] = useState<string>("");
  const [filterFoil, setFilterFoil] = useState<"all" | "foil" | "normal">("all");
  const [filterSort, setFilterSort] = useState<"recent" | "name" | "movie">("recent");
  const [showListModal, setShowListModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [delistingId, setDelistingId] = useState<string | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [triviaCompletedIds, setTriviaCompletedIds] = useState<Set<string>>(new Set());
  const [tradeUpSlots, setTradeUpSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [tradingUp, setTradingUp] = useState(false);
  const [tradeUpResult, setTradeUpResult] = useState<Card | null>(null);
  const [tradeUpResultCredits, setTradeUpResultCredits] = useState<number | null>(null);
  const [tradeUpResultFading, setTradeUpResultFading] = useState(false);
  const [legendaryBlockShown, setLegendaryBlockShown] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [shopSubTab, setShopSubTab] = useState<"packs" | "others">("packs");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
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
  const [userAvatarMap, setUserAvatarMap] = useState<Record<string, string>>({});
  const [badgeLossWarnings, setBadgeLossWarnings] = useState<{ movieTitle: string; isHolo: boolean }[] | null>(null);
  const [badgeLossOnConfirm, setBadgeLossOnConfirm] = useState<(() => void | Promise<void>) | null>(null);
  const [badgeLossIsListing, setBadgeLossIsListing] = useState(false);
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
  const [stardustDelta, setStardustDelta] = useState<number | null>(null);
  const [stardustAnimClass, setStardustAnimClass] = useState("");
  const stardustPrevRef = useRef<number>(0);
  const stardustInitializedRef = useRef(false);
  const stardustAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSoldOutPack = packs.some(
    (p) =>
      p.maxPurchasesPerDay != null &&
      p.maxPurchasesPerDay > 0 &&
      (p.purchasesToday ?? 0) >= p.maxPurchasesPerDay
  );
  const midnightCountdown = useMidnightUTCCountdown(tab === "store" && hasSoldOutPack);

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

  // Pinned badge progress (tracked on winners page, max 3)
  const TCG_TRACKED_KEY = "tcg-tracked-winner-ids";
  const [trackedWinnerIds, setTrackedWinnerIds] = useState<string[]>([]);
  const [pinnedProgress, setPinnedProgress] = useState<{
    winnerId: string;
    movieTitle: string;
    owned: number;
    total: number;
    completed: boolean;
    entries: { characterName: string; actorName: string; owned: boolean }[];
  }[]>([]);

  const myListedCardIds = new Set(
    listings.filter((l) => l.sellerUserId === user?.id).map((l) => l.cardId)
  );

  const loadData = useCallback(async () => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    const u = JSON.parse(cached) as User;

    const [creditsRes, cardsRes, poolRes, listingsRes, winnersRes, attemptsRes, packsRes, shopItemsRes, tradesRes, usersRes, stardustRes] = await Promise.all([
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/cards/character-pool"),
      fetch("/api/marketplace"),
      fetch("/api/winners"),
      fetch(`/api/trivia/attempts?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards/packs?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/shop/items"),
      fetch(`/api/trades?userId=${encodeURIComponent(u.id)}&status=pending`),
      fetch("/api/users?includeProfile=1"),
      fetch(`/api/alchemy/stardust?userId=${encodeURIComponent(u.id)}`),
    ]);

    if (creditsRes.ok) {
      const d = await creditsRes.json();
      if (typeof d?.balance === "number") setCreditBalance(d.balance);
    }
    if (cardsRes.ok) setCards(await cardsRes.json());
    if (poolRes.ok) {
      const poolData = await poolRes.json();
      setPoolCount(poolData?.count ?? 0);
    }
    if (listingsRes.ok) setListings(await listingsRes.json());
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
    if (shopItemsRes.ok) {
      const d = await shopItemsRes.json();
      setShopItems(d.items || []);
    }
    if (tradesRes.ok) setTrades(await tradesRes.json());
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
      setTab("collection");
      setCollectionSubTab("alchemy");
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("dabys-credits-refresh", handler);
    return () => window.removeEventListener("dabys-credits-refresh", handler);
  }, [loadData]);

  useEffect(() => {
    return () => {
      stardustAnimTimeoutRef.current && clearTimeout(stardustAnimTimeoutRef.current);
    };
  }, []);

  // Read pinned/tracked winner IDs from localStorage (sync when returning from winners page)
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(TCG_TRACKED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setTrackedWinnerIds(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
      } catch { setTrackedWinnerIds([]); }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, []);

  // Fetch badge progress for each pinned winner
  useEffect(() => {
    if (!user?.id || trackedWinnerIds.length === 0) {
      setPinnedProgress([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      trackedWinnerIds.map((winnerId) =>
        fetch(`/api/cards/winner-collection?winnerId=${encodeURIComponent(winnerId)}&userId=${encodeURIComponent(user.id)}`).then((r) => r.json())
      )
    ).then((results) => {
      if (cancelled) return;
      setPinnedProgress(
        results
          .filter((d) => d.poolEntries && !d.error)
          .map((d) => {
            const ownedSet = new Set(d.ownedCharacterIds ?? []);
            const entries = (d.poolEntries ?? []).map((e: { characterId: string; characterName: string; actorName: string }) => ({
              characterName: e.characterName ?? "?",
              actorName: e.actorName ?? "",
              owned: ownedSet.has(e.characterId),
            }));
            return {
              winnerId: d.winnerId ?? "",
              movieTitle: d.movieTitle ?? (d.poolEntries?.[0]?.movieTitle ?? ""),
              owned: d.ownedCharacterIds?.length ?? 0,
              total: d.poolEntries?.length ?? 0,
              completed: !!d.completed,
              entries,
            };
          })
      );
    }).catch(() => {
      if (!cancelled) setPinnedProgress([]);
    });
    return () => { cancelled = true; };
  }, [user?.id, trackedWinnerIds]);

  function unpinWinner(winnerId: string) {
    const next = trackedWinnerIds.filter((id) => id !== winnerId);
    setTrackedWinnerIds(next);
    localStorage.setItem(TCG_TRACKED_KEY, JSON.stringify(next));
  }

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
    newCards.forEach((_, idx) => {
      const delay = idx * 220;
      setTimeout(() => {
        setRevealCount((prev) => {
          const next = prev < idx + 1 ? idx + 1 : prev;
          if (next === idx + 1) {
            void playPackFlipSound(idx);
          }
          return next;
        });
      }, delay);
    });
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
    tradeUpCardIds.length === 5 &&
    tradeUpCards.length === 5 &&
    tradeUpCards.every((c) => c.rarity === tradeUpCards[0]?.rarity) &&
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
        setTradeUpSlots([null, null, null, null, null]);
        if (data.card) {
          setTradeUpResult(data.card);
          setTradeUpResultCredits(null);
        } else if (typeof data.credits === "number") {
          setTradeUpResult(null);
          setTradeUpResultCredits(data.credits);
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: data.credits } }));
        }
        await loadData();
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
    if (filled.length >= 5) return;
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
    setTradeUpSlots((prev) => prev.map((id) => (id === cardId ? null : id)));
  }

  function getDustForRarity(rarity: string): number {
    return DISENCHANT_DUST[rarity] ?? 0;
  }

  async function handleAlchemyDisenchant(card: Card) {
    if (!user) return;
    const dust = getDustForRarity(card.rarity);
    if (!confirm(`Disenchant for ${dust} Stardust? This cannot be undone.`)) return;
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
        setAlchemyError(data?.error ?? "Disenchant failed");
        return;
      }
      playAlchemyDisenchantSuccess();
      setAlchemySuccessFlash(true);
      setTimeout(() => setAlchemySuccessFlash(false), 500);
      setAlchemyBenchSlots((prev) => prev.map((id) => (id === card.id ? null : id)));
      await loadData();
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
          loadData();
        }, 1100);
      } else {
        setAlchemyPunchFailedCardIds([card.id]);
        setPAPFailureErrorAndFade("Pack-A-Punch failed — Stardust consumed. Try again!");
        await loadData();
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

  async function handleAlchemyDisenchantAll() {
    if (!user || alchemyBenchCards.length === 0) return;
    const totalDust = alchemyBenchCards.reduce((sum, c) => sum + getDustForRarity(c.rarity), 0);
    if (!confirm(`Disenchant ${alchemyBenchCards.length} Holo(s) for ${totalDust} Stardust? This cannot be undone.`)) return;
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
          setAlchemyError(data?.error ?? "Disenchant failed");
          return;
        }
      }
      playAlchemyDisenchantSuccess();
      setAlchemySuccessFlash(true);
      setTimeout(() => setAlchemySuccessFlash(false), 500);
      setAlchemyBenchSlots([null, null, null, null, null]);
      await loadData();
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
          await loadData();
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
          loadData();
        }, 1200);
      }
      const failedCount = failedIds.length;
      if (failedCount > 0) {
        setAlchemyPunchFailedCardIds(failedIds);
        setPAPFailureErrorAndFade(`${failedCount} Pack-A-Punch attempt(s) failed — Stardust consumed.`);
        setTimeout(() => setAlchemyPunchFailedCardIds([]), 900);
      }
      if (succeededIds.length === 0 || failedCount > 0) {
        await loadData();
      }
    } finally {
      setAlchemyPunchingId(null);
    }
  }

  async function checkBadgeLossThen(
    cardIds: string[],
    action: () => void | Promise<void>,
    options?: { isListing?: boolean }
  ) {
    if (!user || cardIds.length === 0) {
      await action();
      return;
    }
    const res = await fetch("/api/cards/would-lose-badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, cardIds }),
    });
    const data = await res.json().catch(() => ({}));
    const badges: { movieTitle: string; isHolo: boolean }[] = data.badges || [];
    if (badges.length > 0) {
      setBadgeLossWarnings(badges);
      setBadgeLossIsListing(!!options?.isListing);
      setBadgeLossOnConfirm(() => async () => {
        await action();
        setBadgeLossWarnings(null);
        setBadgeLossOnConfirm(null);
      });
    } else {
      await action();
    }
  }

  async function handleBuyPack(pack: Pack) {
    if (!user || (pack.price > 0 && creditBalance < pack.price) || buyingPackId) return;
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
        await loadData();
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: pack.price > 0 ? -pack.price : 0 } }));
      } else {
        alert(data.error || "Failed to buy pack");
      }
    } catch {
      alert("Failed to buy pack");
    } finally {
      setBuyingPackId(null);
    }
  }

  async function handlePurchaseShopItem(item: ShopItem) {
    if (!user || creditBalance < item.price || buyingItemId) return;
    setBuyingItemId(item.id);
    try {
      const res = await fetch("/api/shop/purchase-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, itemId: item.id }),
      });
      const data = await res.json();
      if (res.ok) {
        if (typeof data.balance === "number") setCreditBalance(data.balance);
        alert(`Purchased: ${item.name}`);
        await loadData();
      } else {
        alert(data.error || "Failed to purchase");
      }
    } finally {
      setBuyingItemId(null);
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
        await loadData();
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
      if (res.ok) await loadData();
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
        await loadData();
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

  const pendingTradeOfferedIds = new Set(
    trades.filter((t) => t.initiatorUserId === user?.id && t.status === "pending").flatMap((t) => t.offeredCardIds)
  );
  const availableForOffer = cards.filter(
    (c) => !myListedCardIds.has(c.id!) && !pendingTradeOfferedIds.has(c.id!)
  );
  const counterpartyListedIds = new Set(
    listings.filter((l) => l.sellerUserId === tradeCounterparty?.id).map((l) => l.cardId)
  );
  const availableToRequest = counterpartyCards.filter((c) => !counterpartyListedIds.has(c.id!));

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
        await loadData();
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
        await loadData();
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
        await loadData();
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
      if (res.ok) await loadData();
      else alert(data.error || "Failed to cancel");
    } catch {
      alert("Failed to cancel trade");
    } finally {
      setTradeActionId(null);
    }
  }

  const sentTrades = trades.filter((t) => t.initiatorUserId === user?.id);
  const receivedTrades = trades.filter((t) => t.counterpartyUserId === user?.id);

  const listedCardIds = new Set(listings.map((l) => l.cardId));
  const availableToList = cards.filter((c) => !listedCardIds.has(c.id));

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "store", label: "Shop" },
    { key: "collection", label: "Collection" },
    { key: "marketplace", label: "Marketplace" },
    { key: "trivia", label: "Trivia" },
    { key: "trade", label: "Trade" },
  ];

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <Header />

      <div className="relative z-10">
        {/* Floating quest log — left side; hidden on small viewports to reduce clutter */}
        <aside
          className="fixed left-4 top-20 z-20 w-56 rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden hidden md:block"
          style={{ maxHeight: "min(28rem, calc(100vh - 6rem))" }}
        >
          <div className="p-3 border-b border-white/[0.06] bg-white/[0.02]">
            <h2 className="text-xs font-semibold text-yellow-400/90 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Quest log
            </h2>
            <p className="text-[10px] text-white/40 mt-1">Track badge progress. Add from a winner&apos;s Card set.</p>
          </div>
          <div className="p-3 overflow-y-auto" style={{ maxHeight: "min(22rem, calc(100vh - 8rem))" }}>
            {pinnedProgress.length === 0 ? (
              <p className="text-xs text-white/30 italic py-2">No quests yet.</p>
            ) : (
              <ul className="space-y-2">
                {pinnedProgress.map((p) => (
                  <li
                    key={p.winnerId}
                    className="group relative rounded-lg border border-white/[0.06] bg-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.06] transition-colors overflow-hidden"
                  >
                    <div className="p-2.5 pr-8">
                      <Link href={`/winners/${p.winnerId}`} className="block">
                        <span className="text-xs font-medium text-white/90 truncate block leading-tight">{p.movieTitle || "Movie"}</span>
                        <span className={`text-[11px] mt-0.5 block ${p.completed ? "text-amber-400" : "text-white/50"}`}>
                          {p.completed ? "✓ Complete" : `${p.owned}/${p.total} cards`}
                        </span>
                      </Link>
                      {/* Expanded on hover: collected / missing cards */}
                      {p.entries.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] max-h-0 overflow-hidden group-hover:max-h-40 group-hover:overflow-y-auto transition-[max-height] duration-200 ease-out">
                          <ul className="space-y-1 pr-0.5">
                            {p.entries.map((e, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-[10px]">
                                <span className={e.owned ? "text-yellow-400/90" : "text-white/30"} aria-hidden>
                                  {e.owned ? "✓" : "—"}
                                </span>
                                <span className={`truncate flex-1 ${e.owned ? "text-white/70" : "text-white/40"}`}>
                                  {e.characterName}{e.actorName ? ` (${e.actorName})` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => unpinWinner(p.winnerId)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove from quest log"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white/90 mb-2">Trading Card Game</h1>
            <p className="text-white/50 text-sm">
              Buy packs, manage your collection, trade on the marketplace, and play trivia to earn credits.
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
                Collect character cards from winning movies. Buy packs with credits, trade up duplicates for rarer cards, and buy or sell on the marketplace.
              </p>
              <p className="text-xs text-white/70 leading-relaxed mb-2">
                This is a <strong className="text-amber-300/95">user-driven economy</strong>—prices and value are set by the community.
              </p>
              <p className="text-xs text-white/70 leading-relaxed mb-2">
                Chase a <strong className="text-amber-300/95">badge</strong> (show off a winning movie on your profile) or build your <strong className="text-amber-300/95">collection</strong>.
              </p>
              <p className="text-xs text-white/50 leading-relaxed">
                New cards are added weekly from winning movies.
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

        {/* In-page tabs */}
        <div className="flex gap-1 mb-8 border-b border-white/[0.08]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium transition-all cursor-pointer relative ${
                tab === t.key
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Shop */}
        {tab === "store" && (
          <>
            <h2 className="text-lg font-semibold text-white/90 mb-1">Shop</h2>
            <p className="text-white/50 text-sm mb-4">
              {shopSubTab === "packs"
                ? "Choose a pack, enjoy the art, and unlock new character cards."
                : "Special items like badges and skips."}
            </p>
            <div className="flex gap-1 mb-8 border-b border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShopSubTab("packs")}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                  shopSubTab === "packs"
                    ? "text-amber-400 border-amber-400"
                    : "text-white/40 border-transparent hover:text-white/70"
                }`}
              >
                Packs
              </button>
              <button
                type="button"
                onClick={() => setShopSubTab("others")}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                  shopSubTab === "others"
                    ? "text-amber-400 border-amber-400"
                    : "text-white/40 border-transparent hover:text-white/70"
                }`}
              >
                Others
              </button>
            </div>

            {shopSubTab === "packs" && (
            <>
              {poolCount < 5 && (
                <p className="text-amber-400/70 text-xs mb-4">
                  No winning movies with TMDB data yet. Win some movies to unlock cards!
                </p>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 justify-items-center">
              {packs.map((pack) => {
                const soldOut =
                  pack.maxPurchasesPerDay != null &&
                  pack.maxPurchasesPerDay > 0 &&
                  (pack.purchasesToday ?? 0) >= pack.maxPurchasesPerDay;
                const disabled =
                  soldOut ||
                  poolCount < pack.cardsPerPack ||
                  (pack.price > 0 && creditBalance < pack.price) ||
                  buyingPackId === pack.id;
                const needCredits = pack.price > 0 && creditBalance < pack.price ? pack.price - creditBalance : 0;
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
                    className={`flex flex-col w-fit max-w-full rounded-2xl border border-white/20 bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden ${soldOut ? "opacity-90" : ""}`}
                  >
                    <div className="relative w-max max-w-full bg-white/[0.03]">
                      {soldOut && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                          <span className="w-full py-3 text-center bg-red-800/70 backdrop-blur-md text-white text-sm font-bold border-y border-red-700/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                            Sold out
                          </span>
                        </div>
                      )}
                      {pack.imageUrl ? (
                        <img
                          src={pack.imageUrl}
                          alt={pack.name}
                          className={`block max-w-full h-auto object-contain ${soldOut ? "grayscale opacity-70" : ""}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center text-white/20 text-lg w-40 h-40">
                          No artwork
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                    <div className={`border-t border-white/10 bg-white/[0.02] p-3 ${soldOut ? "opacity-90" : ""}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90 truncate">{pack.name}</p>
                          <p className="text-[10px] text-white/40">{pack.cardsPerPack} cards per pack</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-400/10 backdrop-blur-md border border-sky-400/20 shadow-[0_2px_8px_rgba(0,0,0,0.15)] shrink-0">
                          {pack.price === 0 ? (
                            <span className="text-sky-300 font-bold text-sm">Free</span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 shrink-0 text-sky-300/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sky-300 font-bold text-sm tabular-nums">{pack.price}</span>
                              <span className="text-sky-300/70 text-xs font-semibold">cr</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/50 border border-white/[0.1]">
                          {rarityText}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-white/50 border border-white/[0.1]">
                          {typeText}
                        </span>
                      </div>
                      <button
                        onClick={() => !soldOut && handleBuyPack(pack)}
                        disabled={disabled}
                        className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                          soldOut
                            ? "border border-white/10 bg-white/[0.04] text-white/50 cursor-not-allowed"
                            : "bg-green-600/80 backdrop-blur-md border border-green-500/40 text-white hover:bg-green-500/90 hover:border-green-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
                        }`}
                      >
                        {buyingPackId === pack.id ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Opening...
                          </>
                        ) : soldOut ? (
                          <span className="text-white/50">Resets in {midnightCountdown}</span>
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
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 text-center text-sm text-white/50">
                  No packs are available in the shop right now. Check back later!
                </div>
              )}
            </div>
            </>
            )}

            {shopSubTab === "others" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {shopItems.map((item) => {
                const disabled = creditBalance < item.price || buyingItemId === item.id;
                const needCredits = item.price > 0 && creditBalance < item.price ? item.price - creditBalance : 0;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col w-full min-w-0 rounded-2xl border border-white/20 bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden"
                  >
                    <div className="relative w-full aspect-[4/3] min-h-[140px] bg-white/[0.03] flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex items-center justify-center text-white/20 text-2xl w-full h-full min-h-[140px] bg-white/[0.03]">
                          {item.type === "badge" ? "🏅" : "⏭"}
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                    <div className="border-t border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90 truncate">{item.name}</p>
                          <p className="text-[10px] text-white/40 capitalize">{item.type}</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-400/10 backdrop-blur-md border border-sky-400/20 shrink-0">
                          {item.price === 0 ? (
                            <span className="text-sky-300 font-bold text-sm">Free</span>
                          ) : (
                            <>
                              <svg className="w-4 h-4 shrink-0 text-sky-300/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sky-300 font-bold text-sm tabular-nums">{item.price}</span>
                              <span className="text-sky-300/70 text-xs font-semibold">cr</span>
                            </>
                          )}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-white/50 mb-2 line-clamp-2">{item.description}</p>
                      )}
                      <button
                        onClick={() => handlePurchaseShopItem(item)}
                        disabled={disabled}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-green-600/80 backdrop-blur-md border border-green-500/40 text-white hover:bg-green-500/90 hover:border-green-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
                      >
                        {buyingItemId === item.id ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Purchasing...
                          </>
                        ) : needCredits > 0 ? (
                          `Need ${needCredits} more credits`
                        ) : (
                          "Purchase"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {shopItems.length === 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 text-center text-sm text-white/50 col-span-full">
                  No other items in the shop right now. Check back later!
                </div>
              )}
            </div>
            )}

            {newCards && newCards.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px]"
                  onClick={() => setNewCards(null)}
                  aria-hidden
                />
                <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
                  <div className="relative w-full max-w-4xl rounded-2xl border border-white/[0.18] bg-white/[0.06] backdrop-blur-md shadow-[0_22px_70px_rgba(0,0,0,0.85)] p-6 overflow-hidden">
                    <div className="relative">
                    <h2 className="text-lg font-semibold text-white/90 mb-4 text-center">
                      You got
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {newCards.map((card, i) => {
                        const revealed = i < revealCount;
                        return (
                          <div key={card.id} className="relative">
                            {!revealed && (
                              <div className="aspect-[2/3] rounded-xl border border-white/[0.18] bg-white/[0.06] flex items-center justify-center text-3xl font-semibold text-white/40">
                                ?
                              </div>
                            )}
                            {revealed && (
                              <div className="card-reveal">
                                <CardDisplay card={card} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => {
                          setNewCards(null);
                          setRevealCount(0);
                        }}
                        className="px-5 py-2.5 rounded-xl border border-white/25 bg-white/[0.06] text-sm font-medium text-white/85 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
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

        {/* Collection */}
        {tab === "collection" && (
          <div>
            {/* Browser-style sub-tabs: Trade up | Alchemy */}
            <div className="flex gap-0 rounded-t-lg border border-white/[0.12] border-b-0 bg-white/[0.04] p-0.5">
              <button
                type="button"
                onClick={() => {
                  setCollectionSubTab("tradeup");
                  router.replace("/cards", { scroll: false });
                }}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-all cursor-pointer ${
                  collectionSubTab === "tradeup"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Trade up
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollectionSubTab("alchemy");
                  router.replace("/cards?alchemy=1", { scroll: false });
                }}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-md transition-all cursor-pointer ${
                  collectionSubTab === "alchemy"
                    ? "bg-white/[0.1] border border-white/20 border-b-0 -mb-px text-amber-400 shadow-sm"
                    : "text-white/35 hover:text-white/55 bg-transparent border border-transparent"
                }`}
              >
                Alchemy
              </button>
            </div>

            {collectionSubTab === "tradeup" && (
            <>
            {(tradeUpResult || tradeUpResultCredits != null) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                  className={`w-full max-w-sm rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 transition-opacity duration-500 tradeup-result-in ${
                    tradeUpResultFading ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <h2 className="text-center text-lg font-semibold text-amber-400/90 mb-4">Trade Up Result</h2>
                  <div className="flex flex-col items-center gap-4">
                    {tradeUpResult ? (
                      <>
                        <div className="w-36 mx-auto">
                          <CardDisplay card={tradeUpResult} />
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
            {legendaryBlockShown && (
              <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border-2 border-red-500/60 bg-red-500/15 px-4 py-3 backdrop-blur-sm">
                <svg className="h-6 w-6 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium text-red-400">Legendary cards cannot be traded up</span>
              </div>
            )}
            {/* Trade Up - frosted glass section */}
            <div className="rounded-2xl rounded-tl-none rounded-tr-none border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-8">
              <h2 className="text-lg font-semibold text-amber-400/90 mb-2">Trade Up</h2>
              <p className="text-sm text-white/60 mb-4">
                Add 5 cards of the same rarity below. Consume them to get 1 card of the next rarity. Epic→Legendary: 33% legendary card, 67% 100 credits.
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {/* Input slots - 5 cards */}
                <div className="flex gap-2">
                  {tradeUpSlots.map((cardId, i) => {
                    const slotCard = cardId ? cards.find((x) => x.id === cardId) : null;
                    const filledStyle = slotCard?.rarity ? (SLOT_FILLED_STYLE[slotCard.rarity] ?? SLOT_FILLED_STYLE.uncommon) : "";
                    return (
                      <div
                        key={`${cardId ?? "empty"}-${i}`}
                        className={`w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl border-2 overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-200 ${
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
                <div className={`w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
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
                {/* Submit button */}
                <button
                  onClick={() => checkBadgeLossThen(tradeUpCardIds, handleTradeUp)}
                  disabled={!canTradeUp || tradingUp}
                  className={`ml-auto px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-semibold hover:border-amber-500/50 hover:bg-amber-500/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    canTradeUp && !tradingUp ? "shadow-[0_0_20px_rgba(251,191,36,0.2)]" : ""
                  }`}
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
              </div>
            </div>
            </>
            )}

            {collectionSubTab === "alchemy" && (
              <>
                {/* Alchemy bench - one slot: Holo → Disenchant, normal → Pack-A-Punch */}
                <div className={`rounded-2xl rounded-tl-none rounded-tr-none border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-4 transition-all duration-300 ${alchemySuccessFlash ? "alchemy-success-flash" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h2 className="text-lg font-semibold text-amber-400/90">Alchemy bench</h2>
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
                  <p className="text-sm text-white/60 mb-4">
                    Place up to 5 cards from your collection below. All Holos → disenchant for Stardust. All normals → Pack-A-Punch to make them Holo. Same type only (like Trade up).
                  </p>
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex gap-2">
                      {alchemyBenchSlots.map((cardId, i) => {
                        const benchCard = cardId ? cards.find((c) => c.id === cardId) : null;
                        const showAsHolo = cardId != null && alchemyPunchHoloCardIds.includes(cardId);
                        const showAsFailed = cardId != null && alchemyPunchFailedCardIds.includes(cardId);
                        return (
                          <div
                            key={`${cardId ?? "empty"}-${i}`}
                            className={`w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
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
                    {alchemyBenchType === "foil" && alchemyBenchCards.length > 0 ? (
                      <div className="flex flex-col items-start gap-2">
                        <span className="text-xs text-white/50">
                          Holo → Disenchant all for {alchemyBenchCards.reduce((sum, c) => sum + getDustForRarity(c.rarity), 0)} Stardust
                        </span>
                        <button
                          onClick={() => handleAlchemyDisenchantAll()}
                          disabled={alchemyDisenchantingId === "_all"}
                          className="px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-300 text-sm font-medium hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {alchemyDisenchantingId === "_all" ? <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin inline-block" /> : "Disenchant all"}
                        </button>
                      </div>
                    ) : alchemyBenchType === "normal" && alchemyBenchCards.length > 0 ? (
                      <div className="flex flex-col items-start gap-2">
                        <span className="text-xs text-white/50">
                          Normal → Pack-A-Punch all ({alchemyBenchCards.reduce((sum, c) => sum + getPackAPunchCost(c.rarity), 0)} Stardust)
                        </span>
                        <button
                          onClick={() => handleAlchemyPackAPunchAll()}
                          disabled={alchemyPunchingId === "_all" || stardust < alchemyBenchCards.reduce((sum, c) => sum + getPackAPunchCost(c.rarity), 0)}
                          className="px-4 py-2 rounded-lg border border-purple-500/40 bg-purple-500/15 text-purple-300 text-sm font-medium hover:bg-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {alchemyPunchingId === "_all" ? <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin inline-block" /> : "Pack-A-Punch all"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-white/40">Add cards from your collection below. Holos or normals only (same type).</span>
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

            {/* Your Collection - always visible */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 mt-8">
              <h2 className="text-lg font-semibold text-white/90">Your Collection ({cards.length})</h2>
              <div className="flex items-center gap-3">
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
                  onChange={(e) => setFilterSort(e.target.value as "recent" | "name" | "movie")}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 cursor-pointer"
                >
                  <option value="recent">Most recent</option>
                  <option value="name">Name</option>
                  <option value="movie">Movie</option>
                </select>
              </div>
            </div>
            {cards.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No cards yet. Buy a pack in Shop to get started!</p>
              </div>
            ) : (() => {
              const filtered = cards
                .filter((c) => !filterRarity || c.rarity === filterRarity)
                .filter((c) => filterFoil === "all" || (filterFoil === "foil" && c.isFoil) || (filterFoil === "normal" && !c.isFoil))
                .sort((a, b) => {
                  if (filterSort === "recent") {
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
                });
              const renderCard = (card: Card) => {
                const inSlots = tradeUpCardIds.includes(card.id!);
                const onAlchemyBench = alchemyBenchCardIds.includes(card.id!);
                const canAddTradeUp = card.rarity !== "legendary" && !myListedCardIds.has(card.id!) && !inSlots && tradeUpCardIds.length < 5 && (tradeUpCards.length === 0 || card.rarity === tradeUpCards[0]?.rarity);
                const canAddAlchemy = collectionSubTab === "alchemy" && !myListedCardIds.has(card.id!) && !onAlchemyBench && alchemyBenchCardIds.length < 5 && (alchemyBenchType === null || (alchemyBenchType === "foil" && card.isFoil) || (alchemyBenchType === "normal" && !card.isFoil));
                const ineligibleTradeUp = tradeUpCardIds.length > 0 && !canAddTradeUp && !inSlots && collectionSubTab === "tradeup";
                const ineligibleAlchemy = alchemyBenchCardIds.length > 0 && !canAddAlchemy && !onAlchemyBench && collectionSubTab === "alchemy";
                const ineligible = ineligibleTradeUp || ineligibleAlchemy;
                const handleClick = () => {
                  if (collectionSubTab === "alchemy") {
                    if (canAddAlchemy && card.id) addToAlchemyBench(card.id);
                    return;
                  }
                  if (canAddTradeUp && card.id) addToTradeUpSlot(card.id!);
                  else if (card.rarity === "legendary") {
                    setLegendaryBlockShown(true);
                    setTimeout(() => setLegendaryBlockShown(false), 2500);
                  }
                };
                return (
                  <div
                    key={card.id}
                    onClick={handleClick}
                    className={`relative group/card transition-all duration-200 ${
                      (canAddTradeUp && collectionSubTab === "tradeup") || (canAddAlchemy && collectionSubTab === "alchemy") ? "cursor-pointer hover:ring-2 hover:ring-white/40 rounded-xl" : ""
                    } ${card.rarity === "legendary" && collectionSubTab === "tradeup" ? "cursor-pointer" : ""} ${ineligible ? "opacity-40 grayscale" : ""}`}
                  >
                    {inSlots && collectionSubTab === "tradeup" && (
                      <span className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">
                        ✓
                      </span>
                    )}
                    {onAlchemyBench && collectionSubTab === "alchemy" && (
                      <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-purple-500/90 text-white text-[10px] font-bold">
                        In bench
                      </span>
                    )}
                    {myListedCardIds.has(card.id!) && (
                      <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-xl text-xs text-white/60">
                        Listed
                      </span>
                    )}
                    <div className={(canAddTradeUp && collectionSubTab === "tradeup") || canAddAlchemy ? "transition-transform duration-200 group-hover/card:scale-[1.02]" : ""}>
                      <CardDisplay card={card} />
                    </div>
                  </div>
                );
              };
              const gridClasses = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";
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
                          {movieCards.map(renderCard)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className={gridClasses}>
                  {filtered.map(renderCard)}
                </div>
              );
            })()}
          </div>
        )}

        {/* Marketplace */}
        {tab === "marketplace" && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <p className="text-white/50 text-sm">Buy and sell character cards with other collectors.</p>
              <button
                onClick={() => setShowListModal(true)}
                className="px-4 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 backdrop-blur-md text-green-400 font-medium hover:border-green-500/50 hover:bg-green-500/15 transition-colors cursor-pointer"
              >
                List a Card
              </button>
            </div>

            {listings.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No cards for sale yet. List your first card!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {listings.map((listing) => (
                  <div key={listing.id} className="flex flex-col rounded-2xl border border-white/20 bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden">
                    <CardDisplay card={listing.card} />
                    <div className="border-t border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] text-white/40 truncate flex items-center gap-1.5 flex-wrap min-w-0">
                          by{" "}
                          <Link href={`/profile/${listing.sellerUserId}`} className="text-white/60 hover:text-sky-300 transition-colors truncate">
                            {listing.sellerName}
                          </Link>
                          {listing.sellerDisplayedBadge && <BadgePill movieTitle={listing.sellerDisplayedBadge.movieTitle} isHolo={listing.sellerDisplayedBadge.isHolo} appearance={listing.sellerDisplayedBadge.badgeAppearance} />}
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
                          className="w-full px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          {buyingId === listing.id ? "Buying..." : "Buy"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
                                <CardDisplay card={card} />
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
                          <CardDisplay card={selectedCard} />
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
                            onClick={() => selectedCard && checkBadgeLossThen([selectedCard.id], handleListCard, { isListing: true })}
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

        {/* Trivia */}
        {tab === "trivia" && (
          <div>
            <p className="text-white/50 text-sm mb-6">
              Play trivia on winner movies to earn credits. Each movie can only be completed once.
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
                Trade cards directly with other users. Send offers and accept or deny incoming trades.
              </p>
              <button
                onClick={openTradeModal}
                className="px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-medium hover:border-amber-500/50 hover:bg-amber-500/15 transition-colors cursor-pointer"
              >
                Start Trade
              </button>
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
                                {t.counterpartyDisplayedBadge && <BadgePill movieTitle={t.counterpartyDisplayedBadge.movieTitle} isHolo={t.counterpartyDisplayedBadge.isHolo} appearance={t.counterpartyDisplayedBadge.badgeAppearance} />}
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
                          /* Trade window — Steam/WoW style */
                          <div className="border-t border-white/10">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/10">
                              <span className="text-sm font-medium text-white/90">Trade with {t.counterpartyName || "Unknown"}</span>
                              <button onClick={() => setExpandedSentTradeId(null)} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">×</button>
                            </div>
                            <div className="grid grid-cols-2 gap-0 min-h-[200px]">
                              <div className="p-4 border-r border-white/10 bg-black/20 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  {user?.id && (userAvatarMap[user.id] ? <img src={userAvatarMap[user.id]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{user.name?.charAt(0) || "?"}</div>)}
                                  <span className="text-xs font-medium text-white/80">You give</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                                  {t.offeredCards.slice(0, 8).map((c) => (
                                    <div key={c.id} className="relative aspect-[2/3] max-w-[72px] rounded-lg overflow-hidden bg-white/5 border border-white/10 ring-1 ring-white/5">
                                      {c.isFoil && (<span className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold text-white z-10" style={{ background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981)", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}>HOLO</span>)}
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                </div>
                                {(t.offeredCredits ?? 0) > 0 && <div className="mt-2 pt-2 border-t border-white/10"><span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-semibold">{(t.offeredCredits ?? 0)} credits</span></div>}
                              </div>
                              <div className="p-4 bg-black/20 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  {t.counterpartyUserId && (userAvatarMap[t.counterpartyUserId] ? <img src={userAvatarMap[t.counterpartyUserId]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{(t.counterpartyName || "?")[0]}</div>)}
                                  <span className="text-xs font-medium text-white/80">You receive</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                                  {t.requestedCards.slice(0, 8).map((c) => (
                                    <div key={c.id} className="relative aspect-[2/3] max-w-[72px] rounded-lg overflow-hidden bg-white/5 border border-white/10 ring-1 ring-white/5">
                                      {c.isFoil && (<span className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold text-white z-10" style={{ background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981)", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}>HOLO</span>)}
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                </div>
                                {(t.requestedCredits ?? 0) > 0 && <div className="mt-2 pt-2 border-t border-white/10"><span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-semibold">{(t.requestedCredits ?? 0)} credits</span></div>}
                              </div>
                            </div>
                            <div className="px-4 py-3 bg-black/30 border-t border-white/10 flex flex-wrap gap-2">
                              <button onClick={() => setExpandedSentTradeId(null)} className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/70 text-sm hover:bg-white/10 cursor-pointer">Collapse</button>
                              <button onClick={() => handleCancelTrade(t.id)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/15 disabled:opacity-40 cursor-pointer">{tradeActionId === t.id ? "Cancelling..." : "Cancel offer"}</button>
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
                                {t.initiatorDisplayedBadge && <BadgePill movieTitle={t.initiatorDisplayedBadge.movieTitle} isHolo={t.initiatorDisplayedBadge.isHolo} appearance={t.initiatorDisplayedBadge.badgeAppearance} />}
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
                          /* Trade window — Steam/WoW style (incoming) */
                          <div className="border-t border-white/10">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/10">
                              <span className="text-sm font-medium text-white/90">{t.initiatorName || "Unknown"} wants to trade</span>
                              <button onClick={() => setExpandedReceivedTradeId(null)} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 cursor-pointer" aria-label="Close">×</button>
                            </div>
                            <div className="grid grid-cols-2 gap-0 min-h-[200px]">
                              <div className="p-4 border-r border-white/10 bg-black/20 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  <Link href={`/profile/${t.initiatorUserId}`} className="flex items-center gap-2 hover:opacity-80 shrink-0">
                                    {t.initiatorUserId && (userAvatarMap[t.initiatorUserId] ? <img src={userAvatarMap[t.initiatorUserId]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{(t.initiatorName || "?")[0]}</div>)}
                                    <span className="text-xs font-medium text-white/80 truncate">They give</span>
                                  </Link>
                                  {t.initiatorDisplayedBadge && <BadgePill movieTitle={t.initiatorDisplayedBadge.movieTitle} isHolo={t.initiatorDisplayedBadge.isHolo} appearance={t.initiatorDisplayedBadge.badgeAppearance} />}
                                </div>
                                <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                                  {t.offeredCards.slice(0, 8).map((c) => (
                                    <div key={c.id} className="relative aspect-[2/3] max-w-[72px] rounded-lg overflow-hidden bg-white/5 border border-white/10 ring-1 ring-white/5">
                                      {c.isFoil && (<span className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold text-white z-10" style={{ background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981)", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}>HOLO</span>)}
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                </div>
                                {(t.offeredCredits ?? 0) > 0 && <div className="mt-2 pt-2 border-t border-white/10"><span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-semibold">{(t.offeredCredits ?? 0)} credits</span></div>}
                              </div>
                              <div className="p-4 bg-black/20 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                  {user?.id && (userAvatarMap[user.id] ? <img src={userAvatarMap[user.id]} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{user.name?.charAt(0) || "?"}</div>)}
                                  <span className="text-xs font-medium text-white/80">You give</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 flex-1 content-start">
                                  {t.requestedCards.slice(0, 8).map((c) => (
                                    <div key={c.id} className="relative aspect-[2/3] max-w-[72px] rounded-lg overflow-hidden bg-white/5 border border-white/10 ring-1 ring-white/5">
                                      {c.isFoil && (<span className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold text-white z-10" style={{ background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981)", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}>HOLO</span>)}
                                      {c.profilePath ? <img src={c.profilePath} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">{c.actorName?.[0]}</div>}
                                    </div>
                                  ))}
                                </div>
                                {(t.requestedCredits ?? 0) > 0 && <div className="mt-2 pt-2 border-t border-white/10"><span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-semibold">{(t.requestedCredits ?? 0)} credits</span></div>}
                              </div>
                            </div>
                            <div className="px-4 py-3 bg-black/30 border-t border-white/10 flex flex-wrap gap-2">
                              <button onClick={() => setExpandedReceivedTradeId(null)} className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/70 text-sm hover:bg-white/10 cursor-pointer">Collapse</button>
                              <button onClick={() => checkBadgeLossThen(t.requestedCardIds, () => handleAcceptTrade(t.id))} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-sm hover:bg-green-500/15 disabled:opacity-40 cursor-pointer">{tradeActionId === t.id ? "..." : "Accept"}</button>
                              <button onClick={() => openEditTrade(t)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm hover:bg-amber-500/15 disabled:opacity-40 cursor-pointer">Edit trade</button>
                              <button onClick={() => handleDenyTrade(t.id)} disabled={tradeActionId === t.id} className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/15 disabled:opacity-40 cursor-pointer">Decline</button>
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
          </>
        )}

        {/* Start Trade modal */}
        {showTradeModal && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => !tradeLoading && setShowTradeModal(false)}
              aria-hidden
            />
            <div
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col"
              role="dialog"
              aria-label="Start trade"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative p-6 flex flex-col flex-1 min-h-0 overflow-auto">
                <h3 className="text-lg font-bold text-white/90 mb-4 shrink-0 pr-10">
                  Start Trade
                  {tradeStep === 1 && " — Select user"}
                  {tradeStep === 2 && " — Your offer"}
                  {tradeStep === 3 && " — Request from them"}
                </h3>

                {tradeStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-white/50 text-sm">Choose a user to trade with.</p>
                    {tradeUsers.length === 0 ? (
                      <p className="text-white/40 text-sm">No other users yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {tradeUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setTradeCounterparty(u);
                              setTradeStep(2);
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-md hover:border-amber-500/40 hover:bg-amber-500/10 transition-colors cursor-pointer text-left"
                          >
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
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

                {tradeStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-white/50 text-sm">
                      Select cards and/or credits to offer. (Cards listed on marketplace cannot be traded.)
                    </p>
                    {availableForOffer.length === 0 ? (
                      <p className="text-white/40 text-sm">No cards available to offer.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto scrollbar-autocomplete">
                        {availableForOffer.map((c) => {
                          const selected = tradeOfferedIds.has(c.id!);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleTradeOffer(c.id!)}
                              className={`relative rounded-xl overflow-hidden ring-2 transition-all cursor-pointer ${
                                selected ? "ring-amber-400 ring-offset-2 ring-offset-[var(--background)]" : "ring-transparent hover:ring-white/40"
                              }`}
                            >
                              <CardDisplay card={c} />
                              {selected && (
                                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3">
                      <label className="text-sm text-sky-300 font-medium">Add credits:</label>
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
                        className="w-24 px-3 py-2 rounded-xl bg-sky-400/10 border border-sky-400/30 text-sky-300 text-sm outline-none focus:border-sky-400/50 placeholder-sky-300/40"
                      />
                      <span className="text-xs text-sky-300/60">(balance: {creditBalance})</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTradeStep(1)}
                        className="px-4 py-2 rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-md text-white/70 hover:bg-white/[0.1] hover:border-white/20 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => (tradeOfferedIds.size > 0 || tradeOfferedCredits > 0) && setTradeStep(3)}
                        disabled={tradeOfferedIds.size === 0 && tradeOfferedCredits <= 0}
                        className="px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-medium hover:border-amber-500/50 hover:bg-amber-500/15 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {tradeStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-white/50 text-sm">
                      Select cards and/or credits you want from {tradeCounterparty?.name}.
                    </p>
                    {availableToRequest.length === 0 ? (
                      <p className="text-white/40 text-sm">{tradeCounterparty?.name} has no cards available to request.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto scrollbar-autocomplete">
                        {availableToRequest.map((c) => {
                          const selected = tradeRequestedIds.has(c.id!);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleTradeRequest(c.id!)}
                              className={`relative rounded-xl overflow-hidden ring-2 transition-all cursor-pointer ${
                                selected ? "ring-amber-400 ring-offset-2 ring-offset-[var(--background)]" : "ring-transparent hover:ring-white/40"
                              }`}
                            >
                              <CardDisplay card={c} />
                              {selected && (
                                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">✓</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3">
                      <label className="text-sm text-sky-300 font-medium">Request credits:</label>
                      <input
                        type="number"
                        min={0}
                        value={tradeRequestedCredits || ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                          setTradeRequestedCredits(isNaN(v) ? 0 : Math.max(0, v));
                        }}
                        placeholder="0"
                        className="w-24 px-3 py-2 rounded-xl bg-sky-400/10 border border-sky-400/30 text-sky-300 text-sm outline-none focus:border-sky-400/50 placeholder-sky-300/40"
                      />
                    </div>
                    {tradeError && <p className="text-red-400 text-sm">{tradeError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTradeStep(2)}
                        className="px-4 py-2 rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-md text-white/70 hover:bg-white/[0.1] hover:border-white/20 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => checkBadgeLossThen(Array.from(tradeOfferedIds), handleSendTrade)}
                        disabled={tradeLoading || (tradeRequestedIds.size === 0 && tradeRequestedCredits <= 0)}
                        className="px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md text-amber-400 font-medium hover:border-amber-500/50 hover:bg-amber-500/15 disabled:opacity-40 cursor-pointer"
                      >
                        {tradeLoading ? "Sending..." : "Send Offer"}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => !tradeLoading && setShowTradeModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Badge loss confirmation modal — frosted glass, red accents */}
        {badgeLossWarnings != null && badgeLossWarnings.length > 0 && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
              onClick={() => { setBadgeLossWarnings(null); setBadgeLossOnConfirm(null); }}
              aria-hidden
            />
            <div
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-500/40 bg-white/[0.06] backdrop-blur-xl shadow-2xl shadow-red-950/30 overflow-hidden"
              role="dialog"
              aria-label="Badge loss warning"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-red-400 mb-2">Lose badge(s)?</h3>
                <p className="text-sm text-white/60 mb-4">
                  {badgeLossIsListing
                    ? "If this card sells, you will lose the following badge(s):"
                    : "This action will cause you to lose the following badge(s):"}
                </p>
                <ul className="space-y-1.5 mb-6">
                  {badgeLossWarnings.map((b, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-center gap-2">
                      {b.isHolo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Holo</span>}
                      {b.movieTitle}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setBadgeLossWarnings(null); setBadgeLossOnConfirm(null); }}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/20 bg-white/[0.06] text-white/80 hover:bg-white/[0.08] cursor-pointer backdrop-blur-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => { await badgeLossOnConfirm?.(); }}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 border border-red-500/30 cursor-pointer shadow-lg shadow-red-950/40"
                  >
                    Continue anyway
                  </button>
                </div>
              </div>
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
