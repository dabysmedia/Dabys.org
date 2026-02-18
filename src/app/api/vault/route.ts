import { NextResponse } from "next/server";
import { getVaultVideos, getCreditSettings } from "@/lib/data";

export async function GET() {
  const videos = getVaultVideos();
  const { vaultWatch: creditsPerWatch, vaultMinWatchMinutes } = getCreditSettings();
  return NextResponse.json({ videos, creditsPerWatch, vaultMinWatchMinutes });
}
