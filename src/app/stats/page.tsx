"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  name: string;
}

interface StatsData {
  totalWeeks: number;
  totalSubmissions: number;
  totalWinners: number;
  totalRatings: number;
  totalComments: number;
  mostSubmittedMovie: { movieTitle: string; posterUrl: string; year?: string; count: number } | null;
  topSubmitters: { userName: string; count: number }[];
  winLeaders: { userName: string; count: number }[];
  biggestSkippers: { userName: string; skipsUsed: number }[];
  bestRatedWinner: { winnerId: string; movieTitle: string; posterUrl: string; avgStars: number; ratingCount: number; dabysScorePct: number } | null;
  longestWinner: { winnerId: string; movieTitle: string; posterUrl: string; runtimeMinutes: number } | null;
  winnersByDecade: { decade: string; count: number }[];
  cashflowKings: { userName: string; value: number }[];
  legendaryCollectors: { userName: string; value: number }[];
  cardCollectors: { userName: string; value: number }[];
  codexCompletion: { userName: string; unlocked: number; holoUnlocked: number; total: number; pct: number }[];
  totalCreditsEarned: { userName: string; value: number }[];
  packAddicts: { userName: string; value: number }[];
  biggestQuesters: { userName: string; value: number }[];
  highRollers: { userName: string; value: number; hands: number; netPnl: number }[];
  tradeDealers: { userName: string; value: number }[];
  rarityBreakdown: { uncommon: number; rare: number; epic: number; legendary: number };
  totalCards: number;
  totalCodexEntries: number;
  serverStats: {
    totalPacksOpened: number;
    totalCardsUnpacked: number;
    legendaryTradeUpsFailed: number;
    totalTradesCompleted: number;
    totalQuestsCompleted: number;
    totalCasinoHands: number;
    totalCreditsSpent: number;
    totalCreditsEarnedServer: number;
    totalQuicksells: number;
  };
}

interface FavoriteSlice {
  name: string;
  count: number;
  profileUrl?: string;
}

interface FavoritesData {
  favoriteActors: FavoriteSlice[];
  favoriteDirectors: FavoriteSlice[];
  favoriteGenres: FavoriteSlice[];
}

type TabId = "leaderboards" | "movie-night";

const cardClass = "rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6";

