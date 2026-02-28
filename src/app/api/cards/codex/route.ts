import { NextResponse } from "next/server";
import {
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCodexUnlockedPrismaticCharacterIds,
  getCodexUnlockedDarkMatterCharacterIds,
  getCodexUnlockedAltArtCharacterIds,
  getCodexUnlockedAltArtHoloCharacterIds,
  getCodexUnlockedBoysCharacterIds,
  getPrismaticForgeUnlocked,
  getLegendaryOwnershipBySlotId,
} from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const characterIds = getCodexUnlockedCharacterIds(userId);
  const holoCharacterIds = getCodexUnlockedHoloCharacterIds(userId);
  const prismaticCharacterIds = getCodexUnlockedPrismaticCharacterIds(userId);
  const darkMatterCharacterIds = getCodexUnlockedDarkMatterCharacterIds(userId);
  const altArtCharacterIds = getCodexUnlockedAltArtCharacterIds(userId);
  const altArtHoloCharacterIds = getCodexUnlockedAltArtHoloCharacterIds(userId);
  const boysCharacterIds = getCodexUnlockedBoysCharacterIds(userId);
  const prismaticForgeUnlocked = getPrismaticForgeUnlocked(userId);
  const legendaryOwnedBy = getLegendaryOwnershipBySlotId();
  return NextResponse.json({
    characterIds,
    holoCharacterIds,
    prismaticCharacterIds,
    darkMatterCharacterIds,
    altArtCharacterIds,
    altArtHoloCharacterIds,
    boysCharacterIds,
    prismaticForgeUnlocked,
    legendaryOwnedBy,
  });
}
