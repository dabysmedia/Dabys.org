/** Card finish tier (client-safe; do not import from @/lib/data here to avoid pulling fs into client bundle). */
export type CardFinish = "normal" | "holo" | "prismatic" | "darkMatter";

/** Minimal alchemy settings shape used by chance helpers. Pass from API routes via getAlchemySettings(). */
export interface AlchemySettingsChance {
  holoUpgradeChance?: number | Record<string, number>;
  prismaticUpgradeChance: number;
  darkMatterUpgradeChance: number;
  prismaticCraftBaseChance: number;
  prismaticCraftChancePerPrism: number;
}

/** Stardust values per rarity - used by getDisenchantDust, getPackAPunchCost, getUpgradeCost */
export interface AlchemySettingsStardust {
  disenchantHolo?: Record<string, number>;
  packAPunchCost?: Record<string, number>;
}

/** Stardust received when disenchanting a Holo card by rarity. */
export const DISENCHANT_DUST: Record<string, number> = {
  uncommon: 10,
  rare: 20,
  epic: 30,
  legendary: 50,
};

/** Stardust cost to Pack-A-Punch one normal card into a Holo, by rarity. */
export const PACK_A_PUNCH_COST: Record<string, number> = {
  uncommon: 30,
  rare: 60,
  epic: 90,
  legendary: 120,
};

/** Fallback success chances (used if settings file is missing). */
export const UPGRADE_SUCCESS_CHANCE: Record<string, number> = {
  holo: 0.50,
  prismatic: 0.35,
  darkMatter: 0.20,
};

export function getPackAPunchCost(rarity: string, settings?: AlchemySettingsStardust): number {
  const map = settings?.packAPunchCost ?? PACK_A_PUNCH_COST;
  return map[rarity] ?? map.uncommon ?? PACK_A_PUNCH_COST.uncommon;
}

/** Get the stardust cost to upgrade to the target finish tier. Only holo (Pack-A-Punch) is used; prismatic/DM are forge-only. */
export function getUpgradeCost(rarity: string, targetFinish: CardFinish, settings?: AlchemySettingsStardust): number {
  if (targetFinish !== "holo") return 0;
  return (settings?.packAPunchCost ?? PACK_A_PUNCH_COST)[rarity] ?? (settings?.packAPunchCost ?? PACK_A_PUNCH_COST).uncommon ?? PACK_A_PUNCH_COST.uncommon;
}

/** Get success chance for upgrading to the target finish. For holo, pass rarity for per-rarity chance. */
export function getUpgradeSuccessChance(targetFinish: CardFinish, settings?: AlchemySettingsChance, rarity?: string): number {
  switch (targetFinish) {
    case "holo": {
      const h = settings?.holoUpgradeChance;
      if (typeof h === "number") return h / 100;
      if (h && typeof h === "object" && rarity) {
        const pct = h[rarity] ?? h.uncommon ?? 50;
        return Math.min(100, Math.max(0, pct)) / 100;
      }
      return UPGRADE_SUCCESS_CHANCE.holo;
    }
    case "prismatic": return settings ? settings.prismaticUpgradeChance / 100 : UPGRADE_SUCCESS_CHANCE.prismatic;
    case "darkMatter": return settings ? settings.darkMatterUpgradeChance / 100 : UPGRADE_SUCCESS_CHANCE.darkMatter;
    default: return 0.5;
  }
}

/** Get disenchant dust for a card based on its finish and rarity. Only Holo can be disenchanted; prismatic and dark matter return 0. */
export function getDisenchantDust(rarity: string, finish: CardFinish, settings?: AlchemySettingsStardust): number {
  if (finish !== "holo") return 0;
  const map = settings?.disenchantHolo ?? DISENCHANT_DUST;
  return map[rarity] ?? map.uncommon ?? DISENCHANT_DUST.uncommon;
}

/** Credits per rarity for quicksell (vendor). Used for client-side display. Server uses getCreditSettings() for actual payouts. */
export const QUICKSELL_CREDITS: Record<string, number> = {
  uncommon: 5,
  rare: 20,
  epic: 80,
  legendary: 200,
};

/** Client-safe: returns quicksell credits from default map. Server API uses credit settings for actual amount. */
export function getQuicksellCredits(rarity: string): number {
  return QUICKSELL_CREDITS[rarity] ?? QUICKSELL_CREDITS.uncommon;
}

/** Calculate prismatic craft success chance based on number of prisms applied. Pass settings from API or client-fetched config; uses fallback if omitted. */
export function getPrismaticCraftChance(prismsApplied: number, settings?: AlchemySettingsChance): number {
  const base = settings?.prismaticCraftBaseChance ?? 5;
  const perPrism = settings?.prismaticCraftChancePerPrism ?? 10;
  const chance = base + (prismsApplied * perPrism);
  return Math.min(100, Math.max(0, chance));
}
