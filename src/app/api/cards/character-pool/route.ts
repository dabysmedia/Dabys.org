import { NextResponse } from "next/server";
import { buildCharacterPool } from "@/lib/cards";

export async function GET() {
  try {
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
