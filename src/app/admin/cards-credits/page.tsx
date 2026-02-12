"use client";

import { useEffect, useState, useCallback } from "react";
import ImageCropModal from "@/components/ImageCropModal";
import { CardDisplay } from "@/components/CardDisplay";

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
  cardType?: CardType;
  movieTmdbId?: number;
}

type CardType = "actor" | "director" | "character" | "scene";

interface CharacterPortrayal {
  characterId: string;
  actorName: string;
  characterName: string;
  movieTitle: string;
  rarity: string;
  cardType?: CardType;
  profilePath?: string;
  movieTmdbId?: number;
}

function poolOptionLabel(c: CharacterPortrayal): string {
  const ct = c.cardType ?? "actor";
  if (ct === "director") return `${c.actorName} (Director) (${c.movieTitle}) — ${c.rarity}`;
  if (ct === "scene") return `Scene from ${c.movieTitle} — ${c.rarity}`;
  if (ct === "character") return `${c.actorName} (Character) as ${c.characterName} (${c.movieTitle}) — ${c.rarity}`;
  return `${c.actorName} (Actor) as ${c.characterName} (${c.movieTitle}) — ${c.rarity}`;
}

function poolEntryLabelLines(c: CharacterPortrayal): { title: string; subtitle: string } {
  const ct = c.cardType ?? "actor";
  if (ct === "director") return { title: c.actorName, subtitle: "Director" };
  if (ct === "scene") return { title: "Scene", subtitle: `from ${c.movieTitle}` };
  return { title: c.actorName, subtitle: `as ${c.characterName}` };
}

const RARITY_ORDER = ["legendary", "epic", "rare", "uncommon"] as const;

