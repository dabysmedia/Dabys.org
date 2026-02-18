/** Card finish tier (client-safe; do not import from @/lib/data here to avoid pulling fs into client bundle). */
export type CardFinish = "normal" | "holo" | "prismatic" | "darkMatter";

/** Minimal alchemy settings shape used by chance helpers. Pass from API routes via getAlchemySettings(). */
export interface AlchemySettingsChance {
  holoUpgradeChance: number;
  prismaticUpgradeChance: number;
  darkMatterUpgradeChance: number;
  prismaticCraftBaseChance: number;
  prismaticCraftChancePerPrism: number;
}

/** Stardust received when disenchanting a Holo card by rarity. */
export const DISENCHANT_DUST: Record<string, number> = {
  uncommon: 10,
  rare: 20,
  epic: 30,
  legendary: 50,
};

/** Stardust received when disenchanting a Prismatic card by rarity. */
export const DISENCHANT_DUST_PRISMATIC: Record<string, number> = {
  uncommon: 40,
  rare: 80,
  epic: 120,
  legendary: 200,
};

/** Stardust received when disenchanting a Dark Matter card by rarity. */
export const DISENCHANT_DUST_DARK_MATTER: Record<string, number> = {
  uncommon: 100,
  rare: 200,
  epic: 300,
  legendary: 500,
};

/** Stardust cost to Pack-A-Punch one normal card into a Holo, by rarity. */
export const PACK_A_PUNCH_COST: Record<string, number> = {
  uncommon: 30,
  rare: 60,
  epic: 90,
  legendary: 120,
};

/** Stardust cost to upgrade a Holo card to Prismatic, by rarity. */
export const PRISMATIC_UPGRADE_COST: Record<string, number> = {
  uncommon: 80,
  rare: 160,
  epic: 240,
  legendary: 350,
};

/** Stardust cost to upgrade a Prismatic card to Dark Matter, by rarity. */
export const DARK_MATTER_UPGRADE_COST: Record<string, number> = {
  uncommon: 200,
  rare: 400,
  epic: 600,
  legendary: 900,
};

/** Fallback success chances (used if settings file is missing). */
export const UPGRADE_SUCCESS_CHANCE: Record<string, number> = {
  holo: 0.50,
  prismatic: 0.35,
  darkMatter: 0.20,
};

export function getPackAPunchCost(rarity: string): number {
  return PACK_A_PUNCH_COST[rarity] ?? PACK_A_PUNCH_COST.uncommon;
}

/** Get the stardust cost to upgrade to the target finish tier. */
export function getUpgradeCost(rarity: string, targetFinish: CardFinish): number {
  switch (targetFinish) {
    case "holo": return PACK_A_PUNCH_COST[rarity] ?? PACK_A_PUNCH_COST.uncommon;
    case "prismatic": return PRISMATIC_UPGRADE_COST[rarity] ?? PRISMATIC_UPGRADE_COST.uncommon;
    case "darkMatter": return DARK_MATTER_UPGRADE_COST[rarity] ?? DARK_MATTER_UPGRADE_COST.uncommon;
    default: return 0;
  }
}

/** Get success chance for upgrading to the target finish. Pass settings from API (getAlchemySettings()); uses fallback if omitted. */
export function getUpgradeSuccessChance(targetFinish: CardFinish, settings?: AlchemySettingsChance): number {
  switch (targetFinish) {
    case "holo": return settings ? settings.holoUpgradeChance / 100 : UPGRADE_SUCCESS_CHANCE.holo;
    case "prismatic": return settings ? settings.prismaticUpgradeChance / 100 : UPGRADE_SUCCESS_CHANCE.prismatic;
    case "darkMatter": return settings ? settings.darkMatterUpgradeChance / 100 : UPGRADE_SUCCESS_CHANCE.darkMatter;
    default: return 0.5;
  }
}

/** Get disenchant dust for a card based on its finish and rarity. */
export function getDisenchantDust(rarity: string, finish: CardFinish): number {
  switch (finish) {
    case "darkMatter": return DISENCHANT_DUST_DARK_MATTER[rarity] ?? DISENCHANT_DUST_DARK_MATTER.uncommon;
    case "prismatic": return DISENCHANT_DUST_PRISMATIC[rarity] ?? DISENCHANT_DUST_PRISMATIC.uncommon;
    case "holo": return DISENCHANT_DUST[rarity] ?? DISENCHANT_DUST.uncommon;
    default: return 0;
  }
}

/** Credits per rarity for quicksell (vendor). Used for client-side display. Legendary cannot be quicksold. Server uses getCreditSettings() for actual payouts. */
export const QUICKSELL_CREDITS: Record<string, number> = {
  uncommon: 5,
  rare: 20,
  epic: 80,
  legendary: 0,
};

/** Client-safe: returns quicksell credits from default map. Server API uses credit settings for actual amount. */
export function getQuicksellCredits(rarity: string): number {
  return QUICKSELL_CREDITS[rarity] ?? (rarity === "legendary" ? 0 : QUICKSELL_CREDITS.uncommon);
}

/** Calculate prismatic craft success chance based on number of prisms applied. Pass settings from API or client-fetched config; uses fallback if omitted. */
export function getPrismaticCraftChance(prismsApplied: number, settings?: AlchemySettingsChance): number {
  const base = settings?.prismaticCraftBaseChance ?? 5;
  const perPrism = settings?.prismaticCraftChancePerPrism ?? 10;
  const chance = base + (prismsApplied * perPrism);
  return Math.min(100, Math.max(0, chance));
}
