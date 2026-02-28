import { NextResponse } from "next/server";
import {
  getCommunitySetById,
  saveCommunitySet,
  getCharacterPool,
  saveCharacterPool,
} from "@/lib/data";
import type { CharacterPortrayal } from "@/lib/data";

/** POST - Publish a draft community set (add cards to pool) */
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
  if (set.status !== "draft") {
    return NextResponse.json({ error: "Set is already published" }, { status: 400 });
  }

  if (set.cards.length < 6) {
    return NextResponse.json(
      { error: "Set must have at least 6 cards before publishing" },
      { status: 400 }
    );
  }

  const pool = getCharacterPool();
  const existingIds = new Set(pool.map((c) => c.characterId));
  const newEntries: CharacterPortrayal[] = [];

  for (let i = 0; i < set.cards.length; i++) {
    const card = set.cards[i];
    const characterId = `${id}-${i}`;
    if (existingIds.has(characterId)) continue;

    const entry: CharacterPortrayal & { communitySetId?: string } = {
      characterId,
      actorName: card.actorName,
      characterName: card.characterName,
      profilePath: card.profilePath,
      movieTmdbId: 0,
      movieTitle: set.name,
      popularity: 0,
      rarity: card.rarity,
      cardType: "community",
      communitySetId: id,
    };
    newEntries.push(entry);
    existingIds.add(characterId);
  }

  saveCharacterPool([...pool, ...newEntries]);
  set.status = "published";
  saveCommunitySet(set);

  return NextResponse.json({ success: true, set, entriesAdded: newEntries.length });
}
