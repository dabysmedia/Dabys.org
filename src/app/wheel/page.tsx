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
}

const JERRY_ID = "1";

// Segment colours — cycle through these
const SEGMENT_COLORS = [
  "#7c3aed", "#6366f1", "#8b5cf6", "#4f46e5", "#a78bfa",
  "#818cf8", "#6d28d9", "#4338ca", "#c084fc", "#7e22ce",
];

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function WheelPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");

  // Spin state
  const [spinning, setSpinning] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const angleRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const [result, setResult] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Track which spinStartedAt we've already animated/rotated to
  const lastAnimatedSpinRef = useRef<string | null>(null);
  // Track last known lastSpunAt for detecting manual sets
  const lastKnownSpunAtRef = useRef<string | null>(null);

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

  // Smooth rotate to a specific segment (for manual sets — no dramatic multi-spin, just glide)
  const rotateToSegment = useCallback((entries: string[], winnerIndex: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const n = entries.length;
    const sliceAngle = (2 * Math.PI) / n;
    const targetSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    const finalAngle = -(targetSliceCenter) - Math.PI / 2;

    const start = angleRef.current;
    // Normalize final into a reasonable target (1 full rotation + land)
    const normalizedFinal = finalAngle - Math.floor(finalAngle / (2 * Math.PI)) * 2 * Math.PI;
    const target = start - 2 * Math.PI - ((start - normalizedFinal) % (2 * Math.PI));
    const duration = 2000; // 2s smooth glide
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (target - start) * eased;

      angleRef.current = current;
      setCurrentAngle(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setResult(entries[winnerIndex]);
        setShowResult(true);
        setSpinning(false);
      }
    }

    setSpinning(true);
    setShowResult(false);
    setResult(null);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Shared animation logic — given wheel params, plays the spin animation
  const playSpin = useCallback((
    entries: string[],
    winnerIndex: number,
    fullSpins: number,
    duration: number,
    timeOffset: number, // how many ms have already elapsed (for late joiners)
    onComplete: (winner: string) => void
  ) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const n = entries.length;
    const sliceAngle = (2 * Math.PI) / n;
    const targetSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    const finalAngle = -(targetSliceCenter) - Math.PI / 2;

    const totalRotation = fullSpins * 2 * Math.PI;
    const start = angleRef.current;
    const normalizedFinal = finalAngle - Math.floor(finalAngle / (2 * Math.PI)) * 2 * Math.PI;
    const target = start - totalRotation - (start - normalizedFinal) % (2 * Math.PI) - 2 * Math.PI;

    const startTime = performance.now() - timeOffset;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (target - start) * eased;

      angleRef.current = current;
      setCurrentAngle(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        onComplete(entries[winnerIndex]);
      }
    }

    setSpinning(true);
    setShowResult(false);
    setResult(null);
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Load initial wheel data
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/wheel");
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
                setSpinning(false);
                setResult(winner);
                setShowResult(true);
              });
            } else {
              // Spin already finished — snap to correct segment
              lastAnimatedSpinRef.current = data.spinStartedAt;
              if (data.winnerIndex !== null) {
                const n = data.entries.length;
                const sliceAngle = (2 * Math.PI) / n;
                const snapAngle = -(data.winnerIndex * sliceAngle + sliceAngle / 2) - Math.PI / 2;
                angleRef.current = snapAngle;
                setCurrentAngle(snapAngle);
              }
              if (data.lastResult) setResult(data.lastResult);
            }
          } else if (data.lastResult && data.winnerIndex !== null) {
            lastAnimatedSpinRef.current = data.spinStartedAt;
            // Snap wheel to the last result segment on load
            const n = data.entries.length;
            const sliceAngle = (2 * Math.PI) / n;
            const snapAngle = -(data.winnerIndex * sliceAngle + sliceAngle / 2) - Math.PI / 2;
            angleRef.current = snapAngle;
            setCurrentAngle(snapAngle);
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

  // Poll for new spins (every 1.5s)
  useEffect(() => {
    if (!wheel) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/wheel");
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
        // Detect a manual set (lastSpunAt changed but not spinning)
        else if (
          !data.spinning &&
          !spinning &&
          data.lastSpunAt &&
          data.lastSpunAt !== lastKnownSpunAtRef.current &&
          data.winnerIndex !== null
        ) {
          lastKnownSpunAtRef.current = data.lastSpunAt;
          lastAnimatedSpinRef.current = data.spinStartedAt;
          setWheel(data);
          rotateToSegment(data.entries, data.winnerIndex);
        }
        else if (!data.spinning && !spinning) {
          // Update entries if they changed (admin edited while idle)
          setWheel(data);
        }
      } catch { /* ignore */ }
    }, 1500);

    return () => clearInterval(interval);
  }, [wheel, spinning, playSpin, rotateToSegment]);

  // Draw the wheel
  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !wheel || wheel.entries.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement?.clientWidth || 400, 500);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;
    const n = wheel.entries.length;
    const sliceAngle = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, size, size);

    // Shadow
    ctx.save();
    ctx.shadowColor = "rgba(139, 92, 246, 0.3)";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.restore();

    // Segments
    for (let i = 0; i < n; i++) {
      const startAngle = angle + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      const fontSize = Math.max(10, Math.min(16, radius * 0.16));
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;

      const text = wheel.entries[i];
      const maxWidth = radius * 0.7;
      const displayText = ctx.measureText(text).width > maxWidth
        ? text.slice(0, Math.floor(text.length * (maxWidth / ctx.measureText(text).width))) + "…"
        : text;
      ctx.fillText(displayText, radius - 18, fontSize / 3);
      ctx.restore();
    }

    // Center circle
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    gradient.addColorStop(0, "#1e1b4b");
    gradient.addColorStop(1, "#0f0a2e");
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(139, 92, 246, 0.25)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }, [wheel]);

  // Redraw on angle or wheel change
  useEffect(() => {
    drawWheel(currentAngle);
  }, [currentAngle, drawWheel]);

  // Resize handler
  useEffect(() => {
    function handleResize() { drawWheel(angleRef.current); }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWheel]);

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
        setSpinning(false);
        setResult(winner);
        setShowResult(true);
      });
    } catch { /* ignore */ }
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

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
              Dabys.org
            </Link>

          </div>
          <div className="flex items-center gap-4">
            <Link href="/wheel" className="text-xs text-white/30 hover:text-purple-400 transition-colors font-medium">Theme Wheel</Link>
            <Link href="/stats" className="text-xs text-white/30 hover:text-purple-400 transition-colors font-medium">Stats</Link>
            {user && (
              <Link href={`/profile/${user.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shadow-lg shadow-purple-500/20" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-purple-500/20">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white/70 text-sm font-medium">{user.name}</span>
              </Link>
            )}
            <button onClick={() => { localStorage.removeItem("dabys_user"); router.replace("/login"); }} className="text-white/20 hover:text-white/50 transition-colors cursor-pointer" title="Log out"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg></button>
          </div>
        </div>
      </header>

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

        {/* Wheel container */}
        <div className="flex flex-col items-center gap-8">
          <div className="relative" style={{ maxWidth: 500, width: "100%" }}>
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
              <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
                <path d="M16 40 L2 8 Q0 2 6 2 H26 Q32 2 30 8 Z" fill="#c084fc" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <path d="M16 36 L5 10 Q4 6 8 6 H24 Q28 6 27 10 Z" fill="url(#pointerGrad)" />
                <defs>
                  <linearGradient id="pointerGrad" x1="16" y1="6" x2="16" y2="36" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#e9d5ff" />
                    <stop offset="1" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ aspectRatio: "1 / 1" }}
            />

            {/* Spinning overlay for non-Jerry users */}
            {spinning && !isJerry && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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

          {/* Result banner */}
          {showResult && result && (
            <div className="w-full max-w-md mx-auto">
              <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 backdrop-blur-xl p-8 text-center shadow-xl shadow-purple-500/10">
                <p className="text-xs uppercase tracking-widest text-purple-400/60 mb-2">The wheel has spoken</p>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-violet-200 to-indigo-300 bg-clip-text text-transparent">
                  {result}
                </h2>
              </div>
            </div>
          )}

          {/* Last result (when no fresh spin and not spinning) */}
          {!showResult && !spinning && wheel.lastResult && (
            <div className="w-full max-w-md mx-auto">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 text-center">
                <p className="text-xs uppercase tracking-widest text-white/25 mb-2">Last Result</p>
                <h2 className="text-2xl font-bold text-white/80">{wheel.lastResult}</h2>
                {wheel.lastSpunAt && (
                  <p className="text-[11px] text-white/20 mt-2">{timeAgo(wheel.lastSpunAt)}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  const router = useRouter();
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) { router.push("/admin"); }
      else { setAdminError("Wrong password"); setAdminPassword(""); }
    } catch { setAdminError("Something went wrong"); }
    finally { setAdminLoading(false); }
  }

  return (
    <footer className="relative z-10 border-t border-white/[0.04] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-4">
        <button onClick={() => { setAdminOpen(!adminOpen); setAdminError(""); setAdminPassword(""); }} className="text-white/10 text-[11px] hover:text-white/30 transition-colors cursor-pointer">Admin Panel</button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full max-w-xs ${adminOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
          <form onSubmit={handleAdminLogin} className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-3">
            <div className="flex gap-2">
              <input type="password" placeholder="Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors" />
              <button type="submit" disabled={adminLoading || !adminPassword} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                {adminLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Go"}
              </button>
            </div>
            {adminError && <p className="text-red-400/80 text-xs mt-2">{adminError}</p>}
          </form>
        </div>
        <p className="text-white/8 text-[10px] tracking-widest uppercase">Dabys Media Group</p>
      </div>
    </footer>
  );
}
