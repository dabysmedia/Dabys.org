import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCommunitySetById,
  deleteCommunitySet,
  getCharacterPool,
  saveCharacterPool,
  saveCommunitySet,
  getCreditSettings,
  addCredits,
} from "@/lib/data";
import type { CommunitySet, CommunitySetCard } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** PATCH - Admin edit a community set (name, cards) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await params;
  let body: { name?: string; cards?: CommunitySetCard[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const set = getCommunitySetById(id);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
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
        altArts: Array.isArray(c.altArts)
          ? c.altArts
              .filter((a) => a && typeof a.profilePath === "string" && a.profilePath.trim())
              .map((a) => ({ profilePath: (a.profilePath as string).trim() }))
          : undefined,
      }));
    updates.cards = validCards;
  }

  const updated: CommunitySet = { ...set, ...updates };
  saveCommunitySet(updated);

  if (updated.status === "published" && Array.isArray(updated.cards) && id) {
    const pool = getCharacterPool();
    const otherEntries = pool.filter((c) => {
      const sid = (c as { communitySetId?: string }).communitySetId;
      return sid === undefined || sid !== id;
    });
    const newEntries: { characterId: string; actorName: string; characterName: string; profilePath: string; movieTmdbId: number; movieTitle: string; popularity: number; rarity: string; cardType: "community"; communitySetId: string; altArtOfCharacterId?: string }[] = [];
    for (let i = 0; i < updated.cards.length; i++) {
      const card = updated.cards[i];
      const baseId = `${id}-${i}`;
      newEntries.push({
        characterId: baseId,
        actorName: card.actorName,
        characterName: card.characterName,
        profilePath: card.profilePath,
        movieTmdbId: 0,
        movieTitle: updated.name,
        popularity: 0,
        rarity: card.rarity,
        cardType: "community",
        communitySetId: id,
      });
      const alts = card.altArts ?? [];
      for (let j = 0; j < alts.length; j++) {
        const alt = alts[j];
        if (alt?.profilePath?.trim()) {
          newEntries.push({
            characterId: `${baseId}-alt-${j}`,
            altArtOfCharacterId: baseId,
            actorName: card.actorName,
            characterName: card.characterName,
            profilePath: alt.profilePath.trim(),
            movieTmdbId: 0,
            movieTitle: updated.name,
            popularity: 0,
            rarity: card.rarity,
            cardType: "community",
            communitySetId: id,
          });
        }
      }
    }
    saveCharacterPool([...otherEntries, ...newEntries]);
  }

  return NextResponse.json(updated);
}

/** DELETE - Admin remove a community set (and its pool entries) */
export async function DELETE(
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

  const pool = getCharacterPool();
  const otherEntries = pool.filter((c) => {
    const sid = (c as { communitySetId?: string }).communitySetId;
    return sid === undefined || sid !== id;
  });
  saveCharacterPool(otherEntries);

  if (set.status === "draft" || set.status === "pending") {
    const settings = getCreditSettings();
    const createPrice = settings.communitySetCreatePrice;
    const extraCardPrice = settings.communitySetExtraCardPrice;
    const extraCardCount = Math.max(0, (set.cards?.length ?? 0) - 6);
    const refund = createPrice + extraCardCount * extraCardPrice;
    addCredits(set.creatorId, refund, "community_set_admin_remove", { setId: id });
  }

  deleteCommunitySet(id);

  return NextResponse.json({ success: true });
}
