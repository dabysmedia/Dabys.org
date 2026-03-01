"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface WalletData {
  userId: string;
  balance: number;
  entries: LedgerEntry[];
}

const REASON_LABELS: Record<string, string> = {
  submission: "Movie submission",
  vote: "Movie vote",
  submission_win: "Winner prize",
  votes_received: "Votes received",
  daily_quest_reward: "Daily quest",
  lottery_ticket: "Lottery ticket",
  lottery_win: "Lottery win",
  admin_add: "Admin grant",
  admin_set: "Admin adjustment",
  scratch_off: "Scratch-off",
  scratch_off_win: "Scratch-off win",
  pack_purchase: "Pack purchase",
  quicksell: "Quicksell",
  casino_blackjack: "Blackjack",
  casino_blackjack_win: "Blackjack win",
  casino_blackjack_push: "Blackjack push",
  casino_slots: "Slots",
  casino_slots_win: "Slots win",
  casino_roulette: "Roulette",
  casino_roulette_win: "Roulette win",
  community_set_create: "Community set",
  community_set_extra_card: "Extra card",
  comment_like: "Comment like",
  trivia: "Trivia",
  vault_watch: "Vault watch",
  trade_up_epic: "Trade-up (Epic→Legendary)",
  trade: "Trade",
};

function formatReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletPage() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("dabys_user");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(raw) as { id: string; name: string };
      fetch(`/api/wallet?userId=${encodeURIComponent(u.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setData(d);
          else setError("Failed to load wallet");
        })
        .catch(() => setError("Failed to load wallet"))
        .finally(() => setLoading(false));
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center relative z-10">
        <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 relative z-10">
        <p className="text-white/60">{error ?? "Unable to load wallet"}</p>
        <Link href="/" className="text-amber-400 hover:text-amber-300 transition-colors">
          Back home
        </Link>
      </main>
    );
  }

  const { balance, entries } = data;
  const gains = entries.filter((e) => e.amount > 0);
  const losses = entries.filter((e) => e.amount < 0);
  const totalGained = gains.reduce((s, e) => s + e.amount, 0);
  const totalLost = losses.reduce((s, e) => s + Math.abs(e.amount), 0);

  // By source (reason)
  const bySource = new Map<string, { gained: number; lost: number }>();
  for (const e of entries) {
    const cur = bySource.get(e.reason) ?? { gained: 0, lost: 0 };
    if (e.amount > 0) cur.gained += e.amount;
    else cur.lost += Math.abs(e.amount);
    bySource.set(e.reason, cur);
  }
  const sourceBreakdown = Array.from(bySource.entries())
    .map(([reason, { gained, lost }]) => ({ reason, gained, lost, net: gained - lost }))
    .filter((s) => s.gained > 0 || s.lost > 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  // Balance over time (cumulative, for chart)
  const sortedByTime = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let running = 0;
  const balanceHistory = sortedByTime.map((e) => {
    running += e.amount;
    return { date: e.createdAt, balance: running };
  });
  const maxBal = Math.max(...balanceHistory.map((b) => b.balance), balance, 1);
  const minBal = Math.min(...balanceHistory.map((b) => b.balance), 0, balance);

  return (
    <div className="min-h-screen">
      {/* Ambient glow — premium wallet feel */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] rounded-full bg-amber-600/12 blur-[180px] animate-[casino-glow-pulse_6s_ease-in-out_infinite]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-emerald-600/10 blur-[160px] animate-[casino-glow-pulse_8s_ease-in-out_infinite]" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-sky-600/8 blur-[140px] animate-[casino-glow-pulse_7s_ease-in-out_infinite]" style={{ animationDelay: "-1s" }} />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white/95 font-card-title">
              Wallet
            </h1>
            <p className="text-white/50 text-base mt-1 tracking-wide">
              Credits · Ledger · Activity
            </p>
          </div>
          <Link
            href="/cards"
            className="px-5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 hover:border-amber-400/50 transition-all cursor-pointer"
          >
            Go to Store →
          </Link>
        </div>

        {/* Current balance — hero card */}
        <div className="rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-8 mb-8 shadow-[0_16px_48px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
          <div className="relative">
            <p className="text-amber-300/70 text-sm font-medium uppercase tracking-widest mb-2">Current balance</p>
            <p className="text-4xl sm:text-5xl font-bold text-amber-200 tabular-nums tracking-tight font-card-title">
              {balance}
            </p>
            <p className="text-amber-300/50 text-sm mt-1">credits</p>
          </div>
        </div>

        {/* Gains & losses summary */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] backdrop-blur-xl p-5 shadow-[0_8px_32px_rgba(34,197,94,0.08)]">
            <p className="text-emerald-400/80 text-xs font-semibold uppercase tracking-wider mb-1">Total gained</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">+{totalGained}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] backdrop-blur-xl p-5 shadow-[0_8px_32px_rgba(245,158,11,0.08)]">
            <p className="text-amber-400/80 text-xs font-semibold uppercase tracking-wider mb-1">Total spent</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">−{totalLost}</p>
          </div>
        </div>

        {/* Balance over time chart */}
        {balanceHistory.length > 0 && (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            <h2 className="text-lg font-semibold text-white/90 mb-4 font-card-title">
              Balance over time
            </h2>
            <div className="h-44 flex items-end gap-0.5">
              {balanceHistory.slice(-60).map((pt, i) => {
                const range = maxBal - minBal || 1;
                const h = ((pt.balance - minBal) / range) * 100;
                return (
                  <div
                    key={pt.date + i}
                    className="flex-1 min-w-[2px] bg-gradient-to-t from-amber-500/50 to-amber-400/30 rounded-t transition-all hover:from-amber-400/70 hover:to-amber-300/50"
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={`${pt.balance} at ${formatDate(pt.date)}`}
                  />
                );
              })}
            </div>
            <p className="text-white/40 text-xs mt-3">
              Last {Math.min(60, balanceHistory.length)} transactions
            </p>
          </div>
        )}

        {/* By source breakdown */}
        {sourceBreakdown.length > 0 && (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            <h2 className="text-lg font-semibold text-white/90 mb-4 font-card-title">
              By source
            </h2>
            <div className="space-y-4">
              {sourceBreakdown.slice(0, 12).map(({ reason, gained, lost, net }) => {
                const total = gained + lost || 1;
                const gainPct = (gained / total) * 100;
                return (
                  <div key={reason} className="flex items-center gap-4">
                    <span className="text-white/80 text-sm w-44 shrink-0 truncate">
                      {formatReason(reason)}
                    </span>
                    <div className="flex-1 h-7 rounded-full overflow-hidden bg-white/5 flex">
                      <div
                        className="bg-emerald-500/60 transition-all"
                        style={{ width: `${gainPct}%` }}
                      />
                      <div
                        className="bg-amber-500/60 transition-all"
                        style={{ width: `${100 - gainPct}%` }}
                      />
                    </div>
                    <span
                      className={`tabular-nums text-sm font-medium w-16 text-right ${
                        net >= 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {net >= 0 ? `+${net}` : net}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction history */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <div className="px-6 sm:px-8 py-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white/90 font-card-title">
              Credit history
            </h2>
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto scrollbar-autocomplete">
            {entries.length === 0 ? (
              <p className="text-white/40 text-sm p-8 text-center">No transactions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-md z-10">
                  <tr className="text-left text-white/50 border-b border-white/[0.08]">
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Source</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="px-6 py-4 text-white/70 whitespace-nowrap">
                        {formatDate(e.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-white/85">{formatReason(e.reason)}</td>
                      <td
                        className={`px-6 py-4 text-right tabular-nums font-semibold ${
                          e.amount >= 0 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {e.amount >= 0 ? `+${e.amount}` : e.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
