import {
  getWinners,
  getCharacterPool,
  saveCharacterPool,
  getPendingPool,
  savePendingPool,
  addCard,
  deductCredits,
  getCredits,
  addCredits,
  getCreditSettings,
  getOwnedLegendarySlotIds,
  migrateCommonToUncommon,
  getCards,
  getCardById,
  removeCard,
  getListings,
  getPacks,
  getPacksRaw,
  getProfile,
  getPackPurchasesInWindow,
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCodexUnlockedAltArtCharacterIds,
  getCodexUnlockedPrismaticCharacterIds,
  getCodexUnlockedDarkMatterCharacterIds,
  getCardFinish,
} from "@/lib/data";
import type { CharacterPortrayal, Winner, Pack, CardFinish } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p";
const PACK_PRICE = 50;
const CARDS_PER_PACK = 5;
const FOIL_CHANCE = 0.08;
const PRISMATIC_CHANCE = 0.02;
const DARK_MATTER_CHANCE = 0.005;
const CARDS_PER_MOVIE = 6;
const TMDB_DELAY_MS = 100;

type Rarity = "uncommon" | "rare" | "epic" | "legendary";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Roll the finish tier for a newly created card. Options control which premium finishes are possible.
 * - allowPrismatic: if true, prismatic can drop
 * - allowDarkMatter: if true, dark matter can drop
 * - prismaticChance: 0–100 percent (when allowPrismatic). If omitted, uses default 2.
 * - darkMatterChance: 0–100 percent (when allowDarkMatter). If omitted, uses default 0.5.
 * Rolls from highest to lowest; a dark matter roll also satisfies prismatic/holo.
 */
function rollCardFinish(opts?: {
  allowPrismatic?: boolean;
  allowDarkMatter?: boolean;
  prismaticChance?: number;
  darkMatterChance?: number;
  holoChance?: number;
}): { isFoil: boolean; finish: CardFinish } {
  const dmChance = opts?.allowDarkMatter
    ? (typeof opts.darkMatterChance === "number" ? opts.darkMatterChance : 0.5) / 100
    : 0;
  if (dmChance > 0 && Math.random() < dmChance) {
    return { isFoil: true, finish: "darkMatter" };
  }
  const prismChance = opts?.allowPrismatic
    ? (typeof opts.prismaticChance === "number" ? opts.prismaticChance : 2) / 100
    : 0;
  if (prismChance > 0 && Math.random() < prismChance) {
    return { isFoil: true, finish: "prismatic" };
  }
  const effectiveHoloChance = typeof opts?.holoChance === "number" ? opts.holoChance / 100 : FOIL_CHANCE;
  if (Math.random() < effectiveHoloChance) {
    return { isFoil: true, finish: "holo" };
  }
  return { isFoil: false, finish: "normal" };
}

function assignRarity(popularity: number): Rarity {
  if (popularity >= 40) return "legendary";
  if (popularity >= 25) return "epic";
  if (popularity >= 15) return "rare";
  return "uncommon";
}

async function fetchTmdbCredits(tmdbId: number): Promise<{
  cast: { id: number; name: string; character: string; profile_path: string | null; popularity: number }[];
  crew: { id: number; name: string; job: string; profile_path: string | null; popularity?: number }[];
  year: string;
  title: string;
} | null> {
  if (!TMDB_API_KEY) return null;
  const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("append_to_response", "credits");
  url.searchParams.set("language", "en-US");
  const res = await fetch(url.toString());
  const m = await res.json();
  if (!res.ok || !m.credits?.cast) return null;
  const year = m.release_date ? m.release_date.slice(0, 4) : "";
  return {
    cast: m.credits.cast,
    crew: m.credits.crew ?? [],
    year,
    title: m.title || "",
  };
}

/** Returns true if the character name is generic/uncredited (not a named character). */
export function isGenericCharacterName(name: string): boolean {
  const s = (name || "").trim().toLowerCase();
  if (!s || s === "unknown") return true;
  const exact = new Set([
    "man", "woman", "boy", "girl", "guy", "kid", "mom", "dad",
    "himself", "herself", "extra", "voice", "narrator", "witness", "socialite",
    "guard", "guards", "soldier", "cook", "waiter", "waitress", "driver", "pilot", "patient",
    "reporter", "journalist", "doctor", "nurse", "cop", "officer", "agent",
    "host", "hostess", "bartender", "customer", "passenger", "stranger", "crowd",
    "maid", "butler", "servant", "teacher", "student", "bystander", "neighbor",
    "clerk", "receptionist", "secretary", "assistant", "bodyguard", "thug",
    "announcer", "commentator", "anchor", "interviewer", "photographer", "cameraman",
  ]);
  if (exact.has(s)) return true;
  if (s.includes("(uncredited)")) return true;
  const prefixes = [
    "man ", "woman ", "boy ", "girl ", "guy ", "kid ", "mom ", "dad ",
    "man in", "woman in", "man at", "woman at", "boy in", "girl in",
    "extra ", "random ", "generic ", "uncredited ", "voice ",
    "maiden ", "nobleman ", "nobleman's ", "socialite ", "witness ",
  ];
  if (prefixes.some((p) => s.startsWith(p))) return true;
  return false;
}

