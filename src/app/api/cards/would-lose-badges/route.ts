import { NextResponse } from "next/server";
import { getBadgesLostIfCardsRemoved } from "@/lib/cards";
import { getProfile } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Array.isArray(body.cardIds)) {
    return NextResponse.json({ error: "cardIds must be an array" }, { status: 400 });
  }

  const cardIds = body.cardIds.filter((id: unknown): id is string => typeof id === "string");
  const allLost = getBadgesLostIfCardsRemoved(body.userId, cardIds);

  // Only warn when the user's displayed badge would be lost (profile has an affected badge)
  const profile = getProfile(body.userId);
  const displayedWinnerId = profile.displayedBadgeWinnerId ?? null;
  const badges =
    displayedWinnerId != null
      ? allLost.filter((b) => b.winnerId === displayedWinnerId)
      : [];

  return NextResponse.json({ badges });
}
