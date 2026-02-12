"use client";

import { useEffect, useState, useCallback } from "react";

interface User {
  id: string;
  name: string;
}

interface Card {
  id: string;
  userId: string;
  characterId: string;
  rarity: string;
  isFoil: boolean;
  actorName: string;
  characterName: string;
  movieTitle: string;
  profilePath: string;
}

interface CharacterPortrayal {
  characterId: string;
  actorName: string;
  characterName: string;
  movieTitle: string;
  rarity: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: "border-white/30 bg-white/5",
  rare: "border-blue-500/50 bg-blue-500/10",
  epic: "border-purple-500/50 bg-purple-500/10",
  legendary: "border-amber-500/50 bg-amber-500/10",
};

export default function AdminCardsCreditsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditInput, setCreditInput] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [pool, setPool] = useState<CharacterPortrayal[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCredits, setSavingCredits] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addCharacterId, setAddCharacterId] = useState("");
  const [addFoil, setAddFoil] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data: User[] = await res.json();
        setUsers(data);
        if (data.length > 0 && !selectedUserId) setSelectedUserId(data[0].id);
      }
    } catch {
      setError("Failed to load users");
    }
  }, [selectedUserId]);

  const loadData = useCallback(async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError("");
    try {
      const [creditsRes, cardsRes, poolRes] = await Promise.all([
        fetch(`/api/credits?userId=${encodeURIComponent(selectedUserId)}`),
        fetch(`/api/admin/cards?userId=${encodeURIComponent(selectedUserId)}`),
        fetch("/api/admin/character-pool"),
      ]);

      if (creditsRes.ok) {
        const d = await creditsRes.json();
        const bal = typeof d?.balance === "number" ? d.balance : 0;
        setCreditBalance(bal);
        setCreditInput(String(bal));
      }
      if (cardsRes.ok) setCards(await cardsRes.json());
      else setCards([]);
      if (poolRes.ok) {
        const p = await poolRes.json();
        setPool(p.pool || []);
      } else setPool([]);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSetCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || savingCredits) return;
    const val = parseInt(creditInput, 10);
    if (isNaN(val) || val < 0) {
      setError("Enter a valid non-negative number");
      return;
    }
    setSavingCredits(true);
    setError("");
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, balance: val }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreditBalance(data.balance);
        setCreditInput(String(data.balance));
      } else {
        setError(data.error || "Failed to set credits");
      }
    } catch {
      setError("Failed to set credits");
    } finally {
      setSavingCredits(false);
    }
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !addCharacterId || addingCard) return;
    setAddingCard(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          characterId: addCharacterId,
          isFoil: addFoil,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCards((prev) => [...prev, data]);
        setAddCharacterId("");
      } else {
        setError(data.error || "Failed to add card");
      }
    } catch {
      setError("Failed to add card");
    } finally {
      setAddingCard(false);
    }
  }

  async function handleRemoveCard(cardId: string) {
    setRemovingId(cardId);
    setError("");
    try {
      const res = await fetch(`/api/admin/cards?cardId=${encodeURIComponent(cardId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== cardId));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove card");
      }
    } catch {
      setError("Failed to remove card");
    } finally {
      setRemovingId(null);
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white/90 mb-2">Cards & Credits</h1>
      <p className="text-white/50 text-sm mb-8">
        Manually set user credits and manage their card collection. All changes save to /data.
      </p>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* User selector */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-white/60 mb-2">Select User</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full max-w-xs px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-purple-500/50 cursor-pointer [color-scheme:dark] [&_option]:bg-[#1a1a24] [&_option]:text-white"
        >
          <option value="">-- Select user --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.id})
            </option>
          ))}
        </select>
      </div>

      {loading && selectedUserId ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      ) : selectedUserId && selectedUser ? (
        <>
          {/* Credits */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
              Credits
            </h2>
            <p className="text-white/40 text-sm mb-4">
              Current balance: <span className="text-amber-400 font-bold">{creditBalance}</span>
            </p>
            <form onSubmit={handleSetCredits} className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs text-white/40 mb-1">Set balance to</label>
                <input
                  type="number"
                  min={0}
                  value={creditInput}
                  onChange={(e) => setCreditInput(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 w-32"
                  placeholder="0"
                />
              </div>
              <button
                type="submit"
                disabled={savingCredits}
                className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer"
              >
                {savingCredits ? "Saving..." : "Save Credits"}
              </button>
            </form>
          </div>

          {/* Cards / Collection */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
              Collection ({cards.length} cards)
            </h2>

            {/* Add card */}
            <form onSubmit={handleAddCard} className="flex flex-wrap gap-3 items-end mb-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-white/40 mb-1">Add card from pool</label>
                <select
                  value={addCharacterId}
                  onChange={(e) => setAddCharacterId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-purple-500/50 cursor-pointer [color-scheme:dark] [&_option]:bg-[#1a1a24] [&_option]:text-white"
                >
                  <option value="">-- Select character --</option>
                  {pool.map((c) => (
                    <option key={c.characterId} value={c.characterId}>
                      {c.actorName} as {c.characterName} ({c.movieTitle}) — {c.rarity}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addFoil}
                  onChange={(e) => setAddFoil(e.target.checked)}
                  className="rounded border-white/30 bg-white/5"
                />
                <span className="text-sm text-white/60">Foil</span>
              </label>
              <button
                type="submit"
                disabled={!addCharacterId || addingCard}
                className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-40 cursor-pointer"
              >
                {addingCard ? "Adding..." : "Add Card"}
              </button>
            </form>

            {/* Cards grid */}
            {cards.length === 0 ? (
              <p className="text-white/30 text-sm">No cards in collection.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className={`rounded-xl border overflow-hidden bg-white/[0.02] ${RARITY_COLORS[card.rarity] || RARITY_COLORS.common} ${card.isFoil ? "ring-2 ring-amber-400/50" : ""}`}
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
                      <button
                        onClick={() => handleRemoveCard(card.id)}
                        disabled={removingId === card.id}
                        className="mt-2 w-full px-2 py-1.5 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer"
                      >
                        {removingId === card.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-white/40 text-sm">Select a user to manage their credits and cards.</p>
      )}
    </div>
  );
}
