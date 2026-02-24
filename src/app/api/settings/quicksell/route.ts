import { NextResponse } from "next/server";
import { getCreditSettings } from "@/lib/data";

/** Public endpoint: returns current quicksell credits per rarity for UI display. */
export async function GET() {
  const settings = getCreditSettings();
  return NextResponse.json({
    quicksellUncommon: settings.quicksellUncommon,
    quicksellRare: settings.quicksellRare,
    quicksellEpic: settings.quicksellEpic,
    quicksellLegendary: settings.quicksellLegendary,
  });
}
