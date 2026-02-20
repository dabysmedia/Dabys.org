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

const iconClass = "w-full h-full text-white/50";

/* ─── Stats SVG icons (Heroicons-style) ─── */
const StatsIcons = {
  star: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  bookOpen: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  rectangleStack: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
    </svg>
  ),
  cube: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
  banknotes: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M3.75 18.75h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75M18 3.75v.375c0 .621-.504 1.125-1.125 1.125H3.75M18 18.75V6.75m0 9v2.25m0-9V18" />
    </svg>
  ),
  sparkles: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  documentText: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  squares2x2: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  userGroup: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  trophy: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.709 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0M17.25 6.75a6.772 6.772 0 01-3.044 0m0 0a6.726 6.726 0 01-2.749 1.35M20.25 6.75c.621 0 1.125.504 1.125 1.125v7.5c0 .621-.504 1.125-1.125 1.125h-1.5a1.125 1.125 0 01-1.125-1.125v-7.5c0-.621.504-1.125 1.125-1.125h1.5z" />
    </svg>
  ),
  chartBar: (className?: string) => (
    <svg className={className ?? iconClass} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

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
  icon: React.ReactNode;
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
          <span className={`flex shrink-0 ${featured ? "w-8 h-8" : "w-6 h-6"}`}>{icon}</span>
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
                          width: `${Math.max(4, Math.min(100, (entry.value / maxVal) * 100))}%`,
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

/* ─── High Roller card (net win/loss) ─── */
function HighRollerCard({
  entries,
  emptyText = "No casino action",
}: {
  entries: { userName: string; hands: number; wagered: number; netPnl: number }[];
  emptyText?: string;
}) {
  const maxMagnitude = Math.max(...entries.map((e) => Math.abs(e.netPnl)), 1);

  return (
    <div className={`${cardClass} relative overflow-hidden group`}>
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-sky-400 blur-[60px] opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-6 h-6 shrink-0">{StatsIcons.squares2x2()}</span>
          <h3 className="font-semibold text-white/60 uppercase tracking-widest text-xs">High Roller</h3>
        </div>
        {entries.length === 0 ? (
          <p className="text-white/30 text-sm">{emptyText}</p>
        ) : (
          <div className="space-y-2.5">
            {entries.map((e, i) => {
              const rank = i + 1;
              const isFirst = rank === 1;
              const isWin = e.netPnl >= 0;
              const signed = e.netPnl >= 0 ? `+${e.netPnl.toLocaleString()}` : e.netPnl.toLocaleString();
              const valueColor = isWin ? "text-emerald-400" : "text-red-400";
              const barGradient = isWin ? "from-emerald-500/60 to-emerald-400/60" : "from-red-500/60 to-red-400/60";
              return (
                <div key={`${e.userName}-${i}`} className={`flex items-center gap-3 ${isFirst ? "mb-1" : ""}`}>
                  <RankBadge rank={rank} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <span
                          className={`text-sm truncate block ${isFirst ? "font-bold text-white" : "font-medium text-white/70"}`}
                        >
                          {e.userName}
                        </span>
                        <span className="text-[10px] text-white/30 block">
                          {e.hands} hands · {e.wagered.toLocaleString()} cr wagered
                        </span>
                      </div>
                      <span
                        className={`text-xs tabular-nums shrink-0 font-semibold ${isFirst ? valueColor : `${valueColor} opacity-80`}`}
                      >
                        {signed} cr
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
                        style={{
                          width: `${Math.max((Math.abs(e.netPnl) / maxMagnitude) * 100, 4)}%`,
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
                      icon={StatsIcons.star()}
                      featured
                      entries={data.legendaryCollectors.map((e) => ({
                        name: e.userName,
                        value: e.value,
                      }))}
                      valueLabel="legendaries codex'd"
                      accentFrom="from-amber-400/60"
                      accentTo="to-amber-500/60"
                      emptyText="No legendaries codex'd yet"
                      glowColor="bg-amber-500"
                    />

                    <LeaderboardCard
                      title="Codex Completion"
                      icon={StatsIcons.bookOpen()}
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
                      icon={StatsIcons.rectangleStack()}
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
                      icon={StatsIcons.cube()}
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
                      icon={StatsIcons.banknotes()}
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
                      title="Lifetime Net"
                      icon={StatsIcons.sparkles()}
                      entries={data.totalCreditsEarned.map((e) => ({
                        name: e.userName,
                        value: e.value,
                        displayValue: `${e.value >= 0 ? "+" : ""}${e.value.toLocaleString()} cr`,
                      }))}
                      accentFrom="from-sky-400/60"
                      accentTo="to-sky-500/60"
                      emptyText="No credit activity yet"
                      glowColor="bg-sky-400"
                    />

                    <LeaderboardCard
                      title="Biggest Quester"
                      icon={StatsIcons.documentText()}
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

                    <HighRollerCard
                      entries={data.highRollers.map((e) => ({
                        userName: e.userName,
                        hands: e.hands,
                        wagered: e.value,
                        netPnl: e.netPnl,
                      }))}
                      emptyText="No casino action"
                    />

                    <LeaderboardCard
                      title="Trade Dealer"
                      icon={StatsIcons.userGroup()}
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
                      icon={StatsIcons.trophy()}
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
                      <span className="w-6 h-6 shrink-0">{StatsIcons.chartBar()}</span>
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
