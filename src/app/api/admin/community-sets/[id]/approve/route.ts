import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCommunitySetById,
  saveCommunitySet,
  getCharacterPool,
  saveCharacterPool,
} from "@/lib/data";
import type { CharacterPortrayal } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST - Approve a pending community set (add to pool, set status to published) */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await params;
  const set = getCommunitySetById(id);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  if (set.status !== "pending") {
    return NextResponse.json(
      { error: "Set is not pending approval" },
      { status: 400 }
    );
  }

  const pool = getCharacterPool();
  const otherEntries = pool.filter((c) => {
    const sid = (c as { communitySetId?: string }).communitySetId;
    return sid === undefined || sid !== id;
  });
  const newEntries: (CharacterPortrayal & { communitySetId?: string })[] =
    (set.cards ?? []).map((card, i) => ({
      characterId: `${id}-${i}`,
      actorName: card.actorName,
      characterName: card.characterName,
      profilePath: card.profilePath,
      movieTmdbId: 0,
      movieTitle: set.name,
      popularity: 0,
      rarity: card.rarity,
      cardType: "community",
      communitySetId: id,
    }));

  saveCharacterPool([...otherEntries, ...newEntries]);
  set.status = "published";
  saveCommunitySet(set);

  return NextResponse.json({
    success: true,
    set,
    entriesAdded: newEntries.length,
  });
}