/* ─── Rank badge for top 3 ─── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 text-[11px] font-extrabold text-black shadow-lg shadow-amber-500/20">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-300 to-gray-500 text-[11px] font-extrabold text-black">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 text-[11px] font-extrabold text-white/90">
        3
      </span>
    );
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-bold text-white/30">
      {rank}
    </span>
  );
}

/* ─── Generic leaderboard card ─── */
function LeaderboardCard({
  title,
  icon,
  entries,
  valueLabel,
  accentFrom,
  accentTo,
  emptyText = "No data yet",
  glowColor,
  featured = false,
}: {
  title: string;
  icon: string;
  entries: { name: string; value: number; displayValue?: string; subtitle?: string }[];
  valueLabel?: string;
  accentFrom: string;
  accentTo: string;
  emptyText?: string;
  glowColor?: string;
  featured?: boolean;
}) {
  const maxVal = entries[0]?.value ?? 1;

  return (
    <div className={`${cardClass} relative overflow-hidden group`}>
      {glowColor && (
        <div
          className={`absolute -top-8 -right-8 w-32 h-32 rounded-full ${glowColor} blur-[60px] opacity-30 group-hover:opacity-50 transition-opacity duration-500`}
        />
      )}

      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <span className={featured ? "text-3xl" : "text-2xl"}>{icon}</span>
          <h3
            className={`font-semibold text-white/60 uppercase tracking-widest ${featured ? "text-sm" : "text-xs"}`}
          >
            {title}
          </h3>
        </div>

        {entries.length === 0 ? (
          <p className="text-white/30 text-sm">{emptyText}</p>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isFirst = rank === 1;
              return (
                <div key={`${entry.name}-${i}`} className={`flex items-center gap-3 ${isFirst ? "mb-1" : ""}`}>
                  <RankBadge rank={rank} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <span
                          className={`text-sm truncate block ${isFirst ? "font-bold text-white" : "font-medium text-white/70"}`}
                        >
                          {entry.name}
                        </span>
                        {entry.subtitle && (
                          <span className="text-[10px] text-white/30 block">{entry.subtitle}</span>
                        )}
                      </div>
                      <span
                        className={`text-xs tabular-nums shrink-0 ${isFirst ? "font-bold text-white/90" : "text-white/40"}`}
                      >
                        {entry.displayValue ?? entry.value.toLocaleString()}
                        {valueLabel ? ` ${valueLabel}` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${accentFrom} ${accentTo} transition-all duration-700 ease-out`}
                        style={{
                          width: `${Math.max((entry.value / maxVal) * 100, 4)}%`,
                          opacity: isFirst ? 1 : 0.6 + 0.4 * (1 - i / entries.length),
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Server-wide stat pill ─── */
function ServerStat({
  value,
  label,
  color = "text-white/90",
}: {
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-[10px] text-white/35 mt-1 uppercase tracking-wider leading-tight">{label}</p>
    </div>
  );
}

/* ─── Favorite bar list (movie night tab) ─── */
function FavoriteBarList({
  data,
  accent = "purple",
}: {
  data: FavoriteSlice[];
  accent?: "purple" | "violet" | "indigo";
}) {
  if (data.length === 0) return <p className="text-white/30 text-sm">No data</p>;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const gradientClass =
    accent === "purple"
      ? "bg-gradient-to-r from-purple-500/50 to-violet-500/50"
      : accent === "violet"
        ? "bg-gradient-to-r from-violet-500/50 to-indigo-500/50"
        : "bg-gradient-to-r from-indigo-500/50 to-purple-500/50";

  const borderAccent =
    accent === "purple"
      ? "border-purple-500/30 bg-purple-500/5"
      : accent === "violet"
        ? "border-violet-500/30 bg-violet-500/5"
        : "border-indigo-500/30 bg-indigo-500/5";

  const winner = data[0];
  const rest = data.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-xl border ${borderAccent} p-4 shrink-0`}>
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Winner</p>
        <div className="flex items-center gap-3">
          {winner.profileUrl ? (
            <img
              src={winner.profileUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover bg-white/10"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white/90">
              1
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">{winner.name}</p>
            <p className="text-xs text-white/50 mt-0.5">
              {winner.count} appearance{winner.count !== 1 ? "s" : ""} in winning films
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${gradientClass}`}
            style={{ width: `${(winner.count / maxCount) * 100}%` }}
          />
        </div>
      </div>

      {rest.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Also featured</p>
          <ul className="space-y-2 max-h-48 overflow-y-auto scrollbar-autocomplete pr-1">
            {rest.map((entry, i) => (
              <li key={`${entry.name}-${i}`} className="flex items-center gap-3">
                <span className="text-white/25 text-xs tabular-nums w-5 shrink-0">#{i + 2}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-4 rounded bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded transition-[width] duration-500 ease-out ${gradientClass}`}
                      style={{ width: `${(entry.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60 mt-0.5 truncate">
                    {entry.name} <span className="text-white/35">· {entry.count}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── Quick stat pill for hero ─── */
function HeroStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-bold text-white/90 tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-[11px] text-white/40 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState<StatsData | null>(null);
  const [favorites, setFavorites] = useState<FavoritesData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("leaderboards");

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(cached) as User;
      setUser(u);
      setChecking(false);
    } catch {
      localStorage.removeItem("dabys_user");
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/stats/favorites")
      .then((r) => (r.ok ? r.json() : null))
      .then(setFavorites)
      .catch(() => setFavorites(null));
  }, [user]);

  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const maxDecadeCount = Math.max(...(data?.winnersByDecade?.map((d) => d.count) ?? [1]), 1);

  const tabs: { id: TabId; label: string }[] = [
    { id: "leaderboards", label: "Leaderboards" },
    { id: "movie-night", label: "Movie Night" },
  ];

  return (
    <div className="min-h-screen">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full bg-amber-600/5 blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {!data ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ═══ HERO ═══ */}
            <div className={`${cardClass} relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.07] via-transparent to-amber-500/[0.04]" />
              <div className="relative">
                <h1 className="text-3xl sm:text-4xl font-bold text-white/90 mb-1">Dabys Stats</h1>
                <p className="text-white/40 text-sm mb-6">Rankings, records, and bragging rights</p>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 sm:gap-6">
                  <HeroStat value={data.totalCards} label="Cards" />
                  <HeroStat value={data.totalCodexEntries} label="Codex Slots" />
                  <HeroStat value={data.totalWinners} label="Winners" />
                  <HeroStat value={data.totalWeeks} label="Weeks" />
                  <HeroStat value={data.totalSubmissions} label="Submitted" />
                  <HeroStat value={data.totalRatings} label="Ratings" />
                </div>
              </div>
            </div>

            {/* ═══ TAB BAR ═══ */}
            <div className="flex border-b border-white/[0.08]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    activeTab === tab.id
                      ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ═══════════════════════════════════════ */}
            {/* ═══ LEADERBOARDS TAB ═══ */}
            {/* ═══════════════════════════════════════ */}
            {activeTab === "leaderboards" && (
              <div className="space-y-10 animate-in fade-in duration-300">
                {/* ── Featured TCG Rankings ── */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">
                      TCG Rankings
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <LeaderboardCard
                      title="Legendary Collector"
                      icon="⭐"
                      featured
                      entries={data.legendaryCollectors.map((e) => ({
                        name: e.userName,
                        value: e.value,
                      }))}
                      valueLabel="legendaries"
                      accentFrom="from-amber-400/60"
                      accentTo="to-amber-500/60"
                      emptyText="No legendary cards pulled yet"
                      glowColor="bg-amber-500"
                    />

                    <LeaderboardCard
                      title="Codex Completion"
                      icon="📖"
                      featured
                      entries={data.codexCompletion.map((e) => ({
                        name: e.userName,
                        value: e.unlocked,
                        displayValue: `${e.pct}% (${e.unlocked}/${e.total})`,
                        subtitle: e.holoUnlocked > 0 ? `${e.holoUnlocked} holo discovered` : undefined,
                      }))}
                      accentFrom="from-purple-400/60"
                      accentTo="to-purple-500/60"
                      emptyText="No codex entries discovered"
                      glowColor="bg-purple-500"
                    />

                    <LeaderboardCard
                      title="Card Hoarder"
                      icon="🃏"
                      featured
                      entries={data.cardCollectors.map((e) => ({
                        name: e.userName,
                        value: e.value,
                      }))}
                      valueLabel="cards"
                      accentFrom="from-purple-400/60"
                      accentTo="to-purple-500/60"
                      emptyText="No cards collected"
                      glowColor="bg-purple-500"
                    />

                    <LeaderboardCard
                      title="Pack Addict"
                      icon="📦"
                      featured
                      entries={data.packAddicts.map((e) => ({
                        name: e.userName,
                        value: e.value,
                      }))}
                      valueLabel="opened"
                      accentFrom="from-amber-300/50"
                      accentTo="to-amber-400/50"
                      emptyText="No packs opened"
                      glowColor="bg-amber-400"
                    />
                  </div>
                </div>

                {/* ── Economy & Hustle ── */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">
                      Economy & Hustle
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <LeaderboardCard
                      title="Cashflow King"
                      icon="💰"
                      entries={data.cashflowKings.map((e) => ({
                        name: e.userName,
                        value: e.value,
                        displayValue: `${e.value.toLocaleString()} cr`,
                      }))}
                      accentFrom="from-sky-400/60"
                      accentTo="to-sky-500/60"
                      emptyText="No credits earned"
                      glowColor="bg-sky-400"
                    />

                    <LeaderboardCard
                      title="Lifetime Earner"
                      icon="💎"
                      entries={data.totalCreditsEarned.map((e) => ({
                        name: e.userName,
                        value: e.value,
                        displayValue: `${e.value.toLocaleString()} cr`,
                      }))}
                      accentFrom="from-sky-400/60"
                      accentTo="to-sky-500/60"
                      emptyText="No credits earned"
                      glowColor="bg-sky-400"
                    />

                    <LeaderboardCard
                      title="Biggest Quester"
                      icon="📜"
                      entries={data.biggestQuesters.map((e) => ({
                        name: e.userName,
                        value: e.value,
                      }))}
                      valueLabel="quests"
                      accentFrom="from-amber-300/50"
                      accentTo="to-amber-400/50"
                      emptyText="No quests completed"
                      glowColor="bg-amber-400"
                    />

                    <LeaderboardCard
                      title="High Roller"
                      icon="🎰"
                      entries={data.highRollers.map((e) => ({
                        name: e.userName,
                        value: e.value,
                        displayValue: `${e.value.toLocaleString()} cr wagered`,
                        subtitle: `${e.hands} hands · ${e.netPnl >= 0 ? "+" : ""}${e.netPnl.toLocaleString()} cr net`,
                      }))}
                      accentFrom="from-sky-400/60"
                      accentTo="to-sky-500/60"
                      emptyText="No casino action"
                      glowColor="bg-sky-400"
                    />

                    <LeaderboardCard
                      title="Trade Dealer"
                      icon="🤝"
                      entries={data.tradeDealers.map((e) => ({
                        name: e.userName,
                        value: e.value,
                      }))}
                      valueLabel="trades"
                      accentFrom="from-purple-400/60"
                      accentTo="to-purple-500/60"
                      emptyText="No trades yet"
                      glowColor="bg-purple-500"
                    />

                    <LeaderboardCard
                      title="Movie Night Champion"
                      icon="🏆"
                      entries={data.winLeaders.map((e) => ({
                        name: e.userName,
                        value: e.count,
                      }))}
                      valueLabel="wins"
                      accentFrom="from-amber-400/60"
                      accentTo="to-amber-500/60"
                      emptyText="No winners yet"
                      glowColor="bg-amber-500"
                    />
                  </div>
                </div>

                {/* ── Server-Wide Stats ── */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-purple-500/30 to-transparent" />
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">
                      Server-Wide Stats
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-purple-500/30 to-transparent" />
                  </div>

                  <div className={`${cardClass} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-indigo-500/[0.03]" />
                    <div className="relative">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                        <ServerStat
                          value={data.serverStats.totalCardsUnpacked}
                          label="Cards Unpacked"
                          color="text-purple-400"
                        />
                        <ServerStat
                          value={data.serverStats.totalPacksOpened}
                          label="Packs Ripped"
                          color="text-amber-400"
                        />
                        <ServerStat
                          value={data.serverStats.legendaryTradeUpsFailed}
                          label="Legendary Trade-Ups Failed"
                          color="text-amber-400"
                        />
                        <ServerStat
                          value={data.serverStats.totalTradesCompleted}
                          label="Trades Completed"
                          color="text-purple-400"
                        />
                        <ServerStat
                          value={data.serverStats.totalQuestsCompleted}
                          label="Quests Completed"
                          color="text-amber-400"
                        />
                        <ServerStat
                          value={data.serverStats.totalCasinoHands}
                          label="Casino Hands"
                          color="text-sky-400"
                        />
                        <ServerStat
                          value={`${data.serverStats.totalCreditsEarnedServer.toLocaleString()} cr`}
                          label="Credits Earned"
                          color="text-sky-400"
                        />
                        <ServerStat
                          value={`${data.serverStats.totalCreditsSpent.toLocaleString()} cr`}
                          label="Credits Spent"
                          color="text-sky-400"
                        />
                        <ServerStat
                          value={data.serverStats.totalQuicksells}
                          label="Cards Quicksold"
                          color="text-purple-400"
                        />
                        <ServerStat value={data.totalCodexEntries} label="Codex Pool Size" color="text-purple-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Card Census ── */}
                <div className={`${cardClass} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] via-transparent to-amber-500/[0.03]" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-2xl">📊</span>
                      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
                        Card Census
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4 text-center">
                        <p className="text-2xl font-bold text-green-400 tabular-nums">
                          {data.rarityBreakdown.uncommon}
                        </p>
                        <p className="text-[11px] text-green-400/60 uppercase tracking-wider mt-1">Uncommon</p>
                      </div>
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 text-center">
                        <p className="text-2xl font-bold text-blue-400 tabular-nums">
                          {data.rarityBreakdown.rare}
                        </p>
                        <p className="text-[11px] text-blue-400/60 uppercase tracking-wider mt-1">Rare</p>
                      </div>
                      <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4 text-center">
                        <p className="text-2xl font-bold text-purple-400 tabular-nums">
                          {data.rarityBreakdown.epic}
                        </p>
                        <p className="text-[11px] text-purple-400/60 uppercase tracking-wider mt-1">Epic</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-center">
                        <p className="text-2xl font-bold text-amber-400 tabular-nums">
                          {data.rarityBreakdown.legendary}
                        </p>
                        <p className="text-[11px] text-amber-400/60 uppercase tracking-wider mt-1">Legendary</p>
                      </div>
                    </div>
                    {/* Stacked rarity bar */}
                    <div className="mt-4">
                      <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden flex">
                        {data.totalCards > 0 && (
                          <>
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700"
                              style={{
                                width: `${(data.rarityBreakdown.uncommon / data.totalCards) * 100}%`,
                              }}
                            />
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                              style={{
                                width: `${(data.rarityBreakdown.rare / data.totalCards) * 100}%`,
                              }}
                            />
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-700"
                              style={{
                                width: `${(data.rarityBreakdown.epic / data.totalCards) * 100}%`,
                              }}
                            />
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700"
                              style={{
                                width: `${(data.rarityBreakdown.legendary / data.totalCards) * 100}%`,
                              }}
                            />
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-white/30 mt-2 text-center">
                        {data.totalCards.toLocaleString()} total cards in circulation
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════ */}
            {/* ═══ MOVIE NIGHT TAB ═══ */}
            {/* ═══════════════════════════════════════ */}
            {activeTab === "movie-night" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Best Dabys score */}
                <div
                  className={`${cardClass} border-amber-500/15 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent`}
                >
                  <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                    Best Dabys Score
                  </h2>
                  {data.bestRatedWinner ? (
                    <Link
                      href={`/winners/${data.bestRatedWinner.winnerId}`}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-6 group block"
                    >
                      {data.bestRatedWinner.posterUrl ? (
                        <img
                          src={data.bestRatedWinner.posterUrl}
                          alt=""
                          className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl object-cover border border-white/[0.08] group-hover:border-amber-500/30 transition-colors shadow-lg shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-3xl font-bold shrink-0">
                          {data.bestRatedWinner.movieTitle.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 w-full">
                        <p className="text-xl sm:text-2xl font-bold text-white/95 group-hover:text-amber-200 transition-colors mb-4">
                          {data.bestRatedWinner.movieTitle}
                        </p>
                        <div className="mb-3">
                          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                            Dabys Score
                          </h4>
                          {(() => {
                            const pct =
                              data.bestRatedWinner!.dabysScorePct ??
                              Math.round((data.bestRatedWinner!.avgStars / 5) * 100);
                            const isFresh = pct >= 60;
                            return (
                              <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-baseline gap-2">
                                  <span
                                    className={`text-3xl sm:text-4xl font-bold tabular-nums ${isFresh ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {pct}%
                                  </span>
                                  <span
                                    className={`text-sm font-semibold uppercase tracking-wide ${isFresh ? "text-green-400/80" : "text-red-400/80"}`}
                                  >
                                    {isFresh ? "Fresh" : "Rotten"}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-[160px] max-w-xs">
                                  <div className="h-2.5 rounded-full overflow-hidden flex bg-white/10">
                                    <div
                                      className="h-full bg-green-500 transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                    <div
                                      className="h-full bg-red-500 transition-all duration-500"
                                      style={{ width: `${100 - pct}%` }}
                                    />
                                  </div>
                                  <p className="text-[11px] text-white/40 mt-1.5">
                                    Thumbs + stars · Based on {data.bestRatedWinner!.ratingCount} rating
                                    {data.bestRatedWinner!.ratingCount !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        <p className="text-amber-400/90 text-sm font-medium group-hover:text-amber-300 transition-colors">
                          View winner →
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-white/30 text-sm">No ratings yet.</p>
                  )}
                </div>

                {/* Most submitted + Longest movie */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className={cardClass}>
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                      Most Submitted Movie
                    </h2>
                    {data.mostSubmittedMovie ? (
                      <div className="flex items-center gap-4">
                        {data.mostSubmittedMovie.posterUrl ? (
                          <img
                            src={data.mostSubmittedMovie.posterUrl}
                            alt=""
                            className="w-16 h-24 rounded-lg object-cover border border-white/[0.08]"
                          />
                        ) : (
                          <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-2xl font-bold">
                            {data.mostSubmittedMovie.movieTitle.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-lg font-semibold text-white/90">
                            {data.mostSubmittedMovie.movieTitle}
                          </p>
                          {data.mostSubmittedMovie.year && (
                            <p className="text-sm text-white/40">{data.mostSubmittedMovie.year}</p>
                          )}
                          <p className="text-sm text-purple-400 mt-1">
                            Submitted {data.mostSubmittedMovie.count} time
                            {data.mostSubmittedMovie.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/30 text-sm">No submissions yet.</p>
                    )}
                  </div>
                  <div className={cardClass}>
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                      Longest Movie
                    </h2>
                    {data.longestWinner ? (
                      <Link
                        href={`/winners/${data.longestWinner.winnerId}`}
                        className="flex items-center gap-4 group"
                      >
                        {data.longestWinner.posterUrl ? (
                          <img
                            src={data.longestWinner.posterUrl}
                            alt=""
                            className="w-16 h-24 rounded-lg object-cover border border-white/[0.08] group-hover:border-purple-500/30 transition-colors"
                          />
                        ) : (
                          <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-2xl font-bold">
                            {data.longestWinner.movieTitle.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-lg font-semibold text-white/90 group-hover:text-purple-300 transition-colors">
                            {data.longestWinner.movieTitle}
                          </p>
                          <p className="text-white/50 text-sm mt-0.5">
                            {data.longestWinner.runtimeMinutes >= 60
                              ? `${Math.floor(data.longestWinner.runtimeMinutes / 60)}h${data.longestWinner.runtimeMinutes % 60 ? ` ${data.longestWinner.runtimeMinutes % 60}m` : ""}`
                              : `${data.longestWinner.runtimeMinutes}m`}
                          </p>
                          <p className="text-xs text-white/40 mt-1 group-hover:text-purple-400 transition-colors">
                            View winner →
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <p className="text-white/30 text-sm">No runtime data yet.</p>
                    )}
                  </div>
                </div>

                {/* Dabys favorites */}
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                    <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">
                      Dabys Favorites
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
                  </div>
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className={cardClass}>
                      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                        Favorite Actor
                      </h2>
                      {favorites?.favoriteActors && favorites.favoriteActors.length > 0 ? (
                        <FavoriteBarList data={favorites.favoriteActors} accent="purple" />
                      ) : favorites ? (
                        <p className="text-white/30 text-sm">No winner data yet (TMDB needed).</p>
                      ) : (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className={cardClass}>
                      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                        Favorite Director
                      </h2>
                      {favorites?.favoriteDirectors && favorites.favoriteDirectors.length > 0 ? (
                        <FavoriteBarList data={favorites.favoriteDirectors} accent="violet" />
                      ) : favorites ? (
                        <p className="text-white/30 text-sm">No winner data yet (TMDB needed).</p>
                      ) : (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className={cardClass}>
                      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                        Favorite Genre
                      </h2>
                      {favorites?.favoriteGenres && favorites.favoriteGenres.length > 0 ? (
                        <FavoriteBarList data={favorites.favoriteGenres} accent="indigo" />
                      ) : favorites ? (
                        <p className="text-white/30 text-sm">No winner data yet (TMDB needed).</p>
                      ) : (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Most popular decade */}
                <div className={cardClass}>
                  <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
                    Winners by Decade
                  </h2>
                  {data.winnersByDecade && data.winnersByDecade.length > 0 ? (
                    <ul className="space-y-3">
                      {data.winnersByDecade.map((entry) => (
                        <li key={entry.decade}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-white/80 text-sm truncate">{entry.decade}</span>
                            <span className="text-white/40 text-xs shrink-0">
                              {entry.count} winner{entry.count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="h-2 rounded bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-400/50 to-purple-500/50 rounded"
                              style={{ width: `${(entry.count / maxDecadeCount) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-white/30 text-sm">No winner data yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
