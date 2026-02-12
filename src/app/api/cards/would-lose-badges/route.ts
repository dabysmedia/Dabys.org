import { NextResponse } from "next/server";
import { getBadgesLostIfCardsRemoved } from "@/lib/cards";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Array.isArray(body.cardIds)) {
    return NextResponse.json({ error: "cardIds must be an array" }, { status: 400 });
  }

  const cardIds = body.cardIds.filter((id: unknown): id is string => typeof id === "string");
  const badges = getBadgesLostIfCardsRemoved(body.userId, cardIds);

  return NextResponse.json({ badges });
}
