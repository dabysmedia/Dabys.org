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
  altArtOfCharacterId?: string;
}

interface Pack {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  cardsPerPack: number;
  allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
  allowedCardTypes: CardType[];
  isActive: boolean;
  maxPurchasesPerDay?: number;
  isFree?: boolean;
  restockHourUtc?: number;
  restockMinuteUtc?: number;
  discounted?: boolean;
  discountPercent?: number;
  rarityWeights?: { legendary: number; epic: number; rare: number; uncommon: number };
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

function cardTypeDisplayLabel(t: CardType): string {
  if (t === "character") return "Boys";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function poolOptionLabel(c: CharacterPortrayal): string {
  const ct = c.cardType ?? "actor";
  if (ct === "director") return `${c.actorName} (Director) (${c.movieTitle}) — ${c.rarity}`;
  if (ct === "scene") return `Scene from ${c.movieTitle} — ${c.rarity}`;
  if (ct === "character") return `${c.actorName} (Boys) as ${c.characterName} (${c.movieTitle}) — ${c.rarity}`;
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
}: {
  c: CharacterPortrayal;
  onEdit: () => void;
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
    <div className={`rounded-xl border overflow-hidden bg-white/[0.02] ${c.characterId.startsWith("custom-") ? "ring-1 ring-green-500/30" : ""} ${RARITY_COLORS[c.rarity] ?? "border-white/10"}`}>
      <div className="relative w-full" style={{ maxWidth: 72 }}>
        <CardDisplay card={card} compact size="xs" />
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-white/90 truncate">{c.actorName}</p>
        <p className="text-[10px] text-white/60 truncate">{c.characterName}</p>
        <p className="text-[10px] text-white/40 truncate mt-0.5">{c.movieTitle}</p>
        <div className="mt-2">
          <button
            type="button"
            onClick={onEdit}
            className="w-full min-h-[36px] px-3 py-2 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 hover:bg-purple-500/15 cursor-pointer touch-manipulation"
          >
            Edit
          </button>
        </div>
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
  const [stardustBalance, setStardustBalance] = useState<number>(0);
  const [stardustInput, setStardustInput] = useState("");
  const [savingStardust, setSavingStardust] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [pool, setPool] = useState<CharacterPortrayal[]>([]);
  const [pendingByWinner, setPendingByWinner] = useState<Record<string, CharacterPortrayal[]>>({});
  const [pushingWinnerId, setPushingWinnerId] = useState<string | null>(null);
  const [editingPendingWinnerId, setEditingPendingWinnerId] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCredits, setSavingCredits] = useState(false);
  const [restockingPack, setRestockingPack] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [addingCardCharacterId, setAddingCardCharacterId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addHolo, setAddHolo] = useState(false);
  const [error, setError] = useState("");
  const [poolLoading, setPoolLoading] = useState(false);
  const [addingToPool, setAddingToPool] = useState(false);
  const [removingFromPoolId, setRemovingFromPoolId] = useState<string | null>(null);
  const [customActorName, setCustomActorName] = useState("");
  const [customCharacterName, setCustomCharacterName] = useState("");
  const [customWinnerId, setCustomWinnerId] = useState("");
  const [customProfilePath, setCustomProfilePath] = useState("");
  const [customRarity, setCustomRarity] = useState<"uncommon" | "rare" | "epic" | "legendary">("uncommon");
  const [customCardType, setCustomCardType] = useState<CardType>("actor");
  const [customAltArtOfCharacterId, setCustomAltArtOfCharacterId] = useState("");
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingPoolEntry, setEditingPoolEntry] = useState<CharacterPortrayal | null>(null);
  const [poolEditForm, setPoolEditForm] = useState<Partial<CharacterPortrayal>>({});
  const [savingPoolEdit, setSavingPoolEdit] = useState(false);
  const [rebuildingPool, setRebuildingPool] = useState(false);
  const [showRebuildConfirm, setShowRebuildConfirm] = useState(false);
  const [rebuildConfirmInput, setRebuildConfirmInput] = useState("");
  const [poolSort, setPoolSort] = useState<"rarity" | "movie">("rarity");
  const [showImagePickerForAdd, setShowImagePickerForAdd] = useState(false);
  const [showImagePickerForEdit, setShowImagePickerForEdit] = useState(false);
  const [pastingImage, setPastingImage] = useState(false);
  const [showImagePickerForPack, setShowImagePickerForPack] = useState(false);
  const [packsLoading, setPacksLoading] = useState(false);
  const [savingPack, setSavingPack] = useState(false);
  const [deletingPackId, setDeletingPackId] = useState<string | null>(null);
  const [reorderingPack, setReorderingPack] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [showCreatePackForm, setShowCreatePackForm] = useState(false);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopItemsLoading, setShopItemsLoading] = useState(false);
  const [showCreateShopItem, setShowCreateShopItem] = useState(false);
  const [editingShopItemId, setEditingShopItemId] = useState<string | null>(null);
  const [shopItemForm, setShopItemForm] = useState<{
    name: string;
    description: string;
    imageUrl: string;
    price: string;
    type: ShopItemType;
    skipAmount: string;
    isActive: boolean;
  }>({
    name: "",
    description: "",
    imageUrl: "",
    price: "0",
    type: "badge",
    skipAmount: "1",
    isActive: true,
  });
  const [savingShopItem, setSavingShopItem] = useState(false);
  const [deletingShopItemId, setDeletingShopItemId] = useState<string | null>(null);
  const [showCreateCustomCardForm, setShowCreateCustomCardForm] = useState(false);
  const [poolSectionOpen, setPoolSectionOpen] = useState(false);
  const [triviaAttempts, setTriviaAttempts] = useState<{ id: string; userId: string; winnerId: string; correctCount: number; totalCount: number; creditsEarned: number; completedAt: string }[]>([]);
  const [winners, setWinners] = useState<{ id: string; movieTitle: string; posterUrl?: string; tmdbId?: number }[]>([]);
  const [reopeningWinnerId, setReopeningWinnerId] = useState<string | null>(null);
  const [reopeningAll, setReopeningAll] = useState(false);
  const [userCodex, setUserCodex] = useState<{
    characterIds: string[];
    holoCharacterIds: string[];
    altArtCharacterIds: string[];
    boysCharacterIds: string[];
  } | null>(null);
  const [codexBusy, setCodexBusy] = useState<Record<string, boolean>>({});
  const [openUserSection, setOpenUserSection] = useState<Record<string, boolean>>({
    credits: false,
    stardust: false,
    shop: false,
    trivia: false,
    collection: false,
    codex: false,
  });
  const [wipeConfirmUser, setWipeConfirmUser] = useState("");
  const [wipeConfirmServer, setWipeConfirmServer] = useState("");
  const [wipingUser, setWipingUser] = useState(false);
  const [wipingServer, setWipingServer] = useState(false);
  const [resettingCodex, setResettingCodex] = useState(false);
  const [legendaryInInventory, setLegendaryInInventory] = useState<(Card & { inPool: boolean })[]>([]);
  const [legendaryInInventoryLoading, setLegendaryInInventoryLoading] = useState(false);
  const [returnToPoolCardId, setReturnToPoolCardId] = useState<string | null>(null);
  const [creditSettings, setCreditSettings] = useState<{
    submission: number;
    vote: number;
    submissionWin: number;
    votesReceivedPerVote: number;
    rating: number;
    comment: number;
    quicksellUncommon: number;
    quicksellRare: number;
    quicksellEpic: number;
    tradeUpLegendaryFailureCredits: number;
  } | null>(null);
  const [creditSettingsForm, setCreditSettingsForm] = useState({
    submission: "50",
    vote: "50",
    submissionWin: "250",
    votesReceivedPerVote: "50",
    rating: "25",
    comment: "25",
    quicksellUncommon: "5",
    quicksellRare: "20",
    quicksellEpic: "80",
    tradeUpLegendaryFailureCredits: "100",
  });
  const [savingCreditSettings, setSavingCreditSettings] = useState(false);
  const [creditSettingsLoading, setCreditSettingsLoading] = useState(true);
  const [addAllCreditsInput, setAddAllCreditsInput] = useState("");
  const [addAllCreditsLoading, setAddAllCreditsLoading] = useState(false);
  const [packForm, setPackForm] = useState<{
    name: string;
    imageUrl: string;
    price: string;
    cardsPerPack: string;
    allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
    allowedCardTypes: CardType[];
    isActive: boolean;
    maxPurchasesPerDay: string;
    restockIntervalHours: string;
    restockHourUtc: string;
    restockMinuteUtc: string;
    isFree: boolean;
    discounted: boolean;
    discountPercent: string;
    useCustomWeights: boolean;
    rarityWeights: { legendary: string; epic: string; rare: string; uncommon: string };
  }>({
    name: "",
    imageUrl: "",
    price: "50",
    cardsPerPack: "5",
    allowedRarities: ["uncommon", "rare", "epic", "legendary"],
    allowedCardTypes: ["actor", "director", "character", "scene"],
    isActive: true,
    maxPurchasesPerDay: "",
    restockIntervalHours: "",
    restockHourUtc: "0",
    restockMinuteUtc: "0",
    isFree: false,
    discounted: false,
    discountPercent: "",
    useCustomWeights: false,
    rarityWeights: { legendary: "1", epic: "10", rare: "25", uncommon: "64" },
  });

  const REBUILD_CONFIRM_WORD = "rebuild";

  // Paste image directly in form (when modal is closed)
  useEffect(() => {
    if (showImagePickerForAdd || showImagePickerForEdit || showImagePickerForPack) return;
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
  }, [showImagePickerForAdd, showImagePickerForEdit, showImagePickerForPack, editingPoolEntry]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/admin/character-pool");
      if (res.ok) {
        const d = await res.json();
        setPool(Array.isArray(d) ? d : (d?.pool ?? []));
        setPendingByWinner(d?.pendingByWinner ?? {});
      }
    } catch {
      setError("Failed to load pool");
    } finally {
      setPoolLoading(false);
    }
  }, []);

  const loadPacks = useCallback(async () => {
    setPacksLoading(true);
    try {
      const res = await fetch("/api/admin/packs");
      if (res.ok) {
        const d = await res.json();
        setPacks(d.packs || []);
      }
    } catch {
      setError("Failed to load packs");
    } finally {
      setPacksLoading(false);
    }
  }, []);

  const loadShopItems = useCallback(async () => {
    setShopItemsLoading(true);
    try {
      const res = await fetch("/api/admin/shop-items");
      if (res.ok) {
        const d = await res.json();
        setShopItems(d.items || []);
      }
    } catch {
      setError("Failed to load shop items");
    } finally {
      setShopItemsLoading(false);
    }
  }, []);

  const loadCreditSettings = useCallback(async () => {
    setCreditSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/credit-settings");
      if (res.ok) {
        const d = await res.json();
        setCreditSettings(d);
        setCreditSettingsForm({
          submission: String(d.submission ?? 50),
          vote: String(d.vote ?? 50),
          submissionWin: String(d.submissionWin ?? 250),
          votesReceivedPerVote: String(d.votesReceivedPerVote ?? 50),
          rating: String(d.rating ?? 25),
          comment: String(d.comment ?? 25),
          quicksellUncommon: String(d.quicksellUncommon ?? 5),
          quicksellRare: String(d.quicksellRare ?? 20),
          quicksellEpic: String(d.quicksellEpic ?? 80),
          tradeUpLegendaryFailureCredits: String(d.tradeUpLegendaryFailureCredits ?? 100),
        });
      }
    } catch {
      setError("Failed to load credit settings");
    } finally {
      setCreditSettingsLoading(false);
    }
  }, []);

  const loadLegendaryInInventory = useCallback(async () => {
    setLegendaryInInventoryLoading(true);
    try {
      const res = await fetch(`/api/admin/legendary-not-in-pool?t=${Date.now()}`);
      if (res.ok) {
        const d = await res.json();
        setLegendaryInInventory(Array.isArray(d.cards) ? d.cards : []);
      } else {
        setLegendaryInInventory([]);
      }
    } catch {
      setLegendaryInInventory([]);
    } finally {
      setLegendaryInInventoryLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data: User[] = await res.json();
        setUsers(data);
      }
    } catch {
      setError("Failed to load users");
    }
  }, [selectedUserId]);

  const loadData = useCallback(async () => {
    if (!selectedUserId) {
      setUserCodex(null);
      return;
    }
    setLoading(true);
    setError("");
    setUserCodex(null);
    try {
      const [creditsRes, stardustRes, cardsRes, poolRes, attemptsRes, winnersRes, codexRes] = await Promise.all([
        fetch(`/api/credits?userId=${encodeURIComponent(selectedUserId)}`),
        fetch(`/api/alchemy/stardust?userId=${encodeURIComponent(selectedUserId)}`),
        fetch(`/api/admin/cards?userId=${encodeURIComponent(selectedUserId)}`),
        fetch("/api/admin/character-pool"),
        fetch(`/api/trivia/attempts?userId=${encodeURIComponent(selectedUserId)}`),
        fetch("/api/winners"),
        fetch(`/api/cards/codex?userId=${encodeURIComponent(selectedUserId)}`),
      ]);

      if (creditsRes.ok) {
        const d = await creditsRes.json();
        const bal = typeof d?.balance === "number" ? d.balance : 0;
        setCreditBalance(bal);
        setCreditInput(String(bal));
      }
      if (stardustRes.ok) {
        const d = await stardustRes.json();
        const bal = typeof d?.balance === "number" ? d.balance : 0;
        setStardustBalance(bal);
        setStardustInput(String(bal));
      }
      if (cardsRes.ok) setCards(await cardsRes.json());
      else setCards([]);
      if (poolRes.ok) {
        const p = await poolRes.json();
        setPool(Array.isArray(p) ? p : (p?.pool ?? []));
        setPendingByWinner(p?.pendingByWinner ?? {});
      }
      if (attemptsRes.ok) {
        const a = await attemptsRes.json();
        setTriviaAttempts(a.attempts || []);
      } else setTriviaAttempts([]);
      if (winnersRes.ok) {
        const w = await winnersRes.json();
        setWinners(w || []);
      } else setWinners([]);
      if (codexRes.ok) {
        const c = await codexRes.json();
        setUserCodex({
          characterIds: c.characterIds ?? [],
          holoCharacterIds: c.holoCharacterIds ?? [],
          altArtCharacterIds: c.altArtCharacterIds ?? [],
          boysCharacterIds: c.boysCharacterIds ?? [],
        });
      } else {
        setUserCodex({ characterIds: [], holoCharacterIds: [], altArtCharacterIds: [], boysCharacterIds: [] });
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
    loadPacks();
    loadShopItems();
    loadCreditSettings();
    loadLegendaryInInventory();
  }, [loadUsers, loadPool, loadPacks, loadShopItems, loadCreditSettings, loadLegendaryInInventory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetShopItemForm() {
    setEditingShopItemId(null);
    setShowCreateShopItem(false);
    setShopItemForm({
      name: "",
      description: "",
      imageUrl: "",
      price: "0",
      type: "badge",
      skipAmount: "1",
      isActive: true,
    });
  }

  function startEditShopItem(item: ShopItem) {
    setEditingShopItemId(item.id);
    setShowCreateShopItem(true);
    setShopItemForm({
      name: item.name,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      price: String(item.price),
      type: item.type,
      skipAmount: String(item.skipAmount ?? 1),
      isActive: item.isActive,
    });
  }

  async function handleSaveShopItem(e: React.FormEvent) {
    e.preventDefault();
    if (savingShopItem) return;
    const name = shopItemForm.name.trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const price = parseInt(shopItemForm.price, 10);
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be 0 or more");
      return;
    }
    const skipAmount = parseInt(shopItemForm.skipAmount, 10);
    if (shopItemForm.type === "skip" && (!Number.isInteger(skipAmount) || skipAmount < 1)) {
      setError("Skip amount must be at least 1");
      return;
    }
    setSavingShopItem(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shop-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingShopItemId || undefined,
          name,
          description: shopItemForm.description.trim() || undefined,
          imageUrl: shopItemForm.imageUrl.trim() || undefined,
          price,
          type: shopItemForm.type,
          skipAmount: shopItemForm.type === "skip" ? skipAmount : undefined,
          isActive: shopItemForm.isActive,
          order: editingShopItemId ? shopItems.find((i) => i.id === editingShopItemId)?.order : shopItems.length,
        }),
      });
      if (res.ok) {
        const item = await res.json();
        if (editingShopItemId) {
          setShopItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        } else {
          setShopItems((prev) => [...prev, item]);
        }
        resetShopItemForm();
      } else {
        const d = await res.json();
        setError(d.error || "Failed to save");
      }
    } finally {
      setSavingShopItem(false);
    }
  }

  async function handleDeleteShopItem(id: string) {
    setDeletingShopItemId(id);
    try {
      const res = await fetch(`/api/admin/shop-items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setShopItems((prev) => prev.filter((i) => i.id !== id));
        if (editingShopItemId === id) resetShopItemForm();
      }
    } finally {
      setDeletingShopItemId(null);
    }
  }

  function resetPackForm() {
    setEditingPackId(null);
    setShowCreatePackForm(false);
    setPackForm({
      name: "",
      imageUrl: "",
      price: "50",
      cardsPerPack: "5",
      allowedRarities: ["uncommon", "rare", "epic", "legendary"],
      allowedCardTypes: ["actor", "director", "character", "scene"],
      isActive: true,
      maxPurchasesPerDay: "",
      restockIntervalHours: "",
      restockHourUtc: "0",
      restockMinuteUtc: "0",
      isFree: false,
      discounted: false,
      discountPercent: "",
      useCustomWeights: false,
      rarityWeights: { legendary: "1", epic: "10", rare: "25", uncommon: "64" },
    });
  }

  function startEditPack(pack: Pack) {
    setEditingPackId(pack.id);
    setShowCreatePackForm(true);
    const w = pack.rarityWeights;
    setPackForm({
      name: pack.name,
      imageUrl: pack.imageUrl,
      price: String(pack.price),
      cardsPerPack: String(pack.cardsPerPack),
      allowedRarities: pack.allowedRarities,
      allowedCardTypes: pack.allowedCardTypes,
      isActive: pack.isActive,
      maxPurchasesPerDay: pack.maxPurchasesPerDay != null ? String(pack.maxPurchasesPerDay) : "",
      restockIntervalHours: pack.restockIntervalHours != null ? String(pack.restockIntervalHours) : "",
      restockHourUtc: pack.restockHourUtc != null ? String(pack.restockHourUtc) : "0",
      restockMinuteUtc: pack.restockMinuteUtc != null ? String(pack.restockMinuteUtc) : "0",
      isFree: !!pack.isFree,
      discounted: !!pack.discounted,
      discountPercent: pack.discountPercent != null ? String(pack.discountPercent) : "",
      useCustomWeights: !!w,
      rarityWeights: w
        ? { legendary: String(w.legendary), epic: String(w.epic), rare: String(w.rare), uncommon: String(w.uncommon) }
        : { legendary: "1", epic: "10", rare: "25", uncommon: "64" },
    });
  }

  async function handleSavePack(e: React.FormEvent) {
    e.preventDefault();
    if (savingPack) return;
    if (!packForm.name.trim() || !packForm.imageUrl.trim()) {
      setError("Pack name and image are required");
      return;
    }
    const price = parseInt(packForm.price, 10);
    const cardsPerPack = parseInt(packForm.cardsPerPack, 10);
    const maxPurchasesPerDay = packForm.maxPurchasesPerDay.trim() === "" ? undefined : parseInt(packForm.maxPurchasesPerDay, 10);
    const restockIntervalHours = packForm.restockIntervalHours.trim() === "" ? undefined : Math.max(1, Math.min(8760, parseInt(packForm.restockIntervalHours, 10) || 0));
    const restockHourUtc = packForm.restockHourUtc.trim() === "" ? undefined : Math.min(23, Math.max(0, parseInt(packForm.restockHourUtc, 10) || 0));
    const restockMinuteUtc = packForm.restockMinuteUtc.trim() === "" ? undefined : Math.min(59, Math.max(0, parseInt(packForm.restockMinuteUtc, 10) || 0));
    if (!packForm.isFree && (!Number.isFinite(price) || price < 1)) {
      setError("Pack price must be at least 1 when not free");
      return;
    }
    if (packForm.isFree && !Number.isFinite(price)) {
      setError("Price must be a number");
      return;
    }
    if (!Number.isFinite(cardsPerPack) || cardsPerPack < 1) {
      setError("Cards per pack must be at least 1");
      return;
    }

    setSavingPack(true);
    setError("");
    try {
      const method = editingPackId ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        name: packForm.name.trim(),
        imageUrl: packForm.imageUrl.trim(),
        price: packForm.isFree ? 0 : price,
        cardsPerPack,
        allowedRarities: packForm.allowedRarities,
        allowedCardTypes: packForm.allowedCardTypes,
        isActive: packForm.isActive,
        isFree: packForm.isFree,
        discounted: packForm.discounted,
        discountPercent: packForm.discounted && packForm.discountPercent.trim() !== ""
          ? Math.min(100, Math.max(0, parseInt(packForm.discountPercent, 10) || 0))
          : undefined,
        maxPurchasesPerDay: maxPurchasesPerDay === undefined ? "" : maxPurchasesPerDay,
        restockIntervalHours: restockIntervalHours ?? "",
        restockHourUtc: restockHourUtc ?? "",
        restockMinuteUtc: restockMinuteUtc ?? "",
        rarityWeights: packForm.useCustomWeights
          ? {
              legendary: Math.max(0, parseFloat(packForm.rarityWeights.legendary) || 0),
              epic: Math.max(0, parseFloat(packForm.rarityWeights.epic) || 0),
              rare: Math.max(0, parseFloat(packForm.rarityWeights.rare) || 0),
              uncommon: Math.max(0, parseFloat(packForm.rarityWeights.uncommon) || 0),
            }
          : undefined,
      };
      if (editingPackId) body.id = editingPackId;

      const res = await fetch("/api/admin/packs", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPacks();
        resetPackForm();
      } else {
        setError(data.error || "Failed to save pack");
      }
    } catch {
      setError("Failed to save pack");
    } finally {
      setSavingPack(false);
    }
  }

  async function handleSaveCreditSettings(e: React.FormEvent) {
    e.preventDefault();
    if (savingCreditSettings) return;
    setSavingCreditSettings(true);
    setError("");
    try {
      const body = {
        submission: parseInt(creditSettingsForm.submission, 10) || 0,
        vote: parseInt(creditSettingsForm.vote, 10) || 0,
        submissionWin: parseInt(creditSettingsForm.submissionWin, 10) || 0,
        votesReceivedPerVote: parseInt(creditSettingsForm.votesReceivedPerVote, 10) || 0,
        rating: parseInt(creditSettingsForm.rating, 10) || 0,
        comment: parseInt(creditSettingsForm.comment, 10) || 0,
        quicksellUncommon: parseInt(creditSettingsForm.quicksellUncommon, 10) ?? 0,
        quicksellRare: parseInt(creditSettingsForm.quicksellRare, 10) ?? 0,
        quicksellEpic: parseInt(creditSettingsForm.quicksellEpic, 10) ?? 0,
        tradeUpLegendaryFailureCredits: parseInt(creditSettingsForm.tradeUpLegendaryFailureCredits, 10) ?? 0,
      };
      const res = await fetch("/api/admin/credit-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setCreditSettings(data);
      } else {
        setError(data.error || "Failed to save credit settings");
      }
    } catch {
      setError("Failed to save credit settings");
    } finally {
      setSavingCreditSettings(false);
    }
  }

  async function handleReorderPacks(newOrder: string[]) {
    setReorderingPack(true);
    try {
      const res = await fetch("/api/admin/packs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packIds: newOrder }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.packs)) setPacks(data.packs);
      }
    } finally {
      setReorderingPack(false);
    }
  }

  function movePack(index: number, direction: "up" | "down") {
    const newOrder = [...packs.map((p) => p.id)];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= newOrder.length) return;
    [newOrder[index], newOrder[swap]] = [newOrder[swap], newOrder[index]];
    handleReorderPacks(newOrder);
  }

  async function handleDeletePack(id: string) {
    setDeletingPackId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/packs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setPacks((prev) => prev.filter((p) => p.id !== id));
        if (editingPackId === id) {
          resetPackForm();
        }
      } else {
        setError(data.error || "Failed to delete pack");
      }
    } catch {
      setError("Failed to delete pack");
    } finally {
      setDeletingPackId(null);
    }
  }

  async function handleReopenAllTrivia() {
    if (reopeningAll) return;
    setReopeningAll(true);
    setError("");
    try {
      const res = await fetch("/api/admin/trivia/reopen-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTriviaAttempts([]);
      } else {
        setError(data.error || "Failed to reopen all trivia");
      }
    } catch {
      setError("Failed to reopen all trivia");
    } finally {
      setReopeningAll(false);
    }
  }

  async function handleReopenTrivia(winnerId: string) {
    if (!selectedUserId || reopeningWinnerId) return;
    setReopeningWinnerId(winnerId);
    setError("");
    try {
      const res = await fetch("/api/admin/trivia/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, winnerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setTriviaAttempts((prev) => prev.filter((a) => a.winnerId !== winnerId));
      } else {
        setError(data.error || "Failed to reopen trivia");
      }
    } catch {
      setError("Failed to reopen trivia");
    } finally {
      setReopeningWinnerId(null);
    }
  }

  async function handleWipeUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || wipingUser) return;
    if (wipeConfirmUser.trim().toUpperCase() !== "WIPE") {
      setError("Type WIPE to confirm");
      return;
    }
    setWipingUser(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wipe/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, confirm: wipeConfirmUser.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWipeConfirmUser("");
        setCreditBalance(0);
        setCards([]);
        setTriviaAttempts([]);
        setError("");
        alert(`Wiped: ${data.cardsRemoved} cards, ${data.listingsRemoved} listings, ${data.tradesRemoved} trades, ${data.triviaAttemptsRemoved} trivia attempts.`);
      } else {
        setError(data.error || "Failed to wipe user inventory");
      }
    } catch {
      setError("Failed to wipe user inventory");
    } finally {
      setWipingUser(false);
    }
  }

  async function handleWipeServer(e: React.FormEvent) {
    e.preventDefault();
    if (wipingServer) return;
    if (wipeConfirmServer.trim().toUpperCase() !== "WIPE") {
      setError("Type WIPE to confirm");
      return;
    }
    setWipingServer(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wipe/server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: wipeConfirmServer.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWipeConfirmServer("");
        setError("");
        alert("Server reset complete. Reload the page.");
        window.location.reload();
      } else {
        setError(data.error || "Failed to reset server");
      }
    } catch {
      setError("Failed to reset server");
    } finally {
      setWipingServer(false);
    }
  }

  async function handleResetCodex() {
    if (resettingCodex) return;
    if (!confirm("Clear all codex unlocks for every user? Everyone will need to re-discover cards in the Codex.")) return;
    setResettingCodex(true);
    setError("");
    try {
      const res = await fetch("/api/admin/codex/reset", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setError("");
        alert("Codex reset complete. All users’ codex unlocks have been cleared.");
      } else {
        setError(data.error || "Failed to reset codex");
      }
    } catch {
      setError("Failed to reset codex");
    } finally {
      setResettingCodex(false);
    }
  }

  async function handleAddCreditsToAll(e: React.FormEvent) {
    e.preventDefault();
    if (addAllCreditsLoading) return;
    const val = parseInt(addAllCreditsInput, 10);
    if (isNaN(val) || val < 0) {
      setError("Enter a valid non-negative number");
      return;
    }
    setAddAllCreditsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/credits/add-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val }),
      });
      const data = await res.json();
      if (res.ok) {
        if (selectedUserId) {
          const balRes = await fetch(`/api/credits?userId=${encodeURIComponent(selectedUserId)}`);
          if (balRes.ok) {
            const d = await balRes.json();
            setCreditBalance(typeof d?.balance === "number" ? d.balance : 0);
          }
        }
        setAddAllCreditsInput("");
      } else {
        setError(data.error || "Failed to add credits to all users");
      }
    } catch {
      setError("Failed to add credits to all users");
    } finally {
      setAddAllCreditsLoading(false);
    }
  }

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

  async function handleSetStardust(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || savingStardust) return;
    const val = parseInt(stardustInput, 10);
    if (isNaN(val) || val < 0) {
      setError("Enter a valid non-negative number");
      return;
    }
    setSavingStardust(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stardust", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, balance: val }),
      });
      const data = await res.json();
      if (res.ok) {
        setStardustBalance(data.balance);
        setStardustInput(String(data.balance));
      } else {
        setError(data.error || "Failed to set stardust");
      }
    } catch {
      setError("Failed to set stardust");
    } finally {
      setSavingStardust(false);
    }
  }

  async function handleAddCard(characterId: string) {
    if (!selectedUserId || !characterId || addingCard) return;
    setAddingCard(true);
    setAddingCardCharacterId(characterId);
    setError("");
    try {
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          characterId,
          isFoil: addHolo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCards((prev) => [...prev, data]);
      } else {
        setError(data.error || "Failed to add card");
      }
    } catch {
      setError("Failed to add card");
    } finally {
      setAddingCard(false);
      setAddingCardCharacterId(null);
    }
  }

  async function handleAddToPool(e: React.FormEvent) {
    e.preventDefault();
    const isBoys = customCardType === "character";
    if (!customActorName.trim() || !customProfilePath.trim() || (!isBoys && !customWinnerId) || addingToPool) return;
    setAddingToPool(true);
    setError("");
    try {
      const res = await fetch("/api/admin/character-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: customActorName.trim(),
          characterName: customCharacterName.trim() || "Unknown",
          profilePath: customProfilePath.trim(),
          ...(customCardType !== "character" && customWinnerId && { winnerId: customWinnerId }),
          rarity: customRarity,
          cardType: customCardType,
          ...(customAltArtOfCharacterId.trim() && { altArtOfCharacterId: customAltArtOfCharacterId.trim() }),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPool();
        setCustomActorName("");
        setCustomCharacterName("");
        setCustomProfilePath("");
        setCustomWinnerId("");
        setCustomAltArtOfCharacterId("");
      } else {
        setError(data.error || "Failed to add to pool");
      }
    } catch {
      setError("Failed to add to pool");
    } finally {
      setAddingToPool(false);
    }
  }

  async function handlePushToPool(winnerId: string) {
    setPushingWinnerId(winnerId);
    setError("");
    try {
      const res = await fetch("/api/admin/character-pool/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPool();
      } else {
        setError(data.error || "Failed to push to pool");
      }
    } catch {
      setError("Failed to push to pool");
    } finally {
      setPushingWinnerId(null);
    }
  }

  function openEditPoolEntry(entry: CharacterPortrayal, pendingWinnerId?: string) {
    setEditingPoolEntry(entry);
    setEditingPendingWinnerId(pendingWinnerId ?? null);
    setPoolEditForm({
      actorName: entry.actorName,
      characterName: entry.characterName,
      movieTitle: entry.movieTitle,
      profilePath: entry.profilePath ?? "",
      movieTmdbId: entry.movieTmdbId ?? 0,
      rarity: entry.rarity,
      cardType: (entry.cardType ?? "actor") as CardType,
      altArtOfCharacterId: entry.altArtOfCharacterId ?? "",
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
          ...(editingPendingWinnerId && { winnerId: editingPendingWinnerId }),
          ...poolEditForm,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPool();
        setEditingPoolEntry(null);
        setEditingPendingWinnerId(null);
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

  async function handleRemoveFromPool(characterId: string, pendingWinnerId?: string, onSuccess?: () => void) {
    setRemovingFromPoolId(characterId);
    setError("");
    try {
      const params = new URLSearchParams({ characterId });
      if (pendingWinnerId) params.set("winnerId", pendingWinnerId);
      const res = await fetch(`/api/admin/character-pool?${params.toString()}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadPool();
        onSuccess?.();
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

  async function handleRemoveCard(cardId: string, onSuccess?: () => void) {
    setRemovingId(cardId);
    setError("");
    try {
      const res = await fetch(`/api/admin/cards?cardId=${encodeURIComponent(cardId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== cardId));
        onSuccess?.();
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

      {/* Legendaries currently in inventory — who has what */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-1">
              Legendaries currently in inventory
            </h3>
            <p className="text-white/40 text-sm">
              Who has what legendary. Cards not in the character pool can be returned to the pool so they can drop again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadLegendaryInInventory()}
            disabled={legendaryInInventoryLoading}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer"
          >
            {legendaryInInventoryLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div className="mt-4">
          {legendaryInInventoryLoading ? (
            <p className="text-white/50 text-sm">Loading…</p>
          ) : legendaryInInventory.length === 0 ? (
            <p className="text-white/50 text-sm">No legendary cards in any user&apos;s inventory.</p>
          ) : (
            <div className="space-y-6">
              {(() => {
                const byUser = new Map<string, (Card & { inPool: boolean })[]>();
                for (const card of legendaryInInventory) {
                  const list = byUser.get(card.userId) ?? [];
                  list.push(card);
                  byUser.set(card.userId, list);
                }
                const sortedUserIds = Array.from(byUser.keys()).sort((a, b) => {
                  const na = users.find((u) => u.id === a)?.name ?? a;
                  const nb = users.find((u) => u.id === b)?.name ?? b;
                  return na.localeCompare(nb);
                });
                return sortedUserIds.map((userId) => {
                  const userCards = byUser.get(userId) ?? [];
                  const userName = users.find((u) => u.id === userId)?.name ?? userId;
                  return (
                    <div key={userId} className="rounded-lg border border-white/[0.1] bg-white/[0.03] p-5">
                      <h4 className="text-sm font-medium text-white/90 mb-4">
                        {userName}
                        <span className="ml-2 text-white/40 font-normal">
                          ({userCards.length} {userCards.length === 1 ? "legendary" : "legendaries"})
                        </span>
                      </h4>
                      <div className="flex flex-wrap gap-5">
                        {userCards.map((card) => (
                          <div
                            key={card.id}
                            className="flex flex-col items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 min-w-[160px]"
                          >
                            <CardDisplay card={card} size="md" />
                            <span
                              className="text-[10px] text-white/55 font-mono truncate w-full max-w-[180px] text-center min-w-0"
                              title={card.characterId}
                            >
                              {card.characterId}
                            </span>
                            {card.isFoil && <span className="text-xs text-amber-400/90">Holo</span>}
                            <span
                              className={`text-[10px] px-2.5 py-1 rounded-md mt-0.5 ${card.inPool ? "bg-emerald-500/20 text-emerald-400/90" : "bg-amber-500/20 text-amber-400/90"}`}
                            >
                              {card.inPool ? "In pool" : "Not in pool"}
                            </span>
                            {!card.inPool && (
                              <button
                                type="button"
                                disabled={returnToPoolCardId !== null}
                                onClick={async () => {
                                  if (!card.id) return;
                                  setReturnToPoolCardId(card.id);
                                  try {
                                    const res = await fetch("/api/admin/legendary-not-in-pool", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ cardId: card.id }),
                                    });
                                    const data = await res.json();
                                    if (res.ok && data.ok) {
                                      await loadLegendaryInInventory();
                                      await loadPool();
                                    } else {
                                      setError(data?.error ?? "Failed to return to pool");
                                    }
                                  } catch {
                                    setError("Failed to return to pool");
                                  } finally {
                                    setReturnToPoolCardId(null);
                                  }
                                }}
                                className="mt-2 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer"
                              >
                                {returnToPoolCardId === card.id ? "Adding…" : "Return to pool"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Credit Rewards */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
          Credit Rewards
        </h2>
        <p className="text-white/40 text-sm mb-4">
          Credits awarded for each action. Saved to /data (creditSettings.json).
        </p>
        {creditSettingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            Loading...
          </div>
        ) : (
          <form onSubmit={handleSaveCreditSettings} className="flex flex-wrap gap-6">
            <div>
              <label className="block text-xs text-white/40 mb-1">Submission</label>
              <input
                type="number"
                min={0}
                value={creditSettingsForm.submission}
                onChange={(e) => setCreditSettingsForm((f) => ({ ...f, submission: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
              />
              <span className="ml-1 text-xs text-white/40">cr</span>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Vote</label>
              <input
                type="number"
                min={0}
                value={creditSettingsForm.vote}
                onChange={(e) => setCreditSettingsForm((f) => ({ ...f, vote: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
              />
              <span className="ml-1 text-xs text-white/40">cr</span>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Submission wins</label>
              <input
                type="number"
                min={0}
                value={creditSettingsForm.submissionWin}
                onChange={(e) => setCreditSettingsForm((f) => ({ ...f, submissionWin: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
              />
              <span className="ml-1 text-xs text-white/40">cr</span>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1" title="Per vote received, when winner is published (non-winners only)">Votes received</label>
              <input
                type="number"
                min={0}
                value={creditSettingsForm.votesReceivedPerVote}
                onChange={(e) => setCreditSettingsForm((f) => ({ ...f, votesReceivedPerVote: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
              />
              <span className="ml-1 text-xs text-white/40">cr/vote</span>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Rating a movie</label>
              <input
                type="number"
                min={0}
                value={creditSettingsForm.rating}
                onChange={(e) => setCreditSettingsForm((f) => ({ ...f, rating: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
              />
              <span className="ml-1 text-xs text-white/40">cr</span>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Leaving a comment</label>
              <input
                type="number"
                min={0}
                value={creditSettingsForm.comment}
                onChange={(e) => setCreditSettingsForm((f) => ({ ...f, comment: e.target.value }))}
                className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
              />
              <span className="ml-1 text-xs text-white/40">cr</span>
            </div>
            <div className="w-full border-t border-white/[0.06] pt-4 mt-2 flex flex-wrap gap-6">
              <span className="text-xs text-white/40 w-full">Quicksell (vendor) credits per rarity</span>
              <div>
                <label className="block text-xs text-white/40 mb-1">Quicksell uncommon</label>
                <input
                  type="number"
                  min={0}
                  value={creditSettingsForm.quicksellUncommon}
                  onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellUncommon: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
                />
                <span className="ml-1 text-xs text-white/40">cr</span>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Quicksell rare</label>
                <input
                  type="number"
                  min={0}
                  value={creditSettingsForm.quicksellRare}
                  onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellRare: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
                />
                <span className="ml-1 text-xs text-white/40">cr</span>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Quicksell epic</label>
                <input
                  type="number"
                  min={0}
                  value={creditSettingsForm.quicksellEpic}
                  onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellEpic: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
                />
                <span className="ml-1 text-xs text-white/40">cr</span>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1" title="When 4 epics are traded up and the result is credits (67% chance) instead of a legendary">Epic→Legendary trade-up failure</label>
                <input
                  type="number"
                  min={0}
                  value={creditSettingsForm.tradeUpLegendaryFailureCredits}
                  onChange={(e) => setCreditSettingsForm((f) => ({ ...f, tradeUpLegendaryFailureCredits: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40"
                />
                <span className="ml-1 text-xs text-white/40">cr</span>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={savingCreditSettings}
                className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 cursor-pointer"
              >
                {savingCreditSettings ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
        <div className="border-t border-white/[0.06] pt-4 mt-4">
          <p className="text-white/40 text-sm mb-3">Add the same amount of credits to every user.</p>
          <form onSubmit={handleAddCreditsToAll} className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs text-white/40 mb-1">Credits to add</label>
              <input
                type="number"
                min={0}
                value={addAllCreditsInput}
                onChange={(e) => setAddAllCreditsInput(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 w-32"
                placeholder="0"
              />
            </div>
            <button
              type="submit"
              disabled={addAllCreditsLoading}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer"
            >
              {addAllCreditsLoading ? "Adding..." : "Add credits to all users"}
            </button>
          </form>
        </div>
      </div>

      {/* Manage Card Pool */}
      {/* Manage Packs */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
            Manage Packs ({packs.length})
          </h2>
          {packsLoading && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              Loading packs...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pack form (collapsed behind button when not editing) */}
          <div>
            {!(showCreatePackForm || editingPackId) ? (
              <button
                type="button"
                onClick={() => setShowCreatePackForm(true)}
                className="px-4 py-2.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 cursor-pointer"
              >
                Create Pack
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white/80">
                    {editingPackId ? "Edit Pack" : "Create Pack"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingPackId) resetPackForm();
                      else setShowCreatePackForm(false);
                    }}
                    disabled={savingPack}
                    className="text-xs text-white/50 hover:text-white/70 disabled:opacity-40"
                  >
                    Close
                  </button>
                </div>
                <form onSubmit={handleSavePack} className="space-y-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Name *</label>
                <input
                  type="text"
                  value={packForm.name}
                  onChange={(e) => setPackForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                  placeholder="Starter Pack"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Image *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={packForm.imageUrl}
                    onChange={(e) => setPackForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    placeholder="URL, or use upload & crop"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowImagePickerForPack(true)}
                    className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-pointer"
                  >
                    Upload / crop
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={packForm.isFree}
                  onChange={(e) =>
                    setPackForm((f) => ({
                      ...f,
                      isFree: e.target.checked,
                      ...(e.target.checked ? { price: "0" } : {}),
                    }))
                  }
                  className="rounded border-white/30 bg-white/5"
                />
                Free pack (0 credits)
              </label>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Price (credits)</label>
                  <input
                    type="number"
                    min={0}
                    value={packForm.price}
                    onChange={(e) => setPackForm((f) => ({ ...f, price: e.target.value }))}
                    disabled={packForm.isFree}
                    className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Cards per pack</label>
                  <input
                    type="number"
                    min={1}
                    value={packForm.cardsPerPack}
                    onChange={(e) => setPackForm((f) => ({ ...f, cardsPerPack: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Max purchases per window</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={packForm.maxPurchasesPerDay}
                    onChange={(e) => setPackForm((f) => ({ ...f, maxPurchasesPerDay: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 placeholder:text-white/30"
                  />
                  <p className="text-[10px] text-white/40 mt-0.5">Leave empty for no limit.</p>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Restock interval (hours)</label>
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    placeholder="e.g. 6, 12, 24"
                    value={packForm.restockIntervalHours}
                    onChange={(e) => setPackForm((f) => ({ ...f, restockIntervalHours: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 placeholder:text-white/30"
                  />
                  <p className="text-[10px] text-white/40 mt-0.5">Per-user rolling window (e.g. 6 = limit every 6 hours). Leave empty for daily UTC reset below.</p>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Daily reset time (UTC)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      placeholder="0"
                      value={packForm.restockHourUtc}
                      onChange={(e) => setPackForm((f) => ({ ...f, restockHourUtc: e.target.value }))}
                      className="w-16 px-2 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                    <span className="text-white/50">:</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      placeholder="0"
                      value={packForm.restockMinuteUtc}
                      onChange={(e) => setPackForm((f) => ({ ...f, restockMinuteUtc: e.target.value }))}
                      className="w-16 px-2 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">Used only when restock interval is empty. Hour:minute when daily limit resets.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Rarities this pack can drop</label>
                  <div className="flex flex-wrap gap-2">
                    {["uncommon", "rare", "epic", "legendary"].map((r) => {
                      const selected = packForm.allowedRarities.includes(r as any);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            setPackForm((f) => {
                              const current = f.allowedRarities;
                              const has = current.includes(r as any);
                              if (has) {
                                const next = current.filter((x) => x !== r);
                                return { ...f, allowedRarities: next.length ? next : ["uncommon", "rare", "epic", "legendary"] };
                              }
                              return { ...f, allowedRarities: [...current, r as any] };
                            })
                          }
                          className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                            selected
                              ? "border-amber-400/70 bg-amber-500/20 text-amber-200"
                              : "border-white/15 bg-white/[0.04] text-white/60 hover:border-amber-400/40 hover:text-amber-200"
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Card types this pack can drop</label>
                  <div className="flex flex-wrap gap-2">
                    {(["actor", "director", "character", "scene"] as CardType[]).map((t) => {
                      const selected = packForm.allowedCardTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setPackForm((f) => {
                              const current = f.allowedCardTypes;
                              const has = current.includes(t);
                              if (has) {
                                const next = current.filter((x) => x !== t);
                                return { ...f, allowedCardTypes: next.length ? next : ["actor", "director", "character", "scene"] };
                              }
                              return { ...f, allowedCardTypes: [...current, t] };
                            })
                          }
                          className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                            selected
                              ? "border-purple-400/70 bg-purple-500/20 text-purple-100"
                              : "border-white/15 bg-white/[0.04] text-white/60 hover:border-purple-400/40 hover:text-purple-100"
                          }`}
                        >
                          {cardTypeDisplayLabel(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={packForm.isActive}
                  onChange={(e) => setPackForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-white/30 bg-white/5"
                />
                Active in store
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={packForm.discounted}
                  onChange={(e) => setPackForm((f) => ({ ...f, discounted: e.target.checked }))}
                  className="rounded border-white/30 bg-white/5"
                />
                Discounted (show &quot;Sale&quot; label in shop)
              </label>
              {packForm.discounted && (
                <div>
                  <label className="block text-xs text-white/40 mb-1">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="e.g. 20"
                    value={packForm.discountPercent}
                    onChange={(e) => setPackForm((f) => ({ ...f, discountPercent: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 placeholder:text-white/30"
                  />
                  <p className="text-[10px] text-white/40 mt-0.5">Optional. Shows e.g. &quot;Sale 20%&quot; on the pack.</p>
                </div>
              )}

              {/* ── Drop rate weights ────────────────── */}
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={packForm.useCustomWeights}
                  onChange={(e) => setPackForm((f) => ({ ...f, useCustomWeights: e.target.checked }))}
                  className="rounded border-white/30 bg-white/5"
                />
                Custom drop rates
              </label>
              {packForm.useCustomWeights && (() => {
                const vals = {
                  legendary: parseFloat(packForm.rarityWeights.legendary) || 0,
                  epic: parseFloat(packForm.rarityWeights.epic) || 0,
                  rare: parseFloat(packForm.rarityWeights.rare) || 0,
                  uncommon: parseFloat(packForm.rarityWeights.uncommon) || 0,
                };
                const total = vals.legendary + vals.epic + vals.rare + vals.uncommon;
                const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
                return (
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2">
                    <p className="text-[10px] text-white/50 mb-1">
                      Set relative weights for each rarity tier. They are normalised to percentages automatically.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["legendary", "epic", "rare", "uncommon"] as const).map((r) => (
                        <div key={r}>
                          <label className="block text-[11px] text-white/50 mb-0.5 capitalize">{r}</label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={packForm.rarityWeights[r]}
                            onChange={(e) =>
                              setPackForm((f) => ({
                                ...f,
                                rarityWeights: { ...f.rarityWeights, [r]: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40"
                          />
                          <span className="text-[10px] text-white/40">{pct(vals[r])}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-medium ${total > 0 ? "text-white/60" : "text-red-400"}`}>
                        Total weight: {total} {total > 0 ? `(${(["legendary", "epic", "rare", "uncommon"] as const).map((r) => `${r[0].toUpperCase()}:${pct(vals[r])}%`).join(" ")})` : "— add at least one non-zero weight"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2 pt-2">
                {editingPackId && (
                  <button
                    type="button"
                    onClick={resetPackForm}
                    disabled={savingPack}
                    className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer"
                  >
                    Cancel edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingPack}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer"
                >
                  {savingPack ? "Saving..." : editingPackId ? "Save Pack" : "Create Pack"}
                </button>
              </div>
            </form>
              </>
            )}
          </div>

          {/* Packs list */}
          <div>
            <h3 className="text-sm font-medium text-white/80 mb-3">Existing Packs</h3>
            {packs.length === 0 ? (
              <p className="text-white/40 text-sm">No packs configured yet.</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {packs.map((pack, index) => (
                  <div
                    key={pack.id}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => movePack(index, "up")}
                        disabled={reorderingPack || index === 0}
                        className="p-1 rounded border border-white/20 bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move up (earlier in shop)"
                        aria-label="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => movePack(index, "down")}
                        disabled={reorderingPack || index === packs.length - 1}
                        className="p-1 rounded border border-white/20 bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move down (later in shop)"
                        aria-label="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-black/40 flex-shrink-0">
                      {pack.imageUrl ? (
                        <img
                          src={pack.imageUrl}
                          alt={pack.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white/90 truncate">
                          {pack.name}
                        </p>
                        {!pack.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-white/60">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60">
                        {pack.isFree ? (
                          <span className="text-green-400 font-semibold">Free</span>
                        ) : (
                          <span className="text-amber-300 font-semibold">{pack.price}</span>
                        )}{" "}
                        {pack.isFree ? "" : "credits · "}
                        {pack.cardsPerPack} cards
                        {pack.maxPurchasesPerDay != null && pack.maxPurchasesPerDay > 0 && (
                          <> · <span className="text-white/50">{pack.maxPurchasesPerDay}/{typeof pack.restockIntervalHours === "number" && pack.restockIntervalHours > 0 ? `${pack.restockIntervalHours}h` : "day"} limit</span></>
                        )}
                      </p>
                      <p className="text-[11px] text-white/40 mt-0.5 truncate">
                        Drops{" "}
                        {pack.allowedRarities
                          .slice()
                          .sort((a, b) =>
                            ["legendary", "epic", "rare", "uncommon"].indexOf(a) -
                            ["legendary", "epic", "rare", "uncommon"].indexOf(b)
                          )
                          .join(", ")}{" "}
                        ({pack.allowedCardTypes.join(", ")})
                      </p>
                      {pack.rarityWeights && (() => {
                        const w = pack.rarityWeights;
                        const t = w.legendary + w.epic + w.rare + w.uncommon || 1;
                        const p = (v: number) => ((v / t) * 100).toFixed(1);
                        return (
                          <p className="text-[10px] text-purple-300/70 mt-0.5">
                            Rates: L:{p(w.legendary)}% E:{p(w.epic)}% R:{p(w.rare)}% U:{p(w.uncommon)}%
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => startEditPack(pack)}
                        className="px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-300 text-xs font-medium hover:bg-purple-500/10 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePack(pack.id)}
                        disabled={deletingPackId === pack.id}
                        className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/10 disabled:opacity-40 cursor-pointer"
                      >
                        {deletingPackId === pack.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manage Shop Items (Others) */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
            Shop Items — Others ({shopItems.length})
          </h2>
          {shopItemsLoading && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              Loading...
            </div>
          )}
        </div>
        <p className="text-white/40 text-sm mb-4">
          Items shown in the Shop → Others tab (badges, skips). Order matches display order.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {!(showCreateShopItem || editingShopItemId) ? (
              <button
                type="button"
                onClick={() => setShowCreateShopItem(true)}
                className="px-4 py-2.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 text-sm font-medium hover:bg-green-500/20 cursor-pointer"
              >
                Add Shop Item
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white/80">
                    {editingShopItemId ? "Edit Shop Item" : "Add Shop Item"}
                  </h3>
                  <button
                    type="button"
                    onClick={resetShopItemForm}
                    disabled={savingShopItem}
                    className="text-xs text-white/50 hover:text-white/70 disabled:opacity-40"
                  >
                    Close
                  </button>
                </div>
                <form onSubmit={handleSaveShopItem} className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Name *</label>
                    <input
                      type="text"
                      value={shopItemForm.name}
                      onChange={(e) => setShopItemForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"
                      placeholder="e.g. Special Badge"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Type *</label>
                    <select
                      value={shopItemForm.type}
                      onChange={(e) => setShopItemForm((f) => ({ ...f, type: e.target.value as ShopItemType }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"
                    >
                      <option value="badge">Badge</option>
                      <option value="skip">Skip</option>
                    </select>
                  </div>
                  {shopItemForm.type === "skip" && (
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Skip amount *</label>
                      <input
                        type="number"
                        min={1}
                        value={shopItemForm.skipAmount}
                        onChange={(e) => setShopItemForm((f) => ({ ...f, skipAmount: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Price (credits) *</label>
                    <input
                      type="number"
                      min={0}
                      value={shopItemForm.price}
                      onChange={(e) => setShopItemForm((f) => ({ ...f, price: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={shopItemForm.description}
                      onChange={(e) => setShopItemForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"
                      placeholder="Short description for the shop"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Image URL (optional)</label>
                    <input
                      type="text"
                      value={shopItemForm.imageUrl}
                      onChange={(e) => setShopItemForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="shop-item-active"
                      checked={shopItemForm.isActive}
                      onChange={(e) => setShopItemForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-white/20"
                    />
                    <label htmlFor="shop-item-active" className="text-xs text-white/60">Active (visible in shop)</label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingShopItem}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-40"
                    >
                      {savingShopItem ? "Saving..." : editingShopItemId ? "Save" : "Add"}
                    </button>
                    {editingShopItemId && (
                      <button
                        type="button"
                        onClick={resetShopItemForm}
                        disabled={savingShopItem}
                        className="px-4 py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:bg-white/10 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/80 mb-3">Existing Items</h3>
            {shopItems.length === 0 ? (
              <p className="text-white/40 text-sm">No shop items yet. Add one to show in Shop → Others.</p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                {shopItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/90 truncate">{item.name}</p>
                      <p className="text-xs text-white/50 capitalize">{item.type} · {item.price} cr {!item.isActive && "· Inactive"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEditShopItem(item)}
                        className="px-2 py-1 rounded border border-green-500/40 text-green-300 text-xs hover:bg-green-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteShopItem(item.id)}
                        disabled={deletingShopItemId === item.id}
                        className="px-2 py-1 rounded border border-red-500/40 text-red-300 text-xs hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {deletingShopItemId === item.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending cards (new sets not yet pushed to pool) */}
      {Object.keys(pendingByWinner).length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-amber-400/90 uppercase tracking-widest">
              Pending cards
            </h2>
            <p className="text-xs text-white/40">
              New winner cards stay here until you push the set to the pool. Then they appear in Manage Card Pool below.
            </p>
          </div>
          <div className="space-y-6">
            {Object.entries(pendingByWinner).map(([winnerId, entries]) => {
              const winner = winners.find((w) => w.id === winnerId);
              const movieTitle = winner?.movieTitle ?? `Winner #${winnerId}`;
              return (
                <div
                  key={winnerId}
                  className="rounded-lg border border-amber-500/15 bg-white/[0.03] overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-amber-500/10">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{movieTitle}</p>
                      <p className="text-xs text-white/40">{entries.length} card{entries.length !== 1 ? "s" : ""} pending — edit below, then push to pool</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePushToPool(winnerId)}
                      disabled={pushingWinnerId === winnerId}
                      className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {pushingWinnerId === winnerId ? "Pushing…" : "Push to pool"}
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {entries.map((c) => (
                      <PoolEntryCard
                        key={c.characterId}
                        c={c}
                        onEdit={() => openEditPoolEntry(c, winnerId)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manage Card Pool */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
        <button
          type="button"
          onClick={() => setPoolSectionOpen((o) => !o)}
          className="flex flex-wrap items-center justify-between gap-4 w-full text-left mb-4"
        >
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
            Manage Card Pool ({pool.length} cards)
          </h2>
          <span className="text-white/30 text-sm">{poolSectionOpen ? "▼" : "▶"}</span>
        </button>

        {poolSectionOpen && (
        <>
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Drop chance</span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Legendary</span> <span className="font-medium">1%</span></span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Epic</span> <span className="font-medium">10%</span></span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Rare</span> <span className="font-medium">25%</span></span>
          <span className="text-sm text-white/80"><span className="capitalize text-white/60">Uncommon</span> <span className="font-medium">64%</span></span>
        </div>

        <div
          className={
            showCreateCustomCardForm
              ? "grid grid-cols-1 lg:grid-cols-2 gap-8"
              : "grid grid-cols-1 gap-8"
          }
        >
          {/* Create custom card (collapsed behind button) */}
          <div className={showCreateCustomCardForm ? "" : "w-full"}>
            {!showCreateCustomCardForm ? (
              <button
                type="button"
                onClick={() => setShowCreateCustomCardForm(true)}
                className="px-4 py-2.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 text-sm font-medium hover:bg-green-500/20 cursor-pointer"
              >
                Create custom card
              </button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white/80">Create Custom Card</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateCustomCardForm(false)}
                    className="text-xs text-white/50 hover:text-white/70"
                  >
                    Close
                  </button>
                </div>
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
              {customCardType !== "character" && (
              <div>
                <label className="block text-xs text-white/40 mb-1">Winner / Movie *</label>
                <select
                  value={customWinnerId}
                  onChange={(e) => {
                    setCustomWinnerId(e.target.value);
                    setCustomAltArtOfCharacterId("");
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                  required
                >
                  <option value="">-- Select winner (movie) --</option>
                  {winners.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.movieTitle}
                    </option>
                  ))}
                </select>
              </div>
              )}
              {customWinnerId && customCardType !== "character" && (() => {
                const winner = winners.find((w) => w.id === customWinnerId);
                const sameMoviePool = pool.filter(
                  (c) => c.profilePath?.trim() && (c.movieTmdbId ?? 0) === (winner?.tmdbId ?? 0)
                );
                return (
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Alt-art: counts as character</label>
                    <select
                      value={customAltArtOfCharacterId}
                      onChange={(e) => setCustomAltArtOfCharacterId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                    >
                      <option value="">— None (normal pool entry) —</option>
                      {sameMoviePool.map((c) => (
                        <option key={c.characterId} value={c.characterId}>
                          {poolOptionLabel(c)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-white/40 mt-1">
                      If set, this pool entry is an alt-art; any card with this image counts as that character for set completion.
                    </p>
                  </div>
                );
              })()}
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
                    <option value="character">Boys</option>
                    <option value="scene">Scene</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={!customActorName.trim() || !customProfilePath.trim() || (customCardType !== "character" && !customWinnerId) || addingToPool}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-40 cursor-pointer"
              >
                {addingToPool ? "Adding..." : "Add to Pool"}
              </button>
            </form>
              </>
            )}
          </div>

          {/* Pool view (full width when create form is collapsed) */}
          <div className="w-full min-w-0">
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
        </>
        )}
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
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden mb-8">
          <div className="p-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
              User: {selectedUser.name}
            </h2>
            <p className="text-white/40 text-xs mt-1">
              Credits {creditBalance} · Stardust {stardustBalance} · {cards.length} cards
              {userCodex && (
                <> · Codex: {userCodex.characterIds.length} / {userCodex.holoCharacterIds.length} / {userCodex.altArtCharacterIds.length} / {userCodex.boysCharacterIds.length}</>
              )}
            </p>
          </div>

          {/* Collapsible: Credits */}
          <section className="border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setOpenUserSection((s) => ({ ...s, credits: !s.credits }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Credits</span>
              <span className="text-amber-400 font-medium tabular-nums">{creditBalance}</span>
              <span className="text-white/30 text-sm">{openUserSection.credits ? "▼" : "▶"}</span>
            </button>
            {openUserSection.credits && (
              <div className="px-4 pb-4 pt-0">
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
            )}
          </section>

          {/* Collapsible: Stardust */}
          <section className="border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setOpenUserSection((s) => ({ ...s, stardust: !s.stardust }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Stardust</span>
              <span className="text-amber-200 font-medium tabular-nums">{stardustBalance}</span>
              <span className="text-white/30 text-sm">{openUserSection.stardust ? "▼" : "▶"}</span>
            </button>
            {openUserSection.stardust && (
              <div className="px-4 pb-4 pt-0">
                <form onSubmit={handleSetStardust} className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Set balance to</label>
                    <input
                      type="number"
                      min={0}
                      value={stardustInput}
                      onChange={(e) => setStardustInput(e.target.value)}
                      className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40 w-32"
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingStardust}
                    className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 cursor-pointer"
                  >
                    {savingStardust ? "Saving..." : "Save Stardust"}
                  </button>
                </form>
                <p className="text-white/30 text-xs mt-2">Saves to /data (stardust.json).</p>
              </div>
            )}
          </section>

          {/* Collapsible: Shop */}
          <section className="border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setOpenUserSection((s) => ({ ...s, shop: !s.shop }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Shop</span>
              <span className="text-white/40 text-sm">Restock pack purchases</span>
              <span className="text-white/30 text-sm">{openUserSection.shop ? "▼" : "▶"}</span>
            </button>
            {openUserSection.shop && (
              <div className="px-4 pb-4 pt-0">
                <p className="text-white/40 text-sm mb-3">
                  Reset this user&apos;s daily pack purchase count so they can buy packs again today.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedUserId || restockingPack) return;
                    setRestockingPack(true);
                    try {
                      const res = await fetch("/api/admin/restock-pack-purchases", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: selectedUserId }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok) {
                        alert(data.removed > 0 ? `Restocked: ${data.removed} purchase(s) cleared for today.` : "No pack purchases today for this user.");
                      } else {
                        alert(data.error || "Failed to restock");
                      }
                    } finally {
                      setRestockingPack(false);
                    }
                  }}
                  disabled={restockingPack}
                  className="px-5 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-40 cursor-pointer"
                >
                  {restockingPack ? "Resetting..." : "Reset pack purchase history (this user)"}
                </button>
              </div>
            )}
          </section>

          {/* Collapsible: Trivia */}
          <section className="border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setOpenUserSection((s) => ({ ...s, trivia: !s.trivia }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Trivia</span>
              <span className="text-white/40 text-sm">{triviaAttempts.length} completed</span>
              <span className="text-white/30 text-sm">{openUserSection.trivia ? "▼" : "▶"}</span>
            </button>
            {openUserSection.trivia && (
              <div className="px-4 pb-4 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <button
                    onClick={handleReopenAllTrivia}
                    disabled={reopeningAll}
                    className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-500/80 disabled:opacity-40 cursor-pointer"
                    title="Reopen all trivia for all users"
                  >
                    {reopeningAll ? "Reopening All..." : "Reopen All (all users)"}
                  </button>
                </div>
                <p className="text-white/40 text-sm mb-4">Reopen trivia for this user so they can play again.</p>
                {triviaAttempts.length === 0 ? (
                  <p className="text-white/40 text-sm">No completed trivia for this user.</p>
                ) : (
                  <div className="space-y-2">
                    {Array.from(new Map(triviaAttempts.map((a) => [a.winnerId, a])).values()).map((a) => {
                      const winner = winners.find((w) => w.id === a.winnerId);
                      const title = winner?.movieTitle ?? `Winner #${a.winnerId}`;
                      const isReopening = reopeningWinnerId === a.winnerId;
                      return (
                        <div
                          key={a.winnerId}
                          className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                        >
                          <span className="text-white/90 truncate">{title}</span>
                          <span className="text-white/40 text-sm shrink-0">
                            {a.correctCount}/{a.totalCount} · {a.creditsEarned} credits
                          </span>
                          <button
                            onClick={() => handleReopenTrivia(a.winnerId)}
                            disabled={isReopening}
                            className="px-3 py-1.5 rounded-lg bg-amber-600/80 text-white text-sm font-medium hover:bg-amber-500/80 disabled:opacity-40 cursor-pointer shrink-0"
                          >
                            {isReopening ? "Reopening..." : "Reopen"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Collapsible: Collection */}
          <section className="border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setOpenUserSection((s) => ({ ...s, collection: !s.collection }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Collection</span>
              <span className="text-white/40 text-sm">{cards.length} cards</span>
              <span className="text-white/30 text-sm">{openUserSection.collection ? "▼" : "▶"}</span>
            </button>
            {openUserSection.collection && (
              <div className="px-4 pb-4 pt-0">
                <div className="mb-4">
                  <p className="text-xs text-white/40 mb-2">Add card from pool — click a card to add it to this user&apos;s collection.</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addHolo}
                      onChange={(e) => setAddHolo(e.target.checked)}
                      className="rounded border-white/30 bg-white/5"
                    />
                    <span className="text-sm text-white/60">Add as Holo</span>
                  </label>
                </div>
                <div className="max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 mb-6">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {pool.filter((c) => c.profilePath?.trim()).map((c) => {
                      const cardForDisplay = {
                        profilePath: c.profilePath ?? "",
                        actorName: c.actorName,
                        characterName: c.characterName,
                        movieTitle: c.movieTitle,
                        rarity: c.rarity,
                        isFoil: addHolo,
                        cardType: c.cardType,
                      };
                      const isAdding = addingCardCharacterId === c.characterId;
                      return (
                        <div
                          key={c.characterId}
                          className={`rounded-xl border overflow-hidden bg-white/[0.03] transition-all ${RARITY_COLORS[c.rarity] ?? "border-white/10"} hover:ring-2 hover:ring-green-500/40`}
                        >
                          <div className="relative w-full" style={{ maxWidth: 100 }}>
                            <CardDisplay card={cardForDisplay} size="xs" />
                          </div>
                          <div className="p-2">
                            <p className="text-[10px] font-semibold text-white/90 truncate" title={c.actorName}>{c.actorName}</p>
                            <p className="text-[10px] text-white/50 truncate" title={c.characterName}>{c.characterName}</p>
                            <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded uppercase ${RARITY_COLORS[c.rarity] ?? ""}`}>
                              {c.rarity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddCard(c.characterId)}
                              disabled={addingCard}
                              className="mt-2 w-full min-h-[32px] px-2 py-1.5 rounded-lg text-[10px] font-medium bg-green-600/90 text-white hover:bg-green-500 disabled:opacity-50 cursor-pointer"
                            >
                              {isAdding ? "Adding…" : "Add"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {cards.length === 0 ? (
                  <p className="text-white/30 text-sm">No cards in collection.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className={`rounded-xl border overflow-hidden bg-white/[0.02] ${RARITY_COLORS[card.rarity] || RARITY_COLORS.uncommon} ${card.isFoil ? "ring-2 ring-indigo-400/50" : ""}`}
                      >
                        <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                          {card.profilePath ? (
                            <img
                              src={card.profilePath}
                              alt={card.actorName}
                              className={`w-full h-full object-cover ${card.isFoil ? "holo-sheen" : ""}`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl font-bold">
                              {card.actorName.charAt(0)}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                          {card.isFoil && (
                            <span
                              className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white"
                              style={{
                                background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                                boxShadow: "0 0 8px rgba(255,255,255,0.5)",
                              }}
                            >
                              HOLO
                            </span>
                          )}
                          {(() => {
                            const entry = pool.find((p) => p.characterId === card.characterId);
                            const altOfId = entry?.altArtOfCharacterId;
                            const altOfName = altOfId ? pool.find((p) => p.characterId === altOfId)?.actorName : null;
                            return altOfId ? (
                              <span
                                className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-amber-600/90"
                                title={altOfName ? `Alt-art: counts as ${altOfName}` : "Alt-art"}
                              >
                                Alt
                              </span>
                            ) : null;
                          })()}
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
                          <div className="mt-3">
                            <button
                              onClick={() => openEditCard(card)}
                              className="w-full min-h-[44px] px-4 py-3 rounded-lg text-sm font-medium border border-purple-500/40 text-purple-400 hover:bg-purple-500/15 cursor-pointer touch-manipulation"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Collapsible: Codex */}
          <section>
            <button
              type="button"
              onClick={() => setOpenUserSection((s) => ({ ...s, codex: !s.codex }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Codex</span>
              {userCodex ? (
                <span className="text-white/40 text-sm">
                  Regular: {userCodex.characterIds.length} · Holo: {userCodex.holoCharacterIds.length} · Alt: {userCodex.altArtCharacterIds.length} · Boys: {userCodex.boysCharacterIds.length}
                </span>
              ) : (
                <span className="text-white/30 text-sm">—</span>
              )}
              <span className="text-white/30 text-sm">{openUserSection.codex ? "▼" : "▶"}</span>
            </button>
            {openUserSection.codex && userCodex && selectedUserId && (
              <div className="px-4 pb-4 pt-0 space-y-4">
                {(["regular", "holo", "altart", "boys"] as const).map((variant) => {
                  const key = variant === "regular" ? "characterIds" : variant === "holo" ? "holoCharacterIds" : variant === "altart" ? "altArtCharacterIds" : "boysCharacterIds";
                  const ids = userCodex[key];
                  const label = variant === "regular" ? "Regular" : variant === "holo" ? "Holo" : variant === "altart" ? "Alt-art" : "Boys";
                  const poolForVariant = variant === "boys" ? pool.filter((c) => (c.cardType ?? "actor") === "character") : pool.filter((c) => c.profilePath?.trim());
                  return (
                    <div key={variant} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                      <h4 className="text-xs font-semibold text-white/60 mb-2">{label}</h4>
                      <div className="flex flex-wrap gap-2 items-end mb-2">
                        <select
                          id={`codex-add-${variant}`}
                          className="min-w-[180px] px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                          onChange={async (e) => {
                            const characterId = e.target.value;
                            if (!characterId) return;
                            e.target.value = "";
                            const busyKey = `${variant}-add-${characterId}`;
                            setCodexBusy((b) => ({ ...b, [busyKey]: true }));
                            try {
                              const res = await fetch("/api/admin/user-codex", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: selectedUserId, characterId, variant, action: "add" }),
                              });
                              if (res.ok) {
                                setUserCodex((prev) => prev ? { ...prev, [key]: [...prev[key], characterId] } : null);
                              }
                            } finally {
                              setCodexBusy((b) => ({ ...b, [busyKey]: false }));
                            }
                          }}
                        >
                          <option value="">Add {label}…</option>
                          {poolForVariant.filter((c) => !ids.includes(c.characterId)).map((c) => (
                            <option key={c.characterId} value={c.characterId}>
                              {poolOptionLabel(c)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {ids.length === 0 ? (
                          <li className="text-white/30 text-sm">None</li>
                        ) : (
                          ids.map((characterId) => {
                            const entry = pool.find((p) => p.characterId === characterId);
                            const name = entry ? poolOptionLabel(entry) : characterId;
                            const busyKey = `${variant}-remove-${characterId}`;
                            return (
                              <li key={characterId} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-white/[0.04]">
                                <span className="text-white/80 text-sm truncate">{name}</span>
                                <button
                                  type="button"
                                  disabled={codexBusy[busyKey]}
                                  onClick={async () => {
                                    setCodexBusy((b) => ({ ...b, [busyKey]: true }));
                                    try {
                                      const res = await fetch("/api/admin/user-codex", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ userId: selectedUserId, characterId, variant, action: "remove" }),
                                      });
                                      if (res.ok) {
                                        setUserCodex((prev) => prev ? { ...prev, [key]: prev[key].filter((id) => id !== characterId) } : null);
                                      }
                                    } finally {
                                      setCodexBusy((b) => ({ ...b, [busyKey]: false }));
                                    }
                                  }}
                                  className="shrink-0 px-2 py-1 rounded text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 cursor-pointer"
                                >
                                  {codexBusy[busyKey] ? "…" : "Remove"}
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            {openUserSection.codex && !userCodex && (
              <div className="px-4 pb-4 pt-0 text-white/40 text-sm">Loading codex…</div>
            )}
          </section>
        </div>
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
                      <option value="character">Boys</option>
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
                    <span className="text-sm text-white/60">Holo</span>
                  </label>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
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
                  <button
                    type="button"
                    onClick={() => editingCard && handleRemoveCard(editingCard.id, () => setEditingCard(null))}
                    disabled={savingEdit || removingId === editingCard?.id}
                    className="w-full px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer text-sm"
                  >
                    {removingId === editingCard?.id ? "Removing..." : "Delete card"}
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
            onClick={() => { if (!savingPoolEdit) { setEditingPoolEntry(null); setEditingPendingWinnerId(null); } }}
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
                      <option value="character">Boys</option>
                      <option value="scene">Scene</option>
                    </select>
                  </div>
                </div>
                {editingPoolEntry && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Alt-art: counts as character</label>
                    <select
                      value={poolEditForm.altArtOfCharacterId ?? ""}
                      onChange={(e) => setPoolEditForm((f) => ({ ...f, altArtOfCharacterId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"
                    >
                      <option value="">— None (normal pool entry) —</option>
                      {(() => {
                        const sameMoviePool = pool.filter(
                          (c) =>
                            c.profilePath?.trim() &&
                            (c.movieTmdbId ?? 0) === (editingPoolEntry.movieTmdbId ?? 0)
                        );
                        const sameMoviePending = editingPendingWinnerId
                          ? (pendingByWinner[editingPendingWinnerId] ?? []).filter(
                              (c) => (c.movieTmdbId ?? 0) === (editingPoolEntry.movieTmdbId ?? 0)
                            )
                          : [];
                        const combined = [...sameMoviePool];
                        sameMoviePending.forEach((c) => {
                          if (!combined.some((x) => x.characterId === c.characterId)) combined.push(c);
                        });
                        return combined.map((c) => (
                          <option key={c.characterId} value={c.characterId}>
                            {poolOptionLabel(c)}
                          </option>
                        ));
                      })()}
                    </select>
                    <p className="text-[10px] text-white/40 mt-1">
                      If set, this pool entry is an alt-art; any card with this image counts as that character for set completion.
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditingPoolEntry(null); setEditingPendingWinnerId(null); }}
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
                  <button
                    type="button"
                    onClick={() =>
                      editingPoolEntry &&
                      handleRemoveFromPool(
                        editingPoolEntry.characterId,
                        editingPendingWinnerId ?? undefined,
                        () => {
                          setEditingPoolEntry(null);
                          setEditingPendingWinnerId(null);
                        }
                      )
                    }
                    disabled={savingPoolEdit || removingFromPoolId === editingPoolEntry?.characterId}
                    className="w-full px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer text-sm"
                  >
                    {removingFromPoolId === editingPoolEntry?.characterId ? "Removing..." : "Remove from pool"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Danger zone: wipe inventory */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 mb-8">
        <h2 className="text-sm font-semibold text-red-400/90 uppercase tracking-widest mb-2">
          Danger zone
        </h2>
        <p className="text-white/50 text-sm mb-6">
          Wipe one user&apos;s inventory or reset all cards, credits, marketplace, and trades (server-wide). Users, weeks, winners, and other content are not affected. Type <strong className="text-white/80">WIPE</strong> to confirm.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Wipe one user&apos;s inventory</h3>
            <form onSubmit={handleWipeUser} className="flex flex-wrap gap-3 items-end">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-red-500/50 cursor-pointer [color-scheme:dark] min-w-[200px]"
              >
                <option value="">-- Select user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.id})
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={wipeConfirmUser}
                onChange={(e) => setWipeConfirmUser(e.target.value)}
                placeholder="Type WIPE to confirm"
                className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-red-500/40 w-48"
              />
              <button
                type="submit"
                disabled={!selectedUserId || wipingUser || wipeConfirmUser.trim().toUpperCase() !== "WIPE"}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {wipingUser ? "Wiping..." : "Wipe user inventory"}
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Rebuild pool (6 per movie)</h3>
            <p className="text-white/40 text-sm mb-2">Re-fetches cast from TMDB and rebuilds the character pool. Custom pool entries are preserved. This can change which 6 characters appear per movie.</p>
            {showRebuildConfirm ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={rebuildConfirmInput}
                  onChange={(e) => setRebuildConfirmInput(e.target.value)}
                  placeholder={`Type "${REBUILD_CONFIRM_WORD}" to confirm`}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs w-48 outline-none focus:border-red-500/40"
                  autoFocus
                />
                <button
                  onClick={handleRebuildPool}
                  disabled={rebuildingPool || rebuildConfirmInput.toLowerCase().trim() !== REBUILD_CONFIRM_WORD}
                  className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400/90 text-xs font-medium hover:bg-red-500/10 disabled:opacity-40"
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
              </div>
            ) : (
              <button
                onClick={() => setShowRebuildConfirm(true)}
                disabled={rebuildingPool}
                className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400/90 text-xs font-medium hover:bg-red-500/10 disabled:opacity-40"
              >
                {rebuildingPool ? "Rebuilding..." : "Rebuild pool (6/movie)"}
              </button>
            )}
          </div>

          <div>
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Reset codex</h3>
            <p className="text-white/40 text-sm mb-2">Clears all codex unlocks for all users. Everyone will see the Codex as locked until they upload cards again.</p>
            <button
              type="button"
              onClick={handleResetCodex}
              disabled={resettingCodex}
              className="px-4 py-2.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-sm font-medium hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {resettingCodex ? "Resetting..." : "Reset codex"}
            </button>
          </div>

          <div>
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Reset all inventory (server-wide)</h3>
            <p className="text-white/40 text-sm mb-2">Clears all cards, credits, credit history, trivia attempts, marketplace listings, and trades. Users, weeks, winners, submissions, ratings, comments, and packs are not touched.</p>
            <form onSubmit={handleWipeServer} className="flex flex-wrap gap-3 items-end">
              <input
                type="text"
                value={wipeConfirmServer}
                onChange={(e) => setWipeConfirmServer(e.target.value)}
                placeholder="Type WIPE to confirm"
                className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-red-500/40 w-48"
              />
              <button
                type="submit"
                disabled={wipingServer || wipeConfirmServer.trim().toUpperCase() !== "WIPE"}
                className="px-4 py-2.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {wipingServer ? "Resetting..." : "Reset all inventory"}
              </button>
            </form>
          </div>
        </div>
      </div>

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
      <ImageCropModal
        open={showImagePickerForPack}
        onClose={() => setShowImagePickerForPack(false)}
        onComplete={(url) => {
          setPackForm((f) => ({ ...f, imageUrl: url }));
          setShowImagePickerForPack(false);
        }}
        aspect={2 / 3}
        title="Pack art"
        cropShape="rect"
      />
    </div>
  );
}
