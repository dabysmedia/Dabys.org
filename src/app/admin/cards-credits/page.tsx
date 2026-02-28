"use client";

import { useEffect, useState, useCallback } from "react";
import ImageCropModal from "@/components/ImageCropModal";
import { CardDisplay } from "@/components/CardDisplay";

interface User {
  id: string;
  name: string;
}

type CardFinish = "normal" | "holo" | "prismatic" | "darkMatter";

interface Card {
  id: string;
  userId: string;
  characterId: string;
  rarity: string;
  isFoil: boolean;
  finish?: CardFinish;
  actorName: string;
  characterName: string;
  movieTitle: string;
  profilePath: string;
  cardType?: CardType;
  movieTmdbId?: number;
}

/** Derive the effective finish tier (handles legacy cards without finish). */
function getFinish(card: { isFoil?: boolean; finish?: CardFinish }): CardFinish {
  if (card.finish) return card.finish;
  return card.isFoil ? "holo" : "normal";
}

type CardType = "actor" | "director" | "character" | "scene";

interface CustomCardType {
  id: string;
  label: string;
}

interface CharacterPortrayal {
  characterId: string;
  actorName: string;
  characterName: string;
  movieTitle: string;
  rarity: string;
  cardType?: CardType | string;
  profilePath?: string;
  movieTmdbId?: number;
  altArtOfCharacterId?: string;
  customSetId?: string;
}

