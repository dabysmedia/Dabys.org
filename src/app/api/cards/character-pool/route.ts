import { NextResponse } from "next/server";
import { buildCharacterPool, cleanupGenericPoolEntries } from "@/lib/cards";
import { getCharacterPool, migrateCardsAddCardType, migrateCommonToUncommon } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rebuild = searchParams.get("rebuild") === "1";
  const cleanup = searchParams.get("cleanup") === "1";
  if (cleanup) {
    const pool = cleanupGenericPoolEntries();
    return NextResponse.json({ pool, count: pool.length });
  }
  if (rebuild) {
    try {
      migrateCardsAddCardType();
      migrateCommonToUncommon();
      const pool = await buildCharacterPool();
      return NextResponse.json({ pool, count: pool.length });
    } catch (e) {
      console.error("Character pool build error", e);
      return NextResponse.json(
        { error: "Failed to build character pool" },
        { status: 500 }
      );
    }
  }
  const pool = getCharacterPool();
  return NextResponse.json({ pool, count: pool.length });
}
