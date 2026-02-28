import { NextResponse } from "next/server";
import { getCommunitySetById, saveCommunitySet } from "@/lib/data";
import type { CommunitySet, CommunitySetCard } from "@/lib/data";

/** GET - Get a single community set by ID */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const set = getCommunitySetById(id);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  return NextResponse.json(set);
}

/** PATCH - Update a draft community set (name, cards) - creator only */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { userId?: string; name?: string; cards?: CommunitySetCard[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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
  if (set.status !== "draft") {
    return NextResponse.json({ error: "Cannot edit a published set" }, { status: 400 });
  }

  const updates: Partial<CommunitySet> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (Array.isArray(body.cards)) {
    const validCards: CommunitySetCard[] = body.cards
      .filter(
        (c) =>
          c &&
          typeof c.actorName === "string" &&
          typeof c.profilePath === "string" &&
          c.profilePath.trim()
      )
      .map((c) => ({
        actorName: (c.actorName as string).trim(),
        characterName: typeof c.characterName === "string" ? c.characterName.trim() : "",
        profilePath: (c.profilePath as string).trim(),
        rarity: ["uncommon", "rare", "epic", "legendary"].includes(c.rarity as string)
          ? (c.rarity as CommunitySetCard["rarity"])
          : "uncommon",
      }));
    updates.cards = validCards;
  }

  const updated: CommunitySet = { ...set, ...updates };
  saveCommunitySet(updated);
  return NextResponse.json(updated);
}
