"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface WheelData {
  entries: string[];
  lastResult: string | null;
  lastSpunAt: string | null;
  spinning: boolean;
  spinStartedAt: string | null;
  winnerIndex: number | null;
  fullSpins: number | null;
  duration: number | null;
  lastConfirmedResult?: string | null;
  lastConfirmedAt?: string | null;
}

interface ThemeWheelSectionProps {
  user: { id: string; name: string };
  compact?: boolean;
}

const JERRY_ID = "1";

// Alternating sky-blue and amber/gold tints — signature site colors
const SLOT_TINTS = [
  "bg-sky-500/10 border-sky-400/25",
  "bg-amber-500/10 border-amber-400/25",
  "bg-sky-500/8 border-sky-400/20",
  "bg-amber-500/8 border-amber-400/20",
  "bg-sky-500/10 border-sky-400/25",
  "bg-amber-500/10 border-amber-400/25",
];

const CARD_GAP = 8;
const LOOP_CYCLES = 4; // Rendered cycles — strip loops seamlessly via modulo

function wrapOffset(offset: number, cycleWidth: number): number {
  if (cycleWidth <= 0) return offset;
  const w = offset % cycleWidth;
  return w > 0 ? w - cycleWidth : w;
}

function getCardMetrics(viewportWidth: number, compact?: boolean) {
  const baseWidth = compact ? Math.min(160, Math.max(90, (viewportWidth - 48) / 6 - CARD_GAP)) : Math.min(200, Math.max(118, (viewportWidth - 48) / 5.2 - CARD_GAP));
  const width = Math.round(baseWidth);
  const height = Math.round(width * 0.65);
  return { width, gap: CARD_GAP, height, step: width + CARD_GAP };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

let caseAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!caseAudioContext) caseAudioContext = new AudioContext();
  return caseAudioContext;
}
async function playCaseOpen() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch { /* ignore */ }
}
async function playReveal() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.08);
    osc.frequency.setValueAtTime(783.99, t + 0.16);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.setValueAtTime(0.15, t + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  } catch { /* ignore */ }
}

