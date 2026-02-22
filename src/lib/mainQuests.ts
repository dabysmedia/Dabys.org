import fs from "fs";
import path from "path";

const DEFAULT_DATA_DIR = path.join(process.cwd(), "src", "data");
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;

function ensureDataFile(filename: string) {
  const targetPath = path.join(DATA_DIR, filename);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(targetPath) && DATA_DIR !== DEFAULT_DATA_DIR) {
    const defaultPath = path.join(DEFAULT_DATA_DIR, filename);
    if (fs.existsSync(defaultPath)) {
      fs.copyFileSync(defaultPath, targetPath);
    }
  }
  return targetPath;
}

function readJson<T>(filename: string): T {
  const filePath = ensureDataFile(filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJson<T>(filename: string, data: T) {
  const filePath = ensureDataFile(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ──── Types ─────────────────────────────────────────────

export type MainQuestType =
  | "complete_sets"
  | "open_packs"
  | "disenchant_cards"
  | "pack_a_punch"
  | "trade_up_rarity"
  | "complete_dailies";

export type MainQuestRewardType = "credits" | "stardust";
export type Rarity = "uncommon" | "rare" | "epic" | "legendary";

export interface MainQuestDefinition {
  id: string;
  type: MainQuestType;
  targetCount: number;
  reward: number;
  rewardType: MainQuestRewardType;
  label: string;
  description: string;
  /** For trade_up_rarity: which rarity counts */
  rarity?: Rarity;
  /** Display order (lower = first) */
  order?: number;
}

export interface UserLifetimeStats {
  packsOpened: number;
  setsCompleted: number;
  cardsDisenchanted: number;
  cardsPackAPunched: number;
  tradeUpsByRarity: Record<Rarity, number>;
  dailiesCompleted: number;
}

const DEFAULT_STATS: UserLifetimeStats = {
  packsOpened: 0,
  setsCompleted: 0,
  cardsDisenchanted: 0,
  cardsPackAPunched: 0,
  tradeUpsByRarity: { uncommon: 0, rare: 0, epic: 0, legendary: 0 },
  dailiesCompleted: 0,
};

// ──── Main Quest Definitions ─────────────────────────────

type MainQuestDefinitionsStore = { definitions: MainQuestDefinition[] };

function getMainQuestDefinitionsRaw(): MainQuestDefinitionsStore {
  try {
    return readJson<MainQuestDefinitionsStore>("mainQuestDefinitions.json");
  } catch {
    return { definitions: [] };
  }
}

export function getMainQuestDefinitions(): MainQuestDefinition[] {
  const store = getMainQuestDefinitionsRaw();
  const defs = store.definitions ?? [];
  return [...defs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function saveMainQuestDefinitions(definitions: MainQuestDefinition[]): void {
  writeJson("mainQuestDefinitions.json", { definitions });
}

// ──── Lifetime Stats ─────────────────────────────────────

type UserLifetimeStatsStore = Record<string, UserLifetimeStats>;

function getLifetimeStatsStore(): UserLifetimeStatsStore {
  try {
    return readJson<UserLifetimeStatsStore>("mainQuestStats.json");
  } catch {
    return {};
  }
}

function saveLifetimeStatsStore(store: UserLifetimeStatsStore): void {
  writeJson("mainQuestStats.json", store);
}

export function getUserLifetimeStats(userId: string): UserLifetimeStats {
  const store = getLifetimeStatsStore();
  const user = store[userId];
  return user ? { ...DEFAULT_STATS, ...user } : { ...DEFAULT_STATS };
}

function getOrCreateUserStats(userId: string): UserLifetimeStats {
  const store = getLifetimeStatsStore();
  if (!store[userId]) {
    store[userId] = { ...DEFAULT_STATS };
    saveLifetimeStatsStore(store);
  }
  return { ...DEFAULT_STATS, ...store[userId] };
}

/** Set (merge) lifetime stats for a user. Admin only. */
export function setUserLifetimeStats(userId: string, updates: Partial<UserLifetimeStats>): void {
  const store = getLifetimeStatsStore();
  const current = getOrCreateUserStats(userId);
  const merged: UserLifetimeStats = {
    ...current,
    ...updates,
    tradeUpsByRarity: updates.tradeUpsByRarity
      ? { ...current.tradeUpsByRarity, ...updates.tradeUpsByRarity }
      : current.tradeUpsByRarity,
  };
  store[userId] = merged;
  saveLifetimeStatsStore(store);
}

export function incrementUserLifetimeStat(
  userId: string,
  stat: keyof UserLifetimeStats,
  amount: number = 1,
  rarity?: Rarity
): void {
  const store = getLifetimeStatsStore();
  const user = getOrCreateUserStats(userId);
  if (stat === "tradeUpsByRarity" && rarity) {
    const byRarity = { ...user.tradeUpsByRarity };
    byRarity[rarity] = (byRarity[rarity] ?? 0) + amount;
    user.tradeUpsByRarity = byRarity;
  } else if (stat !== "tradeUpsByRarity") {
    const u = user as unknown as Record<string, number>;
    u[stat] = (u[stat] ?? 0) + amount;
  }
  store[userId] = user;
  saveLifetimeStatsStore(store);
}

// ──── Claimed Main Quests ─────────────────────────────────

type ClaimedMainQuestsStore = Record<string, string[]>;

function getClaimedStore(): ClaimedMainQuestsStore {
  try {
    return readJson<ClaimedMainQuestsStore>("mainQuestClaimed.json");
  } catch {
    return {};
  }
}

function saveClaimedStore(store: ClaimedMainQuestsStore): void {
  writeJson("mainQuestClaimed.json", store);
}

export function getClaimedMainQuestIds(userId: string): Set<string> {
  const store = getClaimedStore();
  return new Set(store[userId] ?? []);
}

export function claimMainQuest(userId: string, questId: string): boolean {
  const store = getClaimedStore();
  const list = store[userId] ?? [];
  if (list.includes(questId)) return false;
  list.push(questId);
  store[userId] = list;
  saveClaimedStore(store);
  return true;
}

export function unclaimMainQuest(userId: string, questId: string): boolean {
  const store = getClaimedStore();
  const list = store[userId] ?? [];
  const idx = list.indexOf(questId);
  if (idx < 0) return false;
  list.splice(idx, 1);
  store[userId] = list;
  saveClaimedStore(store);
  return true;
}

// ──── Progress Computation ───────────────────────────────

export interface MainQuestProgress {
  definition: MainQuestDefinition;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

export function getMainQuestProgress(userId: string): MainQuestProgress[] {
  const definitions = getMainQuestDefinitions();
  const stats = getUserLifetimeStats(userId);
  const claimed = getClaimedMainQuestIds(userId);

  return definitions.map((def) => {
    let current = 0;
    switch (def.type) {
      case "complete_sets":
        current = stats.setsCompleted;
        break;
      case "open_packs":
        current = stats.packsOpened;
        break;
      case "disenchant_cards":
        current = stats.cardsDisenchanted;
        break;
      case "pack_a_punch":
        current = stats.cardsPackAPunched;
        break;
      case "trade_up_rarity":
        current = def.rarity
          ? stats.tradeUpsByRarity[def.rarity] ?? 0
          : (stats.tradeUpsByRarity.uncommon ?? 0) + (stats.tradeUpsByRarity.rare ?? 0) + (stats.tradeUpsByRarity.epic ?? 0) + (stats.tradeUpsByRarity.legendary ?? 0);
        break;
      case "complete_dailies":
        current = stats.dailiesCompleted;
        break;
      default:
        current = 0;
    }
    const completed = current >= def.targetCount;
    return {
      definition: def,
      current,
      target: def.targetCount,
      completed,
      claimed: claimed.has(def.id),
    };
  });
}
