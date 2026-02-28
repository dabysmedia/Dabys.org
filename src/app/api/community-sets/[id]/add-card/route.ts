import { NextResponse } from "next/server";
import {
  getCommunitySetById,
  saveCommunitySet,
  getCreditSettings,
  deductCredits,
  getCredits,
} from "@/lib/data";
import type { CommunitySetCard } from "@/lib/data";

/** POST - Add an extra card slot to a draft community set (pay per card) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const userId = body.userId;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const set = getCommunitySetById(id);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  if (set.creatorId !== userId) {
    return NextResponse.json({ error: "Not the creator of this set" }, { status: 403 });
  }

  const settings = getCreditSettings();
  const price = settings.communitySetExtraCardPrice;
  const balance = getCredits(userId);
  if (balance < price) {
    return NextResponse.json(
      { error: `Not enough credits. Need ${price} Xcr per extra card.` },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, price, "community_set_extra_card", { setId: id });
  if (!deducted) {
    return NextResponse.json({ error: "Failed to deduct credits" }, { status: 400 });
  }

  const emptyCard: CommunitySetCard = {
    actorName: "",
    characterName: "",
    profilePath: "",
    rarity: "uncommon",
  };
  set.cards = [...set.cards, emptyCard];
  saveCommunitySet(set);

  return NextResponse.json({ success: true, set, cardIndex: set.cards.length - 1 });
}
