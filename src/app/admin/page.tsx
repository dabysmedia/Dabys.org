"use client";

import { useEffect, useState, useMemo } from "react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface DashboardData {
  economy: {
    totalCredits: number;
    totalStardust: number;
    trend: "rising" | "falling" | "stable";
    creditsEarned24h: number;
    creditsSpent24h: number;
    netFlow24h: number;
    creditsEarned7d: number;
    creditsSpent7d: number;
    reasonBreakdown: Record<string, { earned: number; spent: number; count: number }>;
    userCredits: { userId: string; name: string; balance: number }[];
    dailyActivity: { date: string; transactions: number; earned: number; spent: number }[];
  };
  cards: {
    totalCards: number;
    foilCount: number;
    rarityBreakdown: Record<string, number>;
    poolSize: number;
    userCards: { userId: string; name: string; count: number }[];
  };
  users: {
    total: number;
    online: number;
    away: number;
    offline: number;
  };
  week: {
    id: string;
    theme: string;
    phase: string;
    submissionsCount: number;
    votesCount: number;
  } | null;
  site: {
    totalWinners: number;
    totalSubmissions: number;
    totalVotes: number;
    totalLedgerEntries: number;
    activeListings: number;
    activeBuyOrders: number;
    pendingFeedback: number;
    pendingCommunitySets?: number;
  };
  recentTransactions: {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    reason: string;
    createdAt: string;
  }[];
  legendaryTimeline: {
    type: "card";
    cardId: string;
    userId: string;
    userName: string;
    actorName: string;
    characterName: string;
    movieTitle: string;
    isFoil: boolean;
    profilePath: string;
    timestamp: string;
  }[];
  legendaryPulls: {
    type: "activity";
    activityId: string;
    userId: string;
    userName: string;
    message: string;
    meta?: Record<string, unknown>;
    timestamp: string;
  }[];
}

