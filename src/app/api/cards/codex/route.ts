import { NextResponse } from "next/server";
import {
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCodexUnlockedAltArtCharacterIds,
  getCodexUnlockedBoysCharacterIds,
} from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const characterIds = getCodexUnlockedCharacterIds(userId);
  const holoCharacterIds = getCodexUnlockedHoloCharacterIds(userId);
  const altArtCharacterIds = getCodexUnlockedAltArtCharacterIds(userId);
  const boysCharacterIds = getCodexUnlockedBoysCharacterIds(userId);
  return NextResponse.json({
    characterIds,
    holoCharacterIds,
    altArtCharacterIds,
    boysCharacterIds,
  });
}
