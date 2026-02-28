import { NextResponse } from "next/server";
import {
  getUsers,
  getCreditsRaw,
  getCreditLedgerRaw,
  getStardustRaw,
  getCardsRaw,
  getWinners,
  getCurrentWeek,
  getSubmissions,
  getVotes,
  getCharacterPool,
  getAllPresenceStatuses,
  getListings,
  getBuyOrders,
  getFeedback,
  getActivity,
  getCommunitySets,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = getUsers();
  const creditsAll = getCreditsRaw();
  const ledger = getCreditLedgerRaw();
  const stardustAll = getStardustRaw();
  const cards = getCardsRaw();
  const winners = getWinners();
  const currentWeek = getCurrentWeek();
  const submissions = getSubmissions();
  const votes = getVotes();
  const pool = getCharacterPool();
  const presence = getAllPresenceStatuses();
  const listings = getListings();
  const buyOrders = getBuyOrders();
  const feedback = getFeedback();
  const activity = getActivity();

  // ── Economy overview ──────────────────────────────────
  const totalCredits = creditsAll.reduce((sum, c) => sum + c.balance, 0);
  const totalStardust = stardustAll.reduce((sum, s) => sum + s.balance, 0);

  // Credit flow analysis from ledger
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const twoDaysAgo = now - 48 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const last24h = ledger.filter(
    (e) => new Date(e.createdAt).getTime() > oneDayAgo
  );
  const prev24h = ledger.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t > twoDaysAgo && t <= oneDayAgo;
  });
  const last7d = ledger.filter(
    (e) => new Date(e.createdAt).getTime() > sevenDaysAgo
  );

  const creditsEarned24h = last24h
    .filter((e) => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const creditsSpent24h = last24h
    .filter((e) => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const netFlow24h = creditsEarned24h - creditsSpent24h;

  const prevEarned24h = prev24h
    .filter((e) => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const prevSpent24h = prev24h
    .filter((e) => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const prevNetFlow24h = prevEarned24h - prevSpent24h;

  const creditsEarned7d = last7d
    .filter((e) => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const creditsSpent7d = last7d
    .filter((e) => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  // Trend: compare current 24h net flow to previous 24h
  const trend: "rising" | "falling" | "stable" =
    netFlow24h > prevNetFlow24h + 10
      ? "rising"
      : netFlow24h < prevNetFlow24h - 10
        ? "falling"
        : "stable";

  // Credit breakdown by reason (last 7d)
  const reasonBreakdown: Record<string, { earned: number; spent: number; count: number }> = {};
  for (const e of last7d) {
    const key = e.reason;
    if (!reasonBreakdown[key]) reasonBreakdown[key] = { earned: 0, spent: 0, count: 0 };
    reasonBreakdown[key].count++;
    if (e.amount > 0) reasonBreakdown[key].earned += e.amount;
    else reasonBreakdown[key].spent += Math.abs(e.amount);
  }

  // Per-user credit balances (sorted by balance desc)
  const userCredits = creditsAll
    .map((c) => {
      const user = users.find((u) => u.id === c.userId);
      return { userId: c.userId, name: user?.name || `User ${c.userId}`, balance: c.balance };
    })
    .sort((a, b) => b.balance - a.balance);

  // ── Cards overview ────────────────────────────────────
  const totalCards = cards.length;
  const rarityBreakdown: Record<string, number> = {};
  const foilCount = cards.filter((c) => c.isFoil).length;
  for (const c of cards) {
    rarityBreakdown[c.rarity] = (rarityBreakdown[c.rarity] || 0) + 1;
  }

  // Cards per user
  const cardsPerUser: Record<string, number> = {};
  for (const c of cards) {
    cardsPerUser[c.userId] = (cardsPerUser[c.userId] || 0) + 1;
  }
  const userCards = Object.entries(cardsPerUser)
    .map(([userId, count]) => {
      const user = users.find((u) => u.id === userId);
      return { userId, name: user?.name || `User ${userId}`, count };
    })
    .sort((a, b) => b.count - a.count);

  // ── Presence (online status) ──────────────────────────
  const onlineCount = Object.values(presence).filter((s) => s === "online").length;
  const awayCount = Object.values(presence).filter((s) => s === "away").length;

  // ── Week status ───────────────────────────────────────
  const currentWeekSubs = currentWeek
    ? submissions.filter((s) => s.weekId === currentWeek.id)
    : [];
  const currentWeekVotes = currentWeek
    ? votes.filter((v) => v.weekId === currentWeek.id)
    : [];

  // ── Recent transactions (last 20) ────────────────────
  const recentTransactions = ledger
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((e) => {
      const user = users.find((u) => u.id === e.userId);
      return {
        ...e,
        userName: user?.name || `User ${e.userId}`,
      };
    });

  // ── Daily activity (last 7 days histogram) ────────────
  const dailyActivity: { date: string; transactions: number; earned: number; spent: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayEntries = ledger.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });
    dailyActivity.push({
      date: dayStart.toISOString().slice(0, 10),
      transactions: dayEntries.length,
      earned: dayEntries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
      spent: dayEntries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0),
    });
  }

  // ── Legendary timeline ────────────────────────────────
  // Combine legendary cards (by acquiredAt) and legendary_pull activity entries
  const legendaryCards = cards
    .filter((c) => c.rarity === "legendary")
    .map((c) => {
      const owner = users.find((u) => u.id === c.userId);
      return {
        type: "card" as const,
        cardId: c.id,
        userId: c.userId,
        userName: owner?.name ?? `User ${c.userId}`,
        actorName: c.actorName,
        characterName: c.characterName,
        movieTitle: c.movieTitle,
        isFoil: c.isFoil,
        profilePath: c.profilePath,
        timestamp: c.acquiredAt,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Also grab legendary_pull activity entries for extra context
  const legendaryPulls = activity
    .filter((a) => a.type === "legendary_pull")
    .map((a) => ({
      type: "activity" as const,
      activityId: a.id,
      userId: a.userId,
      userName: a.userName,
      message: a.message,
      meta: a.meta,
      timestamp: a.timestamp,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({
    economy: {
      totalCredits,
      totalStardust,
      trend,
      creditsEarned24h,
      creditsSpent24h,
      netFlow24h,
      creditsEarned7d,
      creditsSpent7d,
      reasonBreakdown,
      userCredits,
      dailyActivity,
    },
    cards: {
      totalCards,
      foilCount,
      rarityBreakdown,
      poolSize: pool.length,
      userCards,
    },
    users: {
      total: users.length,
      online: onlineCount,
      away: awayCount,
      offline: users.length - onlineCount - awayCount,
    },
    week: currentWeek
      ? {
          id: currentWeek.id,
          theme: currentWeek.theme || "No theme",
          phase: currentWeek.phase || "idle",
          submissionsCount: currentWeekSubs.length,
          votesCount: currentWeekVotes.length,
        }
      : null,
    site: {
      totalWinners: winners.length,
      totalSubmissions: submissions.length,
      totalVotes: votes.length,
      totalLedgerEntries: ledger.length,
      activeListings: listings.length,
      activeBuyOrders: buyOrders.length,
      pendingFeedback: feedback.length,
      pendingCommunitySets: getCommunitySets().filter((s) => s.status === "pending").length,
    },
    recentTransactions,
    legendaryTimeline: legendaryCards,
    legendaryPulls,
  });
}
