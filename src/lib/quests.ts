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

export type QuestRewardType = "credits" | "stardust";
export type Rarity = "uncommon" | "rare" | "epic" | "legendary";
export type QuestType =
  | "login"
  | "open_pack"
  | "trade_up"
  | "upload_codex"
  | "complete_trade"
  | "disenchant_holo"
  | "pack_a_punch"
  | "marketplace_request"
  | "find_rarity_in_pack";

export interface QuestDefinition {
  label: string;
  description: string;
  reward: number;
  rewardType: QuestRewardType;
  alwaysActive: boolean;
  rarityParam?: boolean;
}

export interface QuestSettings {
  dailyQuestCount: number;
  /** Bonus credits awarded once when all daily quests are completed and claimed. */
  allQuestsCompleteBonus: number;
  questDefinitions: Record<QuestType, QuestDefinition>;
}

export interface DailyQuestInstance {
  questType: QuestType;
  rarity?: Rarity;
  completed: boolean;
  claimed: boolean;
  reward: number;
  rewardType: QuestRewardType;
  label: string;
  description: string;
}

/** One user's daily quests for a single day. Isolated per user — no sharing. */
export interface UserDailyQuests {
  date: string; // YYYY-MM-DD (UTC)
  quests: DailyQuestInstance[];
  /** True after the all-quests-complete bonus has been awarded for this day. */
  allCompleteBonusClaimed?: boolean;
}

/** Daily quests are per-user: keyed by date (YYYY-MM-DD) then by userId. */
type DailyQuestsStore = Record<string, Record<string, UserDailyQuests>>;

// ──── Settings ──────────────────────────────────────────

const DEFAULT_SETTINGS: QuestSettings = {
  dailyQuestCount: 6,
  allQuestsCompleteBonus: 50,
  questDefinitions: {
    login: { label: "Daily Login", description: "Log in today", reward: 25, rewardType: "credits", alwaysActive: true },
    open_pack: { label: "Open a Pack", description: "Open any pack (except free packs)", reward: 30, rewardType: "credits", alwaysActive: true },
    trade_up: { label: "Trade Up", description: "Complete a trade-up", reward: 40, rewardType: "credits", alwaysActive: true, rarityParam: true },
    upload_codex: { label: "Upload to Codex", description: "Upload a card to the codex", reward: 30, rewardType: "credits", alwaysActive: true },
    complete_trade: { label: "Complete a Trade", description: "Complete a trade with another player", reward: 35, rewardType: "credits", alwaysActive: false },
    disenchant_holo: { label: "Disenchant a Holo", description: "Disenchant a holo card", reward: 25, rewardType: "credits", alwaysActive: false, rarityParam: true },
    pack_a_punch: { label: "Pack-a-Punch", description: "Pack-a-Punch a card", reward: 35, rewardType: "credits", alwaysActive: false, rarityParam: true },
    marketplace_request: { label: "Marketplace Request", description: "Place a buy order on the marketplace", reward: 20, rewardType: "credits", alwaysActive: false },
    find_rarity_in_pack: { label: "Find a Card in a Pack", description: "Find a card of a specific rarity in a pack", reward: 50, rewardType: "credits", alwaysActive: false, rarityParam: true },
  },
};