interface Pack {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  cardsPerPack: number;
  allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
  allowedCardTypes: (CardType | string)[];
  isActive: boolean;
  maxPurchasesPerDay?: number;
  isFree?: boolean;
  restockIntervalHours?: number;
  restockHourUtc?: number;
  restockMinuteUtc?: number;
  discounted?: boolean;
  discountPercent?: number;
  rarityWeights?: { legendary: number; epic: number; rare: number; uncommon: number };
  allowPrismatic?: boolean;
  allowDarkMatter?: boolean;
  prismaticChance?: number;
  darkMatterChance?: number;
  holoChance?: number;
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

function cardTypeDisplayLabel(t: string, customTypes?: CustomCardType[]): string {
  if (t === "character") return "Boys";
  if (t === "community") return "Community";
  const custom = customTypes?.find((c) => c.id === t);
  if (custom) return custom.label;
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
  const [addCreditsInput, setAddCreditsInput] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);
  const [stardustBalance, setStardustBalance] = useState<number>(0);
  const [stardustInput, setStardustInput] = useState("");
  const [savingStardust, setSavingStardust] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [pool, setPool] = useState<CharacterPortrayal[]>([]);
  const [customCardTypes, setCustomCardTypes] = useState<CustomCardType[]>([]);
  const [pendingByWinner, setPendingByWinner] = useState<Record<string, CharacterPortrayal[]>>({});
  const [pushingWinnerId, setPushingWinnerId] = useState<string | null>(null);
  const [editingPendingWinnerId, setEditingPendingWinnerId] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCredits, setSavingCredits] = useState(false);
  const [restockingPack, setRestockingPack] = useState(false);
  const [resettingQuests, setResettingQuests] = useState(false);
  const [questProgress, setQuestProgress] = useState<{
    dailyQuests: { date: string; quests: { questType: string; rarity?: string; completed: boolean; claimed: boolean; reward: number; rewardType: string; label: string; description: string }[] };
    lifetimeStats: { packsOpened: number; setsCompleted: number; cardsDisenchanted: number; cardsPackAPunched: number; tradeUpsByRarity: Record<string, number>; dailiesCompleted: number };
    mainProgress: { definition: { id: string; type: string; targetCount: number; reward: number; rewardType: string; label: string; description: string }; current: number; target: number; completed: boolean; claimed: boolean }[];
    claimedMainIds: string[];
    setCompletionQuests: { winnerId: string; movieTitle: string; reward: number; claimed: boolean; isHolo?: boolean; isPrismatic?: boolean; isDarkMatter?: boolean }[];
  } | null>(null);
  const [questProgressBusy, setQuestProgressBusy] = useState<Record<string, boolean>>({});
  const [addingCard, setAddingCard] = useState(false);
  const [addingCardCharacterId, setAddingCardCharacterId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addFinish, setAddFinish] = useState<"normal" | "holo" | "prismatic" | "darkMatter">("normal");
  const [error, setError] = useState("");
  const [poolLoading, setPoolLoading] = useState(false);
  const [addingToPool, setAddingToPool] = useState(false);
  const [removingFromPoolId, setRemovingFromPoolId] = useState<string | null>(null);
  const [customActorName, setCustomActorName] = useState("");
  const [customCharacterName, setCustomCharacterName] = useState("");
  const [customWinnerId, setCustomWinnerId] = useState("");
  const [customProfilePath, setCustomProfilePath] = useState("");
  const [customRarity, setCustomRarity] = useState<"uncommon" | "rare" | "epic" | "legendary">("uncommon");
  const [customCardType, setCustomCardType] = useState<CardType | string>("actor");
  const [customAltArtOfCharacterId, setCustomAltArtOfCharacterId] = useState("");
  const [customSetId, setCustomSetId] = useState("");
  const [customSetSelectOther, setCustomSetSelectOther] = useState(false);
  const [customSetSelectOtherEdit, setCustomSetSelectOtherEdit] = useState(false);
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
  const [poolSortBoys, setPoolSortBoys] = useState<"rarity" | "set">("rarity");
  const [poolSortCustom, setPoolSortCustom] = useState<"rarity" | "set">("rarity");
  const [showAddPoolModal, setShowAddPoolModal] = useState(false);
  const [newPoolTypeId, setNewPoolTypeId] = useState("");
  const [newPoolTypeLabel, setNewPoolTypeLabel] = useState("");
  const [addingPoolType, setAddingPoolType] = useState(false);
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
  const [awardPackUserId, setAwardPackUserId] = useState("");
  const [awardPackPackId, setAwardPackPackId] = useState("");
  const [awardingPack, setAwardingPack] = useState(false);
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
    prismaticCharacterIds: string[];
    darkMatterCharacterIds: string[];
    altArtCharacterIds: string[];
    altArtHoloCharacterIds: string[];
    boysCharacterIds: string[];
  } | null>(null);
  const [codexBusy, setCodexBusy] = useState<Record<string, boolean>>({});
  const [showManageCodexModal, setShowManageCodexModal] = useState(false);
  const [manageCodexModalTab, setManageCodexModalTab] = useState<"regular" | "holo" | "prismatic" | "darkMatter" | "altart" | "boys">("regular");
  const [codexAddAltArtAsHolo, setCodexAddAltArtAsHolo] = useState(false);
  const [codexAddSetBusy, setCodexAddSetBusy] = useState(false);
  const [codexAddSetDropdownOpen, setCodexAddSetDropdownOpen] = useState(false);
  const [codexAddSectionOpen, setCodexAddSectionOpen] = useState(true);
  const [openUserSection, setOpenUserSection] = useState<Record<string, boolean>>({
    credits: false,
    stardust: false,
    shop: false,
    quests: false,
    trivia: false,
    collection: false,
    codex: false,
  });
  const [wipeConfirmUser, setWipeConfirmUser] = useState("");
  const [wipeConfirmServer, setWipeConfirmServer] = useState("");
  const [wipeConfirmUserInvCurr, setWipeConfirmUserInvCurr] = useState("");
  const [wipeConfirmServerInvCurr, setWipeConfirmServerInvCurr] = useState("");
  const [rollbackConfirm, setRollbackConfirm] = useState("");
  const [rollbackDate, setRollbackDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [backfillDate, setBackfillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState<{ id: string; timestamp: string; userId: string; userName: string; source: string; rarity: string; cardId: string; characterName?: string; actorName?: string; movieTitle?: string; packId?: string }[]>([]);
  const [timelineFilterUserId, setTimelineFilterUserId] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [wipingUser, setWipingUser] = useState(false);
  const [wipingServer, setWipingServer] = useState(false);
  const [wipingUserInvCurr, setWipingUserInvCurr] = useState(false);
  const [wipingServerInvCurr, setWipingServerInvCurr] = useState(false);
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
    quicksellLegendary: number;
    tradeUpLegendaryFailureCredits: number;
    feedbackAccepted: number;
    setCompletionReward: number;
    holoSetCompletionReward: number;
    prismaticSetCompletionReward: number;
    darkMatterSetCompletionReward: number;
    vaultWatch: number;
    vaultMinWatchMinutes: number;
    communitySetCreatePrice: number;
    communitySetExtraCardPrice: number;
    communitySetCompletionReward: number;
    communitySetCompletionCreatorReward: number;
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
    quicksellLegendary: "200",
    tradeUpLegendaryFailureCredits: "100",
    feedbackAccepted: "10",
    setCompletionReward: "1000",
    holoSetCompletionReward: "1500",
    prismaticSetCompletionReward: "3000",
    darkMatterSetCompletionReward: "5000",
    vaultWatch: "25",
    vaultMinWatchMinutes: "1",
    communitySetCreatePrice: "500",
    communitySetExtraCardPrice: "50",
    communitySetCompletionReward: "500",
    communitySetCompletionCreatorReward: "250",
  });
  const [savingCreditSettings, setSavingCreditSettings] = useState(false);
  const [creditSettingsLoading, setCreditSettingsLoading] = useState(true);
  const [alchemySettingsForm, setAlchemySettingsForm] = useState({
    prismTransmuteEpicHoloCount: "3",
    prismTransmuteSuccessChance: "50",
    prismsPerTransmute: "1",
    prismaticCraftBaseChance: "5",
    prismaticCraftChancePerPrism: "10",
    prismaticCraftMaxPrisms: "10",
    prismaticCraftFailureStardust: "25",
    epicHoloForgePrisms: "1",
    holoUpgradeChanceUncommon: "50",
    holoUpgradeChanceRare: "50",
    holoUpgradeChanceEpic: "50",
    holoUpgradeChanceLegendary: "50",
    prismaticUpgradeChance: "35",
    darkMatterUpgradeChance: "20",
    disenchantHoloUncommon: "10",
    disenchantHoloRare: "20",
    disenchantHoloEpic: "30",
    disenchantHoloLegendary: "50",
    packAPunchCostUncommon: "30",
    packAPunchCostRare: "60",
    packAPunchCostEpic: "90",
    packAPunchCostLegendary: "120",
  });
  const [savingAlchemySettings, setSavingAlchemySettings] = useState(false);
  const [alchemySettingsLoading, setAlchemySettingsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "packs" | "pool" | "economy" | "timeline" | "danger">("users");
  const [addAllCreditsInput, setAddAllCreditsInput] = useState("");
  const [addAllCreditsLoading, setAddAllCreditsLoading] = useState(false);
  const [packForm, setPackForm] = useState<{
    name: string;
    imageUrl: string;
    price: string;
    cardsPerPack: string;
    allowedRarities: ("uncommon" | "rare" | "epic" | "legendary")[];
    allowedCardTypes: (CardType | string)[];
    isActive: boolean;
    maxPurchasesPerDay: string;
    restockIntervalHours: string;
    restockHourUtc: string;
    restockMinuteUtc: string;
    isFree: boolean;
    discounted: boolean;
    discountPercent: string;
    comingSoon: boolean;
    useCustomWeights: boolean;
    rarityWeights: { legendary: string; epic: string; rare: string; uncommon: string };
    allowPrismatic: boolean;
    allowDarkMatter: boolean;
    prismaticChance: string;
    darkMatterChance: string;
    holoChance: string;
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
    comingSoon: false,
    useCustomWeights: false,
    rarityWeights: { legendary: "1", epic: "10", rare: "25", uncommon: "64" },
    allowPrismatic: false,
    allowDarkMatter: false,
    prismaticChance: "2",
    darkMatterChance: "0.5",
    holoChance: "",
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

  useEffect(() => {
    if (!showManageCodexModal) {
      setCodexAddSetDropdownOpen(false);
      setCodexAddSectionOpen(true);
    }
  }, [showManageCodexModal]);

  useEffect(() => {
    setCodexAddSetDropdownOpen(false);
  }, [manageCodexModalTab]);

  useEffect(() => {
    if (!editingPoolEntry) {
      setCustomSetSelectOtherEdit(false);
      return;
    }
    const editCt = editingPoolEntry.cardType ?? "actor";
    const val = (editingPoolEntry.customSetId ?? "").trim();
    const existingSets = [...new Set([...pool, ...Object.values(pendingByWinner).flat()].filter((c) => (c.cardType ?? "actor") === editCt && (c.customSetId ?? "").trim()).map((c) => (c.customSetId ?? "").trim()))].filter(Boolean);
    setCustomSetSelectOtherEdit(!!val && !existingSets.includes(val));
  }, [editingPoolEntry, pool, pendingByWinner]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await fetch("/api/admin/character-pool");
      if (res.ok) {
        const d = await res.json();
        setPool(Array.isArray(d) ? d : (d?.pool ?? []));
        setPendingByWinner(d?.pendingByWinner ?? {});
        setCustomCardTypes(d?.customCardTypes ?? []);
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
          quicksellLegendary: String(d.quicksellLegendary ?? 200),
          tradeUpLegendaryFailureCredits: String(d.tradeUpLegendaryFailureCredits ?? 100),
          feedbackAccepted: String(d.feedbackAccepted ?? 10),
          setCompletionReward: String(d.setCompletionReward ?? 1000),
          holoSetCompletionReward: String(d.holoSetCompletionReward ?? 1500),
          prismaticSetCompletionReward: String(d.prismaticSetCompletionReward ?? 3000),
          darkMatterSetCompletionReward: String(d.darkMatterSetCompletionReward ?? 5000),
          vaultWatch: String(d.vaultWatch ?? 25),
          vaultMinWatchMinutes: String(d.vaultMinWatchMinutes ?? 1),
          communitySetCreatePrice: String(d.communitySetCreatePrice ?? 500),
          communitySetExtraCardPrice: String(d.communitySetExtraCardPrice ?? 50),
          communitySetCompletionReward: String(d.communitySetCompletionReward ?? 500),
          communitySetCompletionCreatorReward: String(d.communitySetCompletionCreatorReward ?? 250),
        });
      }
    } catch {
      setError("Failed to load credit settings");
    } finally {
      setCreditSettingsLoading(false);
    }
  }, []);

  const loadAlchemySettings = useCallback(async () => {
    setAlchemySettingsLoading(true);
    try {
      const res = await fetch("/api/admin/alchemy-settings");
      if (res.ok) {
        const d = await res.json();
        const dh = d.disenchantHolo ?? {};
        const pap = d.packAPunchCost ?? {};
        setAlchemySettingsForm({
          prismTransmuteEpicHoloCount: String(d.prismTransmuteEpicHoloCount ?? 3),
          prismTransmuteSuccessChance: String(d.prismTransmuteSuccessChance ?? 50),
          prismsPerTransmute: String(d.prismsPerTransmute ?? 1),
          prismaticCraftBaseChance: String(d.prismaticCraftBaseChance ?? 5),
          prismaticCraftChancePerPrism: String(d.prismaticCraftChancePerPrism ?? 10),
          prismaticCraftMaxPrisms: String(d.prismaticCraftMaxPrisms ?? 10),
          prismaticCraftFailureStardust: String(d.prismaticCraftFailureStardust ?? 25),
          epicHoloForgePrisms: String(d.epicHoloForgePrisms ?? 1),
          holoUpgradeChanceUncommon: String((typeof d.holoUpgradeChance === "object" && d.holoUpgradeChance ? d.holoUpgradeChance.uncommon : typeof d.holoUpgradeChance === "number" ? d.holoUpgradeChance : 50)),
          holoUpgradeChanceRare: String((typeof d.holoUpgradeChance === "object" && d.holoUpgradeChance ? d.holoUpgradeChance.rare : typeof d.holoUpgradeChance === "number" ? d.holoUpgradeChance : 50)),
          holoUpgradeChanceEpic: String((typeof d.holoUpgradeChance === "object" && d.holoUpgradeChance ? d.holoUpgradeChance.epic : typeof d.holoUpgradeChance === "number" ? d.holoUpgradeChance : 50)),
          holoUpgradeChanceLegendary: String((typeof d.holoUpgradeChance === "object" && d.holoUpgradeChance ? d.holoUpgradeChance.legendary : typeof d.holoUpgradeChance === "number" ? d.holoUpgradeChance : 50)),
          prismaticUpgradeChance: String(d.prismaticUpgradeChance ?? 35),
          darkMatterUpgradeChance: String(d.darkMatterUpgradeChance ?? 20),
          disenchantHoloUncommon: String(dh.uncommon ?? 10),
          disenchantHoloRare: String(dh.rare ?? 20),
          disenchantHoloEpic: String(dh.epic ?? 30),
          disenchantHoloLegendary: String(dh.legendary ?? 50),
          packAPunchCostUncommon: String(pap.uncommon ?? 30),
          packAPunchCostRare: String(pap.rare ?? 60),
          packAPunchCostEpic: String(pap.epic ?? 90),
          packAPunchCostLegendary: String(pap.legendary ?? 120),
        });
      }
    } catch {
      setError("Failed to load alchemy settings");
    } finally {
      setAlchemySettingsLoading(false);
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
      setQuestProgress(null);
      return;
    }
    setLoading(true);
    setError("");
    setUserCodex(null);
    setQuestProgress(null);
    try {
      const [creditsRes, stardustRes, cardsRes, poolRes, attemptsRes, winnersRes, codexRes, questProgressRes] = await Promise.all([
        fetch(`/api/credits?userId=${encodeURIComponent(selectedUserId)}`),
        fetch(`/api/alchemy/stardust?userId=${encodeURIComponent(selectedUserId)}`),
        fetch(`/api/admin/cards?userId=${encodeURIComponent(selectedUserId)}`),
        fetch("/api/admin/character-pool"),
        fetch(`/api/trivia/attempts?userId=${encodeURIComponent(selectedUserId)}`),
        fetch("/api/winners"),
        fetch(`/api/cards/codex?userId=${encodeURIComponent(selectedUserId)}`),
        fetch(`/api/admin/quests/user-progress?userId=${encodeURIComponent(selectedUserId)}`),
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
          prismaticCharacterIds: c.prismaticCharacterIds ?? [],
          darkMatterCharacterIds: c.darkMatterCharacterIds ?? [],
          altArtCharacterIds: c.altArtCharacterIds ?? [],
          altArtHoloCharacterIds: c.altArtHoloCharacterIds ?? [],
          boysCharacterIds: c.boysCharacterIds ?? [],
        });
      } else {
        setUserCodex({
          characterIds: [],
          holoCharacterIds: [],
          prismaticCharacterIds: [],
          darkMatterCharacterIds: [],
          altArtCharacterIds: [],
          altArtHoloCharacterIds: [],
          boysCharacterIds: [],
        });
      }
      if (questProgressRes.ok) {
        const q = await questProgressRes.json();
        setQuestProgress({
          dailyQuests: q.dailyQuests ?? { date: "", quests: [] },
          lifetimeStats: q.lifetimeStats ?? { packsOpened: 0, setsCompleted: 0, cardsDisenchanted: 0, cardsPackAPunched: 0, tradeUpsByRarity: {}, dailiesCompleted: 0 },
          mainProgress: q.mainProgress ?? [],
          claimedMainIds: q.claimedMainIds ?? [],
          setCompletionQuests: q.setCompletionQuests ?? [],
        });
      } else {
        setQuestProgress(null);
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
    loadAlchemySettings();
    loadLegendaryInInventory();
  }, [loadUsers, loadPool, loadPacks, loadShopItems, loadCreditSettings, loadAlchemySettings, loadLegendaryInInventory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== "timeline") return;
    setTimelineLoading(true);
    fetch(`/api/admin/timeline${timelineFilterUserId ? `?userId=${encodeURIComponent(timelineFilterUserId)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setTimelineEntries(d.entries ?? []);
      })
      .catch(() => setTimelineEntries([]))
      .finally(() => setTimelineLoading(false));
  }, [activeTab, timelineFilterUserId]);

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
      comingSoon: false,
      useCustomWeights: false,
      rarityWeights: { legendary: "1", epic: "10", rare: "25", uncommon: "64" },
      allowPrismatic: false,
      allowDarkMatter: false,
      prismaticChance: "2",
      darkMatterChance: "0.5",
      holoChance: "",
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
      comingSoon: !!(pack as { comingSoon?: boolean }).comingSoon,
      useCustomWeights: !!w,
      rarityWeights: w
        ? { legendary: String(w.legendary), epic: String(w.epic), rare: String(w.rare), uncommon: String(w.uncommon) }
        : { legendary: "1", epic: "10", rare: "25", uncommon: "64" },
      allowPrismatic: !!pack.allowPrismatic,
      allowDarkMatter: !!pack.allowDarkMatter,
      prismaticChance: typeof pack.prismaticChance === "number" ? String(pack.prismaticChance) : "2",
      darkMatterChance: typeof pack.darkMatterChance === "number" ? String(pack.darkMatterChance) : "0.5",
      holoChance: typeof pack.holoChance === "number" ? String(pack.holoChance) : "",
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
        comingSoon: packForm.comingSoon,
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
          : null,
        allowPrismatic: packForm.allowPrismatic,
        allowDarkMatter: packForm.allowDarkMatter,
        prismaticChance: packForm.allowPrismatic
          ? (parseFloat(packForm.prismaticChance) || 2)
          : undefined,
        darkMatterChance: packForm.allowDarkMatter
          ? (parseFloat(packForm.darkMatterChance) || 0.5)
          : undefined,
        holoChance: packForm.holoChance.trim() !== ""
          ? Math.min(100, Math.max(0, parseFloat(packForm.holoChance) || 0))
          : null,
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
        quicksellLegendary: parseInt(creditSettingsForm.quicksellLegendary, 10) ?? 0,
        tradeUpLegendaryFailureCredits: parseInt(creditSettingsForm.tradeUpLegendaryFailureCredits, 10) ?? 0,
        feedbackAccepted: parseInt(creditSettingsForm.feedbackAccepted, 10) ?? 0,
        setCompletionReward: parseInt(creditSettingsForm.setCompletionReward, 10) ?? 0,
        holoSetCompletionReward: parseInt(creditSettingsForm.holoSetCompletionReward, 10) ?? 0,
        prismaticSetCompletionReward: parseInt(creditSettingsForm.prismaticSetCompletionReward, 10) ?? 0,
        darkMatterSetCompletionReward: parseInt(creditSettingsForm.darkMatterSetCompletionReward, 10) ?? 0,
        vaultWatch: parseInt(creditSettingsForm.vaultWatch, 10) ?? 0,
        vaultMinWatchMinutes: Math.max(0, parseInt(creditSettingsForm.vaultMinWatchMinutes, 10) ?? 1),
        communitySetCreatePrice: parseInt(creditSettingsForm.communitySetCreatePrice, 10) ?? 500,
        communitySetExtraCardPrice: parseInt(creditSettingsForm.communitySetExtraCardPrice, 10) ?? 50,
        communitySetCompletionReward: parseInt(creditSettingsForm.communitySetCompletionReward, 10) ?? 500,
        communitySetCompletionCreatorReward: parseInt(creditSettingsForm.communitySetCompletionCreatorReward, 10) ?? 250,
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

  async function handleSaveAlchemySettings(e: React.FormEvent) {
    e.preventDefault();
    if (savingAlchemySettings) return;
    setSavingAlchemySettings(true);
    setError("");
    try {
      const body = {
        prismTransmuteEpicHoloCount: parseInt(alchemySettingsForm.prismTransmuteEpicHoloCount, 10) || 3,
        prismTransmuteSuccessChance: parseFloat(alchemySettingsForm.prismTransmuteSuccessChance) || 50,
        prismsPerTransmute: parseInt(alchemySettingsForm.prismsPerTransmute, 10) || 1,
        prismaticCraftBaseChance: parseFloat(alchemySettingsForm.prismaticCraftBaseChance) || 5,
        prismaticCraftChancePerPrism: parseFloat(alchemySettingsForm.prismaticCraftChancePerPrism) || 10,
        prismaticCraftMaxPrisms: parseInt(alchemySettingsForm.prismaticCraftMaxPrisms, 10) || 10,
        prismaticCraftFailureStardust: parseInt(alchemySettingsForm.prismaticCraftFailureStardust, 10) || 25,
        epicHoloForgePrisms: parseInt(alchemySettingsForm.epicHoloForgePrisms, 10) || 1,
        holoUpgradeChance: {
          uncommon: parseFloat(alchemySettingsForm.holoUpgradeChanceUncommon) || 50,
          rare: parseFloat(alchemySettingsForm.holoUpgradeChanceRare) || 50,
          epic: parseFloat(alchemySettingsForm.holoUpgradeChanceEpic) || 50,
          legendary: parseFloat(alchemySettingsForm.holoUpgradeChanceLegendary) || 50,
        },
        prismaticUpgradeChance: parseFloat(alchemySettingsForm.prismaticUpgradeChance) || 35,
        darkMatterUpgradeChance: parseFloat(alchemySettingsForm.darkMatterUpgradeChance) || 20,
        disenchantHolo: {
          uncommon: parseInt(alchemySettingsForm.disenchantHoloUncommon, 10) || 10,
          rare: parseInt(alchemySettingsForm.disenchantHoloRare, 10) || 20,
          epic: parseInt(alchemySettingsForm.disenchantHoloEpic, 10) || 30,
          legendary: parseInt(alchemySettingsForm.disenchantHoloLegendary, 10) || 50,
        },
        packAPunchCost: {
          uncommon: parseInt(alchemySettingsForm.packAPunchCostUncommon, 10) || 30,
          rare: parseInt(alchemySettingsForm.packAPunchCostRare, 10) || 60,
          epic: parseInt(alchemySettingsForm.packAPunchCostEpic, 10) || 90,
          legendary: parseInt(alchemySettingsForm.packAPunchCostLegendary, 10) || 120,
        },
      };
      const res = await fetch("/api/admin/alchemy-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save alchemy settings");
      }
    } catch {
      setError("Failed to save alchemy settings");
    } finally {
      setSavingAlchemySettings(false);
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

  async function handleWipeUserInventoryCurrency(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || wipingUserInvCurr) return;
    if (wipeConfirmUserInvCurr.trim().toUpperCase() !== "WIPE") {
      setError("Type WIPE to confirm");
      return;
    }
    setWipingUserInvCurr(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wipe/user-inventory-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, confirm: wipeConfirmUserInvCurr.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWipeConfirmUserInvCurr("");
        setCreditBalance(0);
        setCards([]);
        setError("");
        alert(`Wiped: ${data.cardsRemoved} cards, ${data.listingsRemoved} listings, ${data.tradesRemoved} trades. Trivia, comments, and submissions preserved.`);
      } else {
        setError(data.error || "Failed to wipe user inventory");
      }
    } catch {
      setError("Failed to wipe user inventory");
    } finally {
      setWipingUserInvCurr(false);
    }
  }

  async function handleWipeServerInventoryCurrency(e: React.FormEvent) {
    e.preventDefault();
    if (wipingServerInvCurr) return;
    if (wipeConfirmServerInvCurr.trim().toUpperCase() !== "WIPE") {
      setError("Type WIPE to confirm");
      return;
    }
    setWipingServerInvCurr(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wipe/server-inventory-currency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: wipeConfirmServerInvCurr.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setWipeConfirmServerInvCurr("");
        setError("");
        alert("Inventory and currency reset complete. Trivia, comments, submissions preserved. Reload the page.");
        window.location.reload();
      } else {
        setError(data.error || "Failed to reset inventory");
      }
    } catch {
      setError("Failed to reset inventory");
    } finally {
      setWipingServerInvCurr(false);
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

  async function handleAddCredits(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || addingCredits) return;
    const val = parseInt(addCreditsInput, 10);
    if (isNaN(val) || val <= 0) {
      setError("Enter a positive number to add");
      return;
    }
    setAddingCredits(true);
    setError("");
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, add: val }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreditBalance(data.balance);
        setCreditInput(String(data.balance));
        setAddCreditsInput("");
      } else {
        setError(data.error || "Failed to add credits");
      }
    } catch {
      setError("Failed to add credits");
    } finally {
      setAddingCredits(false);
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
          finish: addFinish,
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

  const isCustomPoolType = customCardType === "character" || customCardTypes.some((t) => t.id === customCardType);

  async function handleAddToPool(e: React.FormEvent) {
    e.preventDefault();
    if (!customActorName.trim() || !customProfilePath.trim() || (!isCustomPoolType && !customWinnerId) || addingToPool) return;
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
          ...(!isCustomPoolType && customWinnerId && { winnerId: customWinnerId }),
          rarity: customRarity,
          cardType: customCardType,
          ...(customAltArtOfCharacterId.trim() && { altArtOfCharacterId: customAltArtOfCharacterId.trim() }),
          ...(isCustomPoolType && customSetId.trim() && { customSetId: customSetId.trim() }),
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
        setCustomSetId("");
        setCustomSetSelectOther(false);
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

  async function handleAddPoolType(e: React.FormEvent) {
    e.preventDefault();
    const id = newPoolTypeId.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || addingPoolType) return;
    setAddingPoolType(true);
    setError("");
    try {
      const res = await fetch("/api/admin/custom-card-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, label: newPoolTypeLabel.trim() || id }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadPool();
        setShowAddPoolModal(false);
        setNewPoolTypeId("");
        setNewPoolTypeLabel("");
      } else {
        setError(data.error || "Failed to add pool type");
      }
    } catch {
      setError("Failed to add pool type");
    } finally {
      setAddingPoolType(false);
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
      cardType: entry.cardType ?? "actor",
      altArtOfCharacterId: entry.altArtOfCharacterId ?? "",
      customSetId: entry.customSetId ?? "",
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
      finish: getFinish(card),
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

  const TABS = [
    { id: "users" as const, label: "Users", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
    { id: "packs" as const, label: "Packs & Shop", icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" },
    { id: "pool" as const, label: "Card Pool", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" },
    { id: "economy" as const, label: "Economy", icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "timeline" as const, label: "Timeline", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "danger" as const, label: "Danger Zone", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Cards & Credits</h1>
          <p className="text-sm text-white/40 mt-0.5">Manage user credits, card collections, packs, and the character pool</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <svg className="w-3.5 h-3.5 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            <span className="text-xs text-white/50"><span className="text-white/80 font-medium">{pool.length}</span> in pool</span>
            <span className="text-white/20">|</span>
            <svg className="w-3.5 h-3.5 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <span className="text-xs text-white/50"><span className="text-white/80 font-medium">{packs.length}</span> packs</span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? tab.id === "danger"
                  ? "bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm shadow-red-500/5"
                  : "bg-purple-500/15 text-purple-300 border border-purple-500/25 shadow-sm shadow-purple-500/5"
                : "text-white/50 border border-transparent hover:bg-white/[0.04] hover:text-white/70"
            }`}
          >
            <svg className={`w-4 h-4 flex-shrink-0 ${activeTab === tab.id ? "" : "opacity-50"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* ═══════════ TAB: USERS ═══════════ */}
      {activeTab === "users" && (
      <>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-white/70">Select User</h2>
        </div>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-purple-500/50 cursor-pointer [color-scheme:dark] [&_option]:bg-[#1a1a24] [&_option]:text-white"
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
        {/* User stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-amber-500/[0.04] to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Credits</span>
              <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-amber-300 tabular-nums">{creditBalance.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-purple-500/[0.04] to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Stardust</span>
              <svg className="w-4 h-4 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-purple-300 tabular-nums">{stardustBalance.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-blue-500/[0.04] to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Cards</span>
              <svg className="w-4 h-4 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-blue-300 tabular-nums">{cards.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Codex</span>
              <svg className="w-4 h-4 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            {userCodex ? (
              <p className="text-2xl font-bold text-emerald-300 tabular-nums">{userCodex.characterIds.length}<span className="text-sm font-normal text-white/30 ml-1">/{userCodex.holoCharacterIds.length}/{userCodex.prismaticCharacterIds?.length ?? 0}/{userCodex.darkMatterCharacterIds?.length ?? 0}/{userCodex.altArtCharacterIds.length}/{userCodex.boysCharacterIds.length}</span></p>
            ) : (
              <p className="text-lg text-white/30">--</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-indigo-400">{selectedUser.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white/90">{selectedUser.name}</h2>
                <p className="text-[11px] text-white/30 font-mono">{selectedUser.id}</p>
              </div>
            </div>
          </div>

          <section className="border-b border-white/[0.06]">
            <button type="button" onClick={() => setOpenUserSection((s) => ({ ...s, credits: !s.credits }))} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors group">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">Credits</span>
              <span className="text-amber-400 font-semibold tabular-nums text-sm">{creditBalance.toLocaleString()}</span>
              <svg className={`w-4 h-4 text-white/20 transition-transform ${openUserSection.credits ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {openUserSection.credits && (
              <div className="px-5 pb-4 pt-1 space-y-4">
                <form onSubmit={handleAddCredits} className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Add credits</label>
                    <input type="number" min={1} value={addCreditsInput} onChange={(e) => setAddCreditsInput(e.target.value)} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 w-32" placeholder="0" />
                  </div>
                  <button type="submit" disabled={addingCredits} className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 cursor-pointer">{addingCredits ? "Adding..." : "Add Credits"}</button>
                </form>
                <form onSubmit={handleSetCredits} className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Set balance to</label>
                    <input type="number" min={0} value={creditInput} onChange={(e) => setCreditInput(e.target.value)} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 w-32" placeholder="0" />
                  </div>
                  <button type="submit" disabled={savingCredits} className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer">{savingCredits ? "Saving..." : "Save Credits"}</button>
                </form>
              </div>
            )}
          </section>

          <section className="border-b border-white/[0.06]">
            <button type="button" onClick={() => setOpenUserSection((s) => ({ ...s, stardust: !s.stardust }))} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors group">
              <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">Stardust</span>
              <span className="text-purple-300 font-semibold tabular-nums text-sm">{stardustBalance.toLocaleString()}</span>
              <svg className={`w-4 h-4 text-white/20 transition-transform ${openUserSection.stardust ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {openUserSection.stardust && (
              <div className="px-5 pb-4 pt-1">
                <form onSubmit={handleSetStardust} className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Set balance to</label>
                    <input type="number" min={0} value={stardustInput} onChange={(e) => setStardustInput(e.target.value)} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40 w-32" placeholder="0" />
                  </div>
                  <button type="submit" disabled={savingStardust} className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 cursor-pointer">{savingStardust ? "Saving..." : "Save Stardust"}</button>
                </form>
                <p className="text-white/30 text-xs mt-2">Saves to /data (stardust.json).</p>
              </div>
            )}
          </section>

          <section className="border-b border-white/[0.06]">
            <button type="button" onClick={() => setOpenUserSection((s) => ({ ...s, shop: !s.shop }))} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors group">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">Shop</span>
              <span className="text-[11px] text-white/30">Restock pack purchases</span>
              <svg className={`w-4 h-4 text-white/20 transition-transform ${openUserSection.shop ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {openUserSection.shop && (
              <div className="px-5 pb-4 pt-1">
                <p className="text-white/40 text-sm mb-3">Reset this user&apos;s daily pack purchase count so they can buy packs again today.</p>
                <button type="button" onClick={async () => { if (!selectedUserId || restockingPack) return; setRestockingPack(true); try { const res = await fetch("/api/admin/restock-pack-purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId }) }); const data = await res.json().catch(() => ({})); if (res.ok) { alert(data.removed > 0 ? `Restocked: ${data.removed} purchase(s) cleared for today.` : "No pack purchases today for this user."); } else { alert(data.error || "Failed to restock"); } } finally { setRestockingPack(false); } }} disabled={restockingPack} className="px-5 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 disabled:opacity-40 cursor-pointer">{restockingPack ? "Resetting..." : "Reset pack purchase history (this user)"}</button>
              </div>
            )}
          </section>

          <section className="border-b border-white/[0.06]">
            <button type="button" onClick={() => setOpenUserSection((s) => ({ ...s, quests: !s.quests }))} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors group">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">Quests</span>
              {questProgress && <span className="text-[11px] text-white/40 tabular-nums">{questProgress.dailyQuests.quests.filter((q) => q.completed).length}/{questProgress.dailyQuests.quests.length} daily · {questProgress.setCompletionQuests.length} set · {questProgress.mainProgress.filter((p) => p.claimed).length}/{questProgress.mainProgress.length} main</span>}
              <svg className={`w-4 h-4 text-white/20 transition-transform ${openUserSection.quests ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {openUserSection.quests && (
              <div className="px-5 pb-4 pt-1 space-y-4">
                {!questProgress ? (
                  <p className="text-white/40 text-sm">Loading quest progress…</p>
                ) : (
                  <>
                    <div>
                      <h4 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-2">Daily quests ({questProgress.dailyQuests.date})</h4>
                      <div className="space-y-2 mb-3">
                        {questProgress.dailyQuests.quests.map((q, i) => {
                          const busyKey = `daily-${i}`;
                          return (
                            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                              <span className="text-white/80 text-sm flex-1 min-w-0 truncate" title={q.description}>{q.label}</span>
                              <label className="flex items-center gap-1.5 text-xs text-white/60 shrink-0 cursor-pointer">
                                <input type="checkbox" checked={q.completed} disabled={questProgressBusy[busyKey]} onChange={async () => { if (!selectedUserId) return; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "daily", questIndex: i, completed: !q.completed }) }); if (res.ok) { setQuestProgress((p) => p ? { ...p, dailyQuests: { ...p.dailyQuests, quests: p.dailyQuests.quests.map((qq, ii) => ii === i ? { ...qq, completed: !qq.completed } : qq) } } : null); loadData(); } } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="rounded border-white/30 bg-white/5" />
                                Done
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-white/60 shrink-0 cursor-pointer">
                                <input type="checkbox" checked={q.claimed} disabled={questProgressBusy[busyKey] || !q.completed} onChange={async () => { if (!selectedUserId || !q.completed) return; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "daily", questIndex: i, claimed: !q.claimed }) }); if (res.ok) { setQuestProgress((p) => p ? { ...p, dailyQuests: { ...p.dailyQuests, quests: p.dailyQuests.quests.map((qq, ii) => ii === i ? { ...qq, claimed: !qq.claimed } : qq) } } : null); loadData(); } } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="rounded border-white/30 bg-white/5" />
                                Claimed
                              </label>
                              <span className="text-[10px] text-amber-400/80 shrink-0">{q.reward} {q.rewardType}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" disabled={resettingQuests} onClick={async () => { if (!selectedUserId || resettingQuests) return; setResettingQuests(true); try { const res = await fetch("/api/admin/quests/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId }) }); const data = await res.json().catch(() => ({})); if (res.ok) { alert("Quests reset. User will get new daily quests on next open."); loadData(); } else { setError(data.error || "Failed to reset"); } } finally { setResettingQuests(false); } }} className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-40 cursor-pointer">{resettingQuests ? "Resetting…" : "Reset daily quests"}</button>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-2">Main quests (lifetime stats)</h4>
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 mb-2 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {(["packsOpened", "setsCompleted", "cardsDisenchanted", "cardsPackAPunched", "dailiesCompleted"] as const).map((key) => (
                            <div key={key}>
                              <label className="block text-[10px] text-white/50 mb-0.5">{key.replace(/([A-Z])/g, " $1").trim()}</label>
                              <input type="number" min={0} value={questProgress.lifetimeStats[key]} onChange={(e) => setQuestProgress((p) => p ? { ...p, lifetimeStats: { ...p.lifetimeStats, [key]: Math.max(0, parseInt(e.target.value, 10) || 0) } } : null)} onBlur={async (e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const busyKey = `stats-${key}`; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "main", stats: { [key]: v } }) }); if (res.ok) loadData(); } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="w-full px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-amber-500/40" />
                            </div>
                          ))}
                          {(["uncommon", "rare", "epic", "legendary"] as const).map((r) => (
                            <div key={`tradeUp-${r}`}>
                              <label className="block text-[10px] text-white/50 mb-0.5">Trade up {r}</label>
                              <input type="number" min={0} value={questProgress.lifetimeStats.tradeUpsByRarity?.[r] ?? 0} onChange={(e) => setQuestProgress((p) => p ? { ...p, lifetimeStats: { ...p.lifetimeStats, tradeUpsByRarity: { ...p.lifetimeStats.tradeUpsByRarity, [r]: Math.max(0, parseInt(e.target.value, 10) || 0) } } } : null)} onBlur={async (e) => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const busyKey = `stats-tradeUp-${r}`; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "main", stats: { tradeUpsByRarity: { ...questProgress.lifetimeStats.tradeUpsByRarity, [r]: v } } }) }); if (res.ok) loadData(); } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="w-full px-2 py-1.5 rounded bg-white/[0.06] border border-white/[0.08] text-white text-sm outline-none focus:border-amber-500/40" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {questProgress.mainProgress.map((p) => {
                          const busyKey = `main-claim-${p.definition.id}`;
                          return (
                            <div key={p.definition.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                              <span className="text-white/80 text-sm flex-1 min-w-0">{p.definition.label}</span>
                              <span className="text-amber-400/80 text-xs tabular-nums shrink-0">{p.current}/{p.target}</span>
                              <label className="flex items-center gap-1.5 text-xs text-white/60 shrink-0 cursor-pointer">
                                <input type="checkbox" checked={p.claimed} disabled={questProgressBusy[busyKey] || !p.completed} onChange={async () => { if (!selectedUserId) return; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "main_claim", questId: p.definition.id, claim: !p.claimed }) }); if (res.ok) { setQuestProgress((prev) => prev ? { ...prev, mainProgress: prev.mainProgress.map((mp) => mp.definition.id === p.definition.id ? { ...mp, claimed: !mp.claimed } : mp), claimedMainIds: !p.claimed ? [...prev.claimedMainIds, p.definition.id] : prev.claimedMainIds.filter((id) => id !== p.definition.id) } : null); loadData(); } } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="rounded border-white/30 bg-white/5" />
                                Claimed
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-2">Set completion (collection)</h4>
                      <div className="flex flex-wrap gap-2 items-end mb-2">
                        <select id="set-completion-add-winner" className="min-w-[160px] px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-amber-500/50 [color-scheme:dark]" onChange={async (e) => { const winnerId = e.target.value; if (!winnerId || !selectedUserId) return; e.target.value = ""; const tier = (document.getElementById("set-completion-add-tier") as HTMLSelectElement)?.value as "regular" | "holo" | "prismatic" | "darkMatter" || "regular"; const busyKey = `set-add-${winnerId}-${tier}`; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "set_completion", action: "add", winnerId, tier }) }); const data = await res.json(); if (res.ok && data.added) loadData(); else if (!res.ok) setError(data.error || "Failed to add"); } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }}>
                          <option value="">Add set completion…</option>
                          {winners.filter((w) => w.tmdbId).map((w) => ( <option key={w.id} value={w.id}>{w.movieTitle}</option> ))}
                        </select>
                        <select id="set-completion-add-tier" className="px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-amber-500/50 [color-scheme:dark]">
                          <option value="regular">Regular</option>
                          <option value="holo">Holo</option>
                          <option value="prismatic">Prismatic</option>
                          <option value="darkMatter">Dark Matter</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        {questProgress.setCompletionQuests.length === 0 ? ( <p className="text-white/30 text-sm py-2">None</p> ) : questProgress.setCompletionQuests.map((q) => { const tier: "regular" | "holo" | "prismatic" | "darkMatter" = q.isDarkMatter ? "darkMatter" : q.isPrismatic ? "prismatic" : q.isHolo ? "holo" : "regular"; const busyKey = `set-${q.winnerId}-${tier}`; return (
                          <div key={`${q.winnerId}-${tier}`} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                            <span className="text-white/80 text-sm flex-1 min-w-0 truncate">{q.movieTitle}</span>
                            <span className="text-[10px] text-white/50 shrink-0">{tier}</span>
                            <span className="text-amber-400/80 text-xs shrink-0">{q.reward} cr</span>
                            <label className="flex items-center gap-1.5 text-xs text-white/60 shrink-0 cursor-pointer">
                              <input type="checkbox" checked={q.claimed} disabled={questProgressBusy[busyKey]} onChange={async () => { if (!selectedUserId) return; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "set_completion", action: "set_claimed", winnerId: q.winnerId, tier, claimed: !q.claimed }) }); if (res.ok) { setQuestProgress((p) => p ? { ...p, setCompletionQuests: p.setCompletionQuests.map((sq) => sq.winnerId === q.winnerId && (!!sq.isHolo) === (tier === "holo") && (!!sq.isPrismatic) === (tier === "prismatic") && (!!sq.isDarkMatter) === (tier === "darkMatter") ? { ...sq, claimed: !sq.claimed } : sq) } : null); loadData(); } } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="rounded border-white/30 bg-white/5" />
                              Claimed
                            </label>
                            <button type="button" disabled={questProgressBusy[busyKey]} onClick={async () => { if (!selectedUserId) return; setQuestProgressBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/quests/user-progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, type: "set_completion", action: "remove", winnerId: q.winnerId, tier }) }); if (res.ok) loadData(); } finally { setQuestProgressBusy((b) => ({ ...b, [busyKey]: false })); } }} className="px-2 py-1 rounded text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 cursor-pointer shrink-0">Remove</button>
                          </div>
                        ); })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="border-b border-white/[0.06]">
            <button type="button" onClick={() => setOpenUserSection((s) => ({ ...s, trivia: !s.trivia }))} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors group">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">Trivia</span>
              <span className="text-[11px] text-white/40 tabular-nums">{triviaAttempts.length} completed</span>
              <svg className={`w-4 h-4 text-white/20 transition-transform ${openUserSection.trivia ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {openUserSection.trivia && (
              <div className="px-5 pb-4 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <button onClick={handleReopenAllTrivia} disabled={reopeningAll} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-500/80 disabled:opacity-40 cursor-pointer" title="Reopen all trivia for all users">{reopeningAll ? "Reopening All..." : "Reopen All (all users)"}</button>
                </div>
                <p className="text-white/40 text-sm mb-4">Reopen trivia for this user so they can play again.</p>
                {triviaAttempts.length === 0 ? ( <p className="text-white/40 text-sm">No completed trivia for this user.</p> ) : (
                  <div className="space-y-2">
                    {Array.from(new Map(triviaAttempts.map((a) => [a.winnerId, a])).values()).map((a) => { const winner = winners.find((w) => w.id === a.winnerId); const title = winner?.movieTitle ?? `Winner #${a.winnerId}`; const isReopening = reopeningWinnerId === a.winnerId; return (
                        <div key={a.winnerId} className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                          <span className="text-white/90 truncate">{title}</span>
                          <span className="text-white/40 text-sm shrink-0">{a.correctCount}/{a.totalCount} · {a.creditsEarned} credits</span>
                          <button onClick={() => handleReopenTrivia(a.winnerId)} disabled={isReopening} className="px-3 py-1.5 rounded-lg bg-amber-600/80 text-white text-sm font-medium hover:bg-amber-500/80 disabled:opacity-40 cursor-pointer shrink-0">{isReopening ? "Reopening..." : "Reopen"}</button>
                        </div>
                    ); })}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="border-b border-white/[0.06]">
            <button type="button" onClick={() => setOpenUserSection((s) => ({ ...s, collection: !s.collection }))} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors group">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              </div>
              <span className="text-sm font-medium text-white/70 flex-1">Collection</span>
              <span className="text-[11px] text-white/40 tabular-nums">{cards.length} cards</span>
              <svg className={`w-4 h-4 text-white/20 transition-transform ${openUserSection.collection ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {openUserSection.collection && (
              <div className="px-5 pb-4 pt-1">
                <div className="mb-4">
                  <p className="text-xs text-white/40 mb-2">Add card from pool — click a card to add it to this user&apos;s collection.</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-xs text-white/40">Add as</label>
                    <select value={addFinish} onChange={(e) => setAddFinish(e.target.value as "normal" | "holo" | "prismatic" | "darkMatter")} className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]">
                      <option value="normal">Normal</option>
                      <option value="holo">Holo</option>
                      <option value="prismatic">Prismatic</option>
                      <option value="darkMatter">Dark Matter</option>
                    </select>
                  </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 mb-6">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {pool.filter((c) => c.profilePath?.trim()).map((c) => {
                      const cardForDisplay = { profilePath: c.profilePath ?? "", actorName: c.actorName, characterName: c.characterName, movieTitle: c.movieTitle, rarity: c.rarity, isFoil: addFinish !== "normal", finish: addFinish, cardType: c.cardType };
                      const isAdding = addingCardCharacterId === c.characterId;
                      return (
                        <div key={c.characterId} className={`rounded-xl border overflow-hidden bg-white/[0.03] transition-all ${RARITY_COLORS[c.rarity] ?? "border-white/10"} hover:ring-2 hover:ring-green-500/40`}>
                          <div className="relative w-full" style={{ maxWidth: 100 }}><CardDisplay card={cardForDisplay} size="xs" /></div>
                          <div className="p-2">
                            <p className="text-[10px] font-semibold text-white/90 truncate" title={c.actorName}>{c.actorName}</p>
                            <p className="text-[10px] text-white/50 truncate" title={c.characterName}>{c.characterName}</p>
                            <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded uppercase ${RARITY_COLORS[c.rarity] ?? ""}`}>{c.rarity}</span>
                            <button type="button" onClick={() => handleAddCard(c.characterId)} disabled={addingCard} className="mt-2 w-full min-h-[32px] px-2 py-1.5 rounded-lg text-[10px] font-medium bg-green-600/90 text-white hover:bg-green-500 disabled:opacity-50 cursor-pointer">{isAdding ? "Adding…" : "Add"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {cards.length === 0 ? ( <p className="text-white/30 text-sm">No cards in collection.</p> ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {cards.map((card) => {
                      const finish = getFinish(card);
                      const isDM = finish === "darkMatter";
                      const isPrismatic = finish === "prismatic";
                      const isHolo = finish === "holo";
                      const isEnhanced = finish !== "normal";

                      const ringClass = isDM
                        ? "ring-2 ring-purple-500/70"
                        : isPrismatic
                        ? "ring-2 ring-amber-400/60"
                        : isHolo
                        ? "ring-2 ring-indigo-400/50"
                        : "";

                      const sheenClass = isDM
                        ? "dark-matter-sheen"
                        : isPrismatic
                        ? "prismatic-sheen"
                        : isHolo
                        ? "holo-sheen"
                        : "";

                      const cardBoxShadow = isDM
                        ? "0 0 16px rgba(139, 92, 246, 0.35), 0 4px 20px rgba(0,0,0,0.4)"
                        : isPrismatic
                        ? "0 0 20px rgba(255, 220, 150, 0.35), 0 4px 20px rgba(0,0,0,0.4)"
                        : "";

                      return (
                      <div key={card.id} className={`group rounded-xl border overflow-hidden bg-white/[0.02] ${RARITY_COLORS[card.rarity] || RARITY_COLORS.uncommon} ${ringClass}`} style={cardBoxShadow ? { boxShadow: cardBoxShadow } : undefined}>
                        <div className="aspect-[2/3] relative bg-gradient-to-br from-purple-900/30 to-indigo-900/30 overflow-hidden">
                          {card.profilePath ? ( <img src={card.profilePath} alt={card.actorName} className={`w-full h-full object-cover ${sheenClass}`} /> ) : ( <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl font-bold">{card.actorName.charAt(0)}</div> )}

                          {/* Dark Matter overlays — nebula, particles */}
                          {isDM && (
                            <>
                              <div className="absolute inset-0 card-dark-matter-nebula z-[4]" aria-hidden />
                              <div className="absolute inset-0 card-dark-matter-particles z-[5]" aria-hidden />
                            </>
                          )}

                          {/* Prismatic overlays — light beam, shimmer */}
                          {isPrismatic && (
                            <>
                              <div className="card-prismatic-beam z-[2]" />
                              <div className="absolute inset-0 card-prismatic-hover pointer-events-none z-[3]" />
                            </>
                          )}

                          {/* Holo overlay */}
                          {isHolo && (
                            <div className="absolute inset-0 card-holo-hover pointer-events-none z-[2]" />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-[1]" />

                          {/* Finish tag */}
                          {isDM && ( <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white z-[5]" style={{ background: "linear-gradient(135deg, #1e0a3c, #7c3aed, #4c1d95, #a855f7, #3b0764)", boxShadow: "0 0 12px rgba(139,92,246,0.7), 0 0 4px rgba(168,85,247,0.5)", letterSpacing: "0.05em" }}>DARK MATTER</span> )}
                          {isPrismatic && ( <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-amber-950 z-[5]" style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a, #fcd34d, #fbbf24, #f59e0b)", backgroundSize: "200% 200%", animation: "prismatic-hover-shift 4s ease-in-out infinite", boxShadow: "0 0 12px rgba(251,191,36,0.6), 0 0 24px rgba(245,158,11,0.3)", letterSpacing: "0.05em" }}>RADIANT</span> )}
                          {isHolo && ( <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white z-[5]" style={{ background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)", boxShadow: "0 0 8px rgba(255,255,255,0.5)" }}>HOLO</span> )}

                          {(() => { const entry = pool.find((p) => p.characterId === card.characterId); const altOfId = entry?.altArtOfCharacterId; const altOfName = altOfId ? pool.find((p) => p.characterId === altOfId)?.actorName : null; return altOfId ? ( <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-amber-600/90 z-[5]" title={altOfName ? `Alt-art: counts as ${altOfName}` : "Alt-art"}>Alt</span> ) : null; })()}
                          <span className="absolute bottom-2 left-2 right-2 text-[10px] font-medium uppercase text-amber-400/90 z-[5]">{card.rarity}</span>
                        </div>
                        <div className="p-2">
                          {(() => { const { title, subtitle } = cardLabelLines(card); return ( <><p className="text-sm font-semibold text-white/90 truncate">{title}</p><p className="text-xs text-white/60 truncate">{subtitle}</p><p className="text-[10px] text-white/40 truncate mt-0.5">{card.movieTitle}</p></> ); })()}
                          <div className="mt-3"><button onClick={() => openEditCard(card)} className="w-full min-h-[44px] px-4 py-3 rounded-lg text-sm font-medium border border-purple-500/40 text-purple-400 hover:bg-purple-500/15 cursor-pointer touch-manipulation">Edit</button></div>
                        </div>
                      </div>
                    ); })}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="border-b border-white/[0.06]">
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                </div>
                <span className="text-sm font-medium text-white/70">Codex</span>
                {userCodex && (
                  <span className="text-[11px] text-white/40 tabular-nums">
                    {userCodex.characterIds.length} reg · {userCodex.holoCharacterIds.length} holo · {userCodex.prismaticCharacterIds?.length ?? 0} prism · {userCodex.darkMatterCharacterIds?.length ?? 0} DM · {userCodex.altArtCharacterIds.length} alt · {userCodex.boysCharacterIds.length} boys
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => selectedUserId && setShowManageCodexModal(true)}
                disabled={!selectedUserId}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Manage Codex
              </button>
            </div>
          </section>
        </div>
        </>
      ) : (
        !loading && !selectedUserId && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">Select a user above to manage their credits and cards.</p>
          </div>
        )
      )}
      </>
      )}

      {/* ═══════════ TAB: PACKS & SHOP ═══════════ */}
      {activeTab === "packs" && (
      <>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/70">Manage Packs</h2>
              <p className="text-[11px] text-white/30">{packs.length} pack{packs.length !== 1 ? "s" : ""} configured</p>
            </div>
          </div>
          {packsLoading && ( <div className="flex items-center gap-2 text-xs text-white/50"><div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />Loading packs...</div> )}
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4 mb-6">
          <h3 className="text-sm font-medium text-amber-200/90 mb-3">Send pack to player</h3>
          <p className="text-xs text-white/50 mb-3">Award an unopened pack to a player. It will appear in their inventory to open.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Pack</label>
              <select value={awardPackPackId} onChange={(e) => setAwardPackPackId(e.target.value)} className="min-w-[180px] px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-amber-500/50 [color-scheme:dark]">
                <option value="">-- Select pack --</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/50 mb-1">Player</label>
              <select value={awardPackUserId} onChange={(e) => setAwardPackUserId(e.target.value)} className="min-w-[200px] px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-amber-500/50 [color-scheme:dark]">
                <option value="">-- Select player --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!awardPackPackId || !awardPackUserId || awardingPack}
              onClick={async () => {
                if (!awardPackPackId || !awardPackUserId || awardingPack) return;
                setAwardingPack(true);
                try {
                  const res = await fetch("/api/cards/award-pack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: awardPackUserId, packId: awardPackPackId, source: "admin" }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    alert(`Pack sent to ${users.find((u) => u.id === awardPackUserId)?.name ?? awardPackUserId}.`);
                    setAwardPackUserId("");
                    setAwardPackPackId("");
                  } else {
                    alert(data.error || "Failed to send pack");
                  }
                } finally {
                  setAwardingPack(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {awardingPack ? "Sending…" : "Send to player"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {!(showCreatePackForm || editingPackId) ? (
              <button type="button" onClick={() => setShowCreatePackForm(true)} className="px-4 py-2.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 cursor-pointer">Create Pack</button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white/80">{editingPackId ? "Edit Pack" : "Create Pack"}</h3>
                  <button type="button" onClick={() => { if (editingPackId) resetPackForm(); else setShowCreatePackForm(false); }} disabled={savingPack} className="text-xs text-white/50 hover:text-white/70 disabled:opacity-40">Close</button>
                </div>
                <form onSubmit={handleSavePack} className="space-y-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Name *</label>
                <input type="text" value={packForm.name} onChange={(e) => setPackForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" placeholder="Starter Pack" required />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Image *</label>
                <div className="flex gap-2">
                  <input type="text" value={packForm.imageUrl} onChange={(e) => setPackForm((f) => ({ ...f, imageUrl: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" placeholder="URL, or use upload & crop" required />
                  <button type="button" onClick={() => setShowImagePickerForPack(true)} className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-pointer">Upload / crop</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={packForm.isFree} onChange={(e) => setPackForm((f) => ({ ...f, isFree: e.target.checked, ...(e.target.checked ? { price: "0" } : {}) }))} className="rounded border-white/30 bg-white/5" />Free pack (0 credits)</label>
              <div className="flex flex-wrap gap-3">
                <div><label className="block text-xs text-white/40 mb-1">Price (credits)</label><input type="number" min={0} value={packForm.price} onChange={(e) => setPackForm((f) => ({ ...f, price: e.target.value }))} disabled={packForm.isFree} className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 disabled:opacity-60 disabled:cursor-not-allowed" /></div>
                <div><label className="block text-xs text-white/40 mb-1">Cards per pack</label><input type="number" min={1} value={packForm.cardsPerPack} onChange={(e) => setPackForm((f) => ({ ...f, cardsPerPack: e.target.value }))} className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                <div><label className="block text-xs text-white/40 mb-1">Max purchases per window</label><input type="number" min={0} placeholder="No limit" value={packForm.maxPurchasesPerDay} onChange={(e) => setPackForm((f) => ({ ...f, maxPurchasesPerDay: e.target.value }))} className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 placeholder:text-white/30" /><p className="text-[10px] text-white/40 mt-0.5">Leave empty for no limit.</p></div>
                <div><label className="block text-xs text-white/40 mb-1">Restock interval (hours)</label><input type="number" min={1} max={8760} placeholder="e.g. 6, 12, 24" value={packForm.restockIntervalHours} onChange={(e) => setPackForm((f) => ({ ...f, restockIntervalHours: e.target.value }))} className="w-28 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 placeholder:text-white/30" /><p className="text-[10px] text-white/40 mt-0.5">Per-user rolling window (e.g. 6 = limit every 6 hours). Leave empty for daily UTC reset below.</p></div>
                <div><label className="block text-xs text-white/40 mb-1">Daily reset time (UTC)</label><div className="flex items-center gap-2"><input type="number" min={0} max={23} placeholder="0" value={packForm.restockHourUtc} onChange={(e) => setPackForm((f) => ({ ...f, restockHourUtc: e.target.value }))} className="w-16 px-2 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /><span className="text-white/50">:</span><input type="number" min={0} max={59} placeholder="0" value={packForm.restockMinuteUtc} onChange={(e) => setPackForm((f) => ({ ...f, restockMinuteUtc: e.target.value }))} className="w-16 px-2 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div><p className="text-[10px] text-white/40 mt-0.5">Used only when restock interval is empty. Hour:minute when daily limit resets.</p></div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div><label className="block text-xs text-white/40 mb-1">Rarities this pack can drop</label><div className="flex flex-wrap gap-2">{["uncommon", "rare", "epic", "legendary"].map((r) => { const selected = packForm.allowedRarities.includes(r as any); return ( <button key={r} type="button" onClick={() => setPackForm((f) => { const current = f.allowedRarities; const has = current.includes(r as any); if (has) { const next = current.filter((x) => x !== r); return { ...f, allowedRarities: next.length ? next : ["uncommon", "rare", "epic", "legendary"] }; } return { ...f, allowedRarities: [...current, r as any] }; })} className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${selected ? "border-amber-400/70 bg-amber-500/20 text-amber-200" : "border-white/15 bg-white/[0.04] text-white/60 hover:border-amber-400/40 hover:text-amber-200"}`}>{r}</button> ); })}</div></div>
                <div><label className="block text-xs text-white/40 mb-1">Card types this pack can drop</label><div className="flex flex-wrap gap-2">{(["actor", "director", "character", "scene", "community"] as (CardType | "community")[]).map((t) => { const selected = packForm.allowedCardTypes.includes(t); return ( <button key={t} type="button" onClick={() => setPackForm((f) => { const current = f.allowedCardTypes; const has = current.includes(t); const fallback = ["actor", "director", "character", "scene", "community", ...customCardTypes.map((ct) => ct.id)]; if (has) { const next = current.filter((x) => x !== t); return { ...f, allowedCardTypes: next.length ? next : fallback }; } return { ...f, allowedCardTypes: [...current, t] }; })} className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${selected ? "border-purple-400/70 bg-purple-500/20 text-purple-100" : "border-white/15 bg-white/[0.04] text-white/60 hover:border-purple-400/40 hover:text-purple-100"}`}>{cardTypeDisplayLabel(t, customCardTypes)}</button> ); })}{customCardTypes.map((t) => { const selected = packForm.allowedCardTypes.includes(t.id); return ( <button key={t.id} type="button" onClick={() => setPackForm((f) => { const current = f.allowedCardTypes; const has = current.includes(t.id); const fallback = ["actor", "director", "character", "scene", "community", ...customCardTypes.map((ct) => ct.id)]; if (has) { const next = current.filter((x) => x !== t.id); return { ...f, allowedCardTypes: next.length ? next : fallback }; } return { ...f, allowedCardTypes: [...current, t.id] }; })} className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${selected ? "border-purple-400/70 bg-purple-500/20 text-purple-100" : "border-white/15 bg-white/[0.04] text-white/60 hover:border-purple-400/40 hover:text-purple-100"}`}>{t.label}</button> ); })}</div></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={packForm.isActive} onChange={(e) => setPackForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-white/30 bg-white/5" />Active in store</label>
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={packForm.discounted} onChange={(e) => setPackForm((f) => ({ ...f, discounted: e.target.checked }))} className="rounded border-white/30 bg-white/5" />Discounted (show &quot;Sale&quot; label in shop)</label>
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={packForm.comingSoon} onChange={(e) => setPackForm((f) => ({ ...f, comingSoon: e.target.checked }))} className="rounded border-white/30 bg-white/5" />Coming soon (visible in shop, not purchasable)</label>
              {packForm.discounted && ( <div><label className="block text-xs text-white/40 mb-1">Discount %</label><input type="number" min={0} max={100} placeholder="e.g. 20" value={packForm.discountPercent} onChange={(e) => setPackForm((f) => ({ ...f, discountPercent: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40 placeholder:text-white/30" /><p className="text-[10px] text-white/40 mt-0.5">Optional. Shows e.g. &quot;Sale 20%&quot; on the pack.</p></div> )}
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={packForm.useCustomWeights} onChange={(e) => setPackForm((f) => ({ ...f, useCustomWeights: e.target.checked }))} className="rounded border-white/30 bg-white/5" />Custom drop rates</label>
              {packForm.useCustomWeights && (() => { const vals = { legendary: parseFloat(packForm.rarityWeights.legendary) || 0, epic: parseFloat(packForm.rarityWeights.epic) || 0, rare: parseFloat(packForm.rarityWeights.rare) || 0, uncommon: parseFloat(packForm.rarityWeights.uncommon) || 0 }; const total = vals.legendary + vals.epic + vals.rare + vals.uncommon; const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) : "0.0"; return ( <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-2"><p className="text-[10px] text-white/50 mb-1">Set relative weights for each rarity tier. They are normalised to percentages automatically.</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{(["legendary", "epic", "rare", "uncommon"] as const).map((r) => ( <div key={r}><label className="block text-[11px] text-white/50 mb-0.5 capitalize">{r}</label><input type="number" min={0} step="any" value={packForm.rarityWeights[r]} onChange={(e) => setPackForm((f) => ({ ...f, rarityWeights: { ...f.rarityWeights, [r]: e.target.value } }))} className="w-full px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /><span className="text-[10px] text-white/40">{pct(vals[r])}%</span></div> ))}</div><div className="flex items-center gap-2 mt-1"><span className={`text-[11px] font-medium ${total > 0 ? "text-white/60" : "text-red-400"}`}>Total weight: {total} {total > 0 ? `(${(["legendary", "epic", "rare", "uncommon"] as const).map((r) => `${r[0].toUpperCase()}:${pct(vals[r])}%`).join(" ")})` : "— add at least one non-zero weight"}</span></div></div> ); })()}

              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 space-y-3">
                <p className="text-xs text-white/60 font-medium">Premium finish drop rates</p>
                <div>
                  <label className="block text-[11px] text-white/50 mb-0.5">Holo drop chance (%) per card</label>
                  <input type="number" min={0} max={100} step={0.1} value={packForm.holoChance} onChange={(e) => setPackForm((f) => ({ ...f, holoChance: e.target.value }))} className="w-24 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-indigo-500/50" placeholder="8" />
                  <span className="text-[10px] text-white/40 ml-2">Leave blank for global default (8%)</span>
                </div>
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input type="checkbox" checked={packForm.allowPrismatic} onChange={(e) => setPackForm((f) => ({ ...f, allowPrismatic: e.target.checked }))} className="rounded border-white/30 bg-white/5" />
                  <span>Enable Radiant drops</span>
                </label>
                {packForm.allowPrismatic && (
                  <div>
                    <label className="block text-[11px] text-white/50 mb-0.5">Radiant chance (%) per card</label>
                    <input type="number" min={0} max={100} step={0.1} value={packForm.prismaticChance} onChange={(e) => setPackForm((f) => ({ ...f, prismaticChance: e.target.value }))} className="w-24 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/50" placeholder="2" />
                    <span className="text-[10px] text-white/40 ml-2">Default 2%</span>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-white/70">
                  <input type="checkbox" checked={packForm.allowDarkMatter} onChange={(e) => setPackForm((f) => ({ ...f, allowDarkMatter: e.target.checked }))} className="rounded border-white/30 bg-white/5" />
                  <span>Enable Dark Matter drops</span>
                </label>
                {packForm.allowDarkMatter && (
                  <div>
                    <label className="block text-[11px] text-white/50 mb-0.5">Dark Matter chance (%) per card</label>
                    <input type="number" min={0} max={100} step={0.1} value={packForm.darkMatterChance} onChange={(e) => setPackForm((f) => ({ ...f, darkMatterChance: e.target.value }))} className="w-24 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/50" placeholder="0.5" />
                    <span className="text-[10px] text-white/40 ml-2">Default 0.5%</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {editingPackId && ( <button type="button" onClick={resetPackForm} disabled={savingPack} className="px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer">Cancel edit</button> )}
                <button type="submit" disabled={savingPack} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer">{savingPack ? "Saving..." : editingPackId ? "Save Pack" : "Create Pack"}</button>
              </div>
            </form>
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/80 mb-3">Existing Packs</h3>
            {packs.length === 0 ? ( <p className="text-white/40 text-sm">No packs configured yet.</p> ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                {packs.map((pack, index) => (
                  <div key={pack.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button type="button" onClick={() => movePack(index, "up")} disabled={reorderingPack || index === 0} className="p-1 rounded border border-white/20 bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="Move up" aria-label="Move up"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg></button>
                      <button type="button" onClick={() => movePack(index, "down")} disabled={reorderingPack || index === packs.length - 1} className="p-1 rounded border border-white/20 bg-white/[0.06] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="Move down" aria-label="Move down"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-black/40 flex-shrink-0">{pack.imageUrl ? ( <img src={pack.imageUrl} alt={pack.name} className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No image</div> )}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><p className="text-sm font-semibold text-white/90 truncate">{pack.name}</p>{!pack.isActive && ( <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-white/60">Inactive</span> )}{(pack as { comingSoon?: boolean }).comingSoon && ( <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300">Coming soon</span> )}</div>
                      <p className="text-xs text-white/60">{pack.isFree ? ( <span className="text-green-400 font-semibold">Free</span> ) : ( <span className="text-amber-300 font-semibold">{pack.price}</span> )}{" "}{pack.isFree ? "" : "credits · "}{pack.cardsPerPack} cards{pack.maxPurchasesPerDay != null && pack.maxPurchasesPerDay > 0 && ( <> · <span className="text-white/50">{pack.maxPurchasesPerDay}/{typeof pack.restockIntervalHours === "number" && pack.restockIntervalHours > 0 ? `${pack.restockIntervalHours}h` : "day"} limit</span></> )}</p>
                      <p className="text-[11px] text-white/40 mt-0.5 truncate">Drops{" "}{pack.allowedRarities.slice().sort((a, b) => ["legendary", "epic", "rare", "uncommon"].indexOf(a) - ["legendary", "epic", "rare", "uncommon"].indexOf(b)).join(", ")}{" "}({pack.allowedCardTypes.join(", ")})</p>
                      {pack.rarityWeights && (() => { const w = pack.rarityWeights; const t = w.legendary + w.epic + w.rare + w.uncommon || 1; const p = (v: number) => ((v / t) * 100).toFixed(1); return ( <p className="text-[10px] text-purple-300/70 mt-0.5">Rates: L:{p(w.legendary)}% E:{p(w.epic)}% R:{p(w.rare)}% U:{p(w.uncommon)}%</p> ); })()}
                      {(pack.holoChance != null || pack.allowPrismatic || pack.allowDarkMatter) && (
                        <p className="text-[10px] text-cyan-300/70 mt-0.5">
                          {[pack.holoChance != null && `Holo ${pack.holoChance}%`, pack.allowPrismatic && `Radiant ${pack.prismaticChance ?? 2}%`, pack.allowDarkMatter && `DM ${pack.darkMatterChance ?? 0.5}%`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => startEditPack(pack)} className="px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-300 text-xs font-medium hover:bg-purple-500/10 cursor-pointer">Edit</button>
                      <button type="button" onClick={() => handleDeletePack(pack.id)} disabled={deletingPackId === pack.id} className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/10 disabled:opacity-40 cursor-pointer">{deletingPackId === pack.id ? "Deleting..." : "Delete"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shop Items — Others */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" /></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/70">Shop Items — Others</h2>
              <p className="text-[11px] text-white/30">{shopItems.length} item{shopItems.length !== 1 ? "s" : ""} · Badges, skips, etc.</p>
            </div>
          </div>
          {shopItemsLoading && ( <div className="flex items-center gap-2 text-xs text-white/50"><div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />Loading...</div> )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {!(showCreateShopItem || editingShopItemId) ? (
              <button type="button" onClick={() => setShowCreateShopItem(true)} className="px-4 py-2.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 text-sm font-medium hover:bg-green-500/20 cursor-pointer">Add Shop Item</button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-medium text-white/80">{editingShopItemId ? "Edit Shop Item" : "Add Shop Item"}</h3><button type="button" onClick={resetShopItemForm} disabled={savingShopItem} className="text-xs text-white/50 hover:text-white/70 disabled:opacity-40">Close</button></div>
                <form onSubmit={handleSaveShopItem} className="space-y-3">
                  <div><label className="block text-xs text-white/40 mb-1">Name *</label><input type="text" value={shopItemForm.name} onChange={(e) => setShopItemForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm" placeholder="e.g. Special Badge" required /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Type *</label><select value={shopItemForm.type} onChange={(e) => setShopItemForm((f) => ({ ...f, type: e.target.value as ShopItemType }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm"><option value="badge">Badge</option><option value="skip">Skip</option></select></div>
                  {shopItemForm.type === "skip" && ( <div><label className="block text-xs text-white/40 mb-1">Skip amount *</label><input type="number" min={1} value={shopItemForm.skipAmount} onChange={(e) => setShopItemForm((f) => ({ ...f, skipAmount: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm" /></div> )}
                  <div><label className="block text-xs text-white/40 mb-1">Price (credits) *</label><input type="number" min={0} value={shopItemForm.price} onChange={(e) => setShopItemForm((f) => ({ ...f, price: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Description (optional)</label><input type="text" value={shopItemForm.description} onChange={(e) => setShopItemForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm" placeholder="Short description for the shop" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Image URL (optional)</label><input type="text" value={shopItemForm.imageUrl} onChange={(e) => setShopItemForm((f) => ({ ...f, imageUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm" placeholder="https://..." /></div>
                  <div className="flex items-center gap-2"><input type="checkbox" id="shop-item-active" checked={shopItemForm.isActive} onChange={(e) => setShopItemForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded border-white/20" /><label htmlFor="shop-item-active" className="text-xs text-white/60">Active (visible in shop)</label></div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingShopItem} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-40">{savingShopItem ? "Saving..." : editingShopItemId ? "Save" : "Add"}</button>
                    {editingShopItemId && ( <button type="button" onClick={resetShopItemForm} disabled={savingShopItem} className="px-4 py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:bg-white/10 disabled:opacity-40">Cancel</button> )}
                  </div>
                </form>
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/80 mb-3">Existing Items</h3>
            {shopItems.length === 0 ? ( <p className="text-white/40 text-sm">No shop items yet. Add one to show in Shop → Others.</p> ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                {shopItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white/90 truncate">{item.name}</p><p className="text-xs text-white/50 capitalize">{item.type} · {item.price} cr {!item.isActive && "· Inactive"}</p></div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => startEditShopItem(item)} className="px-2 py-1 rounded border border-green-500/40 text-green-300 text-xs hover:bg-green-500/10">Edit</button>
                      <button type="button" onClick={() => handleDeleteShopItem(item.id)} disabled={deletingShopItemId === item.id} className="px-2 py-1 rounded border border-red-500/40 text-red-300 text-xs hover:bg-red-500/10 disabled:opacity-40">{deletingShopItemId === item.id ? "..." : "Delete"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* ═══════════ TAB: CARD POOL ═══════════ */}
      {activeTab === "pool" && (
      <>
      {/* Legendaries in inventory */}
      <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-transparent p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/70">Legendaries in Inventory</h3>
              <p className="text-[11px] text-white/40 mt-0.5">Who has what legendary. Cards not in the pool can be returned so they drop again.</p>
            </div>
          </div>
          <button type="button" onClick={() => loadLegendaryInInventory()} disabled={legendaryInInventoryLoading} className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer transition-colors">{legendaryInInventoryLoading ? "Loading…" : "Refresh"}</button>
        </div>
        <div className="mt-4">
          {legendaryInInventoryLoading ? ( <p className="text-white/50 text-sm">Loading…</p> ) : legendaryInInventory.length === 0 ? ( <p className="text-white/50 text-sm">No legendary cards in any user&apos;s inventory.</p> ) : (
            <div className="space-y-6">
              {(() => {
                const byUser = new Map<string, (Card & { inPool: boolean })[]>();
                for (const card of legendaryInInventory) { const list = byUser.get(card.userId) ?? []; list.push(card); byUser.set(card.userId, list); }
                const sortedUserIds = Array.from(byUser.keys()).sort((a, b) => { const na = users.find((u) => u.id === a)?.name ?? a; const nb = users.find((u) => u.id === b)?.name ?? b; return na.localeCompare(nb); });
                return sortedUserIds.map((userId) => {
                  const userCards = byUser.get(userId) ?? [];
                  const userName = users.find((u) => u.id === userId)?.name ?? userId;
                  return (
                    <div key={userId} className="rounded-lg border border-white/[0.1] bg-white/[0.03] p-5">
                      <h4 className="text-sm font-medium text-white/90 mb-4">{userName}<span className="ml-2 text-white/40 font-normal">({userCards.length} {userCards.length === 1 ? "legendary" : "legendaries"})</span></h4>
                      <div className="flex flex-wrap gap-5">
                        {userCards.map((card) => (
                          <div key={card.id} className="flex flex-col items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 min-w-[160px]">
                            <CardDisplay card={card} size="md" />
                            <span className="text-[10px] text-white/55 font-mono truncate w-full max-w-[180px] text-center min-w-0" title={card.characterId}>{card.characterId}</span>
                            {card.isFoil && <span className="text-xs text-amber-400/90">Holo</span>}
                            <span className={`text-[10px] px-2.5 py-1 rounded-md mt-0.5 ${card.inPool ? "bg-emerald-500/20 text-emerald-400/90" : "bg-amber-500/20 text-amber-400/90"}`}>{card.inPool ? "In pool" : "Not in pool"}</span>
                            {!card.inPool && (
                              <button type="button" disabled={returnToPoolCardId !== null} onClick={async () => { if (!card.id) return; setReturnToPoolCardId(card.id); try { const res = await fetch("/api/admin/legendary-not-in-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: card.id }) }); const data = await res.json(); if (res.ok && data.ok) { await loadLegendaryInInventory(); await loadPool(); } else { setError(data?.error ?? "Failed to return to pool"); } } catch { setError("Failed to return to pool"); } finally { setReturnToPoolCardId(null); } }} className="mt-2 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer">{returnToPoolCardId === card.id ? "Adding…" : "Return to pool"}</button>
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

      {/* Pending cards */}
      {Object.keys(pendingByWinner).length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-transparent p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white/70">Pending Cards</h2>
                <p className="text-[11px] text-white/40">Push winner cards to the pool when ready</p>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {Object.entries(pendingByWinner).map(([bucketKey, entries]) => { const winner = winners.find((w) => w.id === bucketKey); const displayName = winner?.movieTitle ?? (bucketKey === "character" ? "Boys" : (customCardTypes.find((t) => t.id === bucketKey)?.label ?? bucketKey)); return (
                <div key={bucketKey} className="rounded-lg border border-amber-500/15 bg-white/[0.03] overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-amber-500/10"><div className="min-w-0"><p className="text-sm font-medium text-white/80 truncate">{displayName}</p><p className="text-xs text-white/40">{entries.length} card{entries.length !== 1 ? "s" : ""} pending — edit below, then push to pool</p></div><button type="button" onClick={() => handlePushToPool(bucketKey)} disabled={pushingWinnerId === bucketKey} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">{pushingWinnerId === bucketKey ? "Pushing…" : "Push to pool"}</button></div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c, bucketKey)} /> ))}</div>
                </div>
            ); })}
          </div>
        </div>
      )}

      {/* Manage Card Pool */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/70">Manage Card Pool</h2>
              <p className="text-[11px] text-white/30">{pool.length} cards in pool</p>
            </div>
          </div>
          <button type="button" onClick={() => { setShowAddPoolModal(true); setNewPoolTypeId(""); setNewPoolTypeLabel(""); }} className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 cursor-pointer">Add pool</button>
        </div>
        <div className="mb-5 grid grid-cols-4 gap-2">
          {[
            { label: "Legendary", pct: "1%", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
            { label: "Epic", pct: "10%", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            { label: "Rare", pct: "25%", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            { label: "Uncommon", pct: "64%", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          ].map((r) => (
            <div key={r.label} className={`rounded-lg border px-3 py-2 text-center ${r.bg}`}>
              <p className={`text-lg font-bold tabular-nums ${r.color}`}>{r.pct}</p>
              <p className="text-[10px] text-white/40">{r.label}</p>
            </div>
          ))}
        </div>
        <div className={showCreateCustomCardForm ? "grid grid-cols-1 lg:grid-cols-2 gap-8" : "grid grid-cols-1 gap-8"}>
          <div className={showCreateCustomCardForm ? "" : "w-full"}>
            {!showCreateCustomCardForm ? (
              <button type="button" onClick={() => setShowCreateCustomCardForm(true)} className="px-4 py-2.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 text-sm font-medium hover:bg-green-500/20 cursor-pointer">Create custom card</button>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-medium text-white/80">Create Custom Card</h3><button type="button" onClick={() => setShowCreateCustomCardForm(false)} className="text-xs text-white/50 hover:text-white/70">Close</button></div>
                <form onSubmit={handleAddToPool} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-white/40 mb-1">Actor / Name *</label><input type="text" value={customActorName} onChange={(e) => setCustomActorName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" placeholder="Al Pacino" required /></div>
                <div><label className="block text-xs text-white/40 mb-1">Character / Role</label><input type="text" value={customCharacterName} onChange={(e) => setCustomCharacterName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" placeholder="Tony Montana" /></div>
              </div>
              {!isCustomPoolType && (
              <div><label className="block text-xs text-white/40 mb-1">Winner / Movie *</label><select value={customWinnerId} onChange={(e) => { setCustomWinnerId(e.target.value); setCustomAltArtOfCharacterId(""); }} className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]" required><option value="">-- Select winner (movie) --</option>{winners.map((w) => ( <option key={w.id} value={w.id}>{w.movieTitle}</option> ))}</select></div>
              )}
              {customWinnerId && !isCustomPoolType && (() => { const winner = winners.find((w) => w.id === customWinnerId); const sameMoviePool = pool.filter((c) => c.profilePath?.trim() && (c.movieTmdbId ?? 0) === (winner?.tmdbId ?? 0)); return ( <div><label className="block text-xs text-white/40 mb-1">Alt-art: counts as character</label><select value={customAltArtOfCharacterId} onChange={(e) => setCustomAltArtOfCharacterId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="">— None (normal pool entry) —</option>{sameMoviePool.map((c) => ( <option key={c.characterId} value={c.characterId}>{poolOptionLabel(c)}</option> ))}</select><p className="text-[10px] text-white/40 mt-1">If set, this pool entry is an alt-art; any card with this image counts as that character for set completion.</p></div> ); })()}
              <p className="text-[10px] text-white/40">New cards go to Pending first. Edit below, then push to pool when ready.</p>
              <div><label className="block text-xs text-white/40 mb-1">Image *</label><div className="flex gap-2"><input type="text" value={customProfilePath} onChange={(e) => setCustomProfilePath(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" placeholder="URL, or paste image (Ctrl+V) / click button" /><button type="button" onClick={() => setShowImagePickerForAdd(true)} disabled={pastingImage} className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-pointer disabled:opacity-50">{pastingImage ? "Uploading..." : "Upload or paste"}</button></div></div>
              <div className="flex flex-wrap gap-3">
                <div><label className="block text-xs text-white/40 mb-1">Rarity</label><select value={customRarity} onChange={(e) => setCustomRarity(e.target.value as typeof customRarity)} className="px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></div>
                <div><label className="block text-xs text-white/40 mb-1">Card Type</label><select value={customCardType} onChange={(e) => setCustomCardType(e.target.value)} className="px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="actor">Actor</option><option value="director">Director</option><option value="character">Boys</option><option value="scene">Scene</option>{customCardTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
              </div>
              {isCustomPoolType && (() => {
                const existingSets = [...new Set([...pool, ...Object.values(pendingByWinner).flat()].filter((c) => (c.cardType ?? "actor") === customCardType && (c.customSetId ?? "").trim()).map((c) => (c.customSetId ?? "").trim()))].filter(Boolean).sort();
                const selectVal = customSetSelectOther ? "__other__" : (existingSets.includes(customSetId.trim()) ? customSetId.trim() : (customSetId.trim() ? "__other__" : ""));
                return (
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Custom Set</label>
                    <select value={selectVal} onChange={(e) => { const v = e.target.value; setCustomSetSelectOther(v === "__other__"); setCustomSetId(v === "__other__" ? customSetId : v); }} className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]">
                      <option value="">— None —</option>
                      {existingSets.map((s) => <option key={s} value={s}>{s}</option>)}
                      <option value="__other__">— Other (type new) —</option>
                    </select>
                    {selectVal === "__other__" && <input type="text" value={customSetId} onChange={(e) => setCustomSetId(e.target.value)} placeholder="e.g. Summer 2025" className="w-full mt-2 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" />}
                    <p className="text-[10px] text-white/40 mt-1">Optional. Groups cards in the codex by this label instead of movie.</p>
                  </div>
                );
              })()}
              <button type="submit" disabled={!customActorName.trim() || !customProfilePath.trim() || (!isCustomPoolType && !customWinnerId) || addingToPool} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-40 cursor-pointer">{addingToPool ? "Adding..." : "Add to Pending"}</button>
            </form>
              </>
            )}
          </div>
          <div className="w-full min-w-0 space-y-6">
            {(() => {
              const customIds = new Set(customCardTypes.map((t) => t.id));
              const actorPool = pool.filter((c) => {
                const ct = c.cardType ?? "actor";
                return ct !== "character" && !customIds.has(ct);
              });
              const boysPool = pool.filter((c) => (c.cardType ?? "actor") === "character");
              return (
                <>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-medium text-blue-300/90">Actor Pool</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/40">{actorPool.length} cards</span>
                        <select value={poolSort} onChange={(e) => setPoolSort(e.target.value as "rarity" | "movie")} className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-blue-500/50 [color-scheme:dark]"><option value="rarity">Sort by rarity</option><option value="movie">Sort by movie</option></select>
                      </div>
                    </div>
                    {poolLoading ? ( <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div> ) : (
                      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
                        {poolSort === "rarity" ? (
                          RARITY_ORDER.map((r) => { const entries = actorPool.filter((c) => c.rarity === r); if (entries.length === 0) return null; return (
                            <div key={r}>
                              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${r === "legendary" ? "bg-amber-400" : r === "epic" ? "bg-purple-400" : r === "rare" ? "bg-blue-400" : "bg-white/40"}`} />{r} ({entries.length})</h4>
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c)} /> ))}</div>
                            </div>
                          ); })
                        ) : (
                          (() => { const byMovie = new Map<string, typeof actorPool>(); for (const c of actorPool) { const m = c.movieTitle || "(No movie)"; if (!byMovie.has(m)) byMovie.set(m, []); byMovie.get(m)!.push(c); } const movies = Array.from(byMovie.keys()).sort(); return movies.map((movieTitle) => { const entries = byMovie.get(movieTitle)!; return (
                            <div key={movieTitle}>
                              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{movieTitle} ({entries.length})</h4>
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c)} /> ))}</div>
                            </div>
                          ); }); })()
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h3 className="text-sm font-medium text-amber-300/90">Boys Pool</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/40">{boysPool.length} cards</span>
                        <select value={poolSortBoys} onChange={(e) => setPoolSortBoys(e.target.value as "rarity" | "set")} className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-amber-500/50 [color-scheme:dark]"><option value="rarity">Sort by rarity</option><option value="set">Sort by set</option></select>
                      </div>
                    </div>
                    {poolLoading ? ( <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /></div> ) : (
                      <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
                        {poolSortBoys === "rarity" ? (
                          RARITY_ORDER.map((r) => { const entries = boysPool.filter((c) => c.rarity === r); if (entries.length === 0) return null; return (
                            <div key={r}>
                              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${r === "legendary" ? "bg-amber-400" : r === "epic" ? "bg-purple-400" : r === "rare" ? "bg-blue-400" : "bg-white/40"}`} />{r} ({entries.length})</h4>
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c)} /> ))}</div>
                            </div>
                          ); })
                        ) : (
                          (() => { const bySet = new Map<string, typeof boysPool>(); for (const c of boysPool) { const s = (c.customSetId ?? c.movieTitle ?? "(Uncategorized)").trim() || "(Uncategorized)"; if (!bySet.has(s)) bySet.set(s, []); bySet.get(s)!.push(c); } const sets = Array.from(bySet.keys()).sort(); return sets.map((setName) => { const entries = bySet.get(setName)!; return (
                            <div key={setName}>
                              <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{setName} ({entries.length})</h4>
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c)} /> ))}</div>
                            </div>
                          ); }); })()
                        )}
                      </div>
                    )}
                  </div>
                  {customCardTypes.map((ct) => {
                    const customPool = pool.filter((c) => (c.cardType ?? "actor") === ct.id);
                    const bySet = new Map<string, typeof customPool>();
                    for (const c of customPool) {
                      const s = (c.customSetId ?? c.movieTitle ?? "(Uncategorized)").trim() || "(Uncategorized)";
                      if (!bySet.has(s)) bySet.set(s, []); bySet.get(s)!.push(c);
                    }
                    const sets = Array.from(bySet.keys()).sort();
                    return (
                      <div key={ct.id} className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                          <h3 className="text-sm font-medium text-teal-300/90">{ct.label} Pool</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white/40">{customPool.length} cards</span>
                            <select value={poolSortCustom} onChange={(e) => setPoolSortCustom(e.target.value as "rarity" | "set")} className="px-3 py-1.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-teal-500/50 [color-scheme:dark]"><option value="rarity">Sort by rarity</option><option value="set">Sort by set</option></select>
                          </div>
                        </div>
                        {poolLoading ? ( <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" /></div> ) : (
                          <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
                            {poolSortCustom === "rarity" ? (
                              RARITY_ORDER.map((r) => { const entries = customPool.filter((c) => c.rarity === r); if (entries.length === 0) return null; return (
                                <div key={r}>
                                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${r === "legendary" ? "bg-amber-400" : r === "epic" ? "bg-purple-400" : r === "rare" ? "bg-blue-400" : "bg-white/40"}`} />{r} ({entries.length})</h4>
                                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c)} /> ))}</div>
                                </div>
                              ); })
                            ) : (
                              sets.map((setName) => { const entries = bySet.get(setName)!; return (
                                <div key={`${ct.id}-${setName}`}>
                                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{setName} ({entries.length})</h4>
                                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">{entries.map((c) => ( <PoolEntryCard key={c.characterId} c={c} onEdit={() => openEditPoolEntry(c)} /> ))}</div>
                                </div>
                              ); })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      </div>
      </>
      )}

      {/* ═══════════ TAB: ECONOMY ═══════════ */}
      {activeTab === "economy" && (
      <>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/70">Credit Rewards</h2>
            <p className="text-[11px] text-white/30">Credits awarded for each action</p>
          </div>
        </div>
        {creditSettingsLoading ? ( <div className="flex items-center gap-2 text-sm text-white/50"><div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />Loading...</div> ) : (
          <form onSubmit={handleSaveCreditSettings} className="flex flex-wrap gap-6">
            <div><label className="block text-xs text-white/40 mb-1">Submission</label><input type="number" min={0} value={creditSettingsForm.submission} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, submission: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1">Vote</label><input type="number" min={0} value={creditSettingsForm.vote} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, vote: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1">Submission wins</label><input type="number" min={0} value={creditSettingsForm.submissionWin} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, submissionWin: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="Per vote received, when winner is published (non-winners only)">Votes received</label><input type="number" min={0} value={creditSettingsForm.votesReceivedPerVote} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, votesReceivedPerVote: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr/vote</span></div>
            <div><label className="block text-xs text-white/40 mb-1">Rating a movie</label><input type="number" min={0} value={creditSettingsForm.rating} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, rating: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1">Leaving a comment</label><input type="number" min={0} value={creditSettingsForm.comment} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, comment: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="When feedback is accepted in admin panel">Feedback accepted</label><input type="number" min={0} value={creditSettingsForm.feedbackAccepted} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, feedbackAccepted: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="When player completes a set and claims the quest">Set completion</label><input type="number" min={0} value={creditSettingsForm.setCompletionReward} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, setCompletionReward: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="When player completes full holo set and claims the quest">Holo set completion</label><input type="number" min={0} value={creditSettingsForm.holoSetCompletionReward} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, holoSetCompletionReward: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="When player completes full prismatic set and claims the quest">Radiant set completion</label><input type="number" min={0} value={creditSettingsForm.prismaticSetCompletionReward} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, prismaticSetCompletionReward: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="When player completes full dark matter set and claims the quest">Dark matter set completion</label><input type="number" min={0} value={creditSettingsForm.darkMatterSetCompletionReward} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, darkMatterSetCompletionReward: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="First watch of a Vault video (original Dabys Media content)">Vault video watch</label><input type="number" min={0} value={creditSettingsForm.vaultWatch} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, vaultWatch: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="Minimum watch time in minutes for Vault video credit claim (timer only runs while playing)">Vault min watch</label><input type="number" min={0} value={creditSettingsForm.vaultMinWatchMinutes} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, vaultMinWatchMinutes: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">min</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="Cost to create a new community set">Community set create</label><input type="number" min={0} value={creditSettingsForm.communitySetCreatePrice} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, communitySetCreatePrice: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="Xcr per extra card beyond 6 in a community set">Community extra card</label><input type="number" min={0} value={creditSettingsForm.communitySetExtraCardPrice} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, communitySetExtraCardPrice: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="Credits for user who completes a community set">Community completion</label><input type="number" min={0} value={creditSettingsForm.communitySetCompletionReward} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, communitySetCompletionReward: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div><label className="block text-xs text-white/40 mb-1" title="Credits for set creator when someone completes their community set">Community creator reward</label><input type="number" min={0} value={creditSettingsForm.communitySetCompletionCreatorReward} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, communitySetCompletionCreatorReward: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            <div className="w-full border-t border-white/[0.06] pt-4 mt-2 flex flex-wrap gap-6">
              <span className="text-xs text-white/40 w-full">Quicksell (vendor) credits per rarity</span>
              <div><label className="block text-xs text-white/40 mb-1">Quicksell uncommon</label><input type="number" min={0} value={creditSettingsForm.quicksellUncommon} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellUncommon: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
              <div><label className="block text-xs text-white/40 mb-1">Quicksell rare</label><input type="number" min={0} value={creditSettingsForm.quicksellRare} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellRare: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
              <div><label className="block text-xs text-white/40 mb-1">Quicksell epic</label><input type="number" min={0} value={creditSettingsForm.quicksellEpic} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellEpic: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
              <div><label className="block text-xs text-white/40 mb-1">Quicksell legendary</label><input type="number" min={0} value={creditSettingsForm.quicksellLegendary} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, quicksellLegendary: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
              <div><label className="block text-xs text-white/40 mb-1" title="When 4 epics are traded up and the result is credits (67% chance) instead of a legendary">Epic→Legendary trade-up failure</label><input type="number" min={0} value={creditSettingsForm.tradeUpLegendaryFailureCredits} onChange={(e) => setCreditSettingsForm((f) => ({ ...f, tradeUpLegendaryFailureCredits: e.target.value }))} className="w-24 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40" /><span className="ml-1 text-xs text-white/40">cr</span></div>
            </div>
            <div className="flex items-end"><button type="submit" disabled={savingCreditSettings} className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 cursor-pointer">{savingCreditSettings ? "Saving..." : "Save"}</button></div>
          </form>
        )}
        <div className="border-t border-white/[0.06] pt-5 mt-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
            <h3 className="text-sm font-medium text-white/60">Add Credits to All Users</h3>
          </div>
          <form onSubmit={handleAddCreditsToAll} className="flex gap-3 flex-wrap items-end">
            <div><label className="block text-xs text-white/40 mb-1">Credits to add</label><input type="number" min={0} value={addAllCreditsInput} onChange={(e) => setAddAllCreditsInput(e.target.value)} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-purple-500/40 w-32" placeholder="0" /></div>
            <button type="submit" disabled={addAllCreditsLoading} className="px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer">{addAllCreditsLoading ? "Adding..." : "Add credits to all users"}</button>
          </form>
        </div>
      </div>

      {/* Alchemy Settings */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <span className="text-cyan-400 text-sm font-bold">◆</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/70">Alchemy & Prism Settings</h2>
            <p className="text-[11px] text-white/30">Upgrade chances, prism transmute, prismatic crafting</p>
          </div>
        </div>
        {alchemySettingsLoading ? ( <div className="flex items-center gap-2 text-sm text-white/50"><div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />Loading...</div> ) : (
          <form onSubmit={handleSaveAlchemySettings} className="space-y-5">
            <div>
              <span className="text-xs text-white/50 font-medium block mb-2">Upgrade Success Chances (Forge only)</span>
              <div className="flex flex-wrap gap-4">
                <div><label className="block text-[11px] text-white/40 mb-1">Radiant upgrade %</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.prismaticUpgradeChance} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismaticUpgradeChance: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">Dark Matter upgrade %</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.darkMatterUpgradeChance} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, darkMatterUpgradeChance: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <span className="text-xs text-white/50 font-medium block mb-2">Prism Transmutation (Epic+ Holo → Prisms)</span>
              <div className="flex flex-wrap gap-4">
                <div><label className="block text-[11px] text-white/40 mb-1">Cards required</label><input type="number" min={1} max={10} value={alchemySettingsForm.prismTransmuteEpicHoloCount} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismTransmuteEpicHoloCount: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">Success chance %</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.prismTransmuteSuccessChance} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismTransmuteSuccessChance: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">Prisms awarded</label><input type="number" min={1} max={100} value={alchemySettingsForm.prismsPerTransmute} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismsPerTransmute: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <span className="text-xs text-white/50 font-medium block mb-2">Radiant Crafting (Prisms → Radiant Card)</span>
              <div className="flex flex-wrap gap-4">
                <div><label className="block text-[11px] text-white/40 mb-1">Base chance %</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.prismaticCraftBaseChance} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismaticCraftBaseChance: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">% per prism</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.prismaticCraftChancePerPrism} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismaticCraftChancePerPrism: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">Max prisms</label><input type="number" min={1} max={100} value={alchemySettingsForm.prismaticCraftMaxPrisms} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismaticCraftMaxPrisms: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">Failure stardust</label><input type="number" min={0} max={10000} value={alchemySettingsForm.prismaticCraftFailureStardust} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, prismaticCraftFailureStardust: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
                <div><label className="block text-[11px] text-white/40 mb-1">Epic Holo forge prisms</label><input type="number" min={0} max={100} value={alchemySettingsForm.epicHoloForgePrisms} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, epicHoloForgePrisms: e.target.value }))} className="w-20 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-cyan-500/40" /></div>
              </div>
              <p className="text-[10px] text-white/30 mt-2">Chance = base + (prisms applied × per-prism). Epic Holo in forge = disenchant for prisms; only Legendary Holo can be crafted to Radiant.</p>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <span className="text-xs text-white/50 font-medium block mb-2">Stardust / Alchemy Bench Values</span>
              <p className="text-[10px] text-white/30 mb-3">Stardust from disenchanting Holo by rarity; Stardust cost for Pack-A-Punch (Normal→Holo). Radiant and Dark Matter upgrades are Forge-only with Prisms.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] text-cyan-400/80 font-medium">Disenchant Holo</span>
                  <div className="flex flex-wrap gap-2">
                    <div><label className="block text-[10px] text-white/40 mb-0.5">UC</label><input type="number" min={0} max={10000} value={alchemySettingsForm.disenchantHoloUncommon} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, disenchantHoloUncommon: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">R</label><input type="number" min={0} max={10000} value={alchemySettingsForm.disenchantHoloRare} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, disenchantHoloRare: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">E</label><input type="number" min={0} max={10000} value={alchemySettingsForm.disenchantHoloEpic} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, disenchantHoloEpic: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">L</label><input type="number" min={0} max={10000} value={alchemySettingsForm.disenchantHoloLegendary} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, disenchantHoloLegendary: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] text-amber-400/80 font-medium">Pack-A-Punch cost</span>
                  <div className="flex flex-wrap gap-2">
                    <div><label className="block text-[10px] text-white/40 mb-0.5">UC</label><input type="number" min={0} max={10000} value={alchemySettingsForm.packAPunchCostUncommon} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, packAPunchCostUncommon: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">R</label><input type="number" min={0} max={10000} value={alchemySettingsForm.packAPunchCostRare} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, packAPunchCostRare: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">E</label><input type="number" min={0} max={10000} value={alchemySettingsForm.packAPunchCostEpic} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, packAPunchCostEpic: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">L</label><input type="number" min={0} max={10000} value={alchemySettingsForm.packAPunchCostLegendary} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, packAPunchCostLegendary: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] text-amber-400/80 font-medium">Pack-A-Punch success %</span>
                  <div className="flex flex-wrap gap-2">
                    <div><label className="block text-[10px] text-white/40 mb-0.5">UC</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.holoUpgradeChanceUncommon} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, holoUpgradeChanceUncommon: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">R</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.holoUpgradeChanceRare} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, holoUpgradeChanceRare: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">E</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.holoUpgradeChanceEpic} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, holoUpgradeChanceEpic: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                    <div><label className="block text-[10px] text-white/40 mb-0.5">L</label><input type="number" min={0} max={100} step={1} value={alchemySettingsForm.holoUpgradeChanceLegendary} onChange={(e) => setAlchemySettingsForm((f) => ({ ...f, holoUpgradeChanceLegendary: e.target.value }))} className="w-14 px-1.5 py-1 rounded bg-white/[0.06] border border-white/[0.08] text-white/90 text-xs outline-none focus:border-cyan-500/40" /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-end pt-2"><button type="submit" disabled={savingAlchemySettings} className="px-5 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 disabled:opacity-40 cursor-pointer">{savingAlchemySettings ? "Saving..." : "Save Alchemy Settings"}</button></div>
          </form>
        )}
      </div>
      </>
      )}

      {/* ═══════════ TAB: TIMELINE ═══════════ */}
      {activeTab === "timeline" && (
      <>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/90">Epic & Legendary Timeline</h2>
            <p className="text-[11px] text-white/40">Pulls, rerolls, trade-ups, and prismatic crafts — by who and when</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-xs text-white/50">Filter by user</label>
          <select
            value={timelineFilterUserId}
            onChange={(e) => setTimelineFilterUserId(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-cyan-500/50 cursor-pointer [color-scheme:dark] min-w-[200px]"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setTimelineLoading(true);
              fetch(`/api/admin/timeline${timelineFilterUserId ? `?userId=${encodeURIComponent(timelineFilterUserId)}` : ""}`)
                .then((r) => r.json())
                .then((d) => setTimelineEntries(d.entries ?? []))
                .catch(() => setTimelineEntries([]))
                .finally(() => setTimelineLoading(false));
            }}
            disabled={timelineLoading}
            className="px-3 py-2 rounded-lg bg-cyan-600/80 text-white text-sm font-medium hover:bg-cyan-500/80 disabled:opacity-40 cursor-pointer"
          >
            {timelineLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          {timelineLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : timelineEntries.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-sm">No epic or legendary activity yet.</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#0d0d12] border-b border-white/[0.08]">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-semibold text-white/50 uppercase tracking-wider">Date/Time</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-white/50 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-white/50 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-white/50 uppercase tracking-wider">Rarity</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-white/50 uppercase tracking-wider">Card</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineEntries.map((e) => (
                    <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 text-white/70 font-mono text-xs whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-white/80">{e.userName}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          e.source === "pull" ? "bg-blue-500/20 text-blue-300" :
                          e.source === "reroll" ? "bg-amber-500/20 text-amber-300" :
                          e.source === "trade_up" ? "bg-purple-500/20 text-purple-300" :
                          "bg-cyan-500/20 text-cyan-300"
                        }`}>
                          {e.source === "pull" ? "Pull" : e.source === "reroll" ? "Reroll" : e.source === "trade_up" ? "Trade-up" : "Radiant craft"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={e.rarity === "legendary" ? "text-amber-400 font-medium" : "text-purple-400"}>{e.rarity}</span>
                      </td>
                      <td className="px-4 py-2.5 text-white/80">{e.characterName || e.actorName || e.cardId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* ═══════════ TAB: DANGER ZONE ═══════════ */}
      {activeTab === "danger" && (
      <>
      <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-red-400/90">Danger Zone</h2>
            <p className="text-[11px] text-white/40">Destructive actions — type <strong className="text-white/60">WIPE</strong> to confirm</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.03] p-4">
            <h3 className="text-sm font-medium text-orange-400/90 mb-2">Rollback user to a selected date</h3>
            <p className="text-[11px] text-white/40 mb-3">Revert selected user to the state they were in at the <strong className="text-white/60">start</strong> of the selected date (midnight UTC). Everything that happened on or after that date is undone: credits, inventory (cards), codex, lottery tickets, trades, and marketplace listings. Type <strong className="text-orange-400/80">ROLLBACK</strong> to confirm.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!selectedUserId || rollbackLoading || rollbackConfirm.trim().toUpperCase() !== "ROLLBACK" || !rollbackDate) return;
                setRollbackLoading(true);
                setError("");
                try {
                  const res = await fetch("/api/admin/rollback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: selectedUserId, date: rollbackDate }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    setCreditBalance(data.newBalance);
                    setCreditInput(String(data.newBalance));
                    setRollbackConfirm("");
                    loadData();
                    alert(data.message || "Rollback complete.");
                  } else {
                    setError(data.error || "Failed to rollback");
                  }
                } finally {
                  setRollbackLoading(false);
                }
              }}
              className="flex flex-wrap gap-3 items-end"
            >
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-orange-500/50 cursor-pointer [color-scheme:dark] min-w-[200px]"><option value="">-- Select user --</option>{users.map((u) => ( <option key={u.id} value={u.id}>{u.name} ({u.id})</option> ))}</select>
              <div>
                <label className="block text-xs text-white/40 mb-1">Rollback to start of</label>
                <input type="date" value={rollbackDate} onChange={(e) => setRollbackDate(e.target.value)} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-orange-500/40 w-44 [color-scheme:dark]" />
              </div>
              <input type="text" value={rollbackConfirm} onChange={(e) => setRollbackConfirm(e.target.value)} placeholder="Type ROLLBACK to confirm" className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-orange-500/40 w-48" />
              <button type="submit" disabled={!selectedUserId || rollbackLoading || rollbackConfirm.trim().toUpperCase() !== "ROLLBACK" || !rollbackDate} className="px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{rollbackLoading ? "Rolling back…" : "Rollback"}</button>
            </form>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-4">
            <h3 className="text-sm font-medium text-amber-400/90 mb-2">Backfill codex activity log</h3>
            <p className="text-[11px] text-white/40 mb-3">Stamps all current codex entries into the activity log with the chosen date. This creates a baseline so the rollback tool can undo codex changes that happened after this date. Only adds entries that aren&apos;t already in the log. Run this <strong className="text-white/60">once</strong> after cleaning up any exploited entries, choosing a date <strong className="text-white/60">before</strong> the exploit.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (backfillLoading || !backfillDate) return;
                setBackfillLoading(true);
                setError("");
                try {
                  const res = await fetch("/api/admin/rollback/backfill-codex", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date: backfillDate, userId: selectedUserId || undefined }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    alert(data.message || "Backfill complete.");
                  } else {
                    setError(data.error || "Failed to backfill");
                  }
                } finally {
                  setBackfillLoading(false);
                }
              }}
              className="flex flex-wrap gap-3 items-end"
            >
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-amber-500/50 cursor-pointer [color-scheme:dark] min-w-[200px]"><option value="">All users</option>{users.map((u) => ( <option key={u.id} value={u.id}>{u.name} ({u.id})</option> ))}</select>
              <div>
                <label className="block text-xs text-white/40 mb-1">Stamp entries with date</label>
                <input type="date" value={backfillDate} onChange={(e) => setBackfillDate(e.target.value)} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 outline-none focus:border-amber-500/40 w-44 [color-scheme:dark]" />
              </div>
              <button type="submit" disabled={backfillLoading || !backfillDate} className="px-4 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{backfillLoading ? "Backfilling…" : "Backfill codex log"}</button>
            </form>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-white/70 mb-2">Wipe one user&apos;s inventory</h3>
            <form onSubmit={handleWipeUser} className="flex flex-wrap gap-3 items-end">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-red-500/50 cursor-pointer [color-scheme:dark] min-w-[200px]"><option value="">-- Select user --</option>{users.map((u) => ( <option key={u.id} value={u.id}>{u.name} ({u.id})</option> ))}</select>
              <input type="text" value={wipeConfirmUser} onChange={(e) => setWipeConfirmUser(e.target.value)} placeholder="Type WIPE to confirm" className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-red-500/40 w-48" />
              <button type="submit" disabled={!selectedUserId || wipingUser || wipeConfirmUser.trim().toUpperCase() !== "WIPE"} className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{wipingUser ? "Wiping..." : "Wipe user inventory"}</button>
            </form>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-white/70 mb-2">Wipe one user&apos;s inventory &amp; currency only</h3>
            <p className="text-[11px] text-white/40 mb-3">Removes cards, credits, stardust, prisms, listings, trades. Keeps trivia, comments, submissions, codex.</p>
            <form onSubmit={handleWipeUserInventoryCurrency} className="flex flex-wrap gap-3 items-end">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#12121a] border border-white/[0.12] text-white outline-none focus:border-red-500/50 cursor-pointer [color-scheme:dark] min-w-[200px]"><option value="">-- Select user --</option>{users.map((u) => ( <option key={u.id} value={u.id}>{u.name} ({u.id})</option> ))}</select>
              <input type="text" value={wipeConfirmUserInvCurr} onChange={(e) => setWipeConfirmUserInvCurr(e.target.value)} placeholder="Type WIPE to confirm" className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-red-500/40 w-48" />
              <button type="submit" disabled={!selectedUserId || wipingUserInvCurr || wipeConfirmUserInvCurr.trim().toUpperCase() !== "WIPE"} className="px-4 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{wipingUserInvCurr ? "Wiping..." : "Wipe inventory &amp; currency only"}</button>
            </form>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-white/70 mb-2">Rebuild pool (6 per movie)</h3>
            <p className="text-[11px] text-white/40 mb-3">Re-fetches cast from TMDB and rebuilds the character pool. Custom entries are preserved.</p>
            {showRebuildConfirm ? (
              <div className="flex flex-wrap items-center gap-2">
                <input type="text" value={rebuildConfirmInput} onChange={(e) => setRebuildConfirmInput(e.target.value)} placeholder={`Type "${REBUILD_CONFIRM_WORD}" to confirm`} className="px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm w-48 outline-none focus:border-red-500/40" autoFocus />
                <button onClick={handleRebuildPool} disabled={rebuildingPool || rebuildConfirmInput.toLowerCase().trim() !== REBUILD_CONFIRM_WORD} className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400/90 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40 cursor-pointer">{rebuildingPool ? "Rebuilding..." : "Confirm rebuild"}</button>
                <button onClick={() => { setShowRebuildConfirm(false); setRebuildConfirmInput(""); }} disabled={rebuildingPool} className="px-3 py-2 rounded-lg border border-white/20 text-white/60 text-sm font-medium hover:bg-white/5 disabled:opacity-40 cursor-pointer">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowRebuildConfirm(true)} disabled={rebuildingPool} className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400/90 text-sm font-medium hover:bg-red-500/10 disabled:opacity-40 cursor-pointer">{rebuildingPool ? "Rebuilding..." : "Rebuild pool (6/movie)"}</button>
            )}
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-white/70 mb-2">Reset codex</h3>
            <p className="text-[11px] text-white/40 mb-3">Clears all codex unlocks for all users. Everyone will see the Codex as locked.</p>
            <button type="button" onClick={handleResetCodex} disabled={resettingCodex} className="px-4 py-2.5 rounded-lg border border-amber-500/40 text-amber-400/90 text-sm font-medium hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{resettingCodex ? "Resetting..." : "Reset codex"}</button>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-white/70 mb-2">Reset all inventory &amp; currency (server-wide)</h3>
            <p className="text-[11px] text-white/40 mb-3">Clears all cards, credits, stardust, prisms, listings, and trades. Keeps trivia, comments, submissions, codex, users, weeks, winners, packs.</p>
            <form onSubmit={handleWipeServerInventoryCurrency} className="flex flex-wrap gap-3 items-end">
              <input type="text" value={wipeConfirmServerInvCurr} onChange={(e) => setWipeConfirmServerInvCurr(e.target.value)} placeholder="Type WIPE to confirm" className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-red-500/40 w-48" />
              <button type="submit" disabled={wipingServerInvCurr || wipeConfirmServerInvCurr.trim().toUpperCase() !== "WIPE"} className="px-4 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{wipingServerInvCurr ? "Resetting..." : "Reset inventory &amp; currency only"}</button>
            </form>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/[0.03] p-4">
            <h3 className="text-sm font-medium text-red-400/90 mb-2">Reset all inventory (server-wide, full)</h3>
            <p className="text-[11px] text-white/40 mb-3">Clears all cards, credits, credit history, trivia attempts, marketplace listings, and trades. Users, weeks, winners, submissions, ratings, comments, and packs are not touched.</p>
            <form onSubmit={handleWipeServer} className="flex flex-wrap gap-3 items-end">
              <input type="text" value={wipeConfirmServer} onChange={(e) => setWipeConfirmServer(e.target.value)} placeholder="Type WIPE to confirm" className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 placeholder:text-white/30 outline-none focus:border-red-500/40 w-48" />
              <button type="submit" disabled={wipingServer || wipeConfirmServer.trim().toUpperCase() !== "WIPE"} className="px-4 py-2.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{wipingServer ? "Resetting..." : "Reset all inventory (incl. trivia)"}</button>
            </form>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Edit card modal */}
      {editingCard && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => !savingEdit && setEditingCard(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden" role="dialog" aria-label="Edit card">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white/90 mb-4">Edit Card</h3>
              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-white/40 mb-1">Actor / Name</label><input type="text" value={editForm.actorName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, actorName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Character / Role</label><input type="text" value={editForm.characterName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, characterName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                </div>
                <div><label className="block text-xs text-white/40 mb-1">Movie Title</label><input type="text" value={editForm.movieTitle ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, movieTitle: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                <div><label className="block text-xs text-white/40 mb-1">Image URL</label><input type="url" value={editForm.profilePath ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, profilePath: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                <div className="flex flex-wrap gap-3">
                  <div><label className="block text-xs text-white/40 mb-1">TMDB Movie ID</label><input type="number" value={editForm.movieTmdbId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, movieTmdbId: parseInt(e.target.value, 10) || 0 }))} className="w-20 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Rarity</label><select value={editForm.rarity ?? "uncommon"} onChange={(e) => setEditForm((f) => ({ ...f, rarity: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></div>
                  <div><label className="block text-xs text-white/40 mb-1">Card Type</label><select value={editForm.cardType ?? "actor"} onChange={(e) => setEditForm((f) => ({ ...f, cardType: e.target.value as CardType }))} className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="actor">Actor</option><option value="director">Director</option><option value="character">Boys</option><option value="scene">Scene</option></select></div>
                  <div className="self-end pb-1"><label className="block text-xs text-white/40 mb-1">Finish</label><select value={editForm.finish ?? "normal"} onChange={(e) => { const f = e.target.value as CardFinish; setEditForm((prev) => ({ ...prev, finish: f, isFoil: f !== "normal" })); }} className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="normal">Normal</option><option value="holo">Holo</option><option value="prismatic">Prismatic</option><option value="darkMatter">Dark Matter</option></select></div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2"><button type="button" onClick={() => setEditingCard(null)} disabled={savingEdit} className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer">Cancel</button><button type="submit" disabled={savingEdit} className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer">{savingEdit ? "Saving..." : "Save"}</button></div>
                  <button type="button" onClick={() => editingCard && handleRemoveCard(editingCard.id, () => setEditingCard(null))} disabled={savingEdit || removingId === editingCard?.id} className="w-full px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer text-sm">{removingId === editingCard?.id ? "Removing..." : "Delete card"}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit pool entry modal */}
      {editingPoolEntry && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => { if (!savingPoolEdit) { setEditingPoolEntry(null); setEditingPendingWinnerId(null); } }} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden" role="dialog" aria-label="Edit pool entry">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white/90 mb-4">Edit Pool Entry</h3>
              <form onSubmit={handleSavePoolEdit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-white/40 mb-1">Actor / Name</label><input type="text" value={poolEditForm.actorName ?? ""} onChange={(e) => setPoolEditForm((f) => ({ ...f, actorName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Character / Role</label><input type="text" value={poolEditForm.characterName ?? ""} onChange={(e) => setPoolEditForm((f) => ({ ...f, characterName: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                </div>
                <div><label className="block text-xs text-white/40 mb-1">Movie Title</label><input type="text" value={poolEditForm.movieTitle ?? ""} onChange={(e) => setPoolEditForm((f) => ({ ...f, movieTitle: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                <div><label className="block text-xs text-white/40 mb-1">Image</label><div className="flex gap-2"><input type="text" value={poolEditForm.profilePath ?? ""} onChange={(e) => setPoolEditForm((f) => ({ ...f, profilePath: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" placeholder="URL, or paste image (Ctrl+V) / click button" /><button type="button" onClick={() => setShowImagePickerForEdit(true)} disabled={pastingImage} className="px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-colors cursor-pointer disabled:opacity-50">{pastingImage ? "Uploading..." : "Upload or paste"}</button></div></div>
                <div className="flex flex-wrap gap-3">
                  <div><label className="block text-xs text-white/40 mb-1">TMDB Movie ID</label><input type="number" value={poolEditForm.movieTmdbId ?? ""} onChange={(e) => setPoolEditForm((f) => ({ ...f, movieTmdbId: parseInt(e.target.value, 10) || 0 }))} className="w-20 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Rarity</label><select value={poolEditForm.rarity ?? "uncommon"} onChange={(e) => setPoolEditForm((f) => ({ ...f, rarity: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="epic">Epic</option><option value="legendary">Legendary</option></select></div>
                  <div><label className="block text-xs text-white/40 mb-1">Card Type</label><select value={poolEditForm.cardType ?? "actor"} onChange={(e) => setPoolEditForm((f) => ({ ...f, cardType: e.target.value }))} className="px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]"><option value="actor">Actor</option><option value="director">Director</option><option value="character">Boys</option><option value="scene">Scene</option>{customCardTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                </div>
                {((poolEditForm.cardType ?? "actor") === "character" || customCardTypes.some((t) => t.id === (poolEditForm.cardType ?? "actor"))) && (() => {
                  const editCt = poolEditForm.cardType ?? "actor";
                  const existingSets = [...new Set([...pool, ...Object.values(pendingByWinner).flat()].filter((c) => (c.cardType ?? "actor") === editCt && (c.customSetId ?? "").trim()).map((c) => (c.customSetId ?? "").trim()))].filter(Boolean).sort();
                  const val = poolEditForm.customSetId ?? "";
                  const selectVal = customSetSelectOtherEdit ? "__other__" : (existingSets.includes(val.trim()) ? val.trim() : (val.trim() ? "__other__" : ""));
                  return (
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Custom Set</label>
                      <select value={selectVal} onChange={(e) => { const v = e.target.value; setCustomSetSelectOtherEdit(v === "__other__"); setPoolEditForm((f) => ({ ...f, customSetId: v === "__other__" ? (f.customSetId ?? "") : v })); }} className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]">
                        <option value="">— None —</option>
                        {existingSets.map((s) => <option key={s} value={s}>{s}</option>)}
                        <option value="__other__">— Other (type new) —</option>
                      </select>
                      {selectVal === "__other__" && <input type="text" value={val} onChange={(e) => setPoolEditForm((f) => ({ ...f, customSetId: e.target.value }))} placeholder="e.g. Summer 2025" className="w-full mt-2 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-purple-500/40" />}
                      <p className="text-[10px] text-white/40 mt-1">Groups Boys in the codex by this label instead of movie.</p>
                    </div>
                  );
                })()}
                {editingPoolEntry && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Alt-art: counts as character</label>
                    <select value={poolEditForm.altArtOfCharacterId ?? ""} onChange={(e) => setPoolEditForm((f) => ({ ...f, altArtOfCharacterId: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.12] text-white text-sm outline-none focus:border-purple-500/50 [color-scheme:dark]">
                      <option value="">— None (normal pool entry) —</option>
                      {(() => { const isEditCustomType = (editingPoolEntry.cardType ?? "actor") === "character" || customCardTypes.some((t) => t.id === (editingPoolEntry.cardType ?? "actor")); const sameMoviePool = isEditCustomType ? pool.filter((c) => c.profilePath?.trim() && (c.cardType ?? "actor") === (editingPoolEntry.cardType ?? "actor")) : pool.filter((c) => c.profilePath?.trim() && (c.movieTmdbId ?? 0) === (editingPoolEntry.movieTmdbId ?? 0)); const sameMoviePending = editingPendingWinnerId ? (pendingByWinner[editingPendingWinnerId] ?? []).filter((c) => isEditCustomType ? (c.cardType ?? "actor") === (editingPoolEntry.cardType ?? "actor") : (c.movieTmdbId ?? 0) === (editingPoolEntry.movieTmdbId ?? 0)) : []; const combined = [...sameMoviePool]; sameMoviePending.forEach((c) => { if (!combined.some((x) => x.characterId === c.characterId)) combined.push(c); }); return combined.map((c) => ( <option key={c.characterId} value={c.characterId}>{poolOptionLabel(c)}</option> )); })()}
                    </select>
                    <p className="text-[10px] text-white/40 mt-1">If set, this pool entry is an alt-art; any card with this image counts as that character for set completion.</p>
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2"><button type="button" onClick={() => { setEditingPoolEntry(null); setEditingPendingWinnerId(null); }} disabled={savingPoolEdit} className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer">Cancel</button><button type="submit" disabled={savingPoolEdit} className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-40 cursor-pointer">{savingPoolEdit ? "Saving..." : "Save"}</button></div>
                  <button type="button" onClick={() => editingPoolEntry && handleRemoveFromPool(editingPoolEntry.characterId, editingPendingWinnerId ?? undefined, () => { setEditingPoolEntry(null); setEditingPendingWinnerId(null); })} disabled={savingPoolEdit || removingFromPoolId === editingPoolEntry?.characterId} className="w-full px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 cursor-pointer text-sm">{removingFromPoolId === editingPoolEntry?.characterId ? "Removing..." : "Remove from pool"}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {showAddPoolModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => !addingPoolType && setShowAddPoolModal(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden" role="dialog" aria-label="Add pool category">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white/90 mb-4">Add Pool Category</h3>
              <p className="text-xs text-white/50 mb-4">Creates a new card type and pool section (e.g. Girls, Villains). Also adds it to pack &quot;Drops&quot; options.</p>
              <form onSubmit={handleAddPoolType} className="space-y-3">
                <div><label className="block text-xs text-white/40 mb-1">ID (lowercase, hyphens only)</label><input type="text" value={newPoolTypeId} onChange={(e) => setNewPoolTypeId(e.target.value)} placeholder="e.g. girls" className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-emerald-500/40" /><p className="text-[10px] text-white/40 mt-1">Used internally. &quot;Girls&quot; → girls</p></div>
                <div><label className="block text-xs text-white/40 mb-1">Display label</label><input type="text" value={newPoolTypeLabel} onChange={(e) => setNewPoolTypeLabel(e.target.value)} placeholder="e.g. Girls" className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm outline-none focus:border-emerald-500/40" /></div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowAddPoolModal(false)} disabled={addingPoolType} className="flex-1 px-4 py-2 rounded-lg border border-white/[0.08] text-white/70 hover:bg-white/[0.04] disabled:opacity-40 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={!newPoolTypeId.trim() || addingPoolType} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-40 cursor-pointer">{addingPoolType ? "Adding..." : "Add"}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Manage Codex modal */}
      {showManageCodexModal && selectedUserId && userCodex && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowManageCodexModal(false)} aria-hidden />
          <div className="fixed inset-4 z-50 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden flex flex-col" role="dialog" aria-label="Manage Codex">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
              <h2 className="text-lg font-semibold text-white">Manage Codex</h2>
              <button type="button" onClick={() => setShowManageCodexModal(false)} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06]">✕</button>
            </div>
            <div className="flex gap-1 px-4 pt-2 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
              {(["regular", "holo", "prismatic", "darkMatter", "altart", "boys"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setManageCodexModalTab(tab)} className={`px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${manageCodexModalTab === tab ? "bg-white/[0.08] text-white" : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"}`}>
                  {tab === "regular" ? "Regular" : tab === "holo" ? "Holo" : tab === "prismatic" ? "Radiant" : tab === "darkMatter" ? "Dark Matter" : tab === "altart" ? "Alt-art" : "Boys"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const variant = manageCodexModalTab;
                const key = variant === "regular" ? "characterIds" : variant === "holo" ? "holoCharacterIds" : variant === "prismatic" ? "prismaticCharacterIds" : variant === "darkMatter" ? "darkMatterCharacterIds" : variant === "altart" ? "altArtCharacterIds" : "boysCharacterIds";
                const ids = userCodex[key] ?? [];
                const label = variant === "regular" ? "Regular" : variant === "holo" ? "Holo" : variant === "prismatic" ? "Radiant" : variant === "darkMatter" ? "Dark Matter" : variant === "altart" ? "Alt-art" : "Boys";
                const poolForVariant = variant === "boys" ? pool.filter((c) => (c.cardType ?? "actor") === "character") : variant === "altart" ? pool.filter((c) => c.altArtOfCharacterId?.trim()) : pool.filter((c) => c.profilePath?.trim());
                const available = poolForVariant.filter((c) => !ids.includes(c.characterId));
                const finish: "normal" | "holo" | "prismatic" | "darkMatter" = variant === "darkMatter" ? "darkMatter" : variant === "prismatic" ? "prismatic" : variant === "holo" ? "holo" : "normal";
                const availableBySet = new Map<string, typeof available>();
                for (const c of available) {
                  const setKey = (c.customSetId ?? c.movieTitle ?? "(Uncategorized)").trim() || "(Uncategorized)";
                  if (!availableBySet.has(setKey)) availableBySet.set(setKey, []);
                  availableBySet.get(setKey)!.push(c);
                }
                const setsWithAvailable = Array.from(availableBySet.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                const addSingle = async (c: CharacterPortrayal) => {
                  const isHolo = variant === "altart" && codexAddAltArtAsHolo;
                  const busyKey = `${variant}-add-${c.characterId}`;
                  setCodexBusy((b) => ({ ...b, [busyKey]: true }));
                  try {
                    const res = await fetch("/api/admin/user-codex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, characterId: c.characterId, variant, action: "add", ...(variant === "altart" && { isHolo }) }) });
                    if (res.ok) {
                      setUserCodex((prev) => prev ? { ...prev, [key]: [...(prev[key] ?? []), c.characterId], ...(variant === "altart" && isHolo && { altArtHoloCharacterIds: [...(prev.altArtHoloCharacterIds ?? []), c.characterId] }) } : null);
                    }
                  } finally {
                    setCodexBusy((b) => ({ ...b, [busyKey]: false }));
                  }
                };
                const addSet = async (setName: string) => {
                  if (!availableBySet.has(setName)) return;
                  const toAdd = availableBySet.get(setName)!;
                  setCodexAddSetDropdownOpen(false);
                  setCodexAddSetBusy(true);
                  const isHolo = variant === "altart" && codexAddAltArtAsHolo;
                  try {
                    const results = await Promise.all(toAdd.map((c) =>
                      fetch("/api/admin/user-codex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, characterId: c.characterId, variant, action: "add", ...(variant === "altart" && { isHolo }) }) })
                    ));
                    if (results.every((r) => r.ok)) {
                      const addedIds = toAdd.map((c) => c.characterId);
                      setUserCodex((prev) => prev ? { ...prev, [key]: [...(prev[key] ?? []), ...addedIds], ...(variant === "altart" && isHolo && { altArtHoloCharacterIds: [...(prev.altArtHoloCharacterIds ?? []), ...addedIds] }) } : null);
                    }
                  } finally {
                    setCodexAddSetBusy(false);
                  }
                };
                return (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCodexAddSectionOpen((o) => !o)}
                        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-white/60 transition-transform ${codexAddSectionOpen ? "rotate-90" : ""}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </span>
                          <h3 className="text-sm font-semibold text-white/80">Add cards</h3>
                          {variant === "altart" && (
                            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={codexAddAltArtAsHolo} onChange={(e) => setCodexAddAltArtAsHolo(e.target.checked)} className="rounded border-white/30 bg-white/5" />
                              <span>Add as holo</span>
                            </label>
                          )}
                        </div>
                        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setCodexAddSetDropdownOpen((o) => !o)}
                            disabled={codexAddSetBusy || setsWithAvailable.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/80 text-white text-sm font-medium hover:bg-emerald-500/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-emerald-500/30"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0v6m0-6V5m-14 6v6m0-6V5" /></svg>
                            {codexAddSetBusy ? "Adding…" : "Add set"}
                            {setsWithAvailable.length > 0 && <span className="text-emerald-200/80 text-xs">({setsWithAvailable.length})</span>}
                          </button>
                          {codexAddSetDropdownOpen && setsWithAvailable.length > 0 && (
                            <>
                              <div className="fixed inset-0 z-40" aria-hidden onClick={() => setCodexAddSetDropdownOpen(false)} />
                              <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] max-h-[50vh] overflow-y-auto py-1 rounded-lg border border-white/[0.12] bg-[#1a1a24] shadow-xl scrollbar-autocomplete">
                                {setsWithAvailable.map(([setName, cards]) => (
                                  <button key={setName} type="button" onClick={() => addSet(setName)} className="w-full px-4 py-2.5 text-left text-sm text-white/90 hover:bg-white/[0.08] flex items-center justify-between gap-2">
                                    <span className="truncate">{setName}</span>
                                    <span className="text-white/50 text-xs shrink-0">{cards.length} cards</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </button>
                      {codexAddSectionOpen && (
                        <div className="border-t border-white/[0.06] p-4">
                          <p className="text-xs text-white/50 mb-3">Click a card to add it to the codex</p>
                          {available.length === 0 ? (
                            <p className="text-white/40 text-sm py-6 text-center">All {label} cards are already in the codex</p>
                          ) : (
                            <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                              {setsWithAvailable.map(([setName, cards]) => (
                                <div key={setName}>
                                  <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">{setName}</h4>
                                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5">
                                    {cards.map((c) => {
                                      const busyKey = `${variant}-add-${c.characterId}`;
                                      const codexCard = { id: c.characterId, rarity: c.rarity, isFoil: variant === "holo" || variant === "prismatic" || variant === "darkMatter" || (variant === "altart" && codexAddAltArtAsHolo), finish: variant === "altart" ? (codexAddAltArtAsHolo ? "holo" : "normal") : finish, actorName: c.actorName ?? "", characterName: c.characterName ?? "", movieTitle: c.movieTitle ?? "", profilePath: c.profilePath ?? "", cardType: c.cardType ?? "actor", isAltArt: variant === "altart" };
                                      return (
                                        <button key={c.characterId} type="button" disabled={!!codexBusy[busyKey]} onClick={() => addSingle(c)} className="relative w-full min-w-0 rounded-lg overflow-hidden border-2 border-transparent hover:border-purple-500/50 focus:border-purple-500/50 focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group">
                                          <CardDisplay card={codexCard} size="sm" selectable />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                                            <span className="px-1.5 py-0.5 rounded bg-purple-600/90 text-white text-[10px] font-medium">{codexBusy[busyKey] ? "…" : "+ Add"}</span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-white/80">In codex</h3>
                      {ids.length === 0 ? ( <p className="text-white/30 text-sm py-8 text-center">None</p> ) : ( (() => { const bySet = new Map<string, string[]>(); for (const characterId of ids) { const entry = pool.find((p) => p.characterId === characterId); const setKey = (entry?.customSetId ?? entry?.movieTitle ?? "(Uncategorized)").trim() || "(Uncategorized)"; if (!bySet.has(setKey)) bySet.set(setKey, []); bySet.get(setKey)!.push(characterId); } const sets = Array.from(bySet.keys()).sort(); return sets.map((setName) => { const setIds = bySet.get(setName)!; return (
                        <div key={setName} className="space-y-2">
                          <h5 className="text-xs font-semibold text-white/60 uppercase tracking-wider">{setName} ({setIds.length})</h5>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                            {setIds.map((characterId) => { const entry = pool.find((p) => p.characterId === characterId); const busyKey = `${variant}-remove-${characterId}`; const isAltHolo = variant === "altart" && (userCodex.altArtHoloCharacterIds ?? []).includes(characterId); const codexCard = entry ? { id: entry.characterId, rarity: entry.rarity, isFoil: variant === "holo" || variant === "prismatic" || variant === "darkMatter" || isAltHolo, finish: variant === "altart" ? (isAltHolo ? "holo" : "normal") : finish, actorName: entry.actorName ?? "", characterName: entry.characterName ?? "", movieTitle: entry.movieTitle ?? "", profilePath: entry.profilePath ?? "", cardType: entry.cardType ?? "actor", isAltArt: variant === "altart" } : null; if (!codexCard) return ( <div key={characterId} className="rounded-lg border border-white/10 bg-white/[0.04] aspect-[2/3.35] flex items-center justify-center"><span className="text-white/30 text-xs">?</span></div> ); return (
                              <div key={characterId} className="relative group/codexcard w-full min-w-0">
                                <CardDisplay card={codexCard} size="sm" selectable />
                                <button type="button" disabled={codexBusy[busyKey]} onClick={async (ev) => { ev.stopPropagation(); setCodexBusy((b) => ({ ...b, [busyKey]: true })); try { const res = await fetch("/api/admin/user-codex", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId, characterId, variant, action: "remove" }) }); if (res.ok) { setUserCodex((prev) => prev ? { ...prev, [key]: prev[key].filter((id) => id !== characterId), ...(variant === "altart" && { altArtHoloCharacterIds: (prev.altArtHoloCharacterIds ?? []).filter((id) => id !== characterId) }) } : null); } } finally { setCodexBusy((b) => ({ ...b, [busyKey]: false })); } }} className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60 opacity-0 group-hover/codexcard:opacity-100 transition-opacity cursor-pointer border-2 border-red-500/50 hover:border-red-400">
                                  <span className="px-2 py-1 rounded bg-red-600/90 text-white text-xs font-medium">{codexBusy[busyKey] ? "…" : "Remove"}</span>
                                </button>
                              </div>
                            ); })}
                          </div>
                        </div>
                      ); }); })() )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      <ImageCropModal open={showImagePickerForAdd} onClose={() => setShowImagePickerForAdd(false)} onComplete={(url) => { setCustomProfilePath(url); setShowImagePickerForAdd(false); }} aspect={2 / 3} title="Card art" cropShape="rect" />
      <ImageCropModal open={showImagePickerForEdit} onClose={() => setShowImagePickerForEdit(false)} onComplete={(url) => { setPoolEditForm((f) => ({ ...f, profilePath: url })); setShowImagePickerForEdit(false); }} aspect={2 / 3} title="Card art" cropShape="rect" />
      <ImageCropModal open={showImagePickerForPack} onClose={() => setShowImagePickerForPack(false)} onComplete={(url) => { setPackForm((f) => ({ ...f, imageUrl: url })); setShowImagePickerForPack(false); }} aspect={2 / 3} title="Pack art" cropShape="rect" />
    </div>
  );
}