export function ThemeWheelSection({ user, compact = true }: ThemeWheelSectionProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [loading, setLoading] = useState(true);

  const [cardMetrics, setCardMetrics] = useState(() => getCardMetrics(400, compact));
  const cardMetricsRef = useRef(cardMetrics);
  cardMetricsRef.current = cardMetrics;

  const [stripOffset, setStripOffset] = useState(0);
  const offsetRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipEligible, setSkipEligible] = useState<{ id: string; name: string; skipsAvailable: number }[]>([]);
  const [selectedSkipUserId, setSelectedSkipUserId] = useState("");
  const [skipLoading, setSkipLoading] = useState(false);

  const lastAnimatedSpinRef = useRef<string | null>(null);
  const lastKnownSpunAtRef = useRef<string | null>(null);
  const skipNextSnapRef = useRef(false);

  const isJerry = user?.id === JERRY_ID;

  const getViewportWidth = useCallback(() => viewportRef.current?.clientWidth ?? 400, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const vw = el.clientWidth || 400;
      setCardMetrics(getCardMetrics(vw, compact));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  const scrollToWinner = useCallback((entries: string[], winnerIndex: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const { step, width } = cardMetricsRef.current;
    const n = entries.length;
    const vw = getViewportWidth();
    const cycleWidth = n * step;
    const centerX = vw / 2 - width / 2;
    const rawTarget = -(winnerIndex * step) + centerX;
    const targetOffset = wrapOffset(rawTarget, cycleWidth);
    const start = offsetRef.current;
    const duration = 2000;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (targetOffset - start) * eased;
      const wrapped = wrapOffset(current, cycleWidth);
      offsetRef.current = wrapped;
      setStripOffset(wrapped);
      if (progress < 1) animFrameRef.current = requestAnimationFrame(animate);
      else {
        playReveal();
        setResult(entries[winnerIndex]);
        setShowResult(true);
        setSpinning(false);
      }
    }
    playCaseOpen();
    setSpinning(true);
    setShowResult(false);
    setResult(null);
    animFrameRef.current = requestAnimationFrame(animate);
  }, [getViewportWidth]);

  const playSpin = useCallback((
    entries: string[],
    winnerIndex: number,
    fullSpins: number,
    duration: number,
    timeOffset: number,
    onComplete: (winner: string) => void
  ) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const { step, width } = cardMetricsRef.current;
    const n = entries.length;
    const vw = getViewportWidth();
    const cycleWidth = n * step;
    const centerX = vw / 2 - width / 2;
    const totalCards = (fullSpins + 1) * n + winnerIndex;
    const endOffset = -(totalCards * step) + centerX;
    const start = offsetRef.current;
    const startTime = performance.now() - timeOffset;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (endOffset - start) * eased;
      const wrapped = wrapOffset(current, cycleWidth);
      offsetRef.current = wrapped;
      setStripOffset(wrapped);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        playReveal();
        onComplete(entries[winnerIndex]);
      }
    }
    if (timeOffset === 0) playCaseOpen();
    setSpinning(true);
    setShowResult(false);
    setResult(null);
    const startWrapped = wrapOffset(0, cycleWidth);
    offsetRef.current = startWrapped;
    setStripOffset(startWrapped);
    animFrameRef.current = requestAnimationFrame(animate);
  }, [getViewportWidth]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/wheel", { cache: "no-store" });
        if (res.ok) {
          const data: WheelData = await res.json();
          setWheel(data);
          lastKnownSpunAtRef.current = data.lastSpunAt;

          if (data.spinning && data.spinStartedAt && data.winnerIndex !== null && data.fullSpins && data.duration) {
            const elapsed = Date.now() - new Date(data.spinStartedAt).getTime();
            if (elapsed < data.duration) {
              lastAnimatedSpinRef.current = data.spinStartedAt;
              playSpin(data.entries, data.winnerIndex, data.fullSpins, data.duration, elapsed, (winner) => {
                skipNextSnapRef.current = true;
                setSpinning(false);
                setResult(winner);
                setShowResult(true);
              });
            } else {
              lastAnimatedSpinRef.current = data.spinStartedAt;
              if (data.winnerIndex !== null && viewportRef.current && data.entries.length > 0) {
                const vw = viewportRef.current.clientWidth;
                const { step, width } = cardMetricsRef.current;
                const n = data.entries.length;
                const cycleWidth = n * step;
                const centerX = vw / 2 - width / 2;
                const raw = -(data.winnerIndex * step) + centerX;
                const snap = wrapOffset(raw, cycleWidth);
                offsetRef.current = snap;
                setStripOffset(snap);
              }
              if (data.lastResult) setResult(data.lastResult);
            }
          } else if (data.lastResult && data.winnerIndex !== null) {
            lastAnimatedSpinRef.current = data.spinStartedAt;
            if (viewportRef.current && data.entries.length > 0) {
              const vw = viewportRef.current.clientWidth;
              const { step, width } = cardMetricsRef.current;
              const n = data.entries.length;
              const cycleWidth = n * step;
              const centerX = vw / 2 - width / 2;
              const raw = -(data.winnerIndex * step) + centerX;
              const snap = wrapOffset(raw, cycleWidth);
              offsetRef.current = snap;
              setStripOffset(snap);
            }
            setResult(data.lastResult);
          } else if (data.lastResult) {
            lastAnimatedSpinRef.current = data.spinStartedAt;
            setResult(data.lastResult);
          }
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    init();
  }, [playSpin]);

  useEffect(() => {
    if (!wheel) return;

    const pollFn = async () => {
      try {
        const res = await fetch("/api/wheel", { cache: "no-store" });
        if (!res.ok) return;
        const data: WheelData = await res.json();

        if (
          data.spinning &&
          data.spinStartedAt &&
          data.spinStartedAt !== lastAnimatedSpinRef.current &&
          data.winnerIndex !== null &&
          data.fullSpins &&
          data.duration
        ) {
          lastAnimatedSpinRef.current = data.spinStartedAt;
          lastKnownSpunAtRef.current = data.lastSpunAt;
          setWheel(data);

          const elapsed = Date.now() - new Date(data.spinStartedAt).getTime();
          if (elapsed < data.duration) {
            playSpin(data.entries, data.winnerIndex, data.fullSpins, data.duration, elapsed, (winner) => {
              skipNextSnapRef.current = true;
              setSpinning(false);
              setResult(winner);
              setShowResult(true);
            });
          } else {
            setResult(data.lastResult);
            setShowResult(true);
            setSpinning(false);
          }
        }
        else if (
          !data.spinning &&
          !spinning &&
          data.lastSpunAt &&
          data.lastSpunAt !== lastKnownSpunAtRef.current &&
          data.winnerIndex !== null
        ) {
          lastKnownSpunAtRef.current = data.lastSpunAt;
          if (data.spinStartedAt !== lastAnimatedSpinRef.current) {
            lastAnimatedSpinRef.current = data.spinStartedAt;
            setWheel(data);
            const isAfterConfirm = data.lastConfirmedResult && !data.spinStartedAt;
            if (!isAfterConfirm) scrollToWinner(data.entries, data.winnerIndex);
          } else {
            setWheel(data);
          }
        }
        else if (!data.spinning && !spinning) {
          setWheel(data);
        }
      } catch { /* ignore */ }
    };

    let interval = setInterval(pollFn, 1500);
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        pollFn();
        interval = setInterval(pollFn, 1500);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [wheel, spinning, playSpin, scrollToWinner]);

  const stripRepeats = wheel && wheel.entries.length > 0 ? LOOP_CYCLES : 0;
  const stripEntries = wheel ? Array.from({ length: stripRepeats }, () => wheel.entries).flat() : [];
  const n = wheel?.entries.length ?? 0;

  useEffect(() => {
    if (!wheel?.lastResult || wheel.winnerIndex == null || !viewportRef.current || spinning || n === 0) return;
    if (skipNextSnapRef.current) {
      skipNextSnapRef.current = false;
      return;
    }
    const vw = viewportRef.current.clientWidth;
    const { step, width } = cardMetrics;
    const cycleWidth = n * step;
    const centerX = vw / 2 - width / 2;
    const rawSnap = -(wheel.winnerIndex * step) + centerX;
    const snap = wrapOffset(rawSnap, cycleWidth);
    offsetRef.current = snap;
    setStripOffset(snap);
  }, [wheel?.lastResult, wheel?.winnerIndex, spinning, cardMetrics, n, stripRepeats]);

  async function handleSpin() {
    if (spinning || !wheel || wheel.entries.length < 2 || !isJerry) return;

    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id }),
      });
      if (!res.ok) return;
      const data = await res.json();

      lastAnimatedSpinRef.current = data.spinStartedAt;
      setWheel(data.wheel);

      playSpin(wheel.entries, data.winnerIndex, data.fullSpins, data.duration, 0, (winner) => {
        skipNextSnapRef.current = true;
        setSpinning(false);
        setResult(winner);
        setShowResult(true);
      });
    } catch { /* ignore */ }
  }

  async function handleConfirmTheme() {
    if (!result || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const res = await fetch("/api/wheel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: result }),
      });
      if (res.ok) {
        const data = await res.json();
        setWheel(data.wheel);
        if (data.wheel?.lastSpunAt) lastKnownSpunAtRef.current = data.wheel.lastSpunAt;
        setShowResult(false);
        setResult(null);
        setConfirmDialogOpen(false);
      }
    } catch { /* ignore */ }
    finally { setConfirmLoading(false); }
  }

  function openSkipModal() {
    setSkipModalOpen(true);
    setSelectedSkipUserId("");
    fetch("/api/wheel/skip-eligible", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then(setSkipEligible)
      .catch(() => setSkipEligible([]));
  }

  async function handleUseSkip() {
    if (!selectedSkipUserId || skipLoading) return;
    setSkipLoading(true);
    try {
      const res = await fetch("/api/wheel/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedSkipUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        setWheel(data.wheel);
        setShowResult(false);
        setResult(null);
        setSkipModalOpen(false);
      }
    } catch { /* ignore */ }
    finally { setSkipLoading(false); }
  }

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (loading || !wheel) {
    return (
      <div className="rounded-2xl border border-sky-400/15 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-8 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-sky-400/20 border-t-sky-400/70 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.15),0_0_0_1px_rgba(56,189,248,0.08)]">
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.08] bg-gradient-to-r from-sky-500/5 via-transparent to-amber-500/5">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gradient-to-b from-sky-400/60 to-amber-400/60" />
          Theme Wheel
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
          {isJerry ? "Spin to decide next week's theme" : "Watch for the next theme reveal"}
        </p>
      </div>

      <div className="p-6 flex flex-col items-center gap-6">
        <div className="relative w-full max-w-4xl mx-auto">
          <div
            ref={viewportRef}
            className="relative w-full overflow-hidden rounded-xl border border-sky-400/25 bg-white/[0.02] shadow-[0_0_20px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(251,191,36,0.05)]"
            style={{ height: cardMetrics.height + 32 }}
          >
            <div className="absolute left-1/2 top-0 bottom-0 z-10 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-400/80 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
            <div className="absolute left-1/2 top-0 bottom-0 z-10 w-0.5 -translate-x-1/2 bg-gradient-to-b from-sky-300/50 via-amber-300/80 to-sky-300/50" />

            <div
              className="absolute left-0 top-4 flex items-stretch gap-0 transition-none"
              style={{
                height: cardMetrics.height,
                transform: `translateX(${stripOffset}px)`,
                willChange: spinning ? "transform" : "auto",
              }}
            >
              {stripEntries.map((label, i) => (
                <div
                  key={`${i}-${label}`}
                  className={`flex shrink-0 items-center justify-center rounded-lg border px-4 text-center font-semibold text-white/90 ${SLOT_TINTS[i % SLOT_TINTS.length]}`}
                  style={{
                    width: cardMetrics.width,
                    height: cardMetrics.height,
                    marginRight: cardMetrics.gap,
                  }}
                >
                  <span className="truncate text-sm sm:text-base">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {spinning && !isJerry && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl">
              <div className="px-6 py-3 rounded-xl border border-sky-400/30 bg-sky-500/10 backdrop-blur-xl shadow-lg">
                <p className="text-sky-300/90 text-sm font-medium animate-pulse">Jerry is spinning...</p>
              </div>
            </div>
          )}
        </div>

        {isJerry ? (
          <button
            onClick={handleSpin}
            disabled={spinning || wheel.entries.length < 2}
            className={`px-10 py-4 rounded-xl text-lg font-bold tracking-wide transition-all cursor-pointer disabled:cursor-not-allowed border ${
              spinning
                ? "border-sky-400/30 bg-sky-500/10 text-sky-300 animate-pulse"
                : "border-sky-400/40 bg-gradient-to-r from-sky-500/15 to-amber-500/15 text-white hover:from-sky-500/25 hover:to-amber-500/25 hover:border-sky-400/50 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] active:scale-[0.98] disabled:opacity-40"
            }`}
          >
            {spinning ? "Spinning..." : "Spin the Wheel"}
          </button>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-white/40 text-sm">Only Jerry can spin the wheel</p>
            </div>
          </div>
        )}

        {showResult && result && (
          <div className="w-full max-w-md mx-auto space-y-4">
            <div className="rounded-xl border border-amber-400/30 bg-gradient-to-b from-amber-500/10 to-sky-500/10 backdrop-blur-xl p-8 text-center shadow-[0_0_24px_rgba(251,191,36,0.1),0_0_0_1px_rgba(56,189,248,0.1)]">
              <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-2">The wheel has spoken</p>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-200 via-amber-100 to-sky-200 bg-clip-text text-transparent" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {result}
              </h2>
            </div>
            {isJerry && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setConfirmDialogOpen(true)}
                  className="px-6 py-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 font-medium hover:bg-green-500/20 hover:border-green-500/40 transition-all cursor-pointer"
                >
                  Confirm theme & create new week
                </button>
                <button
                  onClick={openSkipModal}
                  className="px-6 py-3 rounded-xl border border-white/[0.12] bg-white/[0.04] text-white/80 font-medium hover:bg-white/[0.08] transition-all cursor-pointer"
                >
                  Use skip
                </button>
              </div>
            )}
          </div>
        )}

        {!showResult && !spinning && (wheel.lastResult || wheel.lastConfirmedResult) && (
          <div className="w-full max-w-md mx-auto">
            <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-500/5 to-amber-500/5 backdrop-blur-xl p-6 text-center">
              <p className="text-xs uppercase tracking-widest text-sky-400/60 mb-2">
                {wheel.lastConfirmedResult ? "Confirmed theme" : "Last Result"}
              </p>
              <h2 className="text-2xl font-bold text-white/95" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {wheel.lastResult || wheel.lastConfirmedResult}
              </h2>
              {(wheel.lastSpunAt || wheel.lastConfirmedAt) && (
                <p className="text-[11px] text-white/35 mt-2">
                  {timeAgo(wheel.lastSpunAt || wheel.lastConfirmedAt || "")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {confirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !confirmLoading && setConfirmDialogOpen(false)}>
          <div className="rounded-xl border border-white/[0.08] bg-[#0f0f14] p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/90 font-medium mb-2">Confirm theme & create new week?</p>
            <p className="text-sm text-white/50 mb-4">Current week will be archived. Theme &quot;{result}&quot; will become the new week and be removed from the wheel.</p>
            <div className="flex gap-3">
              <button onClick={() => !confirmLoading && setConfirmDialogOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-white/80 hover:bg-white/[0.04] transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleConfirmTheme} disabled={confirmLoading} className="flex-1 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 font-medium hover:bg-green-500/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                {confirmLoading ? "..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {skipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !skipLoading && setSkipModalOpen(false)}>
          <div className="rounded-xl border border-white/[0.08] bg-[#0f0f14] p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/90 font-medium mb-2">Whose skip are we using?</p>
            <p className="text-sm text-white/50 mb-4">One skip will be charged for the selected person. The result will be cleared and you can spin again.</p>
            <select
              value={selectedSkipUserId}
              onChange={(e) => setSelectedSkipUserId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white/90 text-sm mb-4 cursor-pointer focus:outline-none focus:border-white/20"
            >
              <option value="">Select user...</option>
              {skipEligible.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name} ({u.skipsAvailable} skip{u.skipsAvailable !== 1 ? "s" : ""})</option>
              ))}
            </select>
            {skipEligible.length === 0 && <p className="text-white/40 text-sm mb-4">No one has skips available.</p>}
            <div className="flex gap-3">
              <button onClick={() => !skipLoading && setSkipModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] text-white/80 hover:bg-white/[0.04] transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleUseSkip} disabled={skipLoading || !selectedSkipUserId} className="flex-1 py-2.5 rounded-xl border border-white/[0.12] bg-white/[0.06] text-white/90 font-medium hover:bg-white/[0.08] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                {skipLoading ? "..." : "Use skip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
