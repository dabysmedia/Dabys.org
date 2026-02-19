import { NextResponse } from "next/server";
import { getAlchemySettings } from "@/lib/data";

/** Public read-only endpoint for alchemy settings (used by cards page for display). */
export async function GET() {
  const settings = getAlchemySettings();
  return NextResponse.json(settings);
}