interface UserDetailData {
  user: {
    id: string;
    name: string;
    status: "online" | "away" | "offline";
    balance: number;
    stardust: number;
  };
  cards: {
    total: number;
    foilCount: number;
    rarityBreakdown: Record<string, number>;
    legendaryCards: {
      id: string;
      characterId: string;
      actorName: string;
      characterName: string;
      movieTitle: string;
      isFoil: boolean;
      acquiredAt: string;
      profilePath: string;
    }[];
  };
  economy: {
    earned24h: number;
    spent24h: number;
    net24h: number;
    earned7d: number;
    spent7d: number;
    net7d: number;
    trend: "gaining" | "losing" | "stable";
    ratePerDay: number;
    dailyNet: { date: string; earned: number; spent: number; net: number }[];
    reasonBreakdown24h: Record<string, { earned: number; spent: number; count: number }>;
  };
  recentTransactions: {
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
  }[];
  activity: {
    id: string;
    type: string;
    timestamp: string;
    userId: string;
    userName: string;
    message: string;
    meta?: Record<string, unknown>;
  }[];
  totalTransactions: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const PHASE_LABELS: Record<string, { label: string; dot: string }> = {
  subs_open:        { label: "Submissions Open",   dot: "bg-green-400" },
  subs_closed:      { label: "Submissions Closed",  dot: "bg-yellow-400" },
  vote_open:        { label: "Voting Open",          dot: "bg-blue-400" },
  vote_closed:      { label: "Voting Closed",        dot: "bg-orange-400" },
  winner_published: { label: "Winner Published",     dot: "bg-purple-400" },
  idle:             { label: "Idle",                  dot: "bg-white/30" },
};

const REASON_LABELS: Record<string, string> = {
  pack_purchase: "Pack Purchases",
  admin_set: "Admin Set",
  submission: "Submissions",
  submission_win: "Submission Wins",
  vote: "Voting Rewards",
  trade_up_epic: "Trade-Ups",
  quicksell: "Quicksells",
  daily_quest_reward: "Daily Quests",
  casino_slots: "Casino Slots",
  casino_blackjack: "Blackjack Bets",
  casino_blackjack_win: "Blackjack Wins",
  casino_blackjack_push: "Blackjack Push",
  wheel_spin: "Wheel Spins",
  shop_purchase: "Shop Purchases",
  marketplace_sale: "Marketplace Sales",
  marketplace_buy: "Marketplace Buys",
};

const RARITY_COLORS: Record<string, string> = {
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-amber-400",
};

function formatNum(n: number): string {
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Mini bar chart (pure CSS) ──────────────────────────────────── */

function MiniBarChart({ data, maxVal }: { data: { earned: number; spent: number; date: string }[]; maxVal: number }) {
  const barMax = maxVal || 1;
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => {
        const earnH = (d.earned / barMax) * 100;
        const spentH = (d.spent / barMax) * 100;
        const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="w-full flex gap-px items-end justify-center" style={{ height: 64 }}>
              <div
                className="flex-1 bg-emerald-500/60 rounded-t-sm transition-all"
                style={{ height: `${earnH}%`, minHeight: d.earned > 0 ? 2 : 0 }}
              />
              <div
                className="flex-1 bg-red-400/50 rounded-t-sm transition-all"
                style={{ height: `${spentH}%`, minHeight: d.spent > 0 ? 2 : 0 }}
              />
            </div>
            <span className="text-[9px] text-white/30 leading-none">{dayLabel}</span>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="text-emerald-400">+{formatNum(d.earned)}</div>
              <div className="text-red-400">-{formatNum(d.spent)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Trend indicator ────────────────────────────────────────────── */

function TrendBadge({ trend, netFlow }: { trend: string; netFlow: number }) {
  if (trend === "rising")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
        +{formatNum(netFlow)} net
      </span>
    );
  if (trend === "falling")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
        </svg>
        {formatNum(netFlow)} net
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/40 border border-white/10">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
      </svg>
      Stable
    </span>
  );
}

/* ─── User Detail Modal ──────────────────────────────────────────── */

function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/user-detail?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const chartMax = useMemo(() => {
    if (!detail) return 1;
    return Math.max(
      ...detail.economy.dailyNet.map((d) => Math.max(d.earned, d.spent)),
      1
    );
  }, [detail]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-4 sm:inset-8 md:inset-12 z-50 rounded-2xl border border-white/[0.08] bg-[#0f0f14] shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="User detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            {detail && (
              <>
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    detail.user.status === "online"
                      ? "bg-emerald-400"
                      : detail.user.status === "away"
                        ? "bg-amber-400"
                        : "bg-white/20"
                  }`}
                />
                <div>
                  <h2 className="text-lg font-bold text-white/90">
                    {detail.user.name}
                  </h2>
                  <p className="text-xs text-white/40">
                    User ID: {detail.user.id} &middot;{" "}
                    {detail.totalTransactions} total transactions
                  </p>
                </div>
              </>
            )}
            {loading && (
              <h2 className="text-lg font-bold text-white/90">Loading...</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : !detail ? (
            <p className="text-white/50 text-sm py-8">
              Failed to load user data.
            </p>
          ) : (
            <div className="space-y-5">
              {/* ── Top stat cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-amber-500/[0.04] to-transparent p-4">
                  <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium mb-1">
                    Balance
                  </p>
                  <p className="text-2xl font-bold text-amber-300 tabular-nums">
                    {formatNum(detail.user.balance)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-purple-500/[0.04] to-transparent p-4">
                  <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium mb-1">
                    Stardust
                  </p>
                  <p className="text-2xl font-bold text-purple-300 tabular-nums">
                    {formatNum(detail.user.stardust)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-blue-500/[0.04] to-transparent p-4">
                  <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium mb-1">
                    Cards
                  </p>
                  <p className="text-2xl font-bold text-blue-300 tabular-nums">
                    {formatNum(detail.cards.total)}
                  </p>
                  <p className="text-[10px] text-white/25 mt-0.5">
                    {detail.cards.foilCount} foils
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4">
                  <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium mb-1">
                    Credit Trend
                  </p>
                  <div className="flex items-center gap-2">
                    {detail.economy.trend === "gaining" && (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                          />
                        </svg>
                        <span className="text-lg font-bold">Gaining</span>
                      </span>
                    )}
                    {detail.economy.trend === "losing" && (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25"
                          />
                        </svg>
                        <span className="text-lg font-bold">Losing</span>
                      </span>
                    )}
                    {detail.economy.trend === "stable" && (
                      <span className="inline-flex items-center gap-1 text-white/40">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 12h-15"
                          />
                        </svg>
                        <span className="text-lg font-bold">Stable</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/25 mt-0.5">
                    {detail.economy.ratePerDay >= 0 ? "+" : ""}
                    {formatNum(detail.economy.ratePerDay)} / active day
                  </p>
                </div>
              </div>

              {/* ── 24h Summary + 7d Chart ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* 24h summary */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="text-sm font-semibold text-white/70 mb-3">
                    Last 24 Hours
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wide">
                        Earned
                      </p>
                      <p className="text-lg font-semibold text-emerald-400 tabular-nums">
                        +{formatNum(detail.economy.earned24h)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wide">
                        Spent
                      </p>
                      <p className="text-lg font-semibold text-red-400 tabular-nums">
                        -{formatNum(detail.economy.spent24h)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wide">
                        Net
                      </p>
                      <p
                        className={`text-lg font-semibold tabular-nums ${
                          detail.economy.net24h > 0
                            ? "text-emerald-400"
                            : detail.economy.net24h < 0
                              ? "text-red-400"
                              : "text-white/40"
                        }`}
                      >
                        {detail.economy.net24h > 0 ? "+" : ""}
                        {formatNum(detail.economy.net24h)}
                      </p>
                    </div>
                  </div>

                  {/* 24h breakdown by reason */}
                  {Object.keys(detail.economy.reasonBreakdown24h).length >
                    0 && (
                    <div className="mt-4 pt-3 border-t border-white/[0.06]">
                      <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">
                        Breakdown
                      </p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {Object.entries(detail.economy.reasonBreakdown24h)
                          .sort((a, b) => b[1].count - a[1].count)
                          .map(([reason, { earned, spent, count }]) => (
                            <div
                              key={reason}
                              className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/60 truncate">
                                  {REASON_LABELS[reason] || reason}
                                </p>
                                <p className="text-[10px] text-white/20">
                                  {count} txns
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                {earned > 0 && (
                                  <span className="text-[11px] text-emerald-400/80">
                                    +{formatNum(earned)}
                                  </span>
                                )}
                                {earned > 0 && spent > 0 && (
                                  <span className="text-white/15 mx-1">
                                    /
                                  </span>
                                )}
                                {spent > 0 && (
                                  <span className="text-[11px] text-red-400/70">
                                    -{formatNum(spent)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 7d chart */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white/70">
                      7-Day Credit Flow
                    </h3>
                    <div className="flex gap-3 text-[10px]">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-emerald-500/60" />{" "}
                        Earned
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-red-400/50" />{" "}
                        Spent
                      </span>
                    </div>
                  </div>
                  <MiniBarChart
                    data={detail.economy.dailyNet}
                    maxVal={chartMax}
                  />
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-white/[0.06]">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">
                        Earned (7d)
                      </p>
                      <p className="text-sm font-semibold text-emerald-400/70 tabular-nums">
                        +{formatNum(detail.economy.earned7d)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">
                        Spent (7d)
                      </p>
                      <p className="text-sm font-semibold text-red-400/70 tabular-nums">
                        -{formatNum(detail.economy.spent7d)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">
                        Net (7d)
                      </p>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          detail.economy.net7d > 0
                            ? "text-emerald-400/70"
                            : detail.economy.net7d < 0
                              ? "text-red-400/70"
                              : "text-white/30"
                        }`}
                      >
                        {detail.economy.net7d > 0 ? "+" : ""}
                        {formatNum(detail.economy.net7d)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Card rarity + Legendaries ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Card breakdown */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="text-sm font-semibold text-white/70 mb-3">
                    Card Collection
                  </h3>
                  <div className="space-y-2.5">
                    {["legendary", "epic", "rare", "uncommon"].map((rarity) => {
                      const count =
                        detail.cards.rarityBreakdown[rarity] || 0;
                      const pct =
                        detail.cards.total > 0
                          ? (count / detail.cards.total) * 100
                          : 0;
                      return (
                        <div key={rarity}>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs font-medium capitalize ${RARITY_COLORS[rarity] || "text-white/60"}`}
                            >
                              {rarity}
                            </span>
                            <span className="text-[11px] text-white/40 tabular-nums">
                              {count}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                rarity === "legendary"
                                  ? "bg-amber-400/60"
                                  : rarity === "epic"
                                    ? "bg-purple-400/60"
                                    : rarity === "rare"
                                      ? "bg-blue-400/60"
                                      : "bg-green-400/60"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legendary cards */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="text-sm font-semibold text-white/70 mb-3">
                    <span className="text-amber-400">Legendary</span> Cards
                  </h3>
                  {detail.cards.legendaryCards.length === 0 ? (
                    <p className="text-white/30 text-sm">
                      No legendaries yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {detail.cards.legendaryCards.map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center gap-3 py-2 px-2 rounded-lg bg-amber-500/[0.03] border border-amber-500/[0.08]"
                        >
                          {card.profilePath && (
                            <img
                              src={card.profilePath}
                              alt={card.actorName}
                              className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-amber-300 truncate">
                              {card.characterName}
                            </p>
                            <p className="text-[10px] text-white/30 truncate">
                              {card.actorName} &middot; {card.movieTitle}
                              {card.isFoil && (
                                <span className="ml-1 text-cyan-400">
                                  FOIL
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-white/25">
                              {timeAgo(card.acquiredAt)}
                            </p>
                            <p className="text-[9px] text-white/15">
                              {new Date(card.acquiredAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Recent transactions ── */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-3">
                  Recent Transactions
                  <span className="text-white/25 font-normal text-xs ml-2">
                    (last 50)
                  </span>
                </h3>
                <div className="space-y-0 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {detail.recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0"
                    >
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          tx.amount > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : tx.amount < 0
                              ? "bg-red-500/10 text-red-400"
                              : "bg-white/5 text-white/30"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : tx.amount < 0 ? "−" : "="}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-white/40">
                          {REASON_LABELS[tx.reason] || tx.reason}
                        </span>
                        <br />
                        <span className="text-[10px] text-white/20">
                          {timeAgo(tx.createdAt)}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                          tx.amount > 0
                            ? "text-emerald-400"
                            : tx.amount < 0
                              ? "text-red-400"
                              : "text-white/30"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {formatNum(tx.amount)}
                      </span>
                    </div>
                  ))}
                  {detail.recentTransactions.length === 0 && (
                    <p className="text-white/30 text-sm py-2">
                      No transactions.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main dashboard ─────────────────────────────────────────────── */

type TransactionRow = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [transactionsHistory, setTransactionsHistory] = useState<TransactionRow[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
  const [marketplaceToggling, setMarketplaceToggling] = useState(false);
  const [marketplaceMsg, setMarketplaceMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/admin/marketplace-toggle")
      .then((r) => r.json())
      .then((d) => setMarketplaceEnabled(d.marketplaceEnabled ?? true))
      .catch(console.error);
  }, []);

  const handleMarketplaceToggle = async () => {
    const newState = !marketplaceEnabled;
    const confirmed = newState
      ? true
      : window.confirm(
          "Disabling the marketplace will return ALL active listings to their owners and cancel all buy orders. Continue?"
        );
    if (!confirmed) return;
    setMarketplaceToggling(true);
    setMarketplaceMsg(null);
    try {
      const res = await fetch("/api/admin/marketplace-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: newState }),
      });
      const d = await res.json();
      if (d.success) {
        setMarketplaceEnabled(d.marketplaceEnabled);
        setMarketplaceMsg(d.message);
        setTimeout(() => setMarketplaceMsg(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarketplaceToggling(false);
    }
  };

  useEffect(() => {
    if (!showTransactionsModal) return;
    setTransactionsLoading(true);
    fetch("/api/admin/transactions?limit=500")
      .then((r) => r.json())
      .then((d) => {
        setTransactionsHistory(d.transactions ?? []);
        setTransactionsTotal(d.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setTransactionsLoading(false));
  }, [showTransactionsModal]);

  const chartMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      ...data.economy.dailyActivity.map((d) => Math.max(d.earned, d.spent)),
      1
    );
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-white/50 py-10">Failed to load dashboard data.</p>;
  }

  const phaseInfo = data.week
    ? PHASE_LABELS[data.week.phase] || PHASE_LABELS.idle
    : PHASE_LABELS.idle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Command Center</h1>
          <p className="text-sm text-white/40 mt-0.5">Real-time overview of your entire site</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/50">
              <span className="text-white/80 font-medium">{data.users.online}</span> online
            </span>
            {data.users.away > 0 && (
              <>
                <span className="text-white/20">|</span>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-white/50">
                  <span className="text-white/80 font-medium">{data.users.away}</span> away
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Top stats row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Credits in Economy */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-amber-500/[0.04] to-transparent p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Total Credits</span>
            <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-amber-300 tabular-nums">{formatNum(data.economy.totalCredits)}</p>
          <div className="mt-1.5">
            <TrendBadge trend={data.economy.trend} netFlow={data.economy.netFlow24h} />
          </div>
        </div>

        {/* Total Stardust */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-purple-500/[0.04] to-transparent p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Total Stardust</span>
            <svg className="w-4 h-4 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-purple-300 tabular-nums">{formatNum(data.economy.totalStardust)}</p>
          <p className="text-[10px] text-white/25 mt-1.5">Across all users</p>
        </div>

        {/* Total Cards */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-blue-500/[0.04] to-transparent p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Cards in Circulation</span>
            <svg className="w-4 h-4 text-blue-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-blue-300 tabular-nums">{formatNum(data.cards.totalCards)}</p>
          <p className="text-[10px] text-white/25 mt-1.5">{data.cards.foilCount} foils | {data.cards.poolSize} in pool</p>
        </div>

        {/* Users */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Users</span>
            <svg className="w-4 h-4 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-emerald-300 tabular-nums">{data.users.total}</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[10px] text-emerald-400/60">{data.users.online} online</span>
            <span className="text-[10px] text-amber-400/60">{data.users.away} away</span>
            <span className="text-[10px] text-white/20">{data.users.offline} off</span>
          </div>
        </div>
      </div>

      {/* ─── Economy panel + Activity chart ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 24h / 7d Credit Flow */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/70">Credit Flow</h2>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/60" /> Earned</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400/50" /> Spent</span>
            </div>
          </div>

          {/* 7-day bar chart */}
          <MiniBarChart data={data.economy.dailyActivity} maxVal={chartMax} />

          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/[0.06]">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Earned (24h)</p>
              <p className="text-lg font-semibold text-emerald-400 tabular-nums">+{formatNum(data.economy.creditsEarned24h)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Spent (24h)</p>
              <p className="text-lg font-semibold text-red-400 tabular-nums">-{formatNum(data.economy.creditsSpent24h)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Earned (7d)</p>
              <p className="text-lg font-semibold text-emerald-400/70 tabular-nums">+{formatNum(data.economy.creditsEarned7d)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wide">Spent (7d)</p>
              <p className="text-lg font-semibold text-red-400/70 tabular-nums">-{formatNum(data.economy.creditsSpent7d)}</p>
            </div>
          </div>
        </div>

        {/* Current week status */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Current Week</h2>
          {data.week ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Theme</p>
                  <p className="text-lg font-semibold text-white/90">{data.week.theme}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Phase</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${phaseInfo.dot}`} />
                    <span className="text-sm font-medium text-white/80">{phaseInfo.label}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                    <p className="text-xl font-bold text-white/90 tabular-nums">{data.week.submissionsCount}</p>
                    <p className="text-[10px] text-white/30 uppercase">Submissions</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 text-center">
                    <p className="text-xl font-bold text-white/90 tabular-nums">{data.week.votesCount}</p>
                    <p className="text-[10px] text-white/30 uppercase">Votes</p>
                  </div>
                </div>
              </div>
              <a
                href="/admin/movie-night"
                className="mt-4 block text-center text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Manage Week →
              </a>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/30 text-sm">No active week</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Spending breakdown + Card rarity + Leaderboards ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Spending breakdown (7d) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-3">Activity Breakdown <span className="text-white/25 font-normal">(7d)</span></h2>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {Object.entries(data.economy.reasonBreakdown)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([reason, { earned, spent, count }]) => (
                <div key={reason} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{REASON_LABELS[reason] || reason}</p>
                    <p className="text-[10px] text-white/25">{count} txns</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    {earned > 0 && <span className="text-[11px] text-emerald-400/80">+{formatNum(earned)}</span>}
                    {earned > 0 && spent > 0 && <span className="text-white/15 mx-1">/</span>}
                    {spent > 0 && <span className="text-[11px] text-red-400/70">-{formatNum(spent)}</span>}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Card rarity breakdown */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-3">Card Distribution</h2>
          <div className="space-y-3">
            {["legendary", "epic", "rare", "uncommon"].map((rarity) => {
              const count = data.cards.rarityBreakdown[rarity] || 0;
              const pct = data.cards.totalCards > 0 ? (count / data.cards.totalCards) * 100 : 0;
              return (
                <div key={rarity}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium capitalize ${RARITY_COLORS[rarity] || "text-white/60"}`}>
                      {rarity}
                    </span>
                    <span className="text-[11px] text-white/40 tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        rarity === "legendary"
                          ? "bg-amber-400/60"
                          : rarity === "epic"
                            ? "bg-purple-400/60"
                            : rarity === "rare"
                              ? "bg-blue-400/60"
                              : "bg-green-400/60"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/30">Foil cards</span>
              <span className="text-white/60 tabular-nums">{data.cards.foilCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/30">Pool size</span>
              <span className="text-white/60 tabular-nums">{data.cards.poolSize}</span>
            </div>
          </div>
        </div>

        {/* Leaderboards */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-3">Leaderboards</h2>

          {/* Credits leaderboard */}
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Top Balances</p>
          <div className="space-y-1.5 mb-4">
            {data.economy.userCredits.slice(0, 5).map((u, i) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => setSelectedUserId(u.userId)}
                className="flex items-center gap-2 w-full text-left hover:bg-white/[0.04] rounded-md px-1 py-0.5 -mx-1 transition-colors cursor-pointer group"
              >
                <span className="w-4 text-[10px] text-white/25 text-right tabular-nums">{i + 1}</span>
                <span className="flex-1 text-xs text-white/70 truncate group-hover:text-white/90 transition-colors">{u.name}</span>
                <span className="text-xs text-amber-400/80 font-medium tabular-nums">{formatNum(u.balance)}</span>
              </button>
            ))}
          </div>

          {/* Cards leaderboard */}
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Most Cards</p>
          <div className="space-y-1.5">
            {data.cards.userCards.slice(0, 5).map((u, i) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => setSelectedUserId(u.userId)}
                className="flex items-center gap-2 w-full text-left hover:bg-white/[0.04] rounded-md px-1 py-0.5 -mx-1 transition-colors cursor-pointer group"
              >
                <span className="w-4 text-[10px] text-white/25 text-right tabular-nums">{i + 1}</span>
                <span className="flex-1 text-xs text-white/70 truncate group-hover:text-white/90 transition-colors">{u.name}</span>
                <span className="text-xs text-blue-400/80 font-medium tabular-nums">{formatNum(u.count)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Site counters + Recent transactions ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Site-wide counters */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-3">Site Totals</h2>
          <div className="space-y-2.5">
            {[
              { label: "Movies Watched", value: data.site.totalWinners, icon: "🎬" },
              { label: "All-Time Submissions", value: data.site.totalSubmissions, icon: "📥" },
              { label: "All-Time Votes", value: data.site.totalVotes, icon: "🗳️" },
              { label: "Ledger Entries", value: data.site.totalLedgerEntries, icon: "📒" },
              { label: "Active Listings", value: data.site.activeListings, icon: "🏷️" },
              { label: "Active Buy Orders", value: data.site.activeBuyOrders, icon: "💰" },
              { label: "Pending Feedback", value: data.site.pendingFeedback, icon: "💬" },
              { label: "Pending Community Sets", value: data.site.pendingCommunitySets ?? 0, icon: "🃏" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-white/50 flex items-center gap-2">
                  <span className="text-sm">{item.icon}</span>
                  {item.label}
                </span>
                <span className="text-sm font-medium text-white/80 tabular-nums">{formatNum(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-white/70">Recent Transactions</h2>
            <button
              type="button"
              onClick={() => setShowTransactionsModal(true)}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              View full history
            </button>
          </div>
          <div className="space-y-0 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {data.recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  tx.amount > 0
                    ? "bg-emerald-500/10 text-emerald-400"
                    : tx.amount < 0
                      ? "bg-red-500/10 text-red-400"
                      : "bg-white/5 text-white/30"
                }`}>
                  {tx.amount > 0 ? "+" : tx.amount < 0 ? "−" : "="}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(tx.userId)}
                      className="text-xs font-medium text-white/80 truncate hover:text-purple-400 transition-colors cursor-pointer"
                    >
                      {tx.userName}
                    </button>
                    <span className="text-[10px] text-white/25">{REASON_LABELS[tx.reason] || tx.reason}</span>
                  </div>
                  <span className="text-[10px] text-white/20">{timeAgo(tx.createdAt)}</span>
                </div>
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                  tx.amount > 0 ? "text-emerald-400" : tx.amount < 0 ? "text-red-400" : "text-white/30"
                }`}>
                  {tx.amount > 0 ? "+" : ""}{formatNum(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Legendary Timeline ──────────────────────────────────── */}
      {data.legendaryTimeline.length > 0 && (
        <div className="rounded-xl border border-amber-500/[0.12] bg-gradient-to-br from-amber-500/[0.03] to-transparent p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <h2 className="text-sm font-semibold text-amber-300">Legendary Timeline</h2>
            <span className="text-[10px] text-white/25 ml-auto">{data.legendaryTimeline.length} total</span>
          </div>
          <div className="space-y-0 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {data.legendaryTimeline.map((leg) => (
              <div
                key={leg.cardId}
                className="flex items-center gap-3 py-2.5 border-b border-amber-500/[0.06] last:border-0"
              >
                {leg.profilePath && (
                  <img
                    src={leg.profilePath}
                    alt={leg.actorName}
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-amber-500/20"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-300 truncate">
                      {leg.characterName}
                    </span>
                    {leg.isFoil && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        FOIL
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30 truncate">
                    {leg.actorName} &middot; {leg.movieTitle}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(leg.userId)}
                    className="text-xs text-white/60 hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    {leg.userName}
                  </button>
                  <p className="text-[10px] text-white/20">
                    {new Date(leg.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── User Lookup ───────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-3">User Lookup</h2>
        <p className="text-[10px] text-white/30 mb-3">Click any user to view their detailed activity, credit trends, and legendary cards.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {data.economy.userCredits.map((u) => (
            <button
              key={u.userId}
              type="button"
              onClick={() => setSelectedUserId(u.userId)}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-purple-400">
                  {u.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-white/70 truncate group-hover:text-white/90 transition-colors">
                  {u.name}
                </p>
                <p className="text-[10px] text-amber-400/60 tabular-nums">{formatNum(u.balance)}c</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Marketplace Toggle ──────────────────────────────── */}
      <div className={`rounded-xl border p-5 ${marketplaceEnabled ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent" : "border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent"}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${marketplaceEnabled ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <svg className={`w-5 h-5 ${marketplaceEnabled ? "text-emerald-400" : "text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/80">Marketplace</h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                {marketplaceEnabled
                  ? "Marketplace is currently active. Users can list and buy cards."
                  : "Marketplace is disabled. Tab is hidden and all listings have been returned."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {marketplaceMsg && (
              <span className="text-xs text-white/50 max-w-[260px] truncate">{marketplaceMsg}</span>
            )}
            <button
              type="button"
              onClick={handleMarketplaceToggle}
              disabled={marketplaceToggling}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50 ${
                marketplaceEnabled
                  ? "border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/60"
                  : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60"
              }`}
            >
              {marketplaceToggling
                ? "..."
                : marketplaceEnabled
                  ? "Disable Marketplace"
                  : "Enable Marketplace"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Quick actions ─────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            { href: "/admin/movie-night", label: "Movie Night", icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375", iconCls: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20" },
            { href: "/admin/users", label: "Users", icon: "M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z", iconCls: "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20" },
            { href: "/admin/cards-credits", label: "Cards & Credits", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z", iconCls: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20" },
            { href: "/admin/community-cards", label: `Community Cards${(data.site.pendingCommunitySets ?? 0) > 0 ? ` (${data.site.pendingCommunitySets})` : ""}`, icon: "M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122", iconCls: "bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20" },
            { href: "/admin/feedback", label: `Feedback${data.site.pendingFeedback > 0 ? ` (${data.site.pendingFeedback})` : ""}`, icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z", iconCls: "bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${action.iconCls}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                  </svg>
                </div>
                <span className="text-xs font-medium text-white/70 group-hover:text-white/90 transition-colors truncate">
                  {action.label}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* User detail modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}

      {/* Transaction history modal */}
      {showTransactionsModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTransactionsModal(false)}
            aria-hidden
          />
          <div
            className="fixed inset-4 sm:inset-8 md:inset-12 z-50 rounded-2xl border border-white/[0.08] bg-[#0f0f14] shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Transaction history"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white/90">Transaction history</h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {transactionsTotal > 0
                    ? `Showing latest ${transactionsHistory.length} of ${formatNum(transactionsTotal)} total`
                    : "Credit ledger entries (earned and spent)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransactionsModal(false)}
                className="p-2 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
              {transactionsLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                </div>
              ) : transactionsHistory.length === 0 ? (
                <p className="text-white/50 text-sm py-8">No transactions in the ledger.</p>
              ) : (
                (() => {
                  const now = new Date();
                  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                  const oneDayMs = 24 * 60 * 60 * 1000;
                  const groups: { label: string; txs: TransactionRow[] }[] = [];
                  let currentLabel = "";
                  let currentTxs: TransactionRow[] = [];
                  for (const tx of transactionsHistory) {
                    const t = new Date(tx.createdAt).getTime();
                    const dayStart = new Date(new Date(tx.createdAt).getFullYear(), new Date(tx.createdAt).getMonth(), new Date(tx.createdAt).getDate()).getTime();
                    const diffDays = Math.floor((todayStart - dayStart) / oneDayMs);
                    let label: string;
                    if (diffDays === 0) label = "Today";
                    else if (diffDays === 1) label = "Yesterday";
                    else if (diffDays < 7) label = new Date(tx.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                    else label = new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    if (label !== currentLabel) {
                      if (currentTxs.length) groups.push({ label: currentLabel, txs: currentTxs });
                      currentLabel = label;
                      currentTxs = [];
                    }
                    currentTxs.push(tx);
                  }
                  if (currentTxs.length) groups.push({ label: currentLabel, txs: currentTxs });
                  return (
                    <div className="space-y-6">
                      {groups.map((g) => (
                        <div key={g.label}>
                          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 sticky top-0 bg-[#0f0f14]/95 py-1 -mx-1 px-1">
                            {g.label}
                          </h3>
                          <div className="space-y-0 rounded-lg border border-white/[0.04] overflow-hidden">
                            {g.txs.map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center gap-3 py-2.5 px-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                              >
                                <div
                                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                    tx.amount > 0
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : tx.amount < 0
                                        ? "bg-red-500/10 text-red-400"
                                        : "bg-white/5 text-white/30"
                                  }`}
                                >
                                  {tx.amount > 0 ? "+" : tx.amount < 0 ? "−" : "="}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowTransactionsModal(false);
                                        setSelectedUserId(tx.userId);
                                      }}
                                      className="text-sm font-medium text-white/85 truncate hover:text-purple-400 transition-colors cursor-pointer"
                                    >
                                      {tx.userName}
                                    </button>
                                    <span className="text-[11px] text-white/35">{REASON_LABELS[tx.reason] || tx.reason}</span>
                                  </div>
                                  <span className="text-[11px] text-white/25">
                                    {new Date(tx.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                                  </span>
                                </div>
                                <span
                                  className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                                    tx.amount > 0 ? "text-emerald-400" : tx.amount < 0 ? "text-red-400" : "text-white/30"
                                  }`}
                                >
                                  {tx.amount > 0 ? "+" : ""}{formatNum(tx.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
