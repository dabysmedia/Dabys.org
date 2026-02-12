import {
  getWinners,
  getCharacterPool,
  saveCharacterPool,
  addCard,
  deductCredits,
  getCredits,
} from "@/lib/data";
import type { CharacterPortrayal } from "@/lib/data";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p";
const PACK_PRICE = 50;
const CARDS_PER_PACK = 5;
const FOIL_CHANCE = 0.08;

type Rarity = "common" | "rare" | "epic" | "legendary";

function assignRarity(popularity: number): Rarity {
  if (popularity >= 40) return "legendary";
  if (popularity >= 25) return "epic";
  if (popularity >= 15) return "rare";
  return "common";
}

async function fetchTmdbCredits(tmdbId: number): Promise<{
  cast: { id: number; name: string; character: string; profile_path: string | null; popularity: number }[];
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
    year,
    title: m.title || "",
  };
}

export async function buildCharacterPool(): Promise<CharacterPortrayal[]> {
  const winners = getWinners().filter((w) => w.tmdbId);
  const existing = getCharacterPool();
  const byKey = new Map<string, CharacterPortrayal>();
  existing.forEach((c) => byKey.set(`${c.tmdbPersonId}-${c.movieTmdbId}`, c));

  for (const winner of winners) {
    const tmdbId = winner.tmdbId!;
    const movieTitle = winner.movieTitle;
    const data = await fetchTmdbCredits(tmdbId);
    if (!data?.cast?.length) continue;

    for (const c of data.cast) {
      const key = `${c.id}-${tmdbId}`;
      if (byKey.has(key)) continue;
      const characterName = (c.character || "").trim() || "Unknown";
      const actorName = (c.name || "").trim() || "Unknown";
      const popularity = typeof c.popularity === "number" ? c.popularity : 0;
      const rarity = assignRarity(popularity);
      const characterId = `chr-${c.id}-${tmdbId}`;
      byKey.set(key, {
        characterId,
        tmdbPersonId: c.id,
        actorName,
        characterName,
        profilePath: c.profile_path ? `${TMDB_IMG}/w500${c.profile_path}` : "",
        movieTmdbId: tmdbId,
        movieTitle,
        popularity,
        rarity,
      });
    }
  }

  const pool = Array.from(byKey.values());
  saveCharacterPool(pool);
  return pool;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weightedPick(pool: CharacterPortrayal[]): CharacterPortrayal {
  const weights = pool.map((c) => {
    if (c.rarity === "legendary") return 1;
    if (c.rarity === "epic") return 3;
    if (c.rarity === "rare") return 8;
    return 20;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function buyPack(userId: string): { success: boolean; cards?: ReturnType<typeof addCard>[]; error?: string } {
  const balance = getCredits(userId);
  if (balance < PACK_PRICE) {
    return { success: false, error: "Not enough credits" };
  }

  const pool = getCharacterPool();
  if (pool.length < CARDS_PER_PACK) {
    return { success: false, error: "Character pool too small. Add more winning movies." };
  }

  const deducted = deductCredits(userId, PACK_PRICE, "pack_purchase", {});
  if (!deducted) return { success: false, error: "Failed to deduct credits" };

  const cards: ReturnType<typeof addCard>[] = [];
  for (let i = 0; i < CARDS_PER_PACK; i++) {
    const char = weightedPick(pool);
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
    });
    cards.push(card);
  }

  return { success: true, cards };
}

export { PACK_PRICE, CARDS_PER_PACK };
