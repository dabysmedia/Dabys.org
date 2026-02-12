import {
  getWinners,
  getCharacterPool,
  saveCharacterPool,
  addCard,
  deductCredits,
  getCredits,
  addCredits,
  getOwnedLegendaryCharacterIds,
  migrateCommonToUncommon,
  getCards,
  getCardById,
  removeCard,
  getListings,
  getPacks,
  getProfile,
} from "@/lib/data";
import type { CharacterPortrayal, Winner, Pack } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p";
const PACK_PRICE = 50;
const CARDS_PER_PACK = 5;
const FOIL_CHANCE = 0.08;
const CARDS_PER_MOVIE = 6;
const TMDB_DELAY_MS = 100;

type Rarity = "uncommon" | "rare" | "epic" | "legendary";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

/** Add up to 6 actor cards for a single winner to the pool. Fire-and-forget from API routes. */
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

/** Pack-based drop chances: 1% legendary, 10% epic, 25% rare, 64% all uncommon. */
const PACK_TIER_CUMULATIVE = [0.01, 0.11, 0.36, 1] as const;
const PACK_TIERS = ["legendary", "epic", "rare", "uncommon"] as const;
type PackTier = (typeof PACK_TIERS)[number];

const CASCADE_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon"];

function normRarity(r: string | undefined): Rarity {
  const s = (r === "common" ? "uncommon" : r) || "uncommon";
  if (s === "uncommon" || s === "rare" || s === "epic" || s === "legendary") return s;
  return "uncommon";
}

