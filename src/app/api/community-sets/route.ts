import { NextResponse } from "next/server";
import {
  getPublishedCommunitySets,
  getCommunitySets,
  getCommunitySetById,
  saveCommunitySet,
  getCreditSettings,
  deductCredits,
  getCredits,
} from "@/lib/data";
import type { CommunitySet, CommunitySetCard } from "@/lib/data";

function generateId(): string {
  return `community-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** GET - List published community sets (public) */
export async function GET() {
  const sets = getPublishedCommunitySets();
  return NextResponse.json({ sets });
}

/** POST - Create a new community set (pay price, get draft) */
export async function POST(request: Request) {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const settings = getCreditSettings();
  const price = settings.communitySetCreatePrice;
  const balance = getCredits(userId);
  if (balance < price) {
    return NextResponse.json(
      { error: `Not enough credits. Need ${price} Xcr.` },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, price, "community_set_create", {});
  if (!deducted) {
    return NextResponse.json({ error: "Failed to deduct credits" }, { status: 400 });
  }

  const setId = generateId();
  const newSet: CommunitySet = {
    id: setId,
    creatorId: userId,
    name: "Untitled Set",
    createdAt: new Date().toISOString(),
    status: "draft",
    cards: [],
  };
  saveCommunitySet(newSet);

  return NextResponse.json({ setId, set: newSet }, { status: 201 });
}
