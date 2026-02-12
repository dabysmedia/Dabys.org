"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

interface User {
  id: string;
  name: string;
}

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
}

interface Listing {
  id: string;
  cardId: string;
  sellerUserId: string;
  sellerName: string;
  askingPrice: number;
  card: Card;
}

const RARITY_COLORS: Record<string, string> = {
  common: "border-white/30 bg-white/5",
  rare: "border-blue-500/50 bg-blue-500/10",
  epic: "border-purple-500/50 bg-purple-500/10",
  legendary: "border-amber-500/50 bg-amber-500/10",
};

const PACK_PRICE = 50;

type TabKey = "store" | "collection" | "marketplace" | "trivia";

interface Winner {
  id: string;
  movieTitle: string;
  posterUrl: string;
  weekTheme?: string;
  tmdbId?: number;
}

export default function CardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabKey>("store");
  const [creditBalance, setCreditBalance] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [poolCount, setPoolCount] = useState(0);
  const [newCards, setNewCards] = useState<Card[] | null>(null);
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

  const loadData = useCallback(async () => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    const u = JSON.parse(cached) as User;

    const [creditsRes, cardsRes, poolRes, listingsRes, winnersRes, attemptsRes] = await Promise.all([
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`),
      fetch(`/api/cards?userId=${encodeURIComponent(u.id)}`),
      fetch("/api/cards/character-pool"),
      fetch("/api/marketplace"),
      fetch("/api/winners"),
      fetch(`/api/trivia/attempts?userId=${encodeURIComponent(u.id)}`),
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

  async function handleBuyPack() {
    if (!user || creditBalance < PACK_PRICE || buying) return;
    setBuying(true);
    try {
      const res = await fetch("/api/cards/buy-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.cards) {
        setNewCards(data.cards);
        await loadData();
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh"));
      } else {
        alert(data.error || "Failed to buy pack");
      }
    } catch {
      alert("Failed to buy pack");
    } finally {
      setBuying(false);
    }
  }

  async function handleBuyListing(listingId: string) {
    if (!user) return;
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
        window.dispatchEvent(new CustomEvent("dabys-credits-refresh"));
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
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-amber-600/10 blur-[140px]" />
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
                  <h2 className="text-lg font-semibold text-white/90 mb-1">Buy a Pack</h2>
                  <p className="text-white/50 text-sm">
                    {PACK_PRICE} credits · 5 random character cards · Chance for foil variants
                  </p>
                </div>
                <button
                  onClick={handleBuyPack}
                  disabled={poolCount < 5 || creditBalance < PACK_PRICE || buying}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all disabled:hover:from-amber-600 disabled:hover:to-amber-700"
                >
                  {buying ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Opening...
                    </span>
                  ) : poolCount < 5 ? (
                    "Need winning movies first"
                  ) : creditBalance < PACK_PRICE ? (
                    `Need ${PACK_PRICE - creditBalance} more credits`
                  ) : (
                    "Buy Pack"
                  )}
                </button>
              </div>
              {poolCount < 5 && (
                <p className="text-amber-400/70 text-xs mt-3">
                  No winning movies with TMDB data yet. Win some movies to unlock cards!
                </p>
              )}
            </div>

            {newCards && newCards.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-amber-400/90 mb-4">You got:</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {newCards.map((card, i) => (
                    <div key={card.id} className="card-reveal" style={{ animationDelay: `${i * 0.1}s` }}>
                      <CardDisplay card={card} />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNewCards(null)}
                  className="mt-4 text-sm text-amber-400/70 hover:text-amber-400 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </>
        )}

        {/* Collection */}
        {tab === "collection" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-white/90">Your Collection ({cards.length})</h2>
              <div className="flex items-center gap-3">
                <select
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 cursor-pointer"
                >
                  <option value="">All rarities</option>
                  <option value="common">Common</option>
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
                  <option value="foil">Foil only</option>
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
                  .map((card) => (
                    <CardDisplay key={card.id} card={card} />
                  ))}
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
                className="px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-colors cursor-pointer"
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
                    className={`rounded-xl border overflow-hidden bg-white/[0.02] ${RARITY_COLORS[listing.card.rarity] || RARITY_COLORS.common} ${listing.card.isFoil ? "ring-2 ring-amber-400/50" : ""}`}
                  >
                    <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                      {listing.card.profilePath ? (
                        <img
                          src={listing.card.profilePath}
                          alt={listing.card.actorName}
                          className={`w-full h-full object-cover ${listing.card.isFoil ? "foil-shimmer" : ""}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl font-bold">
                          {listing.card.actorName.charAt(0)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      {listing.card.isFoil && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/90 text-black">FOIL</span>
                      )}
                      <span className="absolute bottom-2 left-2 right-2 text-[10px] font-medium uppercase text-amber-400/90">
                        {listing.card.rarity}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-white/90 truncate">{listing.card.actorName}</p>
                      <p className="text-xs text-white/60 truncate">as {listing.card.characterName}</p>
                      <p className="text-[10px] text-white/40 truncate mt-0.5">{listing.card.movieTitle}</p>
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
                  className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-[var(--background)] shadow-2xl overflow-hidden"
                  role="dialog"
                  aria-label="List a card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-white/90 mb-4">List a Card</h3>
                    {!selectedCard ? (
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-auto">
                        {availableToList.length === 0 ? (
                          <p className="col-span-2 text-white/40 text-sm">No cards available to list. Buy packs in Store to get cards!</p>
                        ) : (
                          availableToList.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => setSelectedCard(card)}
                              className="text-left p-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
                            >
                              <p className="text-xs font-medium text-white/80 truncate">{card.actorName}</p>
                              <p className="text-[10px] text-white/50 truncate">as {card.characterName}</p>
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                          <p className="text-sm font-medium text-white/90">{selectedCard.actorName}</p>
                          <p className="text-xs text-white/50">as {selectedCard.characterName}</p>
                          <button
                            onClick={() => setSelectedCard(null)}
                            className="ml-auto text-xs text-white/40 hover:text-white/70 cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                        <label className="block text-sm text-white/60 mb-2">Asking price (credits)</label>
                        <input
                          type="number"
                          min={1}
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 mb-4"
                          placeholder="e.g. 50"
                        />
                        <div className="flex gap-2">
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

function CardDisplay({ card }: { card: Card }) {
  const rarityClass = RARITY_COLORS[card.rarity] || RARITY_COLORS.common;
  return (
    <div
      className={`rounded-xl border overflow-hidden bg-white/[0.02] transition-transform hover:scale-[1.02] ${rarityClass} ${card.isFoil ? "ring-2 ring-amber-400/50" : ""}`}
    >
      <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
        {card.profilePath ? (
          <img
            src={card.profilePath}
            alt={card.actorName}
            className={`w-full h-full object-cover ${card.isFoil ? "foil-shimmer" : ""}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl font-bold">
            {card.actorName.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        {card.isFoil && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/90 text-black">
            FOIL
          </span>
        )}
        <span className="absolute bottom-2 left-2 right-2 text-[10px] font-medium uppercase text-amber-400/90">
          {card.rarity}
        </span>
      </div>
      <div className="p-2">
        <p className="text-sm font-semibold text-white/90 truncate">{card.actorName}</p>
        <p className="text-xs text-white/60 truncate">as {card.characterName}</p>
        <p className="text-[10px] text-white/40 truncate mt-0.5">{card.movieTitle}</p>
      </div>
    </div>
  );
}
