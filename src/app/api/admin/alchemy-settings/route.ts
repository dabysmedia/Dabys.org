import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAlchemySettings, saveAlchemySettings } from "@/lib/data";
import type { AlchemySettings } from "@/lib/data";

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

  const num = (v: unknown, fallback: number, min = 0, max = 100) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  const updated: AlchemySettings = {
    prismTransmuteEpicHoloCount: num(body.prismTransmuteEpicHoloCount, current.prismTransmuteEpicHoloCount, 1, 10),
    prismTransmuteSuccessChance: num(body.prismTransmuteSuccessChance, current.prismTransmuteSuccessChance, 0, 100),
    prismsPerTransmute: num(body.prismsPerTransmute, current.prismsPerTransmute, 1, 100),
    prismaticCraftBaseChance: num(body.prismaticCraftBaseChance, current.prismaticCraftBaseChance, 0, 100),
    prismaticCraftChancePerPrism: num(body.prismaticCraftChancePerPrism, current.prismaticCraftChancePerPrism, 0, 100),
    prismaticCraftMaxPrisms: num(body.prismaticCraftMaxPrisms, current.prismaticCraftMaxPrisms, 1, 100),
    prismaticCraftFailureStardust: num(body.prismaticCraftFailureStardust, current.prismaticCraftFailureStardust, 0, 10000),
    epicHoloForgePrisms: num(body.epicHoloForgePrisms, current.epicHoloForgePrisms, 0, 100),
    holoUpgradeChance: num(body.holoUpgradeChance, current.holoUpgradeChance, 0, 100),
    prismaticUpgradeChance: num(body.prismaticUpgradeChance, current.prismaticUpgradeChance, 0, 100),
    darkMatterUpgradeChance: num(body.darkMatterUpgradeChance, current.darkMatterUpgradeChance, 0, 100),
  };

  saveAlchemySettings(updated);
  return NextResponse.json(updated);
}
