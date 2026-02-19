import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAlchemySettings, saveAlchemySettings } from "@/lib/data";
import type { AlchemySettings, AlchemyStardustRarity } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function num(v: unknown, fallback: number, min = 0, max = 100) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function mergeRarity(
  raw: Partial<AlchemyStardustRarity> | undefined,
  current: AlchemyStardustRarity,
  min = 0,
  max = 10000
): AlchemyStardustRarity {
  if (!raw || typeof raw !== "object") return current;
  return {
    uncommon: num(raw.uncommon, current.uncommon, min, max),
    rare: num(raw.rare, current.rare, min, max),
    epic: num(raw.epic, current.epic, min, max),
    legendary: num(raw.legendary, current.legendary, min, max),
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const settings = getAlchemySettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  let body: Partial<AlchemySettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = getAlchemySettings();

  const updated: AlchemySettings = {
    prismTransmuteEpicHoloCount: num(body.prismTransmuteEpicHoloCount, current.prismTransmuteEpicHoloCount, 1, 10),
    prismTransmuteSuccessChance: num(body.prismTransmuteSuccessChance, current.prismTransmuteSuccessChance, 0, 100),
    prismsPerTransmute: num(body.prismsPerTransmute, current.prismsPerTransmute, 1, 100),
    prismaticCraftBaseChance: num(body.prismaticCraftBaseChance, current.prismaticCraftBaseChance, 0, 100),
    prismaticCraftChancePerPrism: num(body.prismaticCraftChancePerPrism, current.prismaticCraftChancePerPrism, 0, 100),
    prismaticCraftMaxPrisms: num(body.prismaticCraftMaxPrisms, current.prismaticCraftMaxPrisms, 1, 100),
    prismaticCraftFailureStardust: num(body.prismaticCraftFailureStardust, current.prismaticCraftFailureStardust, 0, 10000),
    epicHoloForgePrisms: num(body.epicHoloForgePrisms, current.epicHoloForgePrisms, 0, 100),
    holoUpgradeChance: mergeRarity(body.holoUpgradeChance, current.holoUpgradeChance, 0, 100),
    prismaticUpgradeChance: num(body.prismaticUpgradeChance, current.prismaticUpgradeChance, 0, 100),
    darkMatterUpgradeChance: num(body.darkMatterUpgradeChance, current.darkMatterUpgradeChance, 0, 100),
    disenchantHolo: mergeRarity(body.disenchantHolo, current.disenchantHolo),
    packAPunchCost: mergeRarity(body.packAPunchCost, current.packAPunchCost),
  };

  saveAlchemySettings(updated);
  return NextResponse.json(updated);
}
