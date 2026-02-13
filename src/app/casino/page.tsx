"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RED_NUMBERS, ROULETTE_WHEEL_ORDER } from "@/lib/casino";

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
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header block */}
        <div className="flex flex-col gap-5 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Casino
            </h1>
            <p className="text-white/45 text-sm mt-0.5">
              Slots · Blackjack · Roulette · Dabys Bets
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Tab bar */}
            <div className="flex gap-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTab(tab.key)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer backdrop-blur-xl ${
                    activeTab === tab.key
                      ? "bg-white/15 border border-white/25 text-white"
                      : "bg-white/[0.05] border border-white/[0.08] text-white/55 hover:text-white/85 hover:bg-white/[0.08] hover:border-white/[0.12]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Game content — main glass panel */}
        <div className="rounded-2xl border border-white/[0.1] bg-white/[0.05] backdrop-blur-2xl p-6 sm:p-10 shadow-xl shadow-black/30">
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

        {/* Blackjack result — outside container, same visual position, fades after 3s */}
        {activeTab === "blackjack" && blackjackLastResult && (
          <div
            className={`mt-6 text-center py-4 px-5 rounded-xl border backdrop-blur-xl transition-opacity duration-500 ${
              blackjackResultFading ? "opacity-0" : "opacity-100"
            } ${
              blackjackLastResult.result === "win"
                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
                : blackjackLastResult.result === "push"
                  ? "bg-white/[0.06] border-white/[0.12] text-white/70"
                  : "bg-red-500/15 border-red-400/30 text-red-200"
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
const SLOT_SYMBOLS = ["7", "BAR", "cherry", "star", "bell"];

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
      <p className="text-[11px] uppercase tracking-widest text-white/35 mb-6 text-center">3-Reel Slots</p>

      {/* Reels */}
      <div className="flex justify-center gap-2 sm:gap-4 mb-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-16 h-20 sm:w-20 sm:h-28 rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl flex items-center justify-center text-xl sm:text-2xl font-bold text-white/90 overflow-hidden"
          >
            <span className={`capitalize ${spinning ? "opacity-90" : ""}`}>
              {slotIcon((spinning ? spinDisplaySymbols : symbols)?.[i] ?? "—")}
            </span>
          </div>
        ))}
      </div>

      {/* Bet selector */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-5">
        {SLOT_BETS.map((b) => (
          <button
            key={b}
            onClick={() => setBet(b)}
            disabled={spinning || balance < b}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-xl ${
              bet === b
                ? "bg-white/12 border border-white/20 text-white"
                : "bg-white/[0.05] border border-white/[0.08] text-white/65 hover:bg-white/[0.08] hover:border-white/[0.12]"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Spin button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleSpin}
          disabled={spinning || balance < bet}
          className={`min-w-[140px] px-10 py-3.5 rounded-xl text-base font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl ${
            spinning
              ? "bg-white/10 border border-white/20 text-white/70 animate-pulse"
              : "bg-white/12 border border-white/20 text-white hover:bg-white/18 hover:border-white/30"
          }`}
        >
          {spinning ? "Spinning…" : "Spin"}
        </button>
      </div>

      {/* Result */}
      {lastResult && (
        <div
          className={
            lastResult.win
              ? "text-center py-4 px-5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 backdrop-blur-xl text-emerald-200"
              : "text-center py-4 px-5 rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl text-white/60"
          }
        >
          {lastResult.win ? (
            <p className="font-medium text-sm">You won {lastResult.payout} credits!</p>
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
      className={`card-reveal w-14 h-20 sm:w-20 sm:h-28 rounded-lg border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl flex items-center justify-center text-base sm:text-lg font-bold [transform-style:preserve-3d] ${color}`}
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
  const [bet, setBet] = useState(10);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ status: string; bet: number } | null>(null);
  const [playerHand, setPlayerHand] = useState<{ suit: string; rank: string }[]>([]);
  const [dealerHand, setDealerHand] = useState<{ suit: string; rank: string }[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [dealKey, setDealKey] = useState(0);

  async function loadSession() {
    try {
      const res = await fetch(`/api/casino/blackjack?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setPlayerHand(data.playerHand || []);
        setDealerHand(data.dealerHand || []);
        setPlayerValue(data.playerValue || 0);
        setDealerValue(data.dealerValue || 0);
      } else {
        setSession(null);
        setPlayerHand([]);
        setDealerHand([]);
        onResult(null);
      }
    } catch {
      setSession(null);
    }
  }

  useEffect(() => {
    loadSession();
  }, [userId]);

  async function handleAction(action: "deal" | "hit" | "stand") {
    if (loading) return;
    setLoading(true);
    if (action === "deal") onResult(null);
    try {
      const body: Record<string, unknown> = { userId, action };
      if (action === "deal") body.bet = bet;
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
      setPlayerHand(data.playerHand || []);
      setDealerHand(data.dealerHand || []);
      setPlayerValue(data.playerValue ?? 0);
      setDealerValue(data.dealerValue ?? 0);
      if (action === "deal") setDealKey((k) => k + 1);
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
      <p className="text-[11px] uppercase tracking-widest text-white/35 mb-6 text-center">Blackjack</p>

      {/* Dealer hand */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 mb-5">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3 text-center">Dealer</p>
        <div className="flex gap-2 flex-wrap min-h-[7rem] justify-center [perspective:600px]">
          {dealerHand.map((c, i) => renderCard(c, i, `d-${dealKey}-${i}`))}
        </div>
        {dealerValue > 0 && (
          <p className="text-white/50 text-xs mt-2 tabular-nums text-center">Value: {dealerValue}</p>
        )}
      </div>

      {/* Player hand */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 mb-6">
        <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3 text-center">Your hand</p>
        <div className="flex gap-2 flex-wrap min-h-[7rem] justify-center [perspective:600px]">
          {playerHand.map((c, i) => renderCard(c, i, `p-${dealKey}-${i}`))}
        </div>
        {playerValue > 0 && (
          <p className="text-white/50 text-xs mt-2 tabular-nums text-center">Value: {playerValue}</p>
        )}
      </div>

      {/* Controls — single row to prevent container resize */}
      <div className="flex justify-center items-center gap-3 min-h-[44px]">
      {!session ? (
        <>
          <input
            type="number"
            min={5}
            max={500}
            value={bet}
            onChange={(e) => setBet(Math.max(5, Math.min(500, parseInt(e.target.value, 10) || 5)))}
            className="w-16 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2 py-2.5 text-white/90 text-center text-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-white/20"
            title="Bet"
          />
          <button
            onClick={() => handleAction("deal")}
            disabled={loading || balance < bet}
            className="min-w-[90px] px-6 py-2.5 rounded-xl text-sm font-medium bg-white/12 border border-white/20 text-white hover:bg-white/18 backdrop-blur-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "…" : "Deal"}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => handleAction("hit")}
            disabled={loading || playerValue >= 21}
            className="min-w-[90px] px-6 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/[0.12] hover:bg-emerald-500/20 hover:border-emerald-400/25 text-white backdrop-blur-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            Hit
          </button>
          <button
            onClick={() => handleAction("stand")}
            disabled={loading}
            className="min-w-[90px] px-6 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/[0.12] hover:bg-amber-500/20 hover:border-amber-400/25 text-white backdrop-blur-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            Stand
          </button>
        </>
      )}
      </div>
    </div>
  );
}

function rouletteColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
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
  const [bet, setBet] = useState(10);
  const [selection, setSelection] = useState<"red" | "black" | number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [lastResult, setLastResult] = useState<{
    result: number;
    resultColor: string;
    win: boolean;
    payout: number;
    netChange: number;
  } | null>(null);

  const SEGMENT_ANGLE = 360 / 37;
  const SPIN_DURATION_MS = 3500;

  async function handleSpin() {
    if (spinning || balance < bet || selection === null) return;
    setSpinning(true);
    setLastResult(null);
    try {
      // 1. Get result from API first
      const res = await fetch("/api/casino/roulette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, bet, selection }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Spin failed");
        setSpinning(false);
        return;
      }
      const resultNum = data.result as number;
      const resultIdx = ROULETTE_WHEEL_ORDER.indexOf(resultNum);

      // 2. Spin wheel to land on result: segment 0 is at top, so rotate by resultIdx segments
      const extraRevolutions = 7 + Math.floor(Math.random() * 2);
      const landAngle = resultIdx * SEGMENT_ANGLE;
      const targetRotation = wheelRotation + 360 * extraRevolutions + landAngle;

      setWheelRotation(targetRotation);

      if (wheelRef.current) {
        wheelRef.current.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        wheelRef.current.style.transform = `rotate(${targetRotation}deg)`;
      }

      await new Promise((r) => setTimeout(r, SPIN_DURATION_MS));

      setLastResult({
        result: resultNum,
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
      <p className="text-[11px] uppercase tracking-widest text-white/35 mb-6 text-center">Roulette</p>

      <div className="flex flex-col items-center gap-8">
        {/* Wheel — scaled up for real table feel */}
        <div className="relative shrink-0">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 [perspective:1000px]">
            <div
              ref={wheelRef}
              className="absolute inset-0 rounded-full overflow-hidden border-[6px] border-amber-600/70 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {ROULETTE_WHEEL_ORDER.map((n, i) => {
                  const color = rouletteColor(n);
                  const fill =
                    color === "green"
                      ? "#166534"
                      : color === "red"
                        ? "#b91c1c"
                        : "#1f2937";
                  // Segment 0 at top (12 o'clock): offset by -90°
                  const startAngle = -90 + (i / 37) * 360;
                  const endAngle = -90 + ((i + 1) / 37) * 360;
                  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                  const r = 48;
                  const cx = 50;
                  const cy = 50;
                  const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
                  const y1 = cy - r * Math.sin((startAngle * Math.PI) / 180);
                  const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
                  const y2 = cy - r * Math.sin((endAngle * Math.PI) / 180);
                  const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                  const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
                  const tx = cx + 32 * Math.cos(midAngle);
                  const ty = cy - 32 * Math.sin(midAngle);
                  const rot = midAngle * (180 / Math.PI) + 90;
                  return (
                    <g key={i}>
                      <path d={path} fill={fill} stroke="rgba(0,0,0,0.3)" strokeWidth="0.3" />
                      <text
                        x={tx}
                        y={ty}
                        fill="white"
                        fontSize="3.2"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${rot} ${tx} ${ty})`}
                      >
                        {n}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-md z-10"
              aria-hidden
            />
          </div>
        </div>

        {/* Betting board — horizontal table layout */}
        <div className="w-full max-w-3xl rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <label className="text-[11px] uppercase tracking-wider text-white/40 shrink-0">Bet</label>
            <input
              type="number"
              min={5}
              max={500}
              value={bet}
              onChange={(e) => setBet(Math.max(5, Math.min(500, parseInt(e.target.value, 10) || 5)))}
              className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-white/90 text-center text-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSelection(selection === "red" ? null : "red")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  selection === "red"
                    ? "bg-red-600 border-2 border-red-400 text-white shadow-lg shadow-red-500/30"
                    : "bg-red-900/50 border border-red-500/40 text-red-200 hover:bg-red-800/60"
                }`}
              >
                Red 2×
              </button>
              <button
                onClick={() => setSelection(selection === "black" ? null : "black")}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  selection === "black"
                    ? "bg-gray-600 border-2 border-gray-300 text-white shadow-lg"
                    : "bg-gray-800/50 border border-gray-500/40 text-gray-200 hover:bg-gray-700/60"
                }`}
              >
                Black 2×
              </button>
              <button
                onClick={() => setSelection(selection === 0 ? null : 0)}
                className={`w-12 py-2.5 rounded-lg text-xs font-bold ${
                  selection === 0
                    ? "bg-emerald-600 border-2 border-emerald-400 text-white"
                    : "bg-emerald-900/50 border border-emerald-600/50 text-emerald-200 hover:bg-emerald-800/60"
                }`}
              >
                0
              </button>
            </div>
          </div>
          {/* Horizontal number grid — 12 cols × 3 rows (real table layout) */}
          <div className="grid grid-cols-12 gap-1">
            {[0, 1, 2].map((row) =>
              Array.from({ length: 12 }, (_, col) => {
                const n = col * 3 + row + 1;
                const isRed = RED_NUMBERS.includes(n);
                const sel = selection === n;
                return (
                  <button
                    key={n}
                    onClick={() => setSelection(selection === n ? null : n)}
                    className={`aspect-[4/3] min-h-[28px] rounded text-[11px] sm:text-xs font-bold ${
                      sel ? "ring-2 ring-white ring-offset-1 ring-offset-[#0a0a0f]" : "hover:opacity-90"
                    } ${
                      isRed
                        ? sel
                          ? "bg-red-600 text-white"
                          : "bg-red-900/60 border border-red-600/50 text-red-200"
                        : sel
                          ? "bg-gray-600 text-white"
                          : "bg-gray-800/60 border border-gray-600/50 text-gray-200"
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

      {/* Spin button */}
      <div className="flex justify-center mt-6 mb-4">
        <button
          onClick={handleSpin}
          disabled={spinning || balance < bet || selection === null}
          className={`min-w-[140px] px-10 py-3.5 rounded-xl text-base font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl ${
            spinning
              ? "bg-white/10 border border-white/20 text-white/70 animate-pulse"
              : "bg-white/12 border border-white/20 text-white hover:bg-white/18 hover:border-white/30"
          }`}
        >
          {spinning ? "Spinning…" : "Spin"}
        </button>
      </div>

      {/* Result */}
      {lastResult && (
        <div
          className={`text-center py-4 px-5 rounded-xl border backdrop-blur-xl ${
            lastResult.win
              ? "bg-emerald-500/10 border-emerald-400/25 text-emerald-200"
              : "bg-white/[0.04] border-white/[0.1] text-white/60"
          }`}
        >
          <p className="text-[11px] uppercase tracking-wider text-white/45 mb-1">Landed on</p>
          <p
            className={`text-2xl font-bold tabular-nums ${
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
      <p className="text-[11px] uppercase tracking-widest text-white/35 mb-6 text-center">Dabys Bets</p>

      <div className="space-y-4">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl p-5"
          >
            <p className="text-white/90 font-medium text-sm mb-4">{evt.title}</p>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => placeBet(evt.id, "A")}
                  disabled={betting !== null || balance < (betAmount[evt.id] ?? evt.minBet)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl text-purple-200 hover:bg-purple-500/15 hover:border-purple-400/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {evt.sideA} <span className="text-white/50">({evt.oddsA}x)</span>
                </button>
                <span className="hidden sm:inline text-white/25 self-center text-xs">vs</span>
                <button
                  onClick={() => placeBet(evt.id, "B")}
                  disabled={betting !== null || balance < (betAmount[evt.id] ?? evt.minBet)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl text-indigo-200 hover:bg-indigo-500/15 hover:border-indigo-400/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
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
                  className="w-20 bg-white/[0.06] border border-white/[0.1] rounded-lg px-2.5 py-2 text-white/90 text-center text-sm backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-white/20"
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
          className={`mt-6 text-center py-4 px-5 rounded-xl border backdrop-blur-xl ${
            lastResult.userWon
              ? "bg-emerald-500/10 border-emerald-400/25 text-emerald-200"
              : "bg-red-500/10 border-red-400/25 text-red-200"
          }`}
        >
          <p className="font-medium text-sm">{lastResult.eventTitle}</p>
          <p className="text-sm mt-0.5 text-white/80">
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