/** One roll per pack: returns which tier this pack is (determines best card in pack). */
function rollPackTier(): PackTier {
  const r = Math.random();
  const idx = PACK_TIER_CUMULATIVE.findIndex((c) => r < c);
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

/** Pick one card from pool with the requested rarity; cascade to lower tier if none available. */
function pickCardOfRarity(
  pool: CharacterPortrayal[],
  wantedRarity: Rarity,
  ownedLegendaryIds: Set<string>
): CharacterPortrayal {
  const startIdx = CASCADE_ORDER.indexOf(wantedRarity);
  for (let i = startIdx; i < CASCADE_ORDER.length; i++) {
    const t = CASCADE_ORDER[i];
    let subset = pool.filter((c) => normRarity(c.rarity) === t);
    if (t === "legendary") subset = subset.filter((c) => !ownedLegendaryIds.has(c.characterId));
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

  const price = selectedPack?.price ?? PACK_PRICE;
  const cardsPerPack = selectedPack?.cardsPerPack ?? CARDS_PER_PACK;

  const balance = getCredits(userId);
  if (balance < price) {
    return { success: false, error: "Not enough credits" };
  }

  const allowedRarities = selectedPack?.allowedRarities;
  const allowedCardTypes = selectedPack?.allowedCardTypes;

  const norm = (r: string | undefined) => (r === "common" ? "uncommon" : r) || "uncommon";

  const fullPool = getCharacterPool()
    .filter((c) => c.profilePath?.trim())
    .filter((c) => {
      const rarityOk = !allowedRarities || allowedRarities.includes(norm(c.rarity) as any);
      const type = (c.cardType ?? "actor") as NonNullable<typeof c.cardType>;
      const typeOk = !allowedCardTypes || allowedCardTypes.includes(type as any);
      return rarityOk && typeOk;
    });
  const ownedLegendaryIds = getOwnedLegendaryCharacterIds();

  function availablePool(): CharacterPortrayal[] {
    return fullPool.filter(
      (c) => c.rarity !== "legendary" || !ownedLegendaryIds.has(c.characterId)
    );
  }

  let pool = availablePool();
  if (pool.length < cardsPerPack) {
    return { success: false, error: "Character pool too small. Add more winning movies." };
  }

  const deducted = deductCredits(userId, price, "pack_purchase", {
    packId: selectedPack?.id ?? "default",
  });
  if (!deducted) return { success: false, error: "Failed to deduct credits" };

  // Pack-based rarity: one roll per pack, then 5 slots with those rarities
  const packTier = rollPackTier();
  let raritySlots = getRaritySlotsForPack(packTier);
  raritySlots = shuffleArray(raritySlots);

  const cards: ReturnType<typeof addCard>[] = [];
  const pickedCharacterIds = new Set<string>();

  for (let i = 0; i < cardsPerPack; i++) {
    pool = availablePool().filter((c) => !pickedCharacterIds.has(c.characterId));
    if (pool.length === 0) break;

    const wantedRarity = raritySlots[i];
    const char = pickCardOfRarity(pool, wantedRarity, ownedLegendaryIds);
    const isFoil = Math.random() < FOIL_CHANCE;
    const card = addCard({
      userId,
      characterId: char.characterId,
      rarity: char.rarity,
      isFoil,
      actorName: char.actorName,
      characterName: char.characterName,
      movieTitle: char.movieTitle,
      movieTmdbId: char.movieTmdbId,
      profilePath: char.profilePath,
      cardType: char.cardType ?? "actor",
    });
    cards.push(card);
    pickedCharacterIds.add(char.characterId);
    if (char.rarity === "legendary") {
      ownedLegendaryIds.add(char.characterId);
    }
  }

  return { success: true, cards };
}

/** Trade up: consume 5 cards of same rarity for 1 of next rarity. Epic→legendary: 33% legendary card, 67% 100 credits. */
export function tradeUp(
  userId: string,
  cardIds: string[]
): { success: boolean; card?: ReturnType<typeof addCard>; credits?: number; error?: string } {
  if (!Array.isArray(cardIds) || cardIds.length !== 5) {
    return { success: false, error: "Select exactly 5 cards" };
  }
  const uniqueIds = [...new Set(cardIds)];
  if (uniqueIds.length !== 5) return { success: false, error: "Select 5 different cards" };

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
  if (rarities.some((r) => r !== first)) return { success: false, error: "All 5 cards must be the same rarity" };

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
    const CREDITS_REWARD = 100;
    addCredits(userId, CREDITS_REWARD, "trade_up_epic", { source: "epic_trade_up" });
    return { success: true, credits: CREDITS_REWARD };
  }

  const pool = getCharacterPool().filter((c) => c.profilePath?.trim());
  const norm = (r: string | undefined) => (r === "common" ? "uncommon" : r) || "uncommon";
  const CASCADE: ("rare" | "epic" | "legendary")[] =
    targetRarity === "rare" ? ["rare", "epic", "legendary"] : targetRarity === "epic" ? ["epic", "legendary"] : ["legendary"];
  const ownedLegendaryIds = getOwnedLegendaryCharacterIds();
  let subset: typeof pool = [];
  for (const tier of CASCADE) {
    subset = pool.filter((c) => norm(c.rarity) === tier);
    if (tier === "legendary") subset = subset.filter((c) => !ownedLegendaryIds.has(c.characterId));
    if (subset.length > 0) break;
  }
  if (subset.length === 0) return { success: false, error: `No ${targetRarity}+ cards available in the character pool` };

  for (const c of selected) removeCard(c.id);
  const char = subset[Math.floor(Math.random() * subset.length)];
  const isFoil = Math.random() < FOIL_CHANCE;
  const newCard = addCard({
    userId,
    characterId: char.characterId,
    rarity: char.rarity,
    isFoil,
    actorName: char.actorName,
    characterName: char.characterName,
    movieTitle: char.movieTitle,
    movieTmdbId: char.movieTmdbId,
    profilePath: char.profilePath,
    cardType: char.cardType ?? "actor",
  });

  return { success: true, card: newCard };
}

/** Character pool entries for a movie (tmdbId). Up to 6. */
export function getPoolEntriesForMovie(tmdbId: number): CharacterPortrayal[] {
  return getCharacterPool()
    .filter((c) => c.movieTmdbId === tmdbId && c.profilePath?.trim())
    .slice(0, 6);
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

/** True if user owns all 6 pool characterIds for the winner's movie. */
export function hasCompletedMovie(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length < 6) return false;
  const owned = getUserCollectedCharacterIdsForMovie(userId, winner.tmdbId);
  const required = new Set(pool.map((c) => c.characterId));
  for (const id of required) {
    if (!owned.has(id)) return false;
  }
  return true;
}

/** True if user owns all 6 pool characterIds for the winner's movie, each as foil. */
export function hasCompletedMovieHolo(userId: string, winnerId: string): boolean {
  const winner = getWinners().find((w) => w.id === winnerId);
  if (!winner?.tmdbId) return false;
  const pool = getPoolEntriesForMovie(winner.tmdbId);
  if (pool.length < 6) return false;
  const ownedFoil = getUserCollectedFoilCharacterIdsForMovie(userId, winner.tmdbId);
  const required = new Set(pool.map((c) => c.characterId));
  for (const id of required) {
    if (!ownedFoil.has(id)) return false;
  }
  return true;
}

/** Winner IDs for which the user has collected all 6 cards. */
export function getCompletedWinnerIds(userId: string): string[] {
  const winners = getWinners().filter((w) => w.tmdbId);
  return winners.filter((w) => hasCompletedMovie(userId, w.id)).map((w) => w.id);
}

/** Winner IDs for which the user has collected all 6 cards in foil (Holo set). */
export function getCompletedHoloWinnerIds(userId: string): string[] {
  const winners = getWinners().filter((w) => w.tmdbId);
  return winners.filter((w) => hasCompletedMovieHolo(userId, w.id)).map((w) => w.id);
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
    for (const id of required) {
      if (!remainingChars.has(id)) {
        wouldLoseNormal = true;
        break;
      }
    }
    let wouldLoseHolo = false;
    for (const id of required) {
      if (!remainingFoilChars.has(id)) {
        wouldLoseHolo = true;
        break;
      }
    }

    if (wouldLoseNormal) result.push({ winnerId: winner.id, movieTitle: winner.movieTitle, isHolo: false });
    if (wouldLoseHolo) result.push({ winnerId: winner.id, movieTitle: winner.movieTitle, isHolo: true });
  }

  return result;
}

/** Displayed badge for a user (single badge they chose to show). Used by APIs to attach to user payloads. */
export function getDisplayedBadgeForUser(userId: string): {
  winnerId: string;
  movieTitle: string;
  isHolo: boolean;
} | null {
  const profile = getProfile(userId);
  const displayedWinnerId = profile.displayedBadgeWinnerId ?? null;
  if (!displayedWinnerId) return null;
  const completed = getCompletedWinnerIds(userId);
  const completedHolo = getCompletedHoloWinnerIds(userId);
  if (!completed.includes(displayedWinnerId)) return null;
  const winners = getWinners();
  const w = winners.find((x) => x.id === displayedWinnerId);
  return {
    winnerId: displayedWinnerId,
    movieTitle: w?.movieTitle ?? "Unknown",
    isHolo: completedHolo.includes(displayedWinnerId),
  };
}

export { PACK_PRICE, CARDS_PER_PACK };
