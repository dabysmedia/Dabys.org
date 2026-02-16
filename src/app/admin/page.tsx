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
  };
  recentTransactions: {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    reason: string;
    createdAt: string;
  }[];
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

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
                href="/admin/weeks"
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
              <div key={u.userId} className="flex items-center gap-2">
                <span className="w-4 text-[10px] text-white/25 text-right tabular-nums">{i + 1}</span>
                <span className="flex-1 text-xs text-white/70 truncate">{u.name}</span>
                <span className="text-xs text-amber-400/80 font-medium tabular-nums">{formatNum(u.balance)}</span>
              </div>
            ))}
          </div>

          {/* Cards leaderboard */}
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Most Cards</p>
          <div className="space-y-1.5">
            {data.cards.userCards.slice(0, 5).map((u, i) => (
              <div key={u.userId} className="flex items-center gap-2">
                <span className="w-4 text-[10px] text-white/25 text-right tabular-nums">{i + 1}</span>
                <span className="flex-1 text-xs text-white/70 truncate">{u.name}</span>
                <span className="text-xs text-blue-400/80 font-medium tabular-nums">{formatNum(u.count)}</span>
              </div>
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
                    <span className="text-xs font-medium text-white/80 truncate">{tx.userName}</span>
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

      {/* ─── Quick actions ─────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            { href: "/admin/weeks", label: "Weeks & Phases", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z", iconCls: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20" },
            { href: "/admin/users", label: "Users", icon: "M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z", iconCls: "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20" },
            { href: "/admin/submissions", label: "Submissions", icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375", iconCls: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20" },
            { href: "/admin/winners", label: "Winners", icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172", iconCls: "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20" },
            { href: "/admin/cards-credits", label: "Cards & Credits", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z", iconCls: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20" },
            { href: "/admin/votes", label: "Votes", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z", iconCls: "bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20" },
            { href: "/admin/wheel", label: "Theme Wheel", icon: "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z", iconCls: "bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20" },
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
                                    <span className="text-sm font-medium text-white/85 truncate">{tx.userName}</span>
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
