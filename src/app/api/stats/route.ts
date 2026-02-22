import { NextResponse } from "next/server";
import {
  getSubmissions,
  getWinners,
  getRatings,
  getComments,
  getWeeks,
  getUsers,
  getProfiles,
  computeDabysScorePct,
  getCreditsRaw,
  getCardsRaw,
  getCodexPoolEntries,
  getCodexUnlockedCharacterIds,
  getCodexUnlockedHoloCharacterIds,
  getCreditLedgerRaw,
  getTradesRaw,
} from "@/lib/data";

export async function GET() {
  const submissions = getSubmissions();
  const winners = getWinners();
  const ratings = getRatings();
  const comments = getComments();
  const weeks = getWeeks();
  const users = getUsers();
  const profiles = getProfiles();

  // ─── Totals ───
  const totalWeeks = weeks.length;
  const totalSubmissions = submissions.length;
  const totalWinners = winners.length;
  const totalRatings = ratings.length;
  const totalComments = comments.length;

  // ─── Credit ledger analysis ───
  const ledger = getCreditLedgerRaw();

  // Packs opened per user
  const packsOpenedByUser = new Map<string, number>();
  let totalPacksOpened = 0;
  for (const e of ledger) {
    if (e.reason === "pack_purchase") {
      packsOpenedByUser.set(e.userId, (packsOpenedByUser.get(e.userId) || 0) + 1);
      totalPacksOpened++;
    }
  }
  const packAddicts = Array.from(packsOpenedByUser.entries())
    .map(([userId, count]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: count };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Daily quest rewards per user
  const questsByUser = new Map<string, number>();
  let totalQuestsCompleted = 0;
  for (const e of ledger) {
    if (e.reason === "daily_quest_reward") {
      questsByUser.set(e.userId, (questsByUser.get(e.userId) || 0) + 1);
      totalQuestsCompleted++;
    }
  }
  const biggestQuesters = Array.from(questsByUser.entries())
    .map(([userId, count]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: count };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Casino stats per user (blackjack + slots + roulette)
  const casinoByUser = new Map<string, { hands: number; wagered: number; netPnl: number }>();
  let totalCasinoHands = 0;
  for (const e of ledger) {
    if (e.reason === "casino_blackjack" || e.reason === "casino_slots" || e.reason === "casino_roulette") {
      const cur = casinoByUser.get(e.userId) || { hands: 0, wagered: 0, netPnl: 0 };
      cur.hands += 1;
      cur.wagered += Math.abs(e.amount);
      cur.netPnl += e.amount; // negative = loss (bet placed)
      casinoByUser.set(e.userId, cur);
      totalCasinoHands++;
    } else if (
      e.reason === "casino_blackjack_win" ||
      e.reason === "casino_blackjack_push" ||
      e.reason === "casino_slots_win" ||
      e.reason === "casino_roulette_win"
    ) {
      const cur = casinoByUser.get(e.userId) || { hands: 0, wagered: 0, netPnl: 0 };
      cur.netPnl += e.amount; // positive = winnings returned
      casinoByUser.set(e.userId, cur);
    }
  }
  const highRollers = Array.from(casinoByUser.entries())
    .map(([userId, stats]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: stats.wagered, hands: stats.hands, netPnl: stats.netPnl };
    })
    .sort((a, b) => b.netPnl - a.netPnl)
    .slice(0, 10);

  // Failed legendary trade-ups (trade_up_epic gives credits = fail, no entry = success since card goes to inventory)
  let legendaryTradeUpsFailed = 0;
  const tradeUpFailsByUser = new Map<string, number>();
  for (const e of ledger) {
    if (e.reason === "trade_up_epic") {
      legendaryTradeUpsFailed++;
      tradeUpFailsByUser.set(e.userId, (tradeUpFailsByUser.get(e.userId) || 0) + 1);
    }
  }

  // Quicksell stats per user
  const quicksellByUser = new Map<string, { count: number; earned: number }>();
  let totalQuicksells = 0;
  for (const e of ledger) {
    if (e.reason === "quicksell") {
      const cur = quicksellByUser.get(e.userId) || { count: 0, earned: 0 };
      const cardCount = Array.isArray(e.metadata?.cardIds) ? (e.metadata.cardIds as string[]).length : 1;
      cur.count += cardCount;
      cur.earned += e.amount;
      quicksellByUser.set(e.userId, cur);
      totalQuicksells += cardCount;
    }
  }

  // Total credits spent (all negative ledger entries)
  let totalCreditsSpent = 0;
  let totalCreditsEarnedServer = 0;
  for (const e of ledger) {
    if (e.amount < 0) totalCreditsSpent += Math.abs(e.amount);
    if (e.amount > 0) totalCreditsEarnedServer += e.amount;
  }

  // ─── Trade stats ───
  const allTrades = getTradesRaw();
  const acceptedTrades = allTrades.filter((t) => t.status === "accepted");
  const totalTradesCompleted = acceptedTrades.length;
  const tradesByUser = new Map<string, number>();
  for (const t of acceptedTrades) {
    tradesByUser.set(t.initiatorUserId, (tradesByUser.get(t.initiatorUserId) || 0) + 1);
    tradesByUser.set(t.counterpartyUserId, (tradesByUser.get(t.counterpartyUserId) || 0) + 1);
  }
  const tradeDealers = Array.from(tradesByUser.entries())
    .map(([userId, count]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: count };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ─── Movie night stats (existing) ───

  // Most submitted movie
  const movieCount = new Map<string, { count: number; movieTitle: string; posterUrl: string; year?: string }>();
  for (const s of submissions) {
    const key = s.tmdbId != null ? `tmdb:${s.tmdbId}` : `title:${s.movieTitle.trim().toLowerCase()}`;
    const existing = movieCount.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      movieCount.set(key, { count: 1, movieTitle: s.movieTitle, posterUrl: s.posterUrl || "", year: s.year });
    }
  }
  let mostSubmittedMovie: { movieTitle: string; posterUrl: string; year?: string; count: number } | null = null;
  let maxCount = 0;
  for (const v of movieCount.values()) {
    if (v.count > maxCount) {
      maxCount = v.count;
      mostSubmittedMovie = { ...v };
    }
  }

  // Top submitters
  const submitCountByUser = new Map<string, number>();
  for (const s of submissions) {
    submitCountByUser.set(s.userName, (submitCountByUser.get(s.userName) || 0) + 1);
  }
  const topSubmitters = Array.from(submitCountByUser.entries())
    .map(([userName, count]) => ({ userName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Win leaders
  const winCountByUser = new Map<string, number>();
  for (const w of winners) {
    if (w.submittedBy) {
      winCountByUser.set(w.submittedBy, (winCountByUser.get(w.submittedBy) || 0) + 1);
    }
  }
  const winLeaders = Array.from(winCountByUser.entries())
    .map(([userName, count]) => ({ userName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Biggest skippers
  const biggestSkippers = profiles
    .filter((p) => (p.skipsUsed ?? 0) > 0)
    .map((p) => {
      const user = users.find((u) => u.id === p.userId);
      return { userName: user?.name ?? p.userId, skipsUsed: p.skipsUsed ?? 0 };
    })
    .sort((a, b) => b.skipsUsed - a.skipsUsed)
    .slice(0, 10);

  // Best rated winner
  const ratingByWinner = new Map<string, { sum: number; count: number }>();
  for (const r of ratings) {
    const cur = ratingByWinner.get(r.winnerId) || { sum: 0, count: 0 };
    cur.sum += r.stars;
    cur.count += 1;
    ratingByWinner.set(r.winnerId, cur);
  }
  let bestRatedWinner: { winnerId: string; movieTitle: string; posterUrl: string; avgStars: number; ratingCount: number; dabysScorePct: number } | null = null;
  let bestAvg = 0;
  for (const [winnerId, { sum, count }] of ratingByWinner.entries()) {
    if (count < 1) continue;
    const avg = sum / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      const winner = winners.find((w) => w.id === winnerId);
      if (winner) {
        const winnerRatings = ratings.filter((r) => r.winnerId === winnerId);
        const dabysScorePct = computeDabysScorePct(winnerRatings);
        bestRatedWinner = { winnerId, movieTitle: winner.movieTitle, posterUrl: winner.posterUrl || "", avgStars: Math.round(avg * 10) / 10, ratingCount: count, dabysScorePct };
      }
    }
  }

  // Longest movie
  const withRuntime = winners.filter((w) => w.runtime != null && w.runtime > 0);
  let longestWinner: { winnerId: string; movieTitle: string; posterUrl: string; runtimeMinutes: number } | null = null;
  if (withRuntime.length > 0) {
    const longest = withRuntime.reduce((a, b) => (a.runtime! > b.runtime! ? a : b));
    longestWinner = { winnerId: longest.id, movieTitle: longest.movieTitle, posterUrl: longest.posterUrl || "", runtimeMinutes: longest.runtime! };
  }

  // Winners by decade
  const decadeCount = new Map<string, number>();
  for (const w of winners) {
    const y = w.year ? parseInt(w.year, 10) : NaN;
    const decade = !Number.isNaN(y) ? `${Math.floor(y / 10) * 10}s` : "Unknown";
    decadeCount.set(decade, (decadeCount.get(decade) || 0) + 1);
  }
  const winnersByDecade = Array.from(decadeCount.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.count - a.count);

  // ─── TCG leaderboard data ───

  // Credits
  const creditsData = getCreditsRaw();
  const cashflowKings = creditsData
    .map((c) => {
      const user = users.find((u) => u.id === c.userId);
      return { userName: user?.name ?? c.userId, value: c.balance };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Card data
  const allCards = getCardsRaw();

  // Legendary Collectors (codex'd legendaries, not held in hand)
  const codexPool = getCodexPoolEntries();
  const legendaryCharacterIds = new Set(
    codexPool.filter((e) => e.rarity === "legendary").map((e) => e.characterId)
  );
  const legendaryByUser = new Map<string, number>();
  for (const user of users) {
    const unlocked = getCodexUnlockedCharacterIds(user.id);
    const count = unlocked.filter((id) => legendaryCharacterIds.has(id)).length;
    if (count > 0) legendaryByUser.set(user.id, count);
  }
  const legendaryCollectors = Array.from(legendaryByUser.entries())
    .map(([userId, count]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: count };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Card Collectors
  const cardsByUser = new Map<string, number>();
  for (const card of allCards) {
    cardsByUser.set(card.userId, (cardsByUser.get(card.userId) || 0) + 1);
  }
  const cardCollectors = Array.from(cardsByUser.entries())
    .map(([userId, count]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: count };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Codex Completion
  const totalCodexEntries = codexPool.length;
  const codexCompletion = users
    .map((u) => {
      const unlocked = getCodexUnlockedCharacterIds(u.id);
      const holoUnlocked = getCodexUnlockedHoloCharacterIds(u.id);
      return {
        userName: u.name,
        unlocked: unlocked.length,
        holoUnlocked: holoUnlocked.length,
        total: totalCodexEntries,
        pct: totalCodexEntries > 0 ? Math.round((unlocked.length / totalCodexEntries) * 100) : 0,
      };
    })
    .filter((e) => e.unlocked > 0)
    .sort((a, b) => b.unlocked - a.unlocked)
    .slice(0, 10);

  // Vendor Rep: most quicksells (cards vendored) per user
  const vendorReps = Array.from(quicksellByUser.entries())
    .map(([userId, stats]) => {
      const user = users.find((u) => u.id === userId);
      return { userName: user?.name ?? userId, value: stats.count };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Rarity breakdown
  const rarityBreakdown = { uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  for (const card of allCards) {
    if (card.rarity in rarityBreakdown) {
      rarityBreakdown[card.rarity as keyof typeof rarityBreakdown] += 1;
    }
  }

  return NextResponse.json({
    // Movie night
    totalWeeks,
    totalSubmissions,
    totalWinners,
    totalRatings,
    totalComments,
    mostSubmittedMovie,
    topSubmitters,
    winLeaders,
    biggestSkippers,
    bestRatedWinner,
    longestWinner,
    winnersByDecade,
    // TCG leaderboards
    cashflowKings,
    legendaryCollectors,
    cardCollectors,
    codexCompletion,
    vendorReps,
    packAddicts,
    biggestQuesters,
    highRollers,
    tradeDealers,
    // Card census
    rarityBreakdown,
    totalCards: allCards.length,
    totalCodexEntries,
    // Server-wide stats
    serverStats: {
      totalPacksOpened,
      totalCardsUnpacked: totalPacksOpened * 5,
      legendaryTradeUpsFailed,
      totalTradesCompleted,
      totalQuestsCompleted,
      totalCasinoHands,
      totalCreditsSpent,
      totalCreditsEarnedServer,
      totalQuicksells,
    },
  });
}
