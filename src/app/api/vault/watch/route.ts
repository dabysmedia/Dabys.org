import { NextResponse } from "next/server";
import {
  getVaultVideos,
  hasReceivedCreditsForVaultWatch,
  addCredits,
  getCreditSettings,
} from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!body.videoId || typeof body.videoId !== "string") {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  const videos = getVaultVideos();
  const video = videos.find((v) => v.id === body.videoId);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (hasReceivedCreditsForVaultWatch(body.userId, body.videoId)) {
    return NextResponse.json({
      success: false,
      alreadyClaimed: true,
      message: "You have already claimed credits for this video.",
    });
  }

  const { vaultWatch: amount } = getCreditSettings();
  if (amount <= 0) {
    return NextResponse.json({
      success: false,
      message: "Vault watch rewards are not configured.",
    });
  }

  addCredits(body.userId, amount, "vault_watch", {
    videoId: body.videoId,
    youtubeId: video.youtubeId,
  });

  return NextResponse.json({
    success: true,
    creditsAwarded: amount,
  });
}
