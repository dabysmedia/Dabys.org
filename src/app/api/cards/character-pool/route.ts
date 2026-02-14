import { NextResponse } from "next/server";
import { buildCharacterPool, cleanupGenericPoolEntries } from "@/lib/cards";
import { getCharacterPool, getCodexPoolEntries, migrateCardsAddCardType, migrateCommonToUncommon } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rebuild = searchParams.get("rebuild") === "1";
  const cleanup = searchParams.get("cleanup") === "1";
  const codex = searchParams.get("codex") === "1";
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
  if (codex) {
    const pool = getCodexPoolEntries();
    const count = getCharacterPool().length;
    return NextResponse.json({ pool, count });
  }
  const pool = getCharacterPool();
  return NextResponse.json({ pool, count: pool.length });
}
