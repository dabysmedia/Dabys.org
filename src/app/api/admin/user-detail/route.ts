import { NextRequest, NextResponse } from "next/server";
import {
  getUsers,
  getCreditsRaw,
  getCreditLedgerRaw,
  getStardustRaw,
  getCardsRaw,
  getActivity,
  getAllPresenceStatuses,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const creditsAll = getCreditsRaw();
  const ledger = getCreditLedgerRaw();
  const stardustAll = getStardustRaw();
  const cards = getCardsRaw();
  const activity = getActivity();
  const presence = getAllPresenceStatuses();

  // ── User basics ──
  const creditEntry = creditsAll.find((c) => c.userId === userId);
  const balance = creditEntry?.balance ?? 0;
  const stardustEntry = stardustAll.find((s) => s.userId === userId);
  const stardust = stardustEntry?.balance ?? 0;
  const status = presence[userId] ?? "offline";

  // ── User cards ──
  const userCards = cards.filter((c) => c.userId === userId);
  const cardCount = userCards.length;
  const cardRarityBreakdown: Record<string, number> = {};
  for (const c of userCards) {
    cardRarityBreakdown[c.rarity] = (cardRarityBreakdown[c.rarity] || 0) + 1;
  }
  const foilCount = userCards.filter((c) => c.isFoil).length;

  // Legendary cards owned with acquisition dates
  const legendaryCards = userCards
    .filter((c) => c.rarity === "legendary")
    .map((c) => ({
      id: c.id,
      characterId: c.characterId,
      actorName: c.actorName,
      characterName: c.characterName,
      movieTitle: c.movieTitle,
      isFoil: c.isFoil,
      acquiredAt: c.acquiredAt,
      profilePath: c.profilePath,
    }))
    .sort(
      (a, b) =>
        new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime()
    );

  // ── User ledger (all transactions for this user) ──
  const userLedger = ledger
    .filter((e) => e.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  // ── 24h analysis ──
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const last24h = userLedger.filter(
    (e) => new Date(e.createdAt).getTime() > oneDayAgo
  );
  const last7d = userLedger.filter(
    (e) => new Date(e.createdAt).getTime() > sevenDaysAgo
  );

  const earned24h = last24h
    .filter((e) => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const spent24h = last24h
    .filter((e) => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const net24h = earned24h - spent24h;

  const earned7d = last7d
    .filter((e) => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const spent7d = last7d
    .filter((e) => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const net7d = earned7d - spent7d;

  // ── Credit trend & rate ──
  // Calculate daily net for each of the last 7 days
  const dailyNet: { date: string; earned: number; spent: number; net: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayEntries = userLedger.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });
    const dayEarned = dayEntries
      .filter((e) => e.amount > 0)
      .reduce((s, e) => s + e.amount, 0);
    const daySpent = dayEntries
      .filter((e) => e.amount < 0)
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    dailyNet.push({
      date: dayStart.toISOString().slice(0, 10),
      earned: dayEarned,
      spent: daySpent,
      net: dayEarned - daySpent,
    });
  }

  // Rate: average net credits per day over the last 7 days
  const activeDays = dailyNet.filter(
    (d) => d.earned > 0 || d.spent > 0
  ).length;
  const ratePerDay = activeDays > 0 ? Math.round(net7d / activeDays) : 0;

  // Trend: compare last 3 days vs prior 4 days average
  const recentDays = dailyNet.slice(-3);
  const olderDays = dailyNet.slice(0, 4);
  const recentAvg =
    recentDays.reduce((s, d) => s + d.net, 0) / Math.max(recentDays.length, 1);
  const olderAvg =
    olderDays.reduce((s, d) => s + d.net, 0) / Math.max(olderDays.length, 1);

  let trend: "gaining" | "losing" | "stable";
  if (net7d > 50 && recentAvg >= olderAvg - 5) {
    trend = "gaining";
  } else if (net7d < -50 && recentAvg <= olderAvg + 5) {
    trend = "losing";
  } else if (recentAvg > olderAvg + 20) {
    trend = "gaining";
  } else if (recentAvg < olderAvg - 20) {
    trend = "losing";
  } else {
    trend = "stable";
  }

  // ── Activity breakdown by reason (24h) ──
  const reasonBreakdown24h: Record<
    string,
    { earned: number; spent: number; count: number }
  > = {};
  for (const e of last24h) {
    const key = e.reason;
    if (!reasonBreakdown24h[key])
      reasonBreakdown24h[key] = { earned: 0, spent: 0, count: 0 };
    reasonBreakdown24h[key].count++;
    if (e.amount > 0) reasonBreakdown24h[key].earned += e.amount;
    else reasonBreakdown24h[key].spent += Math.abs(e.amount);
  }

  // ── Activity feed entries for this user ──
  const userActivity = activity
    .filter((a) => a.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  // ── Recent transactions (last 50 for the user) ──
  const recentTransactions = userLedger.slice(0, 50).map((e) => ({
    id: e.id,
    amount: e.amount,
    reason: e.reason,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      status,
      balance,
      stardust,
    },
    cards: {
      total: cardCount,
      foilCount,
      rarityBreakdown: cardRarityBreakdown,
      legendaryCards,
    },
    economy: {
      earned24h,
      spent24h,
      net24h,
      earned7d,
      spent7d,
      net7d,
      trend,
      ratePerDay,
      dailyNet,
      reasonBreakdown24h,
    },
    recentTransactions,
    activity: userActivity,
    totalTransactions: userLedger.length,
  });
}
