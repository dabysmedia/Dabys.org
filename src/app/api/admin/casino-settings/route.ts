import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCasinoGameSettings, saveCasinoGameSettings } from "@/lib/data";

const SLOT_SYMBOLS = ["7", "BAR", "star", "bell", "cherry"] as const;

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const settings = getCasinoGameSettings();
  return NextResponse.json(settings);
}

function parseNum(v: unknown, fallback: number, min?: number, max?: number): number {
  const n = typeof v === "number" ? (v < 0 ? Math.ceil(v) : Math.floor(v)) : parseFloat(String(v ?? fallback));
  if (!Number.isFinite(n)) return fallback;
  if (min !== undefined && n < min) return fallback;
  if (max !== undefined && n > max) return fallback;
  return n;
}

function parseValidBets(v: unknown, fallback: number[]): number[] {
  if (!Array.isArray(v)) return fallback;
  const arr = v
    .map((x) => (typeof x === "number" ? Math.floor(x) : parseInt(String(x), 10)))
    .filter((n) => Number.isFinite(n) && n >= 1);
  return arr.length > 0 ? [...new Set(arr)].sort((a, b) => a - b) : fallback;
}

function parsePaytable(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const out: Record<string, number> = {};
  for (const k of SLOT_SYMBOLS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "number" && v >= 0) out[k] = Math.floor(v);
    else out[k] = fallback[k] ?? 4;
  }
  return out;
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const current = getCasinoGameSettings();

  const slotsRaw = body.slots ?? {};
  const blackjackRaw = body.blackjack ?? {};
  const rouletteRaw = body.roulette ?? {};

  const slots = body.slots !== undefined
    ? (() => {
        const s = {
          minBet: parseNum(slotsRaw.minBet, current.slots.minBet, 1),
          maxBet: parseNum(slotsRaw.maxBet, current.slots.maxBet, 1),
          validBets: parseValidBets(slotsRaw.validBets, current.slots.validBets),
          paytable: parsePaytable(slotsRaw.paytable, current.slots.paytable),
          paytable2oak: parseNum(slotsRaw.paytable2oak, current.slots.paytable2oak, 0, 10),
        };
        if (s.minBet > s.maxBet) [s.minBet, s.maxBet] = [s.maxBet, s.minBet];
        return s;
      })()
    : current.slots;

  const blackjack = body.blackjack !== undefined
    ? (() => {
        const bjMin = Math.max(2, parseNum(blackjackRaw.minBet, current.blackjack.minBet, 2));
        const bjMax = Math.max(bjMin, parseNum(blackjackRaw.maxBet, current.blackjack.maxBet, 2));
        return {
          minBet: bjMin % 2 === 0 ? bjMin : bjMin + 1,
          maxBet: bjMax % 2 === 0 ? bjMax : bjMax - 1,
          blackjackPayout: Math.max(1, Math.min(3, parseNum(blackjackRaw.blackjackPayout, current.blackjack.blackjackPayout, 1, 3))),
        };
      })()
    : current.blackjack;

  const roulette = body.roulette !== undefined
    ? (() => {
        const r = {
          minBet: parseNum(rouletteRaw.minBet, current.roulette.minBet, 1),
          maxBet: parseNum(rouletteRaw.maxBet, current.roulette.maxBet, 1),
          betStep: parseNum(rouletteRaw.betStep, current.roulette.betStep, 1),
          colorPayout: parseNum(rouletteRaw.colorPayout, current.roulette.colorPayout, 1, 10),
          straightPayout: parseNum(rouletteRaw.straightPayout, current.roulette.straightPayout, 10, 50),
        };
        if (r.minBet > r.maxBet) [r.minBet, r.maxBet] = [r.maxBet, r.minBet];
        return r;
      })()
    : current.roulette;

  const settings = { slots, blackjack, roulette };
  saveCasinoGameSettings(settings);
  return NextResponse.json(settings);
}