export async function buildCharacterPool(): Promise<CharacterPortrayal[]> {
  const winners = getWinners().filter((w) => w.tmdbId);
  const existing = getCharacterPool();
  const byKey = new Map<string, CharacterPortrayal>();

  // Preserve custom cards
  for (const c of existing.filter((e) => e.characterId?.startsWith("custom-") && e.profilePath?.trim())) {
    byKey.set(c.characterId, { ...c, cardType: (c.cardType ?? "actor") as CharacterPortrayal["cardType"] });
  }

  for (const winner of winners) {
    const tmdbId = winner.tmdbId!;
    const movieTitle = winner.movieTitle;
    const data = await fetchTmdbCredits(tmdbId);
    await delay(TMDB_DELAY_MS);
    if (!data?.cast?.length) continue;

    // Add top 6 most notable cast (TMDB cast order = billing order)
    let added = 0;
    for (const c of data.cast) {
      if (added >= CARDS_PER_MOVIE) break;
      if (!c.profile_path?.trim()) continue;
      const characterName = (c.character || "").trim() || "Unknown";
      if (isGenericCharacterName(characterName)) continue;
      const key = `actor-${c.id}-${tmdbId}`;
      if (byKey.has(key)) continue;
      const actorName = (c.name || "").trim() || "Unknown";
      const popularity = typeof c.popularity === "number" ? c.popularity : 0;
      const rarity = assignRarity(popularity);
      byKey.set(key, {
        characterId: key,
        tmdbPersonId: c.id,
        actorName,
        characterName,
        profilePath: `${TMDB_IMG}/w500${c.profile_path}`,
        movieTmdbId: tmdbId,
        movieTitle,
        popularity,
        rarity,
        cardType: "actor",
      });
      added++;
    }
  }

  const pool = Array.from(byKey.values());
  saveCharacterPool(pool);
  return pool;
}

/** Add up to 6 actor cards for a single winner to the main pool. Used by rebuild; new winners use addPendingPoolEntriesForWinner. */
export async function addPoolEntriesForWinner(winner: Winner): Promise<void> {
  if (!winner.tmdbId) return;
  const tmdbId = winner.tmdbId;
  const movieTitle = winner.movieTitle;

  const existing = getCharacterPool();
  const existingKeys = new Set(existing.map((c) => c.characterId).filter(Boolean));

  const data = await fetchTmdbCredits(tmdbId);
  await delay(TMDB_DELAY_MS);
  if (!data?.cast?.length) return;

  const newEntries: CharacterPortrayal[] = [];
  let added = 0;
  for (const c of data.cast) {
    if (added >= CARDS_PER_MOVIE) break;
    if (!c.profile_path?.trim()) continue;
    const characterName = (c.character || "").trim() || "Unknown";
    if (isGenericCharacterName(characterName)) continue;
    const key = `actor-${c.id}-${tmdbId}`;
    if (existingKeys.has(key)) continue;
    const actorName = (c.name || "").trim() || "Unknown";
    const popularity = typeof c.popularity === "number" ? c.popularity : 0;
    const rarity = assignRarity(popularity);
    newEntries.push({
      characterId: key,
      tmdbPersonId: c.id,
      actorName,
      characterName,
      profilePath: `${TMDB_IMG}/w500${c.profile_path}`,
      movieTmdbId: tmdbId,
      movieTitle,
      popularity,
      rarity,
      cardType: "actor",
    });
    existingKeys.add(key);
    added++;
  }

  if (newEntries.length > 0) {
    saveCharacterPool([...existing, ...newEntries]);
  }
}

/** Add up to 6 actor cards for a winner to the pending pool (admin must "push to pool" to add to main pool). */
export async function addPendingPoolEntriesForWinner(winner: Winner): Promise<void> {
  if (!winner.tmdbId) return;
  const tmdbId = winner.tmdbId;
  const movieTitle = winner.movieTitle;
  const winnerId = winner.id;

  const mainPool = getCharacterPool();
  const pending = getPendingPool();
  const existingKeys = new Set(mainPool.map((c) => c.characterId).filter(Boolean));
  for (const c of pending[winnerId] ?? []) {
    existingKeys.add(c.characterId);
  }

  const data = await fetchTmdbCredits(tmdbId);
  await delay(TMDB_DELAY_MS);
  if (!data?.cast?.length) return;

  const newEntries: CharacterPortrayal[] = [];
  let added = 0;
  for (const c of data.cast) {
    if (added >= CARDS_PER_MOVIE) break;
    if (!c.profile_path?.trim()) continue;
    const characterName = (c.character || "").trim() || "Unknown";
    if (isGenericCharacterName(characterName)) continue;
    const key = `actor-${c.id}-${tmdbId}`;
    if (existingKeys.has(key)) continue;
    const actorName = (c.name || "").trim() || "Unknown";
    const popularity = typeof c.popularity === "number" ? c.popularity : 0;
    const rarity = assignRarity(popularity);
    newEntries.push({
      characterId: key,
      tmdbPersonId: c.id,
      actorName,
      characterName,
      profilePath: `${TMDB_IMG}/w500${c.profile_path}`,
      movieTmdbId: tmdbId,
      movieTitle,
      popularity,
      rarity,
      cardType: "actor",
    });
    existingKeys.add(key);
    added++;
  }

  if (newEntries.length > 0) {
    const prev = pending[winnerId] ?? [];
    savePendingPool({ ...pending, [winnerId]: [...prev, ...newEntries] });
  }
}

