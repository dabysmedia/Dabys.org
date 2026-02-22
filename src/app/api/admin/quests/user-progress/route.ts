import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserDailyQuests, setUserDailyQuestState } from "@/lib/quests";
import {
  getUserLifetimeStats,
  setUserLifetimeStats,
  getMainQuestProgress,
  getClaimedMainQuestIds,
  claimMainQuest,
  unclaimMainQuest,
} from "@/lib/mainQuests";
import type { UserLifetimeStats } from "@/lib/mainQuests";
import {
  getSetCompletionQuests,
  addSetCompletionQuest,
  addHoloSetCompletionQuest,
  addPrismaticSetCompletionQuest,
  addDarkMatterSetCompletionQuest,
  setSetCompletionQuestClaimed,
  removeSetCompletionQuestForUserByTier,
  getWinners,
} from "@/lib/data";
import type { SetCompletionTier } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const dailyQuests = getUserDailyQuests(userId.trim());
  const lifetimeStats = getUserLifetimeStats(userId.trim());
  const mainProgress = getMainQuestProgress(userId.trim());
  const claimedMainIds = Array.from(getClaimedMainQuestIds(userId.trim()));
  const setCompletionQuests = getSetCompletionQuests(userId.trim());

  return NextResponse.json({
    dailyQuests,
    lifetimeStats,
    mainProgress,
    claimedMainIds,
    setCompletionQuests,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const type = body.type as "daily" | "main" | "main_claim" | "set_completion" | undefined;
  if (type === "daily") {
    const questIndex = body.questIndex as number | undefined;
    if (typeof questIndex !== "number" || questIndex < 0) {
      return NextResponse.json({ error: "questIndex required (number >= 0)" }, { status: 400 });
    }
    const result = setUserDailyQuestState(userId.trim(), questIndex, {
      completed: body.completed,
      claimed: body.claimed,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (type === "main") {
    const stats = body.stats as Partial<UserLifetimeStats> | undefined;
    if (!stats || typeof stats !== "object") {
      return NextResponse.json({ error: "stats object required" }, { status: 400 });
    }
    setUserLifetimeStats(userId.trim(), stats);
    return NextResponse.json({ success: true });
  }

  if (type === "main_claim") {
    const questId = body.questId as string | undefined;
    const claim = body.claim as boolean | undefined;
    if (!questId?.trim()) {
      return NextResponse.json({ error: "questId required" }, { status: 400 });
    }
    if (claim) {
      claimMainQuest(userId.trim(), questId.trim());
    } else {
      unclaimMainQuest(userId.trim(), questId.trim());
    }
    return NextResponse.json({ success: true });
  }

  if (type === "set_completion") {
    const action = body.action as "add" | "remove" | "set_claimed" | undefined;
    const winnerId = body.winnerId as string | undefined;
    const tier = body.tier as SetCompletionTier | undefined;
    if (!winnerId?.trim()) {
      return NextResponse.json({ error: "winnerId required" }, { status: 400 });
    }
    const uid = userId.trim();
    const wid = winnerId.trim();
    const winners = getWinners();
    const winner = winners.find((w) => w.id === wid);
    const movieTitle = winner?.movieTitle ?? "Unknown";

    if (action === "add") {
      if (!tier || !["regular", "holo", "prismatic", "darkMatter"].includes(tier)) {
        return NextResponse.json({ error: "tier required: regular, holo, prismatic, or darkMatter" }, { status: 400 });
      }
      const added =
        tier === "regular"
          ? addSetCompletionQuest(uid, wid, movieTitle)
          : tier === "holo"
            ? addHoloSetCompletionQuest(uid, wid, movieTitle)
            : tier === "prismatic"
              ? addPrismaticSetCompletionQuest(uid, wid, movieTitle)
              : addDarkMatterSetCompletionQuest(uid, wid, movieTitle);
      return NextResponse.json({ success: true, added });
    }

    if (action === "remove") {
      if (!tier || !["regular", "holo", "prismatic", "darkMatter"].includes(tier)) {
        return NextResponse.json({ error: "tier required: regular, holo, prismatic, or darkMatter" }, { status: 400 });
      }
      const removed = removeSetCompletionQuestForUserByTier(uid, wid, tier);
      return NextResponse.json({ success: true, removed });
    }

    if (action === "set_claimed") {
      if (!tier || !["regular", "holo", "prismatic", "darkMatter"].includes(tier)) {
        return NextResponse.json({ error: "tier required: regular, holo, prismatic, or darkMatter" }, { status: 400 });
      }
      const claimed = body.claimed === true;
      const updated = setSetCompletionQuestClaimed(uid, wid, tier, claimed);
      return NextResponse.json({ success: true, updated });
    }

    return NextResponse.json({ error: "action must be add, remove, or set_claimed" }, { status: 400 });
  }

  return NextResponse.json({ error: "type must be 'daily', 'main', 'main_claim', or 'set_completion'" }, { status: 400 });
}
