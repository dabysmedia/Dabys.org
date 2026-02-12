export const RARITY_COLORS: Record<string, string> = {
  uncommon: "border-green-500/50 bg-green-500/10",
  rare: "border-blue-500/50 bg-blue-500/10",
  epic: "border-purple-500/50 bg-purple-500/10",
  legendary: "border-amber-500/50 bg-amber-500/10",
};

/** Rarity rgba tints for vignette overlays (low opacity) */
export const RARITY_TINTS: Record<string, string> = {
  uncommon: "rgba(34, 197, 94, 0.08)",
  rare: "rgba(59, 130, 246, 0.08)",
  epic: "rgba(168, 85, 247, 0.08)",
  legendary: "rgba(245, 158, 11, 0.08)",
};

/** Rarity badge text colors for premium tag */
export const RARITY_BADGE: Record<string, string> = {
  uncommon: "text-green-400/95",
  rare: "text-blue-400/95",
  epic: "text-purple-400/95",
  legendary: "text-amber-400/95",
};

/** Rarity glow colors for hover borders / outer glow (subtle) */
export const RARITY_GLOW: Record<string, string> = {
  uncommon: "rgba(34, 197, 94, 0.45)",
  rare: "rgba(59, 130, 246, 0.45)",
  epic: "rgba(168, 85, 247, 0.45)",
  legendary: "rgba(245, 158, 11, 0.5)",
};