export function getQuestSettings(): QuestSettings {
  try {
    const raw = readJson<Partial<QuestSettings>>("questSettings.json");
    return {
      dailyQuestCount: typeof raw.dailyQuestCount === "number" ? raw.dailyQuestCount : DEFAULT_SETTINGS.dailyQuestCount,
      allQuestsCompleteBonus: typeof raw.allQuestsCompleteBonus === "number" ? Math.max(0, raw.allQuestsCompleteBonus) : DEFAULT_SETTINGS.allQuestsCompleteBonus,
      questDefinitions: {
        ...DEFAULT_SETTINGS.questDefinitions,
        ...(raw.questDefinitions ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveQuestSettings(settings: QuestSettings): void {
  writeJson("questSettings.json", settings);
}

// ──── Daily Quest Store ─────────────────────────────────

function getDailyQuestsStore(): DailyQuestsStore {
  try {
    return readJson<DailyQuestsStore>("dailyQuests.json");
  } catch {
    return {};
  }
}

function saveDailyQuestsStore(store: DailyQuestsStore): void {
  writeJson("dailyQuests.json", store);
}

/** Clear all daily quest data for all users. Next time any user fetches quests they get a fresh set. (Admin only.) */
export function resetAllDailyQuests(): void {
  writeJson("dailyQuests.json", {});
}

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ──── Random rarity picker ──────────────────────────────

const ALL_RARITIES: Rarity[] = ["uncommon", "rare", "epic", "legendary"];

/** Picks a random rarity for quest params. Never returns legendary (quests don't require legendary). */
function pickRandomRarity(): Rarity {
  // Weighted: 40% uncommon, 35% rare, 25% epic (legendary excluded)
  const r = Math.random();
  if (r < 0.4) return "uncommon";
  if (r < 0.75) return "rare";
  return "epic";
}

function rarityLabel(rarity: Rarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// ──── Quest Generation ──────────────────────────────────

function generateDailyQuests(settings: QuestSettings): DailyQuestInstance[] {
  const defs = settings.questDefinitions;
  const questTypes = Object.keys(defs) as QuestType[];

  // Always-active quests first
  const alwaysActive = questTypes.filter((t) => defs[t].alwaysActive);
  const optional = questTypes.filter((t) => !defs[t].alwaysActive);

  const quests: DailyQuestInstance[] = [];

  // Add all always-active quests
  for (const questType of alwaysActive) {
    const def = defs[questType];
    const rarity = def.rarityParam ? pickRandomRarity() : undefined;
    let label = def.label;
    let description = def.description;
    if (rarity) {
      const rl = rarityLabel(rarity);
      const article = aOrAn(rl);
      label = `${def.label} (${rl})`;
      description = def.description.replace("a trade-up", `${article} ${rl} trade-up`);
    }
    quests.push({
      questType,
      rarity,
      completed: false,
      claimed: false,
      reward: def.reward,
      rewardType: def.rewardType,
      label,
      description,
    });
  }

  // Fill remaining slots with random optional quests
  const remainingSlots = Math.max(0, settings.dailyQuestCount - quests.length);
  const shuffled = [...optional].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, remainingSlots);

  for (const questType of picked) {
    const def = defs[questType];
    const rarity = def.rarityParam ? pickRandomRarity() : undefined;
    let label = def.label;
    let description = def.description;

    if (rarity) {
      const rl = rarityLabel(rarity);
      const article = aOrAn(rl);
      switch (questType) {
        case "disenchant_holo":
          label = `Disenchant ${article} ${rl} Holo`;
          description = `Disenchant ${article} ${rl} rarity holo card`;
          break;
        case "pack_a_punch":
          label = `Pack-a-Punch ${article} ${rl} Card`;
          description = `Pack-a-Punch ${article} ${rl} rarity card`;
          break;
        case "find_rarity_in_pack":
          label = `Find ${article} ${rl} in a Pack`;
          description = `Find ${article} ${rl} rarity card in a pack`;
          break;
        case "trade_up":
          label = `${rl} Trade Up`;
          description = `Complete ${article} ${rl} trade-up`;
          break;
        default:
          label = rarity ? `${def.label} (${rl})` : def.label;
      }
    }

    quests.push({
      questType,
      rarity,
      completed: false,
      claimed: false,
      reward: def.reward,
      rewardType: def.rewardType,
      label,
      description,
    });
  }

  return quests;
}

// ──── Get/Create Daily Quests (per user) ─────────────────

/** Returns daily quests for the given user only. Each user has their own list; generates a new set if none for today. */
export function getUserDailyQuests(userId: string): UserDailyQuests {
  const today = getTodayDateStr();
  const store = getDailyQuestsStore();
  const dateStore = store[today];

  if (dateStore && dateStore[userId]) {
    return dateStore[userId];
  }

  // Generate new daily quests for this user only (not shared)
  const settings = getQuestSettings();
  const quests = generateDailyQuests(settings);
  const userQuests: UserDailyQuests = { date: today, quests };

  if (!store[today]) store[today] = {};
  store[today][userId] = userQuests;

  // Clean up old dates (keep last 7 days)
  const dates = Object.keys(store).sort();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const date of dates) {
    if (date < cutoffStr) {
      delete store[date];
    }
  }

  saveDailyQuestsStore(store);
  return userQuests;
}

// ──── Progress Tracking ─────────────────────────────────

export function recordQuestProgress(
  userId: string,
  questType: QuestType,
  context?: { rarity?: Rarity; packIsFree?: boolean }
): { questCompleted: boolean; questIndex: number } {
  const today = getTodayDateStr();
  const store = getDailyQuestsStore();

  // Ensure user has quests for today
  if (!store[today] || !store[today][userId]) {
    getUserDailyQuests(userId);
    // Re-read store after generation
    const freshStore = getDailyQuestsStore();
    if (!freshStore[today]?.[userId]) return { questCompleted: false, questIndex: -1 };
  }

  const reloadedStore = getDailyQuestsStore();
  const userQuests = reloadedStore[today]?.[userId];
  if (!userQuests) return { questCompleted: false, questIndex: -1 };

  // For open_pack, skip free packs
  if (questType === "open_pack" && context?.packIsFree) {
    return { questCompleted: false, questIndex: -1 };
  }

  // Find matching uncompleted quest
  const idx = userQuests.quests.findIndex((q) => {
    if (q.questType !== questType) return false;
    if (q.completed) return false;
    // If quest has a rarity requirement, check it
    if (q.rarity && context?.rarity && q.rarity !== context.rarity) return false;
    return true;
  });

  if (idx < 0) return { questCompleted: false, questIndex: -1 };

  userQuests.quests[idx].completed = true;
  reloadedStore[today][userId] = userQuests;
  saveDailyQuestsStore(reloadedStore);

  return { questCompleted: true, questIndex: idx };
}

// ──── Claim Quest Reward ────────────────────────────────

/** If all quests are completed and claimed and bonus not yet given, mark it and return bonus amount. */
function maybeAwardAllCompleteBonus(
  today: string,
  userId: string,
  bonusAmount: number
): number | undefined {
  if (bonusAmount <= 0) return undefined;
  const store = getDailyQuestsStore();
  const userQuests = store[today]?.[userId];
  if (!userQuests || userQuests.allCompleteBonusClaimed) return undefined;
  const allDone = userQuests.quests.length > 0 && userQuests.quests.every((q) => q.completed && q.claimed);
  if (!allDone) return undefined;
  userQuests.allCompleteBonusClaimed = true;
  store[today][userId] = userQuests;
  saveDailyQuestsStore(store);
  return bonusAmount;
}

export function claimQuestReward(
  userId: string,
  questIndex: number
): { success: boolean; reward?: number; rewardType?: QuestRewardType; allCompleteBonus?: number; error?: string } {
  const today = getTodayDateStr();
  const store = getDailyQuestsStore();
  const userQuests = store[today]?.[userId];

  if (!userQuests) return { success: false, error: "No quests found for today" };
  if (questIndex < 0 || questIndex >= userQuests.quests.length) {
    return { success: false, error: "Invalid quest index" };
  }

  const quest = userQuests.quests[questIndex];
  if (!quest.completed) return { success: false, error: "Quest not yet completed" };
  if (quest.claimed) return { success: false, error: "Reward already claimed" };

  quest.claimed = true;
  store[today][userId] = userQuests;
  saveDailyQuestsStore(store);

  const settings = getQuestSettings();
  const allCompleteBonus = maybeAwardAllCompleteBonus(today, userId, settings.allQuestsCompleteBonus);

  return {
    success: true,
    reward: quest.reward,
    rewardType: quest.rewardType,
    ...(allCompleteBonus !== undefined && { allCompleteBonus }),
  };
}

// ──── Claim All Completed Quests ────────────────────────

export function claimAllQuestRewards(
  userId: string
): { success: boolean; totalReward: number; rewardType: QuestRewardType; claimedCount: number; allCompleteBonus?: number } {
  const today = getTodayDateStr();
  const store = getDailyQuestsStore();
  const userQuests = store[today]?.[userId];

  if (!userQuests) return { success: false, totalReward: 0, rewardType: "credits", claimedCount: 0 };

  let totalCredits = 0;
  let totalStardust = 0;
  let claimedCount = 0;

  for (const quest of userQuests.quests) {
    if (quest.completed && !quest.claimed) {
      quest.claimed = true;
      if (quest.rewardType === "stardust") {
        totalStardust += quest.reward;
      } else {
        totalCredits += quest.reward;
      }
      claimedCount++;
    }
  }

  store[today][userId] = userQuests;
  saveDailyQuestsStore(store);

  const settings = getQuestSettings();
  const allCompleteBonus = maybeAwardAllCompleteBonus(today, userId, settings.allQuestsCompleteBonus);

  return {
    success: claimedCount > 0,
    totalReward: totalCredits + totalStardust,
    rewardType: totalCredits > 0 ? "credits" : "stardust",
    claimedCount,
    ...(allCompleteBonus !== undefined && { allCompleteBonus }),
  };
}
