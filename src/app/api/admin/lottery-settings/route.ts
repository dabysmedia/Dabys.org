import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLotterySettings, saveLotterySettings } from "@/lib/data";

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

  const settings = getLotterySettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const current = getLotterySettings();

  const ticketCost = typeof body.ticketCost === "number" && body.ticketCost >= 1
    ? Math.floor(body.ticketCost)
    : typeof body.ticketCost === "string"
      ? Math.max(1, parseInt(body.ticketCost, 10) || current.ticketCost)
      : current.ticketCost;

  const startingPool = typeof body.startingPool === "number" && body.startingPool >= 0
    ? Math.floor(body.startingPool)
    : typeof body.startingPool === "string"
      ? Math.max(0, parseInt(body.startingPool, 10) || current.startingPool)
      : current.startingPool;

  const houseTakePercent = typeof body.houseTakePercent === "number" && body.houseTakePercent >= 0 && body.houseTakePercent <= 100
    ? Math.floor(body.houseTakePercent)
    : typeof body.houseTakePercent === "string"
      ? Math.max(0, Math.min(100, parseInt(body.houseTakePercent, 10) || current.houseTakePercent))
      : current.houseTakePercent;

  const scratchRaw = body.scratchOff ?? {};
  const scratchDailyLimit = typeof scratchRaw.dailyLimit === "number" && scratchRaw.dailyLimit >= 1
    ? Math.floor(scratchRaw.dailyLimit)
    : typeof scratchRaw.dailyLimit === "string"
      ? Math.max(1, (parseInt(scratchRaw.dailyLimit, 10) || current.scratchOff.dailyLimit) ?? 20)
      : current.scratchOff.dailyLimit ?? 20;
  const scratchCost = typeof scratchRaw.cost === "number" && scratchRaw.cost >= 1
    ? Math.floor(scratchRaw.cost)
    : typeof scratchRaw.cost === "string"
      ? Math.max(1, parseInt(scratchRaw.cost, 10) || current.scratchOff.cost)
      : current.scratchOff.cost;
  const scratchOdds = scratchRaw.winChanceDenom && typeof scratchRaw.winChanceDenom === "object" && !Array.isArray(scratchRaw.winChanceDenom)
    ? {
        JACKPOT: Math.max(1, Math.floor(scratchRaw.winChanceDenom.JACKPOT ?? current.scratchOff.winChanceDenom.JACKPOT ?? 200)),
        DIAMOND: Math.max(1, Math.floor(scratchRaw.winChanceDenom.DIAMOND ?? current.scratchOff.winChanceDenom.DIAMOND ?? 100)),
        GOLD: Math.max(1, Math.floor(scratchRaw.winChanceDenom.GOLD ?? current.scratchOff.winChanceDenom.GOLD ?? 50)),
        STAR: Math.max(1, Math.floor(scratchRaw.winChanceDenom.STAR ?? current.scratchOff.winChanceDenom.STAR ?? 25)),
        CLOVER: Math.max(1, Math.floor(scratchRaw.winChanceDenom.CLOVER ?? current.scratchOff.winChanceDenom.CLOVER ?? 15)),
        LUCKY: Math.max(1, Math.floor(scratchRaw.winChanceDenom.LUCKY ?? current.scratchOff.winChanceDenom.LUCKY ?? 10)),
      }
    : current.scratchOff.winChanceDenom;
  const scratchPaytable = scratchRaw.paytable && typeof scratchRaw.paytable === "object"
    ? {
        JACKPOT: Math.max(0, Math.floor(scratchRaw.paytable.JACKPOT ?? current.scratchOff.paytable.JACKPOT ?? 50)),
        DIAMOND: Math.max(0, Math.floor(scratchRaw.paytable.DIAMOND ?? current.scratchOff.paytable.DIAMOND ?? 20)),
        GOLD: Math.max(0, Math.floor(scratchRaw.paytable.GOLD ?? current.scratchOff.paytable.GOLD ?? 10)),
        STAR: Math.max(0, Math.floor(scratchRaw.paytable.STAR ?? current.scratchOff.paytable.STAR ?? 5)),
        CLOVER: Math.max(0, Math.floor(scratchRaw.paytable.CLOVER ?? current.scratchOff.paytable.CLOVER ?? 3)),
        LUCKY: Math.max(0, Math.floor(scratchRaw.paytable.LUCKY ?? current.scratchOff.paytable.LUCKY ?? 1)),
      }
    : current.scratchOff.paytable;

  const settings = {
    ticketCost: Math.max(1, ticketCost),
    startingPool: Math.max(0, startingPool),
    houseTakePercent: Math.max(0, Math.min(100, houseTakePercent)),
    scratchOff: {
      cost: Math.max(1, scratchCost),
      dailyLimit: Math.max(1, scratchDailyLimit),
      paytable: scratchPaytable,
      winChanceDenom: scratchOdds,
    },
  };

  saveLotterySettings(settings);
  return NextResponse.json(settings);
}
