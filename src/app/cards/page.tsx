"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { CardDisplay } from "@/components/CardDisplay";
import { RARITY_COLORS } from "@/lib/constants";

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
  return { title: card.actorName, subtitle: `as ${card.characterName}` };
}

interface Listing {
  id: string;
  cardId: string;
  sellerUserId: string;
  sellerName: string;
  askingPrice: number;
  card: Card;
}

const PACK_PRICE = 50;

type TabKey = "store" | "collection" | "marketplace" | "trivia";

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
}

export default function CardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabKey>("store");
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
  const [tradeUpResultFading, setTradeUpResultFading] = useState(false);
  const [legendaryBlockShown, setLegendaryBlockShown] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);

  const myListedCardIds = new Set(
    listings.filter((l) => l.sellerUserId === user?.id).map((l) => l.cardId)
  );

  const loadData = useCallback(async () => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    const u = JSON.parse(cached) as User;

    const [creditsRes, cardsRes, poolRes, listingsRes, winnersRes, attemptsRes, packsRes] = await Promise.all([
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/cards/character-pool"),
      fetch("/api/marketplace"),
      fetch("/api/winners"),
      fetch(`/api/trivia/attempts?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/cards/packs"),
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
    const handler = () => loadData();
    window.addEventListener("dabys-credits-refresh", handler);
    return () => window.removeEventListener("dabys-credits-refresh", handler);
  }, [loadData]);

  useEffect(() => {
    if (!tradeUpResult) return;
    setTradeUpResultFading(false);
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    const fadeTimer = setTimeout(() => {
      setTradeUpResultFading(true);
      clearTimer = setTimeout(() => {
        setTradeUpResult(null);
        setTradeUpResultFading(false);
      }, 500);
    }, 5000);
    return () => {
      clearTimeout(fadeTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [tradeUpResult]);

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
      if (res.ok && data.card) {
        playTradeUpReveal();
        setTradeUpResult(data.card);
        setTradeUpSlots([null, null, null, null, null]);
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

  async function handleBuyPack(pack: Pack) {
    if (!user || creditBalance < pack.price || buyingPackId) return;
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
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta: -pack.price } }));
      } else {
        alert(data.error || "Failed to buy pack");
      }
    } catch {
      alert("Failed to buy pack");
    } finally {
      setBuyingPackId(null);
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
    { key: "store", label: "Store" },
    { key: "collection", label: "Collection" },
    { key: "marketplace", label: "Marketplace" },
    { key: "trivia", label: "Trivia" },
  ];

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <Header />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white/90 mb-2">Cards</h1>
          <p className="text-white/50 text-sm">
            Buy packs, manage your collection, trade on the marketplace, and play trivia to earn credits.
          </p>
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

        {/* Store */}
        {tab === "store" && (
          <>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white/90 mb-1">Storefront</h2>
                  <p className="text-white/50 text-sm">
                    Choose a pack, enjoy the art, and unlock new character cards.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50 mb-1">Your balance</p>
                  <p className="text-sm font-semibold text-amber-300">{creditBalance} credits</p>
                </div>
              </div>
              {poolCount < 5 && (
                <p className="text-amber-400/70 text-xs mt-3">
                  No winning movies with TMDB data yet. Win some movies to unlock cards!
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {packs.map((pack) => {
                const disabled =
                  poolCount < pack.cardsPerPack || creditBalance < pack.price || buyingPackId === pack.id;
                const needCredits = creditBalance < pack.price ? pack.price - creditBalance : 0;
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
                    className="relative rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-2xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] group transform transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
                  >
                    <div className="relative w-full">
                      {pack.imageUrl ? (
                        <img
                          src={pack.imageUrl}
                          alt={pack.name}
                          className="w-full h-auto object-contain block transition-transform duration-500 group-hover:scale-[1.02]"
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
                        <div className="px-3 py-1 rounded-full bg-sky-400/20 text-sky-50 text-xs font-semibold shadow-sm border border-sky-400/40 transition-colors duration-200 group-hover:bg-sky-400/40 group-hover:border-sky-300/70">
                          {pack.price} cr
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.12]">
                          {rarityText}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.12]">
                          {typeText}
                        </span>
                      </div>
                      <button
                        onClick={() => handleBuyPack(pack)}
                        disabled={disabled}
                        className="w-full px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-200 text-sm font-semibold hover:border-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {buyingPackId === pack.id ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Opening...
                          </>
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
                  No packs are available in the store right now. Check back later!
                </div>
              )}
            </div>

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
            {tradeUpResult && (
              <div className="flex justify-center mb-6">
                <div
                  className={`w-full max-w-sm rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 transition-opacity duration-500 tradeup-result-in ${
                    tradeUpResultFading ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <h2 className="text-center text-lg font-semibold text-amber-400/90 mb-4">Trade Up Result</h2>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-36 mx-auto">
                      <CardDisplay card={tradeUpResult} />
                    </div>
                    <p className="text-sm text-white/60 text-center capitalize">
                      {tradeUpResult.rarity} card
                    </p>
                    <button
                      onClick={() => setTradeUpResult(null)}
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
            <div className="rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-6 mb-8">
              <h2 className="text-lg font-semibold text-amber-400/90 mb-2">Trade Up</h2>
              <p className="text-sm text-white/60 mb-4">
                Add 5 cards of the same rarity below. Consume them to get 1 card of the next rarity.
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {/* Input slots - 5 cards */}
                <div className="flex gap-2">
                  {tradeUpSlots.map((cardId, i) => (
                    <div
                      key={`${cardId ?? "empty"}-${i}`}
                      className={`w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl border-2 overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-200 ${
                        cardId
                          ? "border-amber-400/50 bg-amber-500/10 hover:border-amber-400/70 tradeup-slot-pop"
                          : currentRarity ? SLOT_EMPTY_STYLE[currentRarity] ?? SLOT_EMPTY_STYLE.uncommon : "border-dashed border-amber-500/40 bg-white/[0.04] hover:border-amber-500/60 hover:bg-white/[0.06]"
                      }`}
                      onClick={() => cardId && removeFromTradeUpSlot(cardId)}
                    >
                      {cardId ? (
                        <div className="w-full h-full relative group bg-black/20">
                          {(() => {
                            const c = cards.find((x) => x.id === cardId);
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
                                <span className="absolute bottom-0 left-0 right-0 text-[8px] font-medium uppercase py-0.5 text-center bg-black/70 text-amber-400/90">
                                  {c.rarity}
                                </span>
                                <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-amber-400 text-[10px] font-medium transition-opacity text-center px-1">
                                  Click to remove
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/40 text-center px-1">Empty</span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Arrow */}
                <div className="flex items-center justify-center text-amber-400/80 text-2xl font-bold tradeup-arrow-pulse">
                  →
                </div>
                {/* Output slot */}
                <div className={`w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded-xl border-2 flex items-center justify-center transition-all ${
                  canTradeUp ? "bg-amber-500/20 border-amber-400/60 animate-pulse" : currentRarity ? SLOT_OUTPUT_STYLE[currentRarity] ?? SLOT_OUTPUT_STYLE.uncommon : "bg-white/[0.04] border-amber-500/40"
                }`}>
                  {canTradeUp ? (
                    <span className="text-xs text-amber-400 font-medium text-center px-1">
                      1 {TRADE_UP_NEXT[tradeUpCards[0]?.rarity || ""]}
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/40 text-center px-1">?</span>
                  )}
                </div>
                {/* Submit button */}
                <button
                  onClick={handleTradeUp}
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

            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
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
              </div>
            </div>
            {cards.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
                <p className="text-white/40 text-sm">No cards yet. Buy a pack in Store to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {cards
                  .filter((c) => !filterRarity || c.rarity === filterRarity)
                  .filter((c) => filterFoil === "all" || (filterFoil === "foil" && c.isFoil) || (filterFoil === "normal" && !c.isFoil))
                  .map((card) => {
                    const inSlots = tradeUpCardIds.includes(card.id!);
                    const canAdd = card.rarity !== "legendary" && !myListedCardIds.has(card.id!) && !inSlots && tradeUpCardIds.length < 5 && (tradeUpCards.length === 0 || card.rarity === tradeUpCards[0]?.rarity);
                    const ineligible = tradeUpCardIds.length > 0 && !canAdd && !inSlots;
                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          if (canAdd && card.id) addToTradeUpSlot(card.id!);
                          else if (card.rarity === "legendary") {
                            setLegendaryBlockShown(true);
                            setTimeout(() => setLegendaryBlockShown(false), 2500);
                          }
                        }}
                        className={`relative group/card transition-all duration-200 ${
                          canAdd ? "cursor-pointer hover:ring-2 hover:ring-white/40 rounded-xl" : ""
                        } ${card.rarity === "legendary" ? "cursor-pointer" : ""} ${ineligible ? "opacity-40 grayscale" : ""}`}
                      >
                        {inSlots && (
                          <span className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">
                            ✓
                          </span>
                        )}
                        {myListedCardIds.has(card.id!) && (
                          <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-xl text-xs text-white/60">
                            Listed
                          </span>
                        )}
                        <div className={canAdd ? "transition-transform duration-200 group-hover/card:scale-[1.02]" : ""}>
                          <CardDisplay card={card} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
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
                  <div
                    key={listing.id}
                    className={`rounded-xl border overflow-hidden bg-white/[0.02] ${RARITY_COLORS[listing.card.rarity] || RARITY_COLORS.uncommon} ${listing.card.isFoil ? "ring-2 ring-indigo-400/50" : ""}`}
                  >
                    <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                      {listing.card.profilePath ? (
                        <img
                          src={listing.card.profilePath}
                          alt={listing.card.actorName}
                          className={`w-full h-full object-cover ${listing.card.isFoil ? "holo-sheen" : ""}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl font-bold">
                          {listing.card.actorName.charAt(0)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      {listing.card.isFoil && (
                        <span
                          className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{
                            background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                            boxShadow: "0 0 8px rgba(255,255,255,0.5)",
                          }}
                        >HOLO</span>
                      )}
                      <span className="absolute bottom-2 left-2 right-2 text-[10px] font-medium uppercase text-amber-400/90">
                        {listing.card.rarity}
                      </span>
                    </div>
                    <div className="p-3">
                      {(() => {
                        const { title, subtitle } = cardLabelLines(listing.card);
                        return (
                          <>
                            <p className="text-sm font-semibold text-white/90 truncate">{title}</p>
                            <p className="text-xs text-white/60 truncate">{subtitle}</p>
                            <p className="text-[10px] text-white/40 truncate mt-0.5">{listing.card.movieTitle}</p>
                          </>
                        );
                      })()}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
                        <span className="text-amber-400 font-bold">{listing.askingPrice} cr</span>
                        <span className="text-[10px] text-white/40">by {listing.sellerName}</span>
                      </div>
                      {listing.sellerUserId === user.id ? (
                        <button
                          onClick={() => handleDelist(listing.id)}
                          disabled={delistingId === listing.id}
                          className="w-full mt-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          {delistingId === listing.id ? "Delisting..." : "Delist"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyListing(listing.id)}
                          disabled={creditBalance < listing.askingPrice || buyingId === listing.id}
                          className="w-full mt-2 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                          <p className="text-white/40 text-sm">No cards available to list. Buy packs in Store to get cards!</p>
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
                            onClick={handleListCard}
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
      </main>
    </div>
  );
}

