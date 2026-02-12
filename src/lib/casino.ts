// Shared casino logic: RNG, paytables, etc.

export const SLOT_SYMBOLS = ["7", "BAR", "cherry", "star", "bell"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

// Paytable: 3-of-a-kind multiplier
export const SLOT_PAYTABLE: Record<SlotSymbol, number> = {
  "7": 50,
  BAR: 25,
  star: 15,
  bell: 10,
  cherry: 5,
};

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
  bet: number
): number {
  const [a, b, c] = symbols;
  if (a === b && b === c) {
    const mult = SLOT_PAYTABLE[a];
    return Math.floor(bet * mult);
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
  result: number
): number {
  if (typeof selection === "number") {
    return selection === result ? 35 : 0;
  }
  if (result === 0) return 0;
  const red = isRed(result);
  if (selection === "red" && red) return 2;
  if (selection === "black" && !red) return 2;
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
