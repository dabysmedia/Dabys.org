"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

const JERRY_ID = "1";

// Case-style slot colours (cycle per card)
const SLOT_COLORS = [
  "#7c3aed", "#6366f1", "#8b5cf6", "#4f46e5", "#a78bfa",
  "#818cf8", "#6d28d9", "#4338ca", "#c084fc", "#7e22ce",
];

const CARD_GAP = 8;
const LOOP_CYCLES = 4; // Rendered cycles — strip loops seamlessly via modulo

function wrapOffset(offset: number, cycleWidth: number): number {
  if (cycleWidth <= 0) return offset;
  const w = offset % cycleWidth;
  return w > 0 ? w - cycleWidth : w;
}

// Card size from viewport; min 118px so "Comedy"/"Animation" don't truncate
function getCardMetrics(viewportWidth: number) {
  const width = Math.min(200, Math.max(118, (viewportWidth - 48) / 5.2 - CARD_GAP));
  const height = Math.round(width * 0.65);
  return { width, gap: CARD_GAP, height, step: width + CARD_GAP };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// CS:GO-style case sounds (Web Audio API — no assets, works everywhere)
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

export default function WheelPage() {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");

  // Card dimensions from viewport (show more tiles, scale 90–200px)
  const [cardMetrics, setCardMetrics] = useState(() => getCardMetrics(400));
  const cardMetricsRef = useRef(cardMetrics);
  cardMetricsRef.current = cardMetrics;

  // Case-style: strip offset (px). 0 = first card at left; negative = strip scrolled right
  const [stripOffset, setStripOffset] = useState(0);
  const offsetRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Confirm theme / Use skip (when result is shown, Jerry only)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipEligible, setSkipEligible] = useState<{ id: string; name: string; skipsAvailable: number }[]>([]);
  const [selectedSkipUserId, setSelectedSkipUserId] = useState("");
  const [skipLoading, setSkipLoading] = useState(false);

  // Track which spinStartedAt we've already animated/rotated to
  const lastAnimatedSpinRef = useRef<string | null>(null);
  // Track last known lastSpunAt for detecting manual sets
  const lastKnownSpunAtRef = useRef<string | null>(null);
  // Skip next snap so we don't overwrite strip after our own spin completes
  const skipNextSnapRef = useRef(false);

  const isJerry = user?.id === JERRY_ID;

  // Load user
  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) { router.replace("/login"); return; }
    try { setUser(JSON.parse(cached)); }
    catch { router.replace("/login"); }
  }, [router]);

  // Load user avatar
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/users/${user.id}/profile`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.profile?.avatarUrl) setUserAvatarUrl(d.profile.avatarUrl); })
      .catch(() => {});
  }, [user?.id]);

  const getViewportWidth = useCallback(() => viewportRef.current?.clientWidth ?? 400, []);

  // Update card size from viewport so more tiles are visible and scale with window
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const vw = el.clientWidth || 400;
      setCardMetrics(getCardMetrics(vw));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Smooth scroll to center winner (for manual sets — short glide). Loop strip.
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

  // Case-style spin: strip scrolls with seamless loop, eases to stop with winner centered
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

  // Load initial wheel data
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/wheel", { cache: "no-store" });
        if (res.ok) {
          const data: WheelData = await res.json();
          setWheel(data);
          lastKnownSpunAtRef.current = data.lastSpunAt;

          // If a spin is currently in progress, join it mid-animation
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

  // Poll for new spins (every 1.5s), paused when tab hidden
  useEffect(() => {
    if (!wheel) return;

    const pollFn = async () => {
      try {
        const res = await fetch("/api/wheel", { cache: "no-store" });
        if (!res.ok) return;
        const data: WheelData = await res.json();

        // Detect a new spin (Jerry spinning) that we haven't animated yet
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
            // Already finished — just show result
            setResult(data.lastResult);
            setShowResult(true);
            setSpinning(false);
          }
        }
        // Detect a manual set (lastSpunAt changed but not spinning). Do not run scrollToWinner
        // if we already animated this spin (e.g. Jerry just finished spinning), or we get a double reveal sound.
        // After confirm we keep lastResult/winnerIndex but clear spinStartedAt — don't re-animate the strip.
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
          // Update entries if they changed (admin edited while idle)
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

  // Snap strip to last result when viewport is ready (in case init ran before ref mounted).
  // Skip one run after we complete our own spin so we don't overwrite the strip with stale wheel.
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

  // Jerry's spin handler
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
        // So the next poll won't treat unchanged lastSpunAt as a "manual set" and re-run scrollToWinner
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

  // Cleanup animation on unmount
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

  if (loading || !wheel || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            Theme Wheel
          </h1>
          <p className="text-white/40 text-sm">
            {isJerry ? "Spin to decide this week's theme!" : "Watch for this week's theme reveal!"}
          </p>
        </div>

        {/* Case-style strip container — width scales so more tiles visible */}
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto">
          <div className="relative w-full">
            {/* Case window: overflow hidden, center slot highlighted */}
            <div
              ref={viewportRef}
              className="relative w-full overflow-hidden rounded-2xl border-2 border-purple-500/30 bg-black/40 shadow-2xl"
              style={{ height: cardMetrics.height + 32 }}
            >
              {/* Center line (CS:GO-style pointer) */}
              <div className="absolute left-1/2 top-0 bottom-0 z-10 w-1 -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-400/90 to-transparent" />
              <div className="absolute left-1/2 top-0 bottom-0 z-10 w-0.5 -translate-x-1/2 bg-white/60" />

              {/* Scrolling strip */}
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
                    className="flex shrink-0 items-center justify-center rounded-xl border border-white/10 px-4 text-center font-bold text-white/95 shadow-inner"
                    style={{
                      width: cardMetrics.width,
                      height: cardMetrics.height,
                      marginRight: cardMetrics.gap,
                      background: `linear-gradient(135deg, ${SLOT_COLORS[i % SLOT_COLORS.length]}40, ${SLOT_COLORS[(i + 1) % SLOT_COLORS.length]}20)`,
                      borderLeftWidth: i === 0 ? 0 : 1,
                    }}
                  >
                    <span className="truncate text-sm sm:text-base">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Spinning overlay for non-Jerry users */}
            {spinning && !isJerry && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-2xl">
                <div className="px-6 py-3 rounded-2xl bg-black/60 backdrop-blur-sm border border-purple-500/20">
                  <p className="text-purple-300 text-sm font-medium animate-pulse">Jerry is spinning...</p>
                </div>
              </div>
            )}
          </div>

          {/* Spin button — Jerry only */}
          {isJerry ? (
            <button
              onClick={handleSpin}
              disabled={spinning || wheel.entries.length < 2}
              className={`px-10 py-4 rounded-2xl text-lg font-bold tracking-wide transition-all cursor-pointer disabled:cursor-not-allowed ${
                spinning
                  ? "bg-purple-500/20 border border-purple-500/30 text-purple-300 animate-pulse"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-purple-500/20 hover:scale-105 active:scale-95 disabled:opacity-30"
              }`}
            >
              {spinning ? "Spinning..." : "Spin the Wheel"}
            </button>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-white/30 text-sm">Only Jerry can spin the wheel</p>
              </div>
            </div>
          )}

          {/* Result banner + Confirm / Use skip (Jerry only) */}
          {showResult && result && (
            <div className="w-full max-w-md mx-auto space-y-4">
              <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 backdrop-blur-xl p-8 text-center shadow-xl shadow-purple-500/10">
                <p className="text-xs uppercase tracking-widest text-purple-400/60 mb-2">The wheel has spoken</p>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-violet-200 to-indigo-300 bg-clip-text text-transparent">
                  {result}
                </h2>
              </div>
              {isJerry && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setConfirmDialogOpen(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-500 hover:to-emerald-500 transition-all cursor-pointer"
                  >
                    Confirm theme & create new week
                  </button>
                  <button
                    onClick={openSkipModal}
                    className="px-6 py-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-medium hover:bg-cyan-500/20 transition-all cursor-pointer"
                  >
                    Use skip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Confirm theme dialog */}
          {confirmDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !confirmLoading && setConfirmDialogOpen(false)}>
              <div className="rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-white/90 font-medium mb-2">Confirm theme & create new week?</p>
                <p className="text-sm text-white/50 mb-4">Current week will be archived. Theme &quot;{result}&quot; will become the new week and be removed from the wheel.</p>
                <div className="flex gap-3">
                  <button onClick={() => !confirmLoading && setConfirmDialogOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleConfirmTheme} disabled={confirmLoading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                    {confirmLoading ? "..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Use skip modal: whose skip? */}
          {skipModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !skipLoading && setSkipModalOpen(false)}>
              <div className="rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-white/90 font-medium mb-2">Whose skip are we using?</p>
                <p className="text-sm text-white/50 mb-4">One skip will be charged for the selected person. The result will be cleared and you can spin again.</p>
                <select
                  value={selectedSkipUserId}
                  onChange={(e) => setSelectedSkipUserId(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white/90 text-sm mb-4 cursor-pointer"
                >
                  <option value="">Select user...</option>
                  {skipEligible.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name} ({u.skipsAvailable} skip{u.skipsAvailable !== 1 ? "s" : ""})</option>
                  ))}
                </select>
                {skipEligible.length === 0 && <p className="text-white/40 text-sm mb-4">No one has skips available.</p>}
                <div className="flex gap-3">
                  <button onClick={() => !skipLoading && setSkipModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleUseSkip} disabled={skipLoading || !selectedSkipUserId} className="flex-1 py-2.5 rounded-xl bg-cyan-600 text-white font-medium disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                    {skipLoading ? "..." : "Use skip"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Last result / confirmed theme (when no fresh spin and not spinning) — saved and visible for all */}
          {!showResult && !spinning && (wheel.lastResult || wheel.lastConfirmedResult) && (
            <div className="w-full max-w-md mx-auto">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 text-center">
                <p className="text-xs uppercase tracking-widest text-white/25 mb-2">
                  {wheel.lastConfirmedResult ? "Confirmed theme" : "Last Result"}
                </p>
                <h2 className="text-2xl font-bold text-white/80">
                  {wheel.lastResult || wheel.lastConfirmedResult}
                </h2>
                {(wheel.lastSpunAt || wheel.lastConfirmedAt) && (
                  <p className="text-[11px] text-white/20 mt-2">
                    {timeAgo(wheel.lastSpunAt || wheel.lastConfirmedAt || "")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
