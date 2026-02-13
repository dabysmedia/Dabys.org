"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

// Web Audio API — credit gain chime (no assets)
let creditsAudioContext: AudioContext | null = null;
function getCreditsAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!creditsAudioContext) creditsAudioContext = new AudioContext();
  return creditsAudioContext;
}
async function playCreditsGainedSound() {
  const ctx = getCreditsAudioContext();
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
    osc.frequency.setValueAtTime(659.25, t + 0.06);
    osc.frequency.setValueAtTime(783.99, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
    gain.gain.setValueAtTime(0.1, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch { /* ignore */ }
}

interface User {
  id: string;
  name: string;
}

interface CreditsRefreshDetail {
  delta?: number;
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  const base = "text-xs font-medium transition-colors";
  const activeClass = active ? "text-purple-400" : "text-white/30 hover:text-purple-400";
  return (
    <Link href={href} className={`${base} ${activeClass}`}>
      {label}
    </Link>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditDelta, setCreditDelta] = useState<number | null>(null);
  const [creditAnimClass, setCreditAnimClass] = useState("");
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCredits = (delta?: number) => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    try {
      const u = JSON.parse(cached) as User;
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.balance === "number") {
            setCreditBalance(d.balance);
            if (typeof delta === "number" && delta !== 0) {
              if (delta > 0) playCreditsGainedSound();
              setCreditDelta(delta);
              setCreditAnimClass(delta > 0 ? "credits-animate-add" : "credits-animate-subtract");
              animTimeoutRef.current && clearTimeout(animTimeoutRef.current);
              animTimeoutRef.current = setTimeout(() => {
                setCreditDelta(null);
                setCreditAnimClass("");
                animTimeoutRef.current = null;
              }, 900);
            }
          }
        })
        .catch(() => {});
    } catch {}
  };

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(cached) as User;
      setUser(u);
      refreshCredits();
      fetch(`/api/users/${u.id}/profile`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.profile?.avatarUrl) setAvatarUrl(d.profile.avatarUrl);
        })
        .catch(() => {});
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CreditsRefreshDetail>).detail;
      refreshCredits(detail?.delta);
    };
    window.addEventListener("dabys-credits-refresh", handler);
    return () => {
      window.removeEventListener("dabys-credits-refresh", handler);
      animTimeoutRef.current && clearTimeout(animTimeoutRef.current);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("dabys_user");
    router.replace("/login");
  };

  if (!user) {
    return (
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      </header>
    );
  }

  const isWheel = pathname === "/wheel";
  const isStats = pathname === "/stats";
  const isCards = pathname === "/cards";
  const isCasino = pathname === "/casino";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            dabys.org
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <NavLink href="/wheel" label="Wheel" active={isWheel} />
          <NavLink href="/stats" label="Stats" active={isStats} />
          <NavLink href="/casino" label="Casino" active={isCasino} />
          <NavLink href="/cards" label="TCG" active={isCards} />
          <Link
            href="/cards"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors relative overflow-visible ${
              isCards
                ? "bg-sky-400/15 border-sky-400/30 text-sky-300"
                : "bg-sky-400/10 border-sky-400/20 text-sky-300 hover:bg-sky-400/15"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`tabular-nums ${creditAnimClass}`}>{creditBalance}</span>
            <span className="text-sky-300/60 text-xs">credits</span>
            {creditDelta !== null && (
              <span
                className={`absolute -top-1 -right-1 min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-bold credits-delta-pop pointer-events-none ${
                  creditDelta > 0 ? "text-emerald-400 bg-emerald-500/20" : "text-amber-400 bg-amber-500/20"
                }`}
              >
                {creditDelta > 0 ? `+${creditDelta}` : creditDelta}
              </span>
            )}
          </Link>
          <Link
            href={`/profile/${user.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-white/10 shadow-lg shadow-purple-500/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-purple-500/20">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-white/70 text-sm font-medium">{user.name}</span>
          </Link>
          <button
            onClick={logout}
            className="text-white/20 hover:text-white/50 transition-colors cursor-pointer"
            title="Log out"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
