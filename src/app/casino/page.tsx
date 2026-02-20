"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RED_NUMBERS, SLOT_SYMBOLS, SLOT_PAYTABLE, SLOT_PAYTABLE_2OAK, handValue, type Card } from "@/lib/casino";

type GameTab = "slots" | "blackjack" | "roulette" | "dabys-bets";

const TABS: { key: GameTab; label: string }[] = [
  { key: "slots", label: "Slots" },
  { key: "blackjack", label: "Blackjack" },
  { key: "roulette", label: "Roulette" },
  { key: "dabys-bets", label: "Dabys Bets" },
];

function CasinoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [blackjackLastResult, setBlackjackLastResult] = useState<{ result: string; payout: number; netChange: number } | null>(null);
  const [blackjackResultFading, setBlackjackResultFading] = useState(false);

  const gameParam = searchParams.get("game") as GameTab | null;
  const activeTab: GameTab =
    gameParam && TABS.some((t) => t.key === gameParam) ? gameParam : "slots";

  const setTab = (tab: GameTab) => {
    router.replace(`/casino?game=${tab}`, { scroll: false });
  };

  useEffect(() => {
    if (!blackjackLastResult) {
      setBlackjackResultFading(false);
      return;
    }
    setBlackjackResultFading(false);
    const fadeAt = setTimeout(() => setBlackjackResultFading(true), 2500);
    const clearAt = setTimeout(() => {
      setBlackjackLastResult(null);
      setBlackjackResultFading(false);
    }, 3000);
    return () => {
      clearTimeout(fadeAt);
      clearTimeout(clearAt);
    };
  }, [blackjackLastResult]);

  useEffect(() => {
    if (activeTab !== "blackjack") setBlackjackLastResult(null);
  }, [activeTab]);

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(cached) as { id: string; name: string };
      setUser(u);
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.balance === "number") setCreditBalance(d.balance);
        })
        .catch(() => {});
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const refreshCredits = (delta?: number) => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    try {
      const u = JSON.parse(cached) as { id: string };
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.balance === "number") {
            setCreditBalance(d.balance);
            if (typeof delta === "number" && delta !== 0) {
              window.dispatchEvent(
                new CustomEvent("dabys-credits-refresh", { detail: { delta } })
              );
            }
          }
        })
        .catch(() => {});
    } catch {}
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Ambient glow — stronger, animated */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] rounded-full bg-purple-600/15 blur-[180px] animate-[casino-glow-pulse_6s_ease-in-out_infinite]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[700px] h-[700px] rounded-full bg-indigo-600/12 blur-[160px] animate-[casino-glow-pulse_8s_ease-in-out_infinite]" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-amber-600/10 blur-[140px] animate-[casino-glow-pulse_7s_ease-in-out_infinite]" style={{ animationDelay: "-1s" }} />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Header block — bigger, more premium */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white/95 font-card-title tracking-tight" style={{ fontFamily: "'Libre Baskerville', serif" }}>
            Casino
          </h1>
          <p className="text-white/50 text-base sm:text-lg mt-2 tracking-wide">
            Slots · Blackjack · Roulette · Dabys Bets
          </p>
        </div>

        {/* Tab bar — pill style with hover */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer casino-premium-btn ${
                activeTab === tab.key
                  ? "bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.2)]"
                  : "bg-white/[0.04] border border-white/[0.12] text-white/50 hover:bg-white/[0.08] hover:text-white/80 hover:border-amber-500/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Game content — main glass panel, bigger */}
        <div className="rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-8 sm:p-12 shadow-[0_16px_48px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] transition-shadow duration-300 hover:shadow-[0_20px_56px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)]">
          {activeTab === "slots" && (
            <SlotsGame userId={user.id} balance={creditBalance} onCreditsChange={refreshCredits} />
          )}
          {activeTab === "blackjack" && (
            <BlackjackGame
              userId={user.id}
              balance={creditBalance}
              onCreditsChange={refreshCredits}
              onResult={setBlackjackLastResult}
            />
          )}
          {activeTab === "roulette" && (
            <RouletteGame userId={user.id} balance={creditBalance} onCreditsChange={refreshCredits} />
          )}
          {activeTab === "dabys-bets" && (
            <DabysBetsGame userId={user.id} balance={creditBalance} onCreditsChange={refreshCredits} />
          )}
        </div>

        {/* Blackjack result — premium, fades after 3s */}
        {activeTab === "blackjack" && blackjackLastResult && (
          <div
            className={`mt-8 text-center py-6 px-8 rounded-2xl border-2 backdrop-blur-xl transition-opacity duration-500 animate-in fade-in duration-300 ${
              blackjackResultFading ? "opacity-0" : "opacity-100"
            } ${
              blackjackLastResult.result === "win"
                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 shadow-[0_8px_32px_rgba(34,197,94,0.15)]"
                : blackjackLastResult.result === "push"
                  ? "bg-white/[0.08] border-white/[0.15] text-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                  : "bg-red-500/20 border-red-400/40 text-red-200 shadow-[0_8px_32px_rgba(239,68,68,0.15)]"
            }`}
          >
            {blackjackLastResult.result === "win" && (
              <p className="font-medium text-sm">You won {blackjackLastResult.payout} credits!</p>
            )}
            {blackjackLastResult.result === "push" && <p className="text-sm">Push — bet returned</p>}
            {blackjackLastResult.result === "loss" && <p className="text-sm">Dealer wins</p>}
          </div>
        )}
      </main>
    </div>
  );
}

