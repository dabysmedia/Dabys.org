import { NextResponse } from "next/server";
import {
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCodexUnlockedPrismaticCharacterIds,
  getCodexUnlockedDarkMatterCharacterIds,
  getCodexUnlockedAltArtCharacterIds,
  getCodexUnlockedAltArtHoloCharacterIds,
  getCodexUnlockedAltArtPrismaticCharacterIds,
  getCodexUnlockedAltArtDarkMatterCharacterIds,
  getCodexUnlockedBoysCharacterIds,
  getPrismaticForgeUnlocked,
  getLegendaryOwnershipBySlotId,
  getLegendarySlotNotesBySlot,
  getPublishedCommunitySets,
  getCommunityCodexUnlockedCharacterIds,
  getCommunityCodexUnlockedBaseCharacterIds,
  getCommunityCodexUnlockedHoloCharacterIds,
  getCommunityCodexUnlockedPrismaticCharacterIds,
  getCommunityCodexUnlockedDarkMatterCharacterIds,
  getCreditSettings,
  getUsers,
} from "@/lib/data";
import { hasCompletedCommunitySet } from "@/lib/cards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const characterIds = getCodexUnlockedCharacterIds(userId);
  const holoCharacterIds = getCodexUnlockedHoloCharacterIds(userId);
  const prismaticCharacterIds = getCodexUnlockedPrismaticCharacterIds(userId);
  const darkMatterCharacterIds = getCodexUnlockedDarkMatterCharacterIds(userId);
  const altArtCharacterIds = getCodexUnlockedAltArtCharacterIds(userId);
  const altArtHoloCharacterIds = getCodexUnlockedAltArtHoloCharacterIds(userId);
  const altArtPrismaticCharacterIds = getCodexUnlockedAltArtPrismaticCharacterIds(userId);
  const altArtDarkMatterCharacterIds = getCodexUnlockedAltArtDarkMatterCharacterIds(userId);
  const boysCharacterIds = getCodexUnlockedBoysCharacterIds(userId);
  const prismaticForgeUnlocked = getPrismaticForgeUnlocked(userId);
  const legendaryOwnedBy = getLegendaryOwnershipBySlotId();
  const legendarySlotNotes = getLegendarySlotNotesBySlot(legendaryOwnedBy);

  const publishedCommunitySetsRaw = getPublishedCommunitySets();
  const users = getUsers();
  const userById = new Map(users.map((u) => [u.id, u]));
  const publishedCommunitySets = publishedCommunitySetsRaw.map((set) => ({
    ...set,
    creatorName: userById.get(set.creatorId)?.name ?? "Unknown",
  }));
  const communityCodexBySet: Record<string, string[]> = {};
  const communityCodexBaseBySet: Record<string, string[]> = {};
  const communityCodexHoloBySet: Record<string, string[]> = {};
  const communityCodexPrismaticBySet: Record<string, string[]> = {};
  const communityCodexDarkMatterBySet: Record<string, string[]> = {};
  const completedCommunitySetIds: string[] = [];
  for (const set of publishedCommunitySets) {
    communityCodexBySet[set.id] = getCommunityCodexUnlockedCharacterIds(userId, set.id);
    communityCodexBaseBySet[set.id] = getCommunityCodexUnlockedBaseCharacterIds(userId, set.id);
    communityCodexHoloBySet[set.id] = getCommunityCodexUnlockedHoloCharacterIds(userId, set.id);
    communityCodexPrismaticBySet[set.id] = getCommunityCodexUnlockedPrismaticCharacterIds(userId, set.id);
    communityCodexDarkMatterBySet[set.id] = getCommunityCodexUnlockedDarkMatterCharacterIds(userId, set.id);
    if (hasCompletedCommunitySet(userId, set.id)) completedCommunitySetIds.push(set.id);
  }
  const communityCreditPrices = {
    createPrice: getCreditSettings().communitySetCreatePrice,
    extraCardPrice: getCreditSettings().communitySetExtraCardPrice,
  };

  return NextResponse.json({
    characterIds,
    holoCharacterIds,
    prismaticCharacterIds,
    darkMatterCharacterIds,
    altArtCharacterIds,
    altArtHoloCharacterIds,
    altArtPrismaticCharacterIds,
    altArtDarkMatterCharacterIds,
    boysCharacterIds,
    prismaticForgeUnlocked,
    legendaryOwnedBy,
    legendarySlotNotes,
    publishedCommunitySets,
    communityCodexBySet,
    communityCodexBaseBySet,
    communityCodexHoloBySet,
    communityCodexPrismaticBySet,
    communityCodexDarkMatterBySet,
    completedCommunitySetIds,
    communityCreditPrices,
  });
}
