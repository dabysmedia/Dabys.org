import {
  getWinners,
  getCharacterPool,
  saveCharacterPool,
  addCard,
  deductCredits,
  getCredits,
  getOwnedLegendaryCharacterIds,
  migrateCommonToUncommon,
} from "@/lib/data";
import type { CharacterPortrayal, Winner } from "@/lib/data";

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

/** Drop chances: legendary 1%, epic 10%, rare 25%, uncommon 64%. Pick uniformly within tier. */
const DROP_TIERS = ["legendary", "epic", "rare", "uncommon"] as const;
const DROP_CUMULATIVE = [0.01, 0.11, 0.36, 1] as const;

function tierPick(
  pool: CharacterPortrayal[],
  ownedLegendaryIds: Set<string>
): CharacterPortrayal {
  const r = Math.random();
  const tierIdx = DROP_CUMULATIVE.findIndex((c) => r < c);
  const startTier = DROP_TIERS[tierIdx >= 0 ? tierIdx : DROP_TIERS.length - 1];

  const CASCADE_ORDER = ["legendary", "epic", "rare", "uncommon"] as const;
  const startIdx = CASCADE_ORDER.indexOf(startTier);
  const norm = (r: string | undefined) => (r === "common" ? "uncommon" : r) || "uncommon";
  for (let i = startIdx; i < CASCADE_ORDER.length; i++) {
    const t = CASCADE_ORDER[i];
    let subset = pool.filter((c) => norm(c.rarity) === t);
    if (t === "legendary") subset = subset.filter((c) => !ownedLegendaryIds.has(c.characterId));
    if (subset.length > 0) {
      return subset[Math.floor(Math.random() * subset.length)];
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buyPack(userId: string): { success: boolean; cards?: ReturnType<typeof addCard>[]; error?: string } {
  migrateCommonToUncommon();
  const balance = getCredits(userId);
  if (balance < PACK_PRICE) {
    return { success: false, error: "Not enough credits" };
  }

  const fullPool = getCharacterPool().filter((c) => c.profilePath?.trim());
  const ownedLegendaryIds = getOwnedLegendaryCharacterIds();

  function availablePool(): CharacterPortrayal[] {
    return fullPool.filter(
      (c) => c.rarity !== "legendary" || !ownedLegendaryIds.has(c.characterId)
    );
  }

  let pool = availablePool();
  if (pool.length < CARDS_PER_PACK) {
    return { success: false, error: "Character pool too small. Add more winning movies." };
  }

  const deducted = deductCredits(userId, PACK_PRICE, "pack_purchase", {});
  if (!deducted) return { success: false, error: "Failed to deduct credits" };

  const cards: ReturnType<typeof addCard>[] = [];
  for (let i = 0; i < CARDS_PER_PACK; i++) {
    pool = availablePool(); // refresh after each add (legendaries pulled this pack are now owned)
    if (pool.length === 0) break;
    const char = tierPick(pool, ownedLegendaryIds);
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
    if (char.rarity === "legendary") {
      ownedLegendaryIds.add(char.characterId);
    }
  }

  return { success: true, cards };
}

export { PACK_PRICE, CARDS_PER_PACK };