function PoolEntryCard({
  c,
  onEdit,
  onRemove,
  removingFromPoolId,
}: {
  c: CharacterPortrayal;
  onEdit: () => void;
  onRemove: () => void;
  removingFromPoolId: string | null;
}) {
  const card = {
    profilePath: c.profilePath ?? "",
    actorName: c.actorName,
    characterName: c.characterName,
    movieTitle: c.movieTitle,
    rarity: c.rarity,
    isFoil: false,
    cardType: c.cardType,
  };
  return (
    <div className={`relative group ${c.characterId.startsWith("custom-") ? "ring-1 ring-green-500/30 rounded-xl" : ""}`}>
      <CardDisplay card={card} compact={true} />
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={onEdit}
          className="w-5 h-5 rounded bg-purple-500/80 text-white text-xs hover:bg-purple-500 flex items-center justify-center"
          title="Edit"
        >
          ✎
        </button>
        <button
          onClick={onRemove}
          disabled={removingFromPoolId === c.characterId}
          className="w-5 h-5 rounded bg-red-500/80 text-white text-xs hover:bg-red-500 flex items-center justify-center disabled:opacity-50"
          title="Remove from pool"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function cardLabelLines(card: Card): { title: string; subtitle: string } {
  const ct = card.cardType ?? "actor";
  if (ct === "director") return { title: card.actorName, subtitle: "Director" };
  if (ct === "scene") return { title: "Scene", subtitle: `from ${card.movieTitle}` };
  return { title: card.actorName, subtitle: `as ${card.characterName}` };
}

const RARITY_COLORS: Record<string, string> = {
  uncommon: "border-green-500/50 bg-green-500/10",
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
  const [poolLoading, setPoolLoading] = useState(false);
  const [addingToPool, setAddingToPool] = useState(false);
  const [removingFromPoolId, setRemovingFromPoolId] = useState<string | null>(null);
  const [customActorName, setCustomActorName] = useState("");
  const [customCharacterName, setCustomCharacterName] = useState("");
  const [customMovieTitle, setCustomMovieTitle] = useState("");
  const [customProfilePath, setCustomProfilePath] = useState("");
  const [customMovieTmdbId, setCustomMovieTmdbId] = useState("");
  const [customRarity, setCustomRarity] = useState<"uncommon" | "rare" | "epic" | "legendary">("uncommon");
  const [customCardType, setCustomCardType] = useState<CardType>("actor");
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingPoolEntry, setEditingPoolEntry] = useState<CharacterPortrayal | null>(null);
  const [poolEditForm, setPoolEditForm] = useState<Partial<CharacterPortrayal>>({});
  const [savingPoolEdit, setSavingPoolEdit] = useState(false);
  const [cleaningPool, setCleaningPool] = useState(false);
  const [rebuildingPool, setRebuildingPool] = useState(false);
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [rebuildConfirmInput, setRebuildConfirmInput] = useState("");
  const [poolSort, setPoolSort] = useState<"rarity" | "movie">("rarity");
  const [showImagePickerForAdd, setShowImagePickerForAdd] = useState(false);
  const [showImagePickerForEdit, setShowImagePickerForEdit] = useState(false);
  const [pastingImage, setPastingImage] = useState(false);

  const REBUILD_CONFIRM_WORD = "rebuild";

  // Paste image directly in form (when modal is closed)
  useEffect(() => {
    if (showImagePickerForAdd || showImagePickerForEdit) return;
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          setPastingImage(true);
          const formData = new FormData();
          formData.append("file", file);
          fetch("/api/upload", { method: "POST", body: formData })
            .then((r) => r.json())
            .then((data) => {
              if (data.url) {
                if (editingPoolEntry) setPoolEditForm((f) => ({ ...f, profilePath: data.url }));
                else setCustomProfilePath(data.url);
              }
            })
            .finally(() => setPastingImage(false));
          return;
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [showImagePickerForAdd, showImagePickerForEdit, editingPoolEntry]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/admin/character-pool");
      if (res.ok) {
        const d = await res.json();
        setPool(d.pool || []);
      }
    } catch {
      setError("Failed to load pool");
    } finally {
      setPoolLoading(false);
    }
  }, []);

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
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadUsers();
    loadPool();
  }, [loadUsers, loadPool]);

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

  async function handleAddToPool(e: React.FormEvent) {
    e.preventDefault();
    if (!customActorName.trim() || !customMovieTitle.trim() || !customProfilePath.trim() || addingToPool) return;
    setAddingToPool(true);
    setError("");
    try {
      const res = await fetch("/api/admin/character-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: customActorName.trim(),
          characterName: customCharacterName.trim() || "Unknown",
          movieTitle: customMovieTitle.trim(),
          profilePath: customProfilePath.trim(),
          movieTmdbId: parseInt(customMovieTmdbId, 10) || 0,
          rarity: customRarity,
          cardType: customCardType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPool();
        setCustomActorName("");
        setCustomCharacterName("");
        setCustomMovieTitle("");
        setCustomProfilePath("");
        setCustomMovieTmdbId("");
      } else {
        setError(data.error || "Failed to add to pool");
      }
    } catch {
      setError("Failed to add to pool");
    } finally {
      setAddingToPool(false);
    }
  }

  function openEditPoolEntry(entry: CharacterPortrayal) {
    setEditingPoolEntry(entry);
    setPoolEditForm({
      actorName: entry.actorName,
      characterName: entry.characterName,
      movieTitle: entry.movieTitle,
      profilePath: entry.profilePath ?? "",
      movieTmdbId: entry.movieTmdbId ?? 0,
      rarity: entry.rarity,
      cardType: (entry.cardType ?? "actor") as CardType,
    });
    setError("");
  }

  async function handleSavePoolEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPoolEntry || savingPoolEdit) return;
    setSavingPoolEdit(true);
    setError("");
    try {
      const res = await fetch("/api/admin/character-pool", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: editingPoolEntry.characterId,
          ...poolEditForm,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPool();
        setEditingPoolEntry(null);
      } else {
        setError(data.error || "Failed to update pool entry");
      }
    } catch {
      setError("Failed to update pool entry");
    } finally {
      setSavingPoolEdit(false);
    }
  }

  async function handleRebuildPool() {
    setShowRebuildConfirm(false);
    setRebuildConfirmInput("");
    setRebuildingPool(true);
    setError("");
    try {
      const res = await fetch("/api/cards/character-pool?rebuild=1");
      if (res.ok) {
        const d = await res.json();
        setPool(d.pool || []);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to rebuild pool");
      }
    } catch {
      setError("Failed to rebuild pool");
    } finally {
      setRebuildingPool(false);
    }
  }

  async function handleCleanupPool() {
    setCleaningPool(true);
    setError("");
    try {
      const res = await fetch("/api/admin/character-pool?cleanup=1");
      if (res.ok) {
        const d = await res.json();
        setPool(d.pool || []);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to cleanup pool");
      }
    } catch {
      setError("Failed to cleanup pool");
    } finally {
      setCleaningPool(false);
    }
  }

  async function handleRemoveFromPool(characterId: string) {
    setRemovingFromPoolId(characterId);
    setError("");
    try {
      const res = await fetch(`/api/admin/character-pool?characterId=${encodeURIComponent(characterId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadPool();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove from pool");
      }
    } catch {
      setError("Failed to remove from pool");
    } finally {
      setRemovingFromPoolId(null);
    }
  }

  function openEditCard(card: Card) {
    setEditingCard(card);
    setEditForm({
      actorName: card.actorName,
      characterName: card.characterName,
      movieTitle: card.movieTitle,
      profilePath: card.profilePath,
      rarity: card.rarity,
      isFoil: card.isFoil,
      cardType: card.cardType ?? "actor",
      movieTmdbId: card.movieTmdbId ?? 0,
    });
    setError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard || savingEdit) return;
    setSavingEdit(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: editingCard.id,
          ...editForm,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCards((prev) => prev.map((c) => (c.id === editingCard.id ? { ...c, ...data } : c)));
        setEditingCard(null);
      } else {
        setError(data.error || "Failed to update card");
      }
    } catch {
      setError("Failed to update card");
    } finally {
      setSavingEdit(false);
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

      {/* Manage Card Pool */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
            Manage Card Pool ({pool.length} cards)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {showRebuildConfirm ? (
              <>
                <input
                  type="text"
                  value={rebuildConfirmInput}
                  onChange={(e) => setRebuildConfirmInput(e.target.value)}
                  placeholder={`Type "${REBUILD_CONFIRM_WORD}" to confirm`}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs w-48 outline-none focus:border-purple-500/40"
                  autoFocus
                />
                <button
                  onClick={handleRebuildPool}
                  disabled={rebuildingPool || rebuildConfirmInput.toLowerCase().trim() !== REBUILD_CONFIRM_WORD}
                  className="px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400/90 text-xs font-medium hover:bg-purple-500/10 disabled:opacity-40"
                >
                  {rebuildingPool ? "Rebuilding..." : "Confirm rebuild"}
                </button>
                <button
                  onClick={() => {
                    setShowRebuildConfirm(false);
                    setRebuildConfirmInput("");
                  }}
                  disabled={rebuildingPool}
                  className="px-3 py-1.5 rounded-lg border border-white/20 text-white/60 text-xs font-medium hover:bg-white/5 disabled:opacity-40"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowRebuildConfirm(true)}
                disabled={rebuildingPool}
                className="px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400/90 text-xs font-medium hover:bg-purple-500/10 disabled:opacity-40"
              >
                {rebuildingPool ? "Rebuilding..." : "Rebuild pool (6/movie)"}
              </button>
            )}
            <button
              onClick={handleCleanupPool}
              disabled={cleaningPool}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-40"
            >
              {cleaningPool ? "Cleaning..." : "Remove generic roles"}
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Drop chance</span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Legendary</span> <span className="font-medium">1%</span></span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Epic</span> <span className="font-medium">10%</span></span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Rare</span> <span className="font-medium">25%</span></span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Uncommon</span> <span className="font-medium">64%</span></span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create custom card */}
          <div>
            <h3 className="text-sm font-medium text-white/80 mb-3">Create Custom Card</h3>
            <form onSubmit={handleAddToPool} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Actor / Name *</label>
                  <input
                    type="text"
                    value={customActorName}
                    onChange={(e) => setCustomActorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    placeholder="Al Pacino"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Character / Role</label>
                  <input
                    type="text"
                    value={customCharacterName}
                    onChange={(e) => setCustomCharacterName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    placeholder="Tony Montana"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Movie Title *</label>
                <input
                  type="text"
                  value={customMovieTitle}
                  onChange={(e) => setCustomMovieTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                  placeholder="Scarface"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Image *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customProfilePath}
                    onChange={(e) => setCustomProfilePath(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    placeholder="URL, or paste image (Ctrl+V) / click button"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImagePickerForAdd(true)}
                    disabled={pastingImage}
                    className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {pastingImage ? "Uploading..." : "Upload or paste"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">TMDB Movie ID</label>
                  <input
                    type="number"
                    value={customMovieTmdbId}
                    onChange={(e) => setCustomMovieTmdbId(e.target.value)}
                    className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Rarity</label>
                  <select
                    value={customRarity}
                    onChange={(e) => setCustomRarity(e.target.value as typeof customRarity)}
                    className="px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                  >
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Card Type</label>
                  <select
                    value={customCardType}
                    onChange={(e) => setCustomCardType(e.target.value as CardType)}
                    className="px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                  >
                    <option value="actor">Actor</option>
                    <option value="director">Director</option>
                    <option value="character">Character</option>
                    <option value="scene">Scene</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={!customActorName.trim() || !customMovieTitle.trim() || !customProfilePath.trim() || addingToPool}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-40 cursor-pointer"
              >
                {addingToPool ? "Adding..." : "Add to Pool"}
              </button>
            </form>
          </div>

          {/* Pool view */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-medium text-white/80">Pool</h3>
              <select
                value={poolSort}
                onChange={(e) => setPoolSort(e.target.value as "rarity" | "movie")}
                className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
              >
                <option value="rarity">Sort by rarity</option>
                <option value="movie">Sort by movie</option>
              </select>
            </div>
            {poolLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                {poolSort === "rarity" ? (
                  RARITY_ORDER.map((r) => {
                    const entries = pool.filter((c) => c.rarity === r);
                    if (entries.length === 0) return null;
                    return (
                      <div key={r}>
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              r === "legendary" ? "bg-amber-400" : r === "epic" ? "bg-purple-400" : r === "rare" ? "bg-blue-400" : "bg-white/40"
                            }`}
                          />
                          {r} ({entries.length})
                        </h4>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                          {entries.map((c) => (
                            <PoolEntryCard
                              key={c.characterId}
                              c={c}
                              onEdit={() => openEditPoolEntry(c)}
                              onRemove={() => handleRemoveFromPool(c.characterId)}
                              removingFromPoolId={removingFromPoolId}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  (() => {
                    const byMovie = new Map<string, typeof pool>();
                    for (const c of pool) {
                      const m = c.movieTitle || "(No movie)";
                      if (!byMovie.has(m)) byMovie.set(m, []);
                      byMovie.get(m)!.push(c);
                    }
                    const movies = Array.from(byMovie.keys()).sort();
                    return movies.map((movieTitle) => {
                      const entries = byMovie.get(movieTitle)!;
                      return (
                        <div key={movieTitle}>
                          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                            {movieTitle} ({entries.length})
                          </h4>
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                            {entries.map((c) => (
                              <PoolEntryCard
                                key={c.characterId}
                                c={c}
                                onEdit={() => openEditPoolEntry(c)}
                                onRemove={() => handleRemoveFromPool(c.characterId)}
                                removingFromPoolId={removingFromPoolId}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
                  {pool.filter((c) => c.profilePath?.trim()).map((c) => (
                    <option key={c.characterId} value={c.characterId}>
                      {poolOptionLabel(c)}
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
                    className={`rounded-xl border overflow-hidden bg-white/[0.02] ${RARITY_COLORS[card.rarity] || RARITY_COLORS.uncommon} ${card.isFoil ? "ring-2 ring-amber-400/50" : ""}`}
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
                      {(() => {
                        const { title, subtitle } = cardLabelLines(card);
                        return (
                          <>
                            <p className="text-sm font-semibold text-white/90 truncate">{title}</p>
                            <p className="text-xs text-white/60 truncate">{subtitle}</p>
                            <p className="text-[10px] text-white/40 truncate mt-0.5">{card.movieTitle}</p>
                          </>
                        );
                      })()}
                      <div className="mt-2 flex gap-1">
                        <button
                          onClick={() => openEditCard(card)}
                          className="flex-1 px-2 py-1.5 rounded text-xs border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          disabled={removingId === card.id}
                          className="flex-1 px-2 py-1.5 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer"
                        >
                          {removingId === card.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
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

      {/* Edit card modal */}
      {editingCard && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => !savingEdit && setEditingCard(null)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Edit card"
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white/90 mb-4">Edit Card</h3>
              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Actor / Name</label>
                    <input
                      type="text"
                      value={editForm.actorName ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, actorName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Character / Role</label>
                    <input
                      type="text"
                      value={editForm.characterName ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, characterName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Movie Title</label>
                  <input
                    type="text"
                    value={editForm.movieTitle ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, movieTitle: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={editForm.profilePath ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, profilePath: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">TMDB Movie ID</label>
                    <input
                      type="number"
                      value={editForm.movieTmdbId ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, movieTmdbId: parseInt(e.target.value, 10) || 0 }))}
                      className="w-20 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Rarity</label>
                    <select
                      value={editForm.rarity ?? "uncommon"}
                      onChange={(e) => setEditForm((f) => ({ ...f, rarity: e.target.value }))}
                      className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                    >
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Card Type</label>
                    <select
                      value={editForm.cardType ?? "actor"}
                      onChange={(e) => setEditForm((f) => ({ ...f, cardType: e.target.value as CardType }))}
                      className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                    >
                      <option value="actor">Actor</option>
                      <option value="director">Director</option>
                      <option value="character">Character</option>
                      <option value="scene">Scene</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
                    <input
                      type="checkbox"
                      checked={editForm.isFoil ?? false}
                      onChange={(e) => setEditForm((f) => ({ ...f, isFoil: e.target.checked }))}
                      className="rounded border-white/30 bg-white/5"
                    />
                    <span className="text-sm text-white/60">Foil</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingCard(null)}
                    disabled={savingEdit}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer"
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit pool entry modal */}
      {editingPoolEntry && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => !savingPoolEdit && setEditingPoolEntry(null)}
            aria-hidden
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="Edit pool entry"
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-white/90 mb-4">Edit Pool Entry</h3>
              <form onSubmit={handleSavePoolEdit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Actor / Name</label>
                    <input
                      type="text"
                      value={poolEditForm.actorName ?? ""}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, actorName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Character / Role</label>
                    <input
                      type="text"
                      value={poolEditForm.characterName ?? ""}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, characterName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Movie Title</label>
                  <input
                    type="text"
                    value={poolEditForm.movieTitle ?? ""}
                    onChange={(e) => setPoolEditForm((f) => ({ ...f, movieTitle: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Image</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={poolEditForm.profilePath ?? ""}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, profilePath: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                      placeholder="URL, or paste image (Ctrl+V) / click button"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImagePickerForEdit(true)}
                      disabled={pastingImage}
                      className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {pastingImage ? "Uploading..." : "Upload or paste"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">TMDB Movie ID</label>
                    <input
                      type="number"
                      value={poolEditForm.movieTmdbId ?? ""}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, movieTmdbId: parseInt(e.target.value, 10) || 0 }))}
                      className="w-20 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Rarity</label>
                    <select
                      value={poolEditForm.rarity ?? "uncommon"}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, rarity: e.target.value }))}
                      className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                    >
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Card Type</label>
                    <select
                      value={poolEditForm.cardType ?? "actor"}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, cardType: e.target.value as CardType }))}
                      className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                    >
                      <option value="actor">Actor</option>
                      <option value="director">Director</option>
                      <option value="character">Character</option>
                      <option value="scene">Scene</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPoolEntry(null)}
                    disabled={savingPoolEdit}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPoolEdit}
                    className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer"
                  >
                    {savingPoolEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <ImageCropModal
        open={showImagePickerForAdd}
        onClose={() => setShowImagePickerForAdd(false)}
        onComplete={(url) => {
          setCustomProfilePath(url);
          setShowImagePickerForAdd(false);
        }}
        aspect={2 / 3}
        title="Card art"
        cropShape="rect"
      />
      <ImageCropModal
        open={showImagePickerForEdit}
        onClose={() => setShowImagePickerForEdit(false)}
        onComplete={(url) => {
          setPoolEditForm((f) => ({ ...f, profilePath: url }));
          setShowImagePickerForEdit(false);
        }}
        aspect={2 / 3}
        title="Card art"
        cropShape="rect"
      />
    </div>
  );
}