/** Remove actor/character pool entries with generic character names. Fast, no TMDB calls. */
export function cleanupGenericPoolEntries(): CharacterPortrayal[] {
  const pool = getCharacterPool();
  const filtered = pool.filter((c) => {
    if (c.cardType === "actor" || c.cardType === "character") {
      return !isGenericCharacterName(c.characterName);
    }
    return true;
  });
  saveCharacterPool(filtered);
  return filtered;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Default pack-based drop chances: 1% legendary, 10% epic, 25% rare, 64% uncommon. */
const DEFAULT_RARITY_WEIGHTS = { legendary: 1, epic: 10, rare: 25, uncommon: 64 };
const PACK_TIERS = ["legendary", "epic", "rare", "uncommon"] as const;
type PackTier = (typeof PACK_TIERS)[number];

const CASCADE_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon"];

function normRarity(r: string | undefined): Rarity {
  const s = (r === "common" ? "uncommon" : r) || "uncommon";
  if (s === "uncommon" || s === "rare" || s === "epic" || s === "legendary") return s;
  return "uncommon";
}

/** Build cumulative probability array from weight map (values don't need to sum to 100 — they're normalised). */
function buildCumulativeFromWeights(weights: { legendary: number; epic: number; rare: number; uncommon: number }): readonly number[] {
  const ordered = [weights.legendary, weights.epic, weights.rare, weights.uncommon];
  const total = ordered.reduce((s, v) => s + v, 0) || 1;
  const cumulative: number[] = [];
  let sum = 0;
  for (const w of ordered) {
    sum += w / total;
    cumulative.push(sum);
  }
  cumulative[cumulative.length - 1] = 1; // ensure last bucket catches everything
  return cumulative;
}

/** One roll per pack: returns which tier this pack is (determines best card in pack). */
function rollPackTier(weights?: { legendary: number; epic: number; rare: number; uncommon: number }): PackTier {
  const cumulative = buildCumulativeFromWeights(weights ?? DEFAULT_RARITY_WEIGHTS);
  const r = Math.random();
  const idx = cumulative.findIndex((c) => r < c);
  return PACK_TIERS[idx >= 0 ? idx : PACK_TIERS.length - 1];
}

/** Returns 5 rarity slots for this pack. Fill slots (non-feature) are rare/uncommon; 20% rare, 80% uncommon. */
function getRaritySlotsForPack(tier: PackTier): Rarity[] {
  const fillRarity = (): Rarity => (Math.random() < 0.2 ? "rare" : "uncommon");
  switch (tier) {
    case "legendary":
      return ["legendary", fillRarity(), fillRarity(), fillRarity(), fillRarity()];
    case "epic":
      return ["epic", fillRarity(), fillRarity(), fillRarity(), fillRarity()];
    case "rare":
      return ["rare", "uncommon", "uncommon", "uncommon", "uncommon"];
    case "uncommon":
      return ["uncommon", "uncommon", "uncommon", "uncommon", "uncommon"];
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick one card from pool with the requested rarity; cascade to lower tier if none available. Legendaries excluded by slot (main + alt-art 1-of-1). */
function pickCardOfRarity(
  pool: CharacterPortrayal[],
  wantedRarity: Rarity,
  ownedLegendarySlotIds: Set<string>
): CharacterPortrayal {
  const startIdx = CASCADE_ORDER.indexOf(wantedRarity);
  for (let i = startIdx; i < CASCADE_ORDER.length; i++) {
    const t = CASCADE_ORDER[i];
    let subset = pool.filter((c) => normRarity(c.rarity) === t);
    if (t === "legendary") subset = subset.filter((c) => !ownedLegendarySlotIds.has(c.altArtOfCharacterId ?? c.characterId));
    if (subset.length > 0) {
      return subset[Math.floor(Math.random() * subset.length)];
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buyPack(
  userId: string,
  packId?: string
): { success: boolean; cards?: ReturnType<typeof addCard>[]; error?: string } {
  migrateCommonToUncommon();
  const allPacks = getPacks();
  const selectedPack: Pack | undefined = packId
    ? allPacks.find((p) => p.id === packId && p.isActive)
    : undefined;

  if (packId && !selectedPack) {
    return { success: false, error: "Pack not found" };
  }

  const effectivePackId = selectedPack?.id ?? "default";
  const maxPerWindow = selectedPack?.maxPurchasesPerDay;
  if (typeof maxPerWindow === "number" && maxPerWindow > 0) {
    const restockOptions = {
      restockIntervalHours: selectedPack?.restockIntervalHours,
      restockHourUtc: selectedPack?.restockHourUtc,
      restockMinuteUtc: selectedPack?.restockMinuteUtc,
    };
    const count = getPackPurchasesInWindow(userId, effectivePackId, restockOptions);
    if (count >= maxPerWindow) {
      const intervalHours = selectedPack?.restockIntervalHours;
      const limitDesc =
        typeof intervalHours === "number" && intervalHours > 0
          ? `${maxPerWindow} per ${intervalHours} hour${intervalHours !== 1 ? "s" : ""}`
          : `${maxPerWindow} per day`;
      return { success: false, error: `Limit reached for this pack (${limitDesc}).` };
    }
  }

  const basePrice = selectedPack?.price ?? PACK_PRICE;
  const price =
    selectedPack?.discounted &&
    typeof selectedPack.discountPercent === "number" &&
    selectedPack.discountPercent > 0
      ? Math.floor(basePrice * (1 - selectedPack.discountPercent / 100))
      : basePrice;
  const cardsPerPack = selectedPack?.cardsPerPack ?? CARDS_PER_PACK;

  const balance = getCredits(userId);
  if (balance < price) {
    return { success: false, error: "Not enough credits" };
  }

  const allowedRarities = selectedPack?.allowedRarities;
  // Character Pack must never drop Boys (character); enforce in code regardless of stored config.
  let allowedCardTypes = selectedPack?.allowedCardTypes;
  if (selectedPack?.name?.toLowerCase().trim() === "character pack") {
    allowedCardTypes = (allowedCardTypes ?? []).filter((t) => t !== "character");
    if (allowedCardTypes.length === 0) allowedCardTypes = ["actor"];
  }

  const norm = (r: string | undefined) => (r === "common" ? "uncommon" : r) || "uncommon";

  const fullPool = getCharacterPool()
    .filter((c) => c.profilePath?.trim())
    .filter((c) => {
      const rarityOk = !allowedRarities || allowedRarities.includes(norm(c.rarity) as any);
      const type = (c.cardType ?? "actor") as NonNullable<typeof c.cardType>;
      const typeOk = !allowedCardTypes || allowedCardTypes.length === 0 || allowedCardTypes.includes(type as any);
      return rarityOk && typeOk;
    });
  const ownedLegendarySlotIds = getOwnedLegendarySlotIds();
  const ownedSlotsThisPack = new Set(ownedLegendarySlotIds);

  function availablePool(): CharacterPortrayal[] {
    return fullPool.filter(
      (c) => c.rarity !== "legendary" || !ownedSlotsThisPack.has(c.altArtOfCharacterId ?? c.characterId)
    );
  }

  let pool = availablePool();
  if (pool.length === 0) {
    const isBoysOnly =
      allowedCardTypes?.length === 1 && allowedCardTypes[0] === "character";
    const error = isBoysOnly
      ? "Boys pool too small. Add more Boys cards in Admin."
      : "Character pool too small. Add more winning movies.";
    return { success: false, error };
  }
  const cardsToGive = Math.min(pool.length, cardsPerPack);

  const deducted = deductCredits(userId, price, "pack_purchase", {
    packId: selectedPack?.id ?? "default",
  });
  if (!deducted) return { success: false, error: "Failed to deduct credits" };

  // Resolve drop weights: custom from pack config, or global defaults.
  // Each card independently rolls its rarity from the weight distribution.
  let weights: { legendary: number; epic: number; rare: number; uncommon: number } = DEFAULT_RARITY_WEIGHTS;
  if (packId) {
    const rawPacks = getPacksRaw();
    const rawPack = rawPacks.find((p) => p.id === packId);
    const rw = rawPack?.rarityWeights;
    if (rw && typeof rw === "object") {
      const safeNum = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
      const l = safeNum(rw.legendary);
      const e = safeNum(rw.epic);
      const r = safeNum(rw.rare);
      const u = safeNum(rw.uncommon);
      if (l + e + r + u > 0) weights = { legendary: l, epic: e, rare: r, uncommon: u };
    }
  }

  // Zero out weights for rarities absent from the pool so rolls land on available tiers
  const poolCounts = { legendary: 0, epic: 0, rare: 0, uncommon: 0 };
  availablePool().forEach((c) => {
    const t = normRarity(c.rarity);
    if (t in poolCounts) poolCounts[t as keyof typeof poolCounts]++;
  });
  const adjustedWeights = {
    legendary: poolCounts.legendary > 0 ? weights.legendary : 0,
    epic: poolCounts.epic > 0 ? weights.epic : 0,
    rare: poolCounts.rare > 0 ? weights.rare : 0,
    uncommon: poolCounts.uncommon > 0 ? weights.uncommon : 0,
  };
  const adjSum = adjustedWeights.legendary + adjustedWeights.epic + adjustedWeights.rare + adjustedWeights.uncommon;
  const rollWeights = adjSum > 0 ? adjustedWeights : weights;

  // Per-pack model: one roll = hit tier (the set %s are chance per pack for that hit). Rest = bulk (20% rare, 80% uncommon).
  const hitTier = rollPackTier(rollWeights);
  const bulkRarity = (): Rarity => (Math.random() < 0.2 ? "rare" : "uncommon");
  const hitSlot = hitTier;
  const bulkSlots: Rarity[] = Array.from({ length: Math.max(0, cardsToGive - 1) }, bulkRarity);
  let raritySlots: Rarity[] = [hitSlot, ...bulkSlots];
  raritySlots = shuffleArray(raritySlots);

  const cards: ReturnType<typeof addCard>[] = [];
  const pickedCharacterIds = new Set<string>();

  for (let i = 0; i < cardsToGive; i++) {
    pool = availablePool().filter((c) => !pickedCharacterIds.has(c.characterId));
    if (pool.length === 0) break;

    const wantedRarity = raritySlots[i];
    const char = pickCardOfRarity(pool, wantedRarity, ownedSlotsThisPack);
    const packAllowsPrismatic = !!selectedPack?.allowPrismatic;
    const packAllowsDarkMatter = !!selectedPack?.allowDarkMatter;
    const packPrismaticChance = selectedPack?.prismaticChance;
    const packDarkMatterChance = selectedPack?.darkMatterChance;
    const packHoloChance = selectedPack?.holoChance;
    const { isFoil, finish } = rollCardFinish({
      allowPrismatic: packAllowsPrismatic,
      allowDarkMatter: packAllowsDarkMatter,
      prismaticChance: packAllowsPrismatic && typeof packPrismaticChance === "number" ? packPrismaticChance : undefined,
      darkMatterChance: packAllowsDarkMatter && typeof packDarkMatterChance === "number" ? packDarkMatterChance : undefined,
      holoChance: typeof packHoloChance === "number" ? packHoloChance : undefined,
    });
    // Use the rolled rarity so the granted rate exactly matches the set weight,
    // even when the pool is too small and the character's natural rarity differs.
    const grantedRarity = wantedRarity;
    const card = addCard({
      userId,
      characterId: char.characterId,
      rarity: grantedRarity,
      isFoil,
      finish,
      actorName: char.actorName,
      characterName: char.characterName,
      movieTitle: char.movieTitle,
      movieTmdbId: char.movieTmdbId,
      profilePath: char.profilePath,
      cardType: char.cardType ?? "actor",
    });
    cards.push(card);
    pickedCharacterIds.add(char.characterId);
    if (grantedRarity === "legendary") {
      ownedSlotsThisPack.add(char.altArtOfCharacterId ?? char.characterId);
    }
  }

  return { success: true, cards };
}

/** Trade up: consume 4 cards of same rarity for 1 of next rarity. Epic→legendary: 33% legendary card, 67% 100 credits. */
export function tradeUp(
  userId: string,
  cardIds: string[]
): { success: boolean; card?: ReturnType<typeof addCard>; credits?: number; error?: string } {
  if (!Array.isArray(cardIds) || cardIds.length !== 4) {
    return { success: false, error: "Select exactly 4 cards" };
  }
  const uniqueIds = [...new Set(cardIds)];
  if (uniqueIds.length !== 4) return { success: false, error: "Select 4 different cards" };

  const listedCardIds = new Set(getListings().map((l) => l.cardId));

  const selected: ReturnType<typeof getCards> = [];
  for (const id of uniqueIds) {
    const card = getCardById(id);
    if (!card || card.userId !== userId) return { success: false, error: "You don't own one or more of these cards" };
    if (listedCardIds.has(id)) return { success: false, error: "Cannot trade up cards listed on the marketplace" };
    selected.push(card);
  }

  const rarities = selected.map((c) => c.rarity);
  const first = rarities[0];
  if (rarities.some((r) => r !== first)) return { success: false, error: "All 4 cards must be the same rarity" };

  const cardTypes = selected.map((c) => (c.cardType ?? "actor") as NonNullable<typeof c.cardType>);
  const inputCardType = cardTypes[0];
  if (cardTypes.some((t) => t !== inputCardType))
    return { success: false, error: "Cannot mix Boys and actor cards when trading up" };

  const TRADE_UP_MAP: Record<string, "rare" | "epic" | "legendary"> = {
    uncommon: "rare",
    rare: "epic",
    epic: "legendary",
  };
  const targetRarity = TRADE_UP_MAP[first];
  if (!targetRarity) return { success: false, error: "Cannot trade up legendary cards" };

  // Epic→legendary: 33% legendary card, 67% 100 credits. Roll first so credits path doesn't require pool.
  const EPIC_TO_LEGENDARY_LEGENDARY_CHANCE = 0.33;
  const giveCredits = targetRarity === "legendary" && Math.random() >= EPIC_TO_LEGENDARY_LEGENDARY_CHANCE;

  if (giveCredits) {
    for (const c of selected) removeCard(c.id);
    const credits = getCreditSettings().tradeUpLegendaryFailureCredits;
    addCredits(userId, credits, "trade_up_epic", { source: "epic_trade_up" });
    return { success: true, credits };
  }

  const pool = getCharacterPool()
    .filter((c) => c.profilePath?.trim())
    .filter((c) => (c.cardType ?? "actor") === inputCardType);
  const norm = (r: string | undefined) => (r === "common" ? "uncommon" : r) || "uncommon";
  const CASCADE: ("rare" | "epic" | "legendary")[] =
    targetRarity === "rare" ? ["rare", "epic", "legendary"] : targetRarity === "epic" ? ["epic", "legendary"] : ["legendary"];
  const ownedLegendarySlotIds = getOwnedLegendarySlotIds();
  let subset: typeof pool = [];
  for (const tier of CASCADE) {
    subset = pool.filter((c) => norm(c.rarity) === tier);
    if (tier === "legendary") subset = subset.filter((c) => !ownedLegendarySlotIds.has(c.altArtOfCharacterId ?? c.characterId));
    if (subset.length > 0) break;
  }
  if (subset.length === 0) return { success: false, error: `No ${targetRarity}+ cards available in the character pool` };

  for (const c of selected) removeCard(c.id);
  const char = subset[Math.floor(Math.random() * subset.length)];
  const { isFoil, finish } = rollCardFinish();
  const newCard = addCard({
    userId,
    characterId: char.characterId,
    rarity: char.rarity,
    isFoil,
    finish,
    actorName: char.actorName,
    characterName: char.characterName,
    movieTitle: char.movieTitle,
    movieTmdbId: char.movieTmdbId,
    profilePath: char.profilePath,
    cardType: char.cardType ?? "actor",
  });

  return { success: true, card: newCard };
}

/** Legendary reroll: consume 2 legendaries, reroll into a different legendary character. */
export function legendaryReroll(
  userId: string,
  cardIds: string[]
): { success: boolean; card?: ReturnType<typeof addCard>; error?: string } {
  if (!Array.isArray(cardIds) || cardIds.length !== 2) {
    return { success: false, error: "Select exactly 2 legendary cards" };
  }
  const uniqueIds = [...new Set(cardIds)];
  if (uniqueIds.length !== 2) return { success: false, error: "Select 2 different cards" };

  const listedCardIds = new Set(getListings().map((l) => l.cardId));

  const selected: ReturnType<typeof getCards> = [];
  for (const id of uniqueIds) {
    const card = getCardById(id);
    if (!card || card.userId !== userId) return { success: false, error: "You don't own one or more of these cards" };
    if (listedCardIds.has(id)) return { success: false, error: "Cannot reroll cards listed on the marketplace" };
    if (card.rarity !== "legendary") return { success: false, error: "Both cards must be legendary" };
    selected.push(card);
  }

  const cardTypes = selected.map((c) => (c.cardType ?? "actor") as NonNullable<typeof c.cardType>);
  const inputCardType = cardTypes[0];
  if (cardTypes.some((t) => t !== inputCardType))
    return { success: false, error: "Cannot mix Boys and actor cards" };

  const pool = getCharacterPool()
    .filter((c) => c.profilePath?.trim())
    .filter((c) => (c.cardType ?? "actor") === inputCardType);
  const norm = (r: string | undefined) => (r === "common" ? "uncommon" : r) || "uncommon";
  const ownedLegendarySlotIds = getOwnedLegendarySlotIds();
  const inputCharacterIds = new Set(selected.map((c) => c.characterId));
  let subset = pool
    .filter((c) => norm(c.rarity) === "legendary")
    .filter((c) => !ownedLegendarySlotIds.has(c.altArtOfCharacterId ?? c.characterId))
    .filter((c) => !inputCharacterIds.has(c.characterId));

  if (subset.length === 0) {
    subset = pool
      .filter((c) => norm(c.rarity) === "legendary")
      .filter((c) => !inputCharacterIds.has(c.characterId));
  }
  if (subset.length === 0) return { success: false, error: "No other legendary cards available in the pool" };

  for (const c of selected) removeCard(c.id);
  const char = subset[Math.floor(Math.random() * subset.length)];
  const { isFoil, finish } = rollCardFinish();
  const newCard = addCard({
    userId,
    characterId: char.characterId,
    rarity: char.rarity,
    isFoil,
    finish,
    actorName: char.actorName,
    characterName: char.characterName,
    movieTitle: char.movieTitle,
    movieTmdbId: char.movieTmdbId,
    profilePath: char.profilePath,
    cardType: char.cardType ?? "actor",
  });

  return { success: true, card: newCard };
}

/** Character pool entries for a movie (tmdbId). Returns all entries so sets with more than 6 cards and newly added cards are fully represented. */
export function getPoolEntriesForMovie(tmdbId: number): CharacterPortrayal[] {
  return getCharacterPool().filter((c) => c.movieTmdbId === tmdbId && c.profilePath?.trim());
}

/** Distinct characterIds the user owns for a given movie. */
export function getUserCollectedCharacterIdsForMovie(userId: string, tmdbId: number): Set<string> {
  const cards = getCards(userId).filter((c) => c.movieTmdbId === tmdbId);
  return new Set(cards.map((c) => c.characterId));
}

/** Distinct characterIds the user owns as foil for a given movie (at least one foil card per character). */
export function getUserCollectedFoilCharacterIdsForMovie(userId: string, tmdbId: number): Set<string> {
  const cards = getCards(userId).filter((c) => c.movieTmdbId === tmdbId && c.isFoil);
  return new Set(cards.map((c) => c.characterId));
}

/** Distinct characterIds (slots) the user has discovered in the codex for a given movie. Main slots: regular or holo. Alt-art slot: alt-art codex. */
export function getUserCodexCharacterIdsForMovie(userId: string, tmdbId: number): Set<string> {
  const regularIds = new Set(getCodexUnlockedCharacterIds(userId));
  const holoIds = new Set(getCodexUnlockedHoloCharacterIds(userId));
  const altArtIds = new Set(getCodexUnlockedAltArtCharacterIds(userId));
  const pool = getPoolEntriesForMovie(tmdbId);
  const slotIds = new Set(pool.map((c) => c.altArtOfCharacterId ?? c.characterId));
  const result = new Set<string>();
  for (const slotId of slotIds) {
    if (regularIds.has(slotId) || holoIds.has(slotId)) {
      result.add(slotId);
      continue;
    }
    const altEntry = pool.find((p) => p.altArtOfCharacterId === slotId);
    if (altEntry && altArtIds.has(altEntry.characterId)) result.add(slotId);
  }
  return result;
}

/** True if user has discovered all slots for the winner's movie in the codex (badge = codex completion). Works for sets of any size. */
export function hasCompletedMovie(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length === 0) return false;
  const discovered = getUserCodexCharacterIdsForMovie(userId, winner.tmdbId);
  const required = new Set(pool.map((c) => c.altArtOfCharacterId ?? c.characterId));
  for (const id of required) {
    if (!discovered.has(id)) return false;
  }
  return true;
}

/** True if user owns all pool characterIds for the winner's movie, each as foil. Works for sets of any size. */
export function hasCompletedMovieHolo(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length === 0) return false;
  const ownedFoil = getUserCollectedFoilCharacterIdsForMovie(userId, winner.tmdbId);
  const required = new Set(pool.map((c) => c.characterId));
  for (const id of required) {
    if (!ownedFoil.has(id)) return false;
  }
  return true;
}

/** True if every main pool entry for the winner's movie has its holo slot filled in the codex. Main or alt-art holo counts for each slot. */
export function hasCompletedMovieHoloCodex(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length === 0) return false;
  const holoIds = new Set(getCodexUnlockedHoloCharacterIds(userId));
  const mainEntries = pool.filter((c) => (c.altArtOfCharacterId ?? null) == null && (c.cardType ?? "actor") !== "character");
  if (mainEntries.length === 0) return false;
  for (const entry of mainEntries) {
    const slotFilledAsHolo =
      holoIds.has(entry.characterId) ||
      pool.some((p) => p.altArtOfCharacterId === entry.characterId && holoIds.has(p.characterId));
    if (!slotFilledAsHolo) return false;
  }
  return true;
}

/** Winner IDs for which the user has collected the full set (all codex slots for that movie). */
export function getCompletedWinnerIds(userId: string): string[] {
  const winners = getWinners().filter((w) => w.tmdbId);
  return winners.filter((w) => hasCompletedMovie(userId, w.id)).map((w) => w.id);
}

/** Winner IDs for which the user has the full holo set in the codex (all main slots holo-upgraded). */
export function getCompletedHoloWinnerIds(userId: string): string[] {
  const winners = getWinners().filter((w) => w.tmdbId);
  return winners.filter((w) => hasCompletedMovieHoloCodex(userId, w.id)).map((w) => w.id);
}

/** True if every main pool entry for the winner's movie has its prismatic slot filled in the codex. Main or alt-art prismatic counts for each slot. */
export function hasCompletedMoviePrismaticCodex(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length === 0) return false;
  const prismaticIds = new Set(getCodexUnlockedPrismaticCharacterIds(userId));
  const mainEntries = pool.filter((c) => (c.altArtOfCharacterId ?? null) == null && (c.cardType ?? "actor") !== "character");
  if (mainEntries.length === 0) return false;
  for (const entry of mainEntries) {
    const slotFilledAsPrismatic =
      prismaticIds.has(entry.characterId) ||
      pool.some((p) => p.altArtOfCharacterId === entry.characterId && prismaticIds.has(p.characterId));
    if (!slotFilledAsPrismatic) return false;
  }
  return true;
}

/** True if every main pool entry for the winner's movie has its dark matter slot filled in the codex. Main or alt-art dark matter counts for each slot. */
export function hasCompletedMovieDarkMatterCodex(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length === 0) return false;
  const darkMatterIds = new Set(getCodexUnlockedDarkMatterCharacterIds(userId));
  const mainEntries = pool.filter((c) => (c.altArtOfCharacterId ?? null) == null && (c.cardType ?? "actor") !== "character");
  if (mainEntries.length === 0) return false;
  for (const entry of mainEntries) {
    const slotFilledAsDarkMatter =
      darkMatterIds.has(entry.characterId) ||
      pool.some((p) => p.altArtOfCharacterId === entry.characterId && darkMatterIds.has(p.characterId));
    if (!slotFilledAsDarkMatter) return false;
  }
  return true;
}

/** Winner IDs for which the user has the full prismatic set in the codex. */
export function getCompletedPrismaticWinnerIds(userId: string): string[] {
  const winners = getWinners().filter((w) => w.tmdbId);
  return winners.filter((w) => hasCompletedMoviePrismaticCodex(userId, w.id)).map((w) => w.id);
}

/** Winner IDs for which the user has the full dark matter set in the codex. */
export function getCompletedDarkMatterWinnerIds(userId: string): string[] {
  const winners = getWinners().filter((w) => w.tmdbId);
  return winners.filter((w) => hasCompletedMovieDarkMatterCodex(userId, w.id)).map((w) => w.id);
}

export interface BadgeLossEntry {
  winnerId: string;
  movieTitle: string;
  isHolo: boolean;
}

/** Returns badges (normal and/or Holo) the user would lose if the given card IDs were removed. */
export function getBadgesLostIfCardsRemoved(
  userId: string,
  cardIds: string[]
): BadgeLossEntry[] {
  const cards = getCards(userId);
  const completed = new Set(getCompletedWinnerIds(userId));
  const completedHolo = new Set(getCompletedHoloWinnerIds(userId));
  const cardIdSet = new Set(cardIds);
  const toRemove = cardIds
    .map((id) => getCardById(id))
    .filter((c): c is NonNullable<typeof c> => c != null && c.userId === userId);
  if (toRemove.length === 0) return [];

  const winners = getWinners().filter((w) => w.tmdbId);
  const result: BadgeLossEntry[] = [];
  const seenWinner = new Set<string>();

  for (const card of toRemove) {
    const winner = winners.find((w) => w.tmdbId === card.movieTmdbId);
    if (!winner || winner.tmdbId == null || seenWinner.has(winner.id)) continue;
    // Only consider winners where the user currently has the badge unlocked
    const hadNormal = completed.has(winner.id);
    const hadHolo = completedHolo.has(winner.id);
    if (!hadNormal && !hadHolo) continue;
    seenWinner.add(winner.id);

    const pool = getPoolEntriesForMovie(winner.tmdbId);
    if (pool.length < 6) continue;

    const required = new Set(pool.map((c) => c.characterId));
    const remainingCards = cards.filter((c) => c.movieTmdbId === winner.tmdbId && !cardIdSet.has(c.id));
    const remainingChars = new Set(remainingCards.map((c) => c.characterId));
    const remainingFoilChars = new Set(
      remainingCards.filter((c) => c.isFoil).map((c) => c.characterId)
    );

    let wouldLoseNormal = false;
    if (hadNormal) {
      for (const id of required) {
        if (!remainingChars.has(id)) {
          wouldLoseNormal = true;
          break;
        }
      }
    }
    let wouldLoseHolo = false;
    if (hadHolo) {
      for (const id of required) {
        if (!remainingFoilChars.has(id)) {
          wouldLoseHolo = true;
          break;
        }
      }
    }

    if (wouldLoseNormal) result.push({ winnerId: winner.id, movieTitle: winner.movieTitle, isHolo: false });
    if (wouldLoseHolo) result.push({ winnerId: winner.id, movieTitle: winner.movieTitle, isHolo: true });
  }

  return result;
}

/** Displayed badge for a user (single badge they chose to show). Used by APIs to attach to user payloads.
 * Returns the highest tier the user has completed for that movie.
 */
export function getDisplayedBadgeForUser(userId: string): {
  winnerId: string;
  movieTitle: string;
  isHolo: boolean;
  /** Highest completed finish tier for this badge: "normal" | "holo" | "prismatic" | "darkMatter". */
  badgeTier: CardFinish;
} | null {
  const profile = getProfile(userId);
  const displayedWinnerId = profile.displayedBadgeWinnerId ?? null;
  if (!displayedWinnerId) return null;
  const completed = getCompletedWinnerIds(userId);
  if (!completed.includes(displayedWinnerId)) return null;
  const completedHolo = getCompletedHoloWinnerIds(userId);
  const completedPrismatic = getCompletedPrismaticWinnerIds(userId);
  const completedDarkMatter = getCompletedDarkMatterWinnerIds(userId);
  const winners = getWinners();
  const w = winners.find((x) => x.id === displayedWinnerId);

  let badgeTier: CardFinish = "normal";
  if (completedHolo.includes(displayedWinnerId)) badgeTier = "holo";
  if (completedPrismatic.includes(displayedWinnerId)) badgeTier = "prismatic";
  if (completedDarkMatter.includes(displayedWinnerId)) badgeTier = "darkMatter";

  return {
    winnerId: displayedWinnerId,
    movieTitle: w?.movieTitle ?? "Unknown",
    isHolo: completedHolo.includes(displayedWinnerId),
    badgeTier,
  };
}

export { PACK_PRICE, CARDS_PER_PACK };
