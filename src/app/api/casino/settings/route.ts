import { NextResponse } from "next/server";
import { getCasinoGameSettings } from "@/lib/data";

/** Public: returns bet limits for slots, blackjack, roulette (for UI). */
export async function GET() {
  const settings = getCasinoGameSettings();
  return NextResponse.json(settings);
}
