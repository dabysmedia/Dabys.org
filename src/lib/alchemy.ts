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

export function getPackAPunchCost(rarity: string): number {
  return PACK_A_PUNCH_COST[rarity] ?? PACK_A_PUNCH_COST.uncommon;
}

/** Credits received when vendoring (quicksell) a card by rarity. Legendary cannot be quicksold. */
export const QUICKSELL_CREDITS: Record<string, number> = {
  uncommon: 5,
  rare: 20,
  epic: 80,
  legendary: 0,
};

export function getQuicksellCredits(rarity: string): number {
  return QUICKSELL_CREDITS[rarity] ?? (rarity === "legendary" ? 0 : QUICKSELL_CREDITS.uncommon);
}
