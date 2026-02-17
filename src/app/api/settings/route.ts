import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/data";

export async function GET() {
  const settings = getSiteSettings();
  return NextResponse.json({
    marketplaceEnabled: settings.marketplaceEnabled,
  });
}