const SLOT_BETS = [5, 10, 25, 50, 100];

const SLOT_ICONS: Record<string, string> = {
  "7": "7️⃣",
  BAR: "BAR",
  cherry: "🍒",
  star: "⭐",
  bell: "🔔",
};

function slotIcon(symbol: string): string {
  if (!symbol || symbol === "—") return "—";
  return SLOT_ICONS[symbol] ?? symbol;
}

const SPIN_TICK_MS = 80;
const REEL_STOP_DELAY_MS = 400;

function pickRandomSymbol() {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

function SlotsGame({
  userId,
  balance,
  onCreditsChange,
}: {
  userId: string;
  balance: number;
  onCreditsChange: (delta?: number) => void;
}) {
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [symbols, setSymbols] = useState<string[] | null>(null);
  const [finalSymbols, setFinalSymbols] = useState<string[] | null>(null);
  const [reelsStopped, setReelsStopped] = useState(0);
  const [spinDisplaySymbols, setSpinDisplaySymbols] = useState<string[]>(["—", "—", "—"]);
  const [lastResult, setLastResult] = useState<{ win: boolean; payout: number; netChange: number } | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reelsStoppedRef = useRef(0);

  async function handleSpin() {
    if (spinning || balance < bet) return;
    setSpinning(true);
    setLastResult(null);
    setSymbols(null);
    setFinalSymbols(null);
    setReelsStopped(0);
    reelsStoppedRef.current = 0;
    setSpinDisplaySymbols([pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()]);

    const finalResultRef = { symbols: [] as string[], win: false, payout: 0, netChange: 0 };

    try {
      const res = await fetch("/api/casino/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, bet }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Spin failed");
        setSpinning(false);
        return;
      }
      finalResultRef.symbols = data.symbols;
      finalResultRef.win = data.win;
      finalResultRef.payout = data.payout;
      finalResultRef.netChange = data.netChange;
      setFinalSymbols(data.symbols);
    } catch {
      alert("Something went wrong");
      setSpinning(false);
      return;
    }

    spinIntervalRef.current = setInterval(() => {
      const stopped = reelsStoppedRef.current;
      setSpinDisplaySymbols([
        stopped > 0 ? finalResultRef.symbols[0] : pickRandomSymbol(),
        stopped > 1 ? finalResultRef.symbols[1] : pickRandomSymbol(),
        stopped > 2 ? finalResultRef.symbols[2] : pickRandomSymbol(),
      ]);
    }, SPIN_TICK_MS);

    stopTimeoutsRef.current = [];
    for (let i = 0; i < 3; i++) {
      const t = setTimeout(() => {
        reelsStoppedRef.current = i + 1;
        setReelsStopped(i + 1);
        if (i >= 2) {
          if (spinIntervalRef.current) {
            clearInterval(spinIntervalRef.current);
            spinIntervalRef.current = null;
          }
          setSymbols(finalResultRef.symbols);
          setSpinDisplaySymbols(finalResultRef.symbols);
          setLastResult({
            win: finalResultRef.win,
            payout: finalResultRef.payout,
            netChange: finalResultRef.netChange,
          });
          onCreditsChange(finalResultRef.netChange);
          setSpinning(false);
        }
      }, REEL_STOP_DELAY_MS * (i + 1));
      stopTimeoutsRef.current.push(t);
    }
  }

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      stopTimeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">3-Reel Slots</h2>
        <div className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
      </div>

      {/* Slots machine: bigger reels, premium styling */}
      <div className="relative mb-10">
        {/* Reels — bigger, with hover glow */}
        <div className="flex justify-center gap-3 sm:gap-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-20 h-24 sm:w-28 sm:h-36 rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl flex items-center justify-center text-2xl sm:text-4xl font-bold text-white/95 overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,0.2),0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 ${spinning ? "ring-2 ring-amber-400/40 shadow-[inset_0_2px_8px_rgba(0,0,0,0.2),0_0_24px_rgba(245,158,11,0.15)]" : "hover:ring-2 hover:ring-amber-400/20 hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.2),0_8px_32px_rgba(0,0,0,0.2)]"}`}
            >
              <span className={`capitalize transition-opacity duration-150 ${spinning ? "opacity-95" : ""}`}>
                {slotIcon((spinning ? spinDisplaySymbols : symbols)?.[i] ?? "—")}
              </span>
            </div>
          ))}
        </div>

        {/* Vertical paytable — positioned far right */}
        <div className="absolute right-0 top-0 flex flex-col py-3 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] text-xs text-white/50 min-w-[90px] backdrop-blur-sm">
          {SLOT_SYMBOLS.map((sym) => (
            <div key={sym} className="flex items-center justify-between gap-3 py-0.5">
              <span>{slotIcon(sym)}×3</span>
              <span className="text-amber-400/80 font-medium">{SLOT_PAYTABLE[sym]}×</span>
            </div>
          ))}
          <div className="border-t border-white/[0.06] my-1" />
          <div className="flex items-center justify-between gap-3 py-0.5">
            <span>Pair</span>
            <span className="text-amber-400/80 font-medium">{SLOT_PAYTABLE_2OAK}×</span>
          </div>
        </div>
      </div>

      {/* Bet selector — bigger chips with hover */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
        {SLOT_BETS.map((b) => (
          <button
            key={b}
            onClick={() => setBet(b)}
            disabled={spinning || balance < b}
            className={`casino-premium-btn px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              bet === b
                ? "border-2 border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.15)]"
                : "border border-white/[0.15] bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:border-amber-500/30 hover:text-amber-200"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Spin button — premium, bigger */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleSpin}
          disabled={spinning || balance < bet}
          className="casino-premium-btn min-w-[200px] px-12 py-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/15 backdrop-blur-md text-amber-300 font-semibold text-lg hover:border-amber-400/60 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
        >
          {spinning ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              Spinning…
            </span>
          ) : (
            "Spin"
          )}
        </button>
      </div>

      {/* Result — premium */}
      {lastResult && (
        <div
          className={`text-center py-6 px-8 rounded-2xl border-2 backdrop-blur-xl animate-in fade-in duration-300 ${
            lastResult.win
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_8px_32px_rgba(34,197,94,0.15)]"
              : "border-white/[0.1] bg-white/[0.05] text-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
          }`}
        >
          {lastResult.win ? (
            <p className="font-semibold text-base">You won {lastResult.payout} credits!</p>
          ) : (
            <p className="text-sm">No match. Better luck next time!</p>
          )}
        </div>
      )}
    </div>
  );
}

const CARD_FLIP_DELAY_MS = 120;

function renderCard(c: { suit: string; rank: string }, idx: number, cardKey?: string) {
  const isHidden = c.suit === "?" && c.rank === "?";
  const color = c.suit === "♥" || c.suit === "♦" ? "text-red-400" : "text-white/90";
  return (
    <div
      key={cardKey ?? idx}
      className={`card-reveal w-20 h-28 sm:w-24 sm:h-36 rounded-xl border-2 border-white/[0.12] bg-gradient-to-b from-white/[0.1] to-white/[0.04] backdrop-blur-xl flex items-center justify-center text-lg sm:text-xl font-bold [transform-style:preserve-3d] shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-transform duration-200 hover:scale-[1.03] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${color}`}
      style={{ animationDelay: `${idx * CARD_FLIP_DELAY_MS}ms` }}
    >
      {isHidden ? "?" : `${c.rank}${c.suit}`}
    </div>
  );
}

function BlackjackGame({
  userId,
  balance,
  onCreditsChange,
  onResult,
}: {
  userId: string;
  balance: number;
  onCreditsChange: (delta?: number) => void;
  onResult: (r: { result: string; payout: number; netChange: number } | null) => void;
}) {
  const [betInput, setBetInput] = useState("10");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ status: string; bet: number; offerInsurance?: boolean; currentHandIndex?: number; playerHands?: { suit: string; rank: string }[][] } | null>(null);
  const [playerHand, setPlayerHand] = useState<{ suit: string; rank: string }[]>([]);
  const [playerHands, setPlayerHands] = useState<{ suit: string; rank: string }[][] | null>(null);
  const [dealerHand, setDealerHand] = useState<{ suit: string; rank: string }[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [dealKey, setDealKey] = useState(0);
  const [balanceFromApi, setBalanceFromApi] = useState<number | null>(null);

  async function loadSession() {
    try {
      const res = await fetch(`/api/casino/blackjack?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setPlayerHands(data.playerHands || null);
        setPlayerHand(data.playerHand || []);
        setDealerHand(data.dealerHand || []);
        setPlayerValue(data.playerValue ?? 0);
        setDealerValue(data.dealerValue ?? 0);
        onCreditsChange();
      } else {
        setSession(null);
        setPlayerHand([]);
        setPlayerHands(null);
        setDealerHand([]);
        setBalanceFromApi(null);
        onResult(null);
      }
    } catch {
      setSession(null);
    }
  }

  useEffect(() => {
    loadSession();
  }, [userId]);

  async function handleAction(action: "deal" | "hit" | "stand" | "insurance" | "split", takeInsurance?: boolean) {
    if (loading) return;
    if (action === "deal") {
      const parsed = parseInt(betInput, 10);
      const betVal = isNaN(parsed) ? 0 : Math.max(2, Math.min(500, parsed));
      if (betVal < 2 || betVal > 500) {
        alert("Please enter a bet between 2 and 500.");
        return;
      }
      if (betVal % 2 !== 0) {
        alert("Please enter an even number for your bet.");
        return;
      }
      if (balance < betVal) {
        alert("Not enough credits.");
        return;
      }
    }
    setLoading(true);
    if (action === "deal") onResult(null);
    try {
      const betVal = action === "deal" ? Math.max(2, Math.min(500, parseInt(betInput, 10) || 0)) : 0;
      const body: Record<string, unknown> = { userId, action };
      if (action === "deal") body.bet = betVal;
      if (action === "insurance") body.takeInsurance = takeInsurance;
      const res = await fetch("/api/casino/blackjack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed");
        setLoading(false);
        return;
      }
      setSession(data.session);
      setPlayerHands(data.playerHands || null);
      const curHand = data.playerHands
        ? (data.playerHands[data.session?.currentHandIndex ?? 0] ?? data.playerHand)
        : (data.playerHand || []);
      setPlayerHand(curHand);
      setDealerHand(data.dealerHand || []);
      setPlayerValue(data.playerValue ?? 0);
      setDealerValue(data.dealerValue ?? 0);
      if (typeof data.newBalance === "number") setBalanceFromApi(data.newBalance);
      if (action === "deal") {
        setDealKey((k) => k + 1);
        setPlayerHands(null);
        onCreditsChange();
      }
      if (action === "split") {
        onCreditsChange();
      }
      if (data.result !== null && data.result !== undefined) {
        onResult({
          result: data.result,
          payout: data.payout ?? 0,
          netChange: data.netChange ?? 0,
        });
        onCreditsChange(data.netChange);
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">Blackjack</h2>
        <div className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
      </div>

      {/* Dealer hand — premium card area */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 mb-6 shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
        <p className="text-sm font-semibold text-white/50 uppercase tracking-[0.2em] mb-4 text-center">Dealer</p>
        <div className="flex gap-3 sm:gap-4 flex-wrap min-h-[8rem] justify-center [perspective:800px]">
          {dealerHand.map((c, i) => renderCard(c, i, `d-${dealKey}-${i}`))}
        </div>
        {dealerValue > 0 && (
          <p className="text-white/50 text-xs mt-2 tabular-nums text-center">Value: {dealerValue}</p>
        )}
      </div>

      {/* Player hand(s) — premium card area */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 mb-8 shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
        <p className="text-sm font-semibold text-white/50 uppercase tracking-[0.2em] mb-4 text-center">
          {playerHands ? `Hand ${(session?.currentHandIndex ?? 0) + 1} of ${playerHands.length}` : "Your hand"}
        </p>
        {playerHands && playerHands.length > 1 ? (
          <div className="flex flex-wrap justify-center gap-6">
            {playerHands.map((hand, hi) => (
              <div
                key={hi}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg ${hi === (session?.currentHandIndex ?? 0) ? "ring-2 ring-amber-400/50 bg-amber-500/5" : "opacity-70"}`}
              >
                <div className="flex gap-2 [perspective:600px]">
                  {hand.map((c, i) => renderCard(c, i, `p-${dealKey}-${hi}-${i}`))}
                </div>
                <p className="text-white/50 text-xs tabular-nums">Value: {handValue(hand as Card[])}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap min-h-[7rem] justify-center [perspective:600px]">
              {playerHand.map((c, i) => renderCard(c, i, `p-${dealKey}-${i}`))}
            </div>
            {playerValue > 0 && (
              <p className="text-white/50 text-xs mt-2 tabular-nums text-center">Value: {playerValue}</p>
            )}
          </>
        )}
      </div>

      {/* Controls — single row to prevent container resize */}
      <div className="flex justify-center items-center gap-3 min-h-[44px]">
      {!session ? (
        <>
          <div className="flex items-stretch rounded-lg border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl overflow-hidden focus-within:ring-2 focus-within:ring-white/20">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={betInput}
              onChange={(e) => setBetInput(e.target.value.replace(/\D/g, ""))}
              placeholder="2–500, even"
              className="casino-bet-input w-20 bg-transparent px-2 py-2.5 text-white/90 text-center text-sm focus:outline-none placeholder:text-white/30"
              title="Bet (even number, 2–500)"
            />
            <div className="flex flex-col border-l border-white/[0.1]">
              <button
                type="button"
                onClick={() => {
                  const v = parseInt(betInput, 10) || 0;
                  const next = Math.min(500, Math.max(2, v) + 2);
                  setBetInput(String(next));
                }}
                disabled={(parseInt(betInput, 10) || 0) >= 500}
                className="flex items-center justify-center w-6 h-5 text-amber-400/90 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Increase bet"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  const v = parseInt(betInput, 10) || 0;
                  const next = Math.max(2, Math.min(500, v) - 2);
                  setBetInput(String(next));
                }}
                disabled={(parseInt(betInput, 10) || 0) <= 2}
                className="flex items-center justify-center w-6 h-5 text-amber-400/90 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer border-t border-white/[0.08]"
                aria-label="Decrease bet"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
          </div>
          <button
            onClick={() => handleAction("deal")}
            disabled={loading || balance < (parseInt(betInput, 10) || 0)}
            className="casino-premium-btn min-w-[100px] px-8 py-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "…" : "Deal"}
          </button>
        </>
      ) : session?.status === "insurance" ? (
        <>
          <p className="text-sm text-white/60 mr-2">Dealer shows Ace. Insurance? (Pays 2:1 if dealer has blackjack)</p>
          <button
            onClick={() => handleAction("insurance", true)}
            disabled={loading || balance < Math.floor((session?.bet ?? 0) / 2)}
            className="casino-premium-btn min-w-[100px] px-8 py-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Yes ({Math.floor((session?.bet ?? 0) / 2)} cr)
          </button>
          <button
            onClick={() => handleAction("insurance", false)}
            disabled={loading}
            className="casino-premium-btn min-w-[100px] px-8 py-3 rounded-xl border-2 border-white/25 bg-white/[0.06] text-white/70 font-semibold hover:bg-white/[0.1] hover:border-white/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            No
          </button>
        </>
      ) : (
        <>
          {playerHand.length === 2 && !playerHands && (() => {
            const normRank = (r: string) => (["10", "J", "Q", "K"].includes(r) ? "10" : r);
            const isPair = playerHand[0] && playerHand[1] && normRank(playerHand[0].rank) === normRank(playerHand[1].rank);
            const effectiveBalance = balanceFromApi ?? balance;
            const canAffordSplit = effectiveBalance >= (session?.bet ?? 0);
            return (
              <button
                onClick={() => handleAction("split")}
                disabled={loading || !isPair || !canAffordSplit}
                className="casino-premium-btn min-w-[100px] px-8 py-3 rounded-xl border-2 border-purple-500/40 bg-purple-500/15 text-purple-300 font-semibold hover:border-purple-500/60 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Split
              </button>
            );
          })()}
          <button
            onClick={() => handleAction("hit")}
            disabled={loading || playerValue >= 21}
            className="casino-premium-btn min-w-[100px] px-8 py-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-semibold hover:border-emerald-500/60 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Hit
          </button>
          <button
            onClick={() => handleAction("stand")}
            disabled={loading}
            className="casino-premium-btn min-w-[100px] px-8 py-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Stand
          </button>
        </>
      )}
      </div>
    </div>
  );
}

function RouletteGame({
  userId,
  balance,
  onCreditsChange,
}: {
  userId: string;
  balance: number;
  onCreditsChange: (delta?: number) => void;
}) {
  const [betInput, setBetInput] = useState("10");
  const [selection, setSelection] = useState<"red" | "black" | number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const QUICK_BETS = [5, 10, 25, 50, 100, 250, 500];
  const [lastResult, setLastResult] = useState<{
    result: number;
    resultColor: string;
    win: boolean;
    payout: number;
    netChange: number;
  } | null>(null);

  const SPIN_DURATION_MS = 2000;

  async function handleSpin() {
    const betVal = Math.max(5, Math.min(500, parseInt(betInput, 10) || 0));
    if (spinning || selection === null) return;
    if (betVal < 5 || betVal > 500) {
      alert("Please enter a bet between 5 and 500.");
      return;
    }
    if (betVal % 5 !== 0) {
      alert("Please enter a multiple of 5 for your bet.");
      return;
    }
    if (balance < betVal) {
      alert("Not enough credits.");
      return;
    }
    setSpinning(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/casino/roulette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, bet: betVal, selection }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Spin failed");
        setSpinning(false);
        return;
      }
      await new Promise((r) => setTimeout(r, SPIN_DURATION_MS));
      setLastResult({
        result: data.result,
        resultColor: data.resultColor,
        win: data.win,
        payout: data.payout,
        netChange: data.netChange,
      });
      onCreditsChange(data.netChange);
    } catch {
      alert("Something went wrong");
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">Roulette</h2>
        <div className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
      </div>

      <div className="flex flex-col items-center gap-10">
        {/* Betting board — premium, bigger */}
        <div className="w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <label className="text-[11px] uppercase tracking-wider text-white/40 shrink-0">Bet</label>
            <div className="flex items-stretch rounded-lg border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl overflow-hidden focus-within:ring-2 focus-within:ring-white/20">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={betInput}
                onChange={(e) => setBetInput(e.target.value.replace(/\D/g, ""))}
                placeholder="5–500, ×5"
                className="casino-bet-input w-20 bg-transparent px-3 py-2 text-white/90 text-center text-sm focus:outline-none placeholder:text-white/30"
                title="Bet (multiple of 5, 5–500)"
              />
              <div className="flex flex-col border-l border-white/[0.1]">
                <button
                  type="button"
                  onClick={() => {
                    const v = parseInt(betInput, 10) || 0;
                    const next = Math.min(500, Math.max(5, v) + 5);
                    setBetInput(String(next));
                  }}
                  disabled={(parseInt(betInput, 10) || 0) >= 500}
                  className="flex items-center justify-center w-6 h-4 text-amber-400/90 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  aria-label="Increase bet"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = parseInt(betInput, 10) || 0;
                    const next = Math.max(5, Math.min(500, v) - 5);
                    setBetInput(String(next));
                  }}
                  disabled={(parseInt(betInput, 10) || 0) <= 5}
                  className="flex items-center justify-center w-6 h-4 text-amber-400/90 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer border-t border-white/[0.08]"
                  aria-label="Decrease bet"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_BETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBetInput(String(amt))}
                  className={`casino-premium-btn px-3.5 py-2 rounded-xl text-sm font-semibold cursor-pointer ${
                    (parseInt(betInput, 10) || 0) === amt
                      ? "border-2 border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                      : "border border-white/[0.15] bg-white/[0.06] text-white/70 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200"
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelection(selection === "red" ? null : "red")}
                className={`casino-premium-btn px-8 py-3 rounded-xl text-sm font-semibold cursor-pointer ${
                  selection === "red"
                    ? "border-2 border-red-500/50 bg-red-500/20 text-red-400 ring-2 ring-red-400/50 shadow-[0_0_16px_rgba(239,68,68,0.2)]"
                    : "border border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-500/60 hover:bg-red-500/20"
                }`}
              >
                Red 2×
              </button>
              <button
                onClick={() => setSelection(selection === "black" ? null : "black")}
                className={`casino-premium-btn px-8 py-3 rounded-xl text-sm font-semibold cursor-pointer ${
                  selection === "black"
                    ? "border-2 border-white/50 bg-white/15 text-white ring-2 ring-white/40 shadow-[0_0_16px_rgba(255,255,255,0.1)]"
                    : "border border-white/[0.2] bg-white/[0.06] text-white/80 hover:border-white/40 hover:bg-white/[0.12]"
                }`}
              >
                Black 2×
              </button>
              <button
                onClick={() => setSelection(selection === 0 ? null : 0)}
                className={`casino-premium-btn w-14 py-3 rounded-xl text-sm font-semibold cursor-pointer ${
                  selection === 0
                    ? "border-2 border-emerald-500/50 bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                    : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-500/20"
                }`}
              >
                0
              </button>
            </div>
          </div>
          {/* Horizontal number grid — bigger cells, hover effects */}
          <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
            {[0, 1, 2].map((row) =>
              Array.from({ length: 12 }, (_, col) => {
                const n = col * 3 + row + 1;
                const isRed = RED_NUMBERS.includes(n);
                const sel = selection === n;
                return (
                  <button
                    key={n}
                    onClick={() => setSelection(selection === n ? null : n)}
                    className={`aspect-[4/3] min-h-[32px] sm:min-h-[36px] rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer casino-premium-btn ${
                      sel ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0a0a0f] scale-[1.02]" : ""
                    } ${
                      isRed
                        ? sel
                          ? "border-2 border-red-500/50 bg-red-500/25 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                          : "border border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                        : sel
                          ? "border-2 border-white/40 bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                          : "border border-white/[0.15] bg-white/[0.05] text-white/70 hover:bg-white/[0.12] hover:border-white/[0.25]"
                    }`}
                  >
                    {n}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-white/40 text-center mt-2">Straight up 35×</p>
        </div>
      </div>

      {/* Spin button — premium */}
      <div className="flex justify-center mt-8 mb-4">
        <button
          onClick={handleSpin}
          disabled={spinning || balance < (parseInt(betInput, 10) || 0) || selection === null}
          className="casino-premium-btn min-w-[200px] px-12 py-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/15 backdrop-blur-md text-amber-300 font-semibold text-lg hover:border-amber-400/60 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
        >
          {spinning ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              Spinning…
            </span>
          ) : (
            "Spin"
          )}
        </button>
      </div>

      {/* Result — premium */}
      {lastResult && (
        <div
          className={`text-center py-6 px-8 rounded-2xl border-2 backdrop-blur-xl animate-in fade-in duration-300 ${
            lastResult.win
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_8px_32px_rgba(34,197,94,0.15)]"
              : "bg-white/[0.05] border-white/[0.1] text-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
          }`}
        >
          <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Landed on</p>
          <p
            className={`text-3xl sm:text-4xl font-bold tabular-nums ${
              lastResult.resultColor === "red"
                ? "text-red-400"
                : lastResult.resultColor === "black"
                  ? "text-gray-300"
                  : "text-green-400"
            }`}
          >
            {lastResult.result}
          </p>
          {lastResult.win ? (
            <p className="mt-2 text-sm font-medium">You won {lastResult.payout} credits!</p>
          ) : (
            <p className="mt-2 text-sm">No win.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface DabysBetsEvent {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  oddsA: number;
  oddsB: number;
  minBet: number;
  maxBet: number;
  isActive: boolean;
}

function DabysBetsGame({
  userId,
  balance,
  onCreditsChange,
}: {
  userId: string;
  balance: number;
  onCreditsChange: (delta?: number) => void;
}) {
  const [events, setEvents] = useState<DabysBetsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [betting, setBetting] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<{
    eventTitle: string;
    side: string;
    userWon: boolean;
    payout: number;
    netChange: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/casino/dabys-bets")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  async function placeBet(eventId: string, side: "A" | "B") {
    const amount = betAmount[eventId] ?? 10;
    const evt = events.find((e) => e.id === eventId);
    if (!evt || amount < evt.minBet || amount > evt.maxBet || balance < amount) return;
    setBetting(eventId);
    setLastResult(null);
    try {
      const res = await fetch("/api/casino/dabys-bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, eventId, side, bet: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Bet failed");
        setBetting(null);
        return;
      }
      setLastResult({
        eventTitle: data.eventTitle,
        side: side === "A" ? evt.sideA : evt.sideB,
        userWon: data.userWon,
        payout: data.payout,
        netChange: data.netChange,
      });
      onCreditsChange(data.netChange);
    } catch {
      alert("Something went wrong");
    } finally {
      setBetting(null);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/50 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-white/40">No events available. Check back later.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em]">Dabys Bets</h2>
        <div className="h-px flex-1 bg-gradient-to-l from-amber-500/20 to-transparent" />
      </div>

      <div className="space-y-6">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="rounded-2xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.15)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
          >
            <p className="text-white/95 font-semibold text-base mb-5">{evt.title}</p>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={() => placeBet(evt.id, "A")}
                  disabled={betting !== null || balance < (betAmount[evt.id] ?? evt.minBet)}
                  className="casino-premium-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-semibold border-2 border-purple-500/40 bg-purple-500/15 text-purple-300 hover:border-purple-500/60 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer backdrop-blur-md"
                >
                  {evt.sideA} <span className="text-white/50">({evt.oddsA}x)</span>
                </button>
                <span className="hidden sm:inline text-white/30 self-center text-sm font-medium">vs</span>
                <button
                  onClick={() => placeBet(evt.id, "B")}
                  disabled={betting !== null || balance < (betAmount[evt.id] ?? evt.minBet)}
                  className="casino-premium-btn flex-1 px-6 py-3.5 rounded-xl text-sm font-semibold border-2 border-amber-500/40 bg-amber-500/15 text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer backdrop-blur-md"
                >
                  {evt.sideB} <span className="text-white/50">({evt.oddsB}x)</span>
                </button>
              </div>
              <div className="flex items-center gap-2 sm:flex-shrink-0">
                <input
                  type="number"
                  min={evt.minBet}
                  max={evt.maxBet}
                  value={betAmount[evt.id] ?? evt.minBet}
                  onChange={(e) =>
                    setBetAmount((prev) => ({
                      ...prev,
                      [evt.id]: Math.max(evt.minBet, Math.min(evt.maxBet, parseInt(e.target.value, 10) || evt.minBet)),
                    }))
                  }
                  className="w-20 rounded-xl border border-white/[0.12] bg-white/[0.03] backdrop-blur-md px-2.5 py-2 text-white/90 text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <span className="text-white/35 text-[11px]">credits</span>
              </div>
            </div>
            <p className="text-[11px] text-white/30 mt-3">
              Bet {evt.minBet}–{evt.maxBet}
            </p>
          </div>
        ))}
      </div>

      {lastResult && (
        <div
          className={`mt-8 text-center py-6 px-8 rounded-2xl border-2 backdrop-blur-xl animate-in fade-in duration-300 ${
            lastResult.userWon
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_8px_32px_rgba(34,197,94,0.15)]"
              : "bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_8px_32px_rgba(239,68,68,0.15)]"
          }`}
        >
          <p className="font-semibold text-base">{lastResult.eventTitle}</p>
          <p className="text-sm mt-1 text-white/80">
            {lastResult.userWon ? `Won ${lastResult.payout} on ${lastResult.side}` : `Lost — ${lastResult.side}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function CasinoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      }
    >
      <CasinoContent />
    </Suspense>
  );
}
