// Shared casino logic: RNG, paytables, etc.

export const SLOT_SYMBOLS = ["7", "BAR", "cherry", "star", "bell"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

// Paytable: 3-of-a-kind multiplier (reduced slightly to offset 2oak; keeps ~16% house edge)
export const SLOT_PAYTABLE: Record<SlotSymbol, number> = {
  "7": 43,
  BAR: 21,
  star: 13,
  bell: 9,
  cherry: 4,
};

// 2-of-a-kind pays (same for all symbols)
export const SLOT_PAYTABLE_2OAK = 0.25;

// Scratch-off: 12 panels, different symbols, match 3+ to win.
export const SCRATCH_OFF_SYMBOLS = ["JACKPOT", "DIAMOND", "GOLD", "STAR", "CLOVER", "LUCKY"] as const;
export type ScratchOffSymbol = (typeof SCRATCH_OFF_SYMBOLS)[number];

export const SCRATCH_OFF_PAYTABLE: Record<string, number> = {
  JACKPOT: 50,
  DIAMOND: 20,
  GOLD: 10,
  STAR: 5,
  CLOVER: 3,
  LUCKY: 1,
};

/** Pick 12 symbols for a scratch-off ticket. winChanceDenom per symbol = "1 in N". P(win) = sum(1/denom), P(lose) = 1 - that. */
export function pickScratchOffPanels(winChanceDenom: Record<string, number>): string[] {
  const denoms: { sym: string; denom: number }[] = [];
  for (const sym of SCRATCH_OFF_SYMBOLS) {
    const d = Math.max(1, Math.floor(winChanceDenom[sym] ?? 20));
    denoms.push({ sym, denom: d });
  }
  const totalWinChance = denoms.reduce((s, w) => s + 1 / w.denom, 0);
  const r = Math.random();

  if (r >= totalWinChance) {
    const panels: string[] = [];
    for (const sym of SCRATCH_OFF_SYMBOLS) {
      panels.push(sym, sym);
    }
    return shuffle(panels);
  }

  const winR = r / totalWinChance;
  let acc = 0;
  let winSym = denoms[denoms.length - 1]!.sym;
  for (let i = 0; i < denoms.length; i++) {
    const { sym, denom } = denoms[i]!;
    const w = (1 / denom) / totalWinChance;
    acc += w;
    if (winR < acc || i === denoms.length - 1) {
      winSym = sym;
      break;
    }
  }

  const panels: string[] = [winSym, winSym, winSym];
  for (let i = 0; i < 9; i++) {
    panels.push(SCRATCH_OFF_SYMBOLS[Math.floor(Math.random() * SCRATCH_OFF_SYMBOLS.length)] as string);
  }
  return shuffle(panels);
}

/** Payout for scratch-off: match 3+ of same symbol = win that symbol's multiplier × cost. Take highest. */
export function getScratchOffPayout(
  panels: string[],
  cost: number,
  paytable?: Record<string, number>
): number {
  const pt: Record<string, number> = paytable ?? SCRATCH_OFF_PAYTABLE;
  const counts: Record<string, number> = {};
  for (const s of panels) {
    counts[s] = (counts[s] ?? 0) + 1;
  }
  let bestPayout = 0;
  for (const [sym, count] of Object.entries(counts)) {
    if (count >= 3) {
      const mult = pt[sym] ?? 0;
      const payout = Math.floor(cost * mult);
      if (payout > bestPayout) bestPayout = payout;
    }
  }
  return bestPayout;
}

export function pickSlotSymbols(): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const symbols = [...SLOT_SYMBOLS];
  return [
    symbols[Math.floor(Math.random() * symbols.length)] as SlotSymbol,
    symbols[Math.floor(Math.random() * symbols.length)] as SlotSymbol,
    symbols[Math.floor(Math.random() * symbols.length)] as SlotSymbol,
  ];
}

export function getSlotsPayout(
  symbols: [SlotSymbol, SlotSymbol, SlotSymbol],
  bet: number,
  paytable?: Record<string, number>,
  paytable2oak?: number
): number {
  const pt: Record<string, number> = paytable ?? SLOT_PAYTABLE;
  const pt2 = paytable2oak ?? SLOT_PAYTABLE_2OAK;
  const [a, b, c] = symbols;
  if (a === b && b === c) {
    const mult = pt[String(a)] ?? 4;
    return Math.floor(bet * mult);
  }
  if (a === b || b === c || a === c) {
    return Math.floor(bet * pt2);
  }
  return 0;
}

// Roulette: Red numbers (European)
export const RED_NUMBERS = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];
// European wheel order (clockwise from 0)
export const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function spinRoulette(): number {
  return Math.floor(Math.random() * 37); // 0-36
}

export function isRed(n: number): boolean {
  return n > 0 && RED_NUMBERS.includes(n);
}

export function getRoulettePayout(
  selection: "red" | "black" | number,
  result: number,
  colorPayout = 2,
  straightPayout = 35
): number {
  if (typeof selection === "number") {
    return selection === result ? straightPayout : 0;
  }
  if (result === 0) return 0;
  const red = isRed(result);
  if (selection === "red" && red) return colorPayout;
  if (selection === "black" && !red) return colorPayout;
  return 0;
}

// Blackjack: deck and hand value
export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export interface Card {
  suit: (typeof SUITS)[number];
  rank: (typeof RANKS)[number];
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function cardValue(rank: string): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank, 10);
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c.rank);
    total += v;
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

// Dabys Bets: RNG winner based on odds (implied probability)
export function resolveDabysBetWinner(oddsA: number, oddsB: number): "A" | "B" {
  const probA = 1 / oddsA;
  const probB = 1 / oddsB;
  const total = probA + probB;
  const pA = probA / total;
  const r = Math.random();
  return r < pA ? "A" : "B";
}
