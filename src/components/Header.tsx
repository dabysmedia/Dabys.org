"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FeedbackButton } from "@/components/FeedbackButton";
import StatusIndicator from "@/components/StatusIndicator";
import { usePresence } from "@/hooks/usePresence";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import { NotificationCenter } from "@/components/NotificationCenter";

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
  dot,
}: {
  href: string;
  label: string;
  active?: boolean;
  dot?: boolean;
}) {
  const base = "text-xs font-medium transition-colors relative inline-block";
  const activeClass = active ? "text-purple-400" : "text-white/30 hover:text-purple-400";
  return (
    <Link href={href} className={`${base} ${activeClass}`}>
      {label}
      {dot && (
        <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(245,158,11,0.4)]" aria-label="Incoming trades" />
      )}
    </Link>
  );
}

const MOBILE_BREAKPOINT_PX = 768;

const DEFAULT_ADMIN_NAMES = ["jerry", "carlos"];

const isAppRoute = (path: string | null) =>
  path !== "/login" && path !== null && !path.startsWith("/admin");

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditDelta, setCreditDelta] = useState<number | null>(null);
  const [creditAnimClass, setCreditAnimClass] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [hasIncomingTrade, setHasIncomingTrade] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminUser, setAdminUser] = useState<{ id: string; name: string } | null>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminFormRef = useRef<HTMLDivElement>(null);

  // When admin panel opens in menu, scroll it into view
  useEffect(() => {
    if (adminOpen && adminFormRef.current) {
      adminFormRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [adminOpen]);

  // Presence / online status
  const { goOffline } = usePresence(user?.id ?? null);
  const { getStatus } = usePresenceStatus();

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

  // Only run auth/credits/avatar when on main app routes (not login or admin)
  useEffect(() => {
    if (!isAppRoute(pathname)) return;
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
  }, [router, pathname]);

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

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsNarrow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isNarrow) return;
    try {
      const raw = localStorage.getItem("dabys_user");
      if (raw) {
        const u = JSON.parse(raw) as { id?: string; name?: string };
        if (u?.id && u?.name && DEFAULT_ADMIN_NAMES.includes(u.name.trim().toLowerCase()))
          setAdminUser({ id: u.id, name: u.name });
        else setAdminUser(null);
      } else setAdminUser(null);
    } catch {
      setAdminUser(null);
    }
  }, [isNarrow, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Poll for incoming trades and listen for live updates from cards page (must be before any early return)
  useEffect(() => {
    if (!user?.id) {
      setHasIncomingTrade(false);
      return;
    }
    const check = () => {
      fetch(`/api/trades?userId=${encodeURIComponent(user.id)}&status=pending`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: { counterpartyUserId?: string }[]) => {
          const arr = Array.isArray(data) ? data : [];
          const incoming = arr.some((t) => t.counterpartyUserId === user.id);
          setHasIncomingTrade(incoming);
          // Do NOT dispatch dabys-trades-poll — cards page is single source of truth for trades.
          // Dispatching would overwrite fresh data from refreshTrades with stale poll data.
        })
        .catch(() => setHasIncomingTrade(false));
    };
    const onIncomingTrades = (e: Event) => {
      const detail = (e as CustomEvent<{ hasIncoming: boolean }>).detail;
      if (detail && typeof detail.hasIncoming === "boolean") setHasIncomingTrade(detail.hasIncoming);
    };
    check();
    let id = setInterval(check, 20000);
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        check();
        id = setInterval(check, 20000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("dabys-incoming-trades", onIncomingTrades);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("dabys-incoming-trades", onIncomingTrades);
    };
  }, [user?.id]);

  const logout = () => {
    goOffline();
    localStorage.removeItem("dabys_user");
    router.replace("/login");
  };

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
      if (res.ok) {
        closeMenu();
        router.push("/admin");
      } else {
        setAdminError("Wrong password");
        setAdminPassword("");
      }
    } catch {
      setAdminError("Something went wrong");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAdminLoginAsUser(userId: string) {
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        closeMenu();
        router.push("/admin");
      } else setAdminError("Could not sign in as admin");
    } catch {
      setAdminError("Something went wrong");
    } finally {
      setAdminLoading(false);
    }
  }

  // Don't render header on login or admin (layout still mounts us; we stay static elsewhere)
  if (!isAppRoute(pathname)) return null;

  if (!user) {
    return (
      <header className="sticky top-0 z-40 h-[var(--header-height)] min-h-[var(--header-height)] flex items-center border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-center min-h-[var(--header-height)]">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      </header>
    );
  }

  const isStats = pathname === "/stats";
  const isCards = pathname === "/cards";
  const isCasino = pathname === "/casino";
  const isVault = pathname === "/vault";
  const isWallet = pathname === "/wallet";

  const closeMenu = () => setMenuOpen(false);

  const creditsBlock = (
    <Link
      href="/wallet"
      onClick={isNarrow ? closeMenu : undefined}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors relative overflow-visible ${
        isWallet
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
            creditDelta > 0 ? "text-sky-400 bg-sky-500/20" : "text-amber-400 bg-amber-500/20"
          }`}
        >
          {creditDelta > 0 ? `+${creditDelta}` : creditDelta}
        </span>
      )}
    </Link>
  );

  const profileBlock = (
    <Link
      href={`/profile/${user.id}`}
      onClick={isNarrow ? closeMenu : undefined}
      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
    >
      <div className="relative">
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
        <StatusIndicator status={getStatus(user.id)} size="sm" />
      </div>
      <span className="text-white/70 text-sm font-medium">{user.name}</span>
    </Link>
  );

  const creditsBlockMenu = (
    <Link
      href="/wallet"
      onClick={closeMenu}
      className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-xl border text-base font-medium transition-colors relative overflow-visible touch-manipulation ${
        isWallet
          ? "bg-sky-400/15 border-sky-400/30 text-sky-300"
          : "bg-sky-400/10 border-sky-400/20 text-sky-300 hover:bg-sky-400/15"
      }`}
    >
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`tabular-nums ${creditAnimClass}`}>{creditBalance}</span>
      <span className="text-sky-300/60 text-sm">credits</span>
      {creditDelta !== null && (
        <span
          className={`absolute -top-1 -right-1 min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-bold credits-delta-pop pointer-events-none ${
            creditDelta > 0 ? "text-sky-400 bg-sky-500/20" : "text-amber-400 bg-amber-500/20"
          }`}
        >
          {creditDelta > 0 ? `+${creditDelta}` : creditDelta}
        </span>
      )}
    </Link>
  );

  const profileBlockMenu = (
    <Link
      href={`/profile/${user.id}`}
      onClick={closeMenu}
      className="flex items-center gap-4 min-h-[48px] py-3 hover:opacity-80 transition-opacity touch-manipulation"
    >
      <div className="relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg shadow-purple-500/20"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-purple-500/20">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <StatusIndicator status={getStatus(user.id)} size="sm" />
      </div>
      <span className="text-white/70 text-base font-medium">{user.name}</span>
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-40 h-[var(--header-height)] min-h-[var(--header-height)] flex items-center border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between min-h-[var(--header-height)] py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className="flex items-center hover:opacity-90 transition-opacity"
            >
              <img
                src="/dabys-logo.png"
                alt="Daby's"
                className="h-14 w-auto max-h-[4.5rem] object-contain sm:h-16 sm:max-h-[4.75rem]"
              />
            </Link>
          </div>

          {isNarrow ? (
            <div className="flex items-center gap-2">
              {creditsBlock}
              <NotificationCenter />
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-5 sm:gap-6">
              <NavLink href="/stats" label="Stats" active={isStats} />
              <NavLink href="/vault" label="Vault" active={isVault} />
              <NavLink href="/casino" label="Casino" active={isCasino} />
              <NavLink href="/cards" label="TCG" active={isCards} dot={hasIncomingTrade} />
              <NotificationCenter />
              {creditsBlock}
              {profileBlock}
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
          )}
        </div>
      </header>

      {isNarrow && menuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            aria-hidden
            onClick={closeMenu}
          />
          <div
            className="fixed top-0 right-0 z-50 h-full w-full max-w-[min(20rem,85vw)] border-l border-white/[0.08] bg-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] flex flex-col"
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-base font-semibold text-white/70">Menu</span>
              <button
                type="button"
                onClick={closeMenu}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer touch-manipulation"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-2 p-4 overflow-y-auto">
              <Link
                href="/stats"
                onClick={closeMenu}
                className={`min-h-[48px] flex items-center px-5 py-4 rounded-xl text-left text-base font-medium transition-colors touch-manipulation ${isStats ? "bg-purple-500/20 text-purple-300" : "text-white/80 hover:bg-white/10"}`}
              >
                Stats
              </Link>
              <Link
                href="/vault"
                onClick={closeMenu}
                className={`min-h-[48px] flex items-center px-5 py-4 rounded-xl text-left text-base font-medium transition-colors touch-manipulation ${isVault ? "bg-purple-500/20 text-purple-300" : "text-white/80 hover:bg-white/10"}`}
              >
                Vault
              </Link>
              <Link
                href="/casino"
                onClick={closeMenu}
                className={`min-h-[48px] flex items-center px-5 py-4 rounded-xl text-left text-base font-medium transition-colors touch-manipulation ${isCasino ? "bg-purple-500/20 text-purple-300" : "text-white/80 hover:bg-white/10"}`}
              >
                Casino
              </Link>
              <Link
                href="/cards"
                onClick={closeMenu}
                className={`min-h-[48px] flex items-center px-5 py-4 rounded-xl text-left text-base font-medium transition-colors relative touch-manipulation ${isCards ? "bg-purple-500/20 text-purple-300" : "text-white/80 hover:bg-white/10"}`}
              >
                TCG
                {hasIncomingTrade && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-amber-500/80 backdrop-blur-sm ring-1 ring-white/20 shadow-[0_0_8px_rgba(245,158,11,0.4)]" aria-label="Incoming trades" />
                )}
              </Link>
              <div className="min-h-[48px] flex items-center">
                <FeedbackButton inline />
              </div>
              <div className="pt-2 border-t border-white/[0.06]" ref={adminFormRef}>
                {adminOpen ? (
                  <form onSubmit={handleAdminLogin} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={adminLoading || !adminPassword}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {adminLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Go"}
                      </button>
                    </div>
                    {adminError && <p className="text-red-400/80 text-xs mt-2">{adminError}</p>}
                    {adminUser && (
                      <button
                        type="button"
                        onClick={() => handleAdminLoginAsUser(adminUser.id)}
                        disabled={adminLoading}
                        className="mt-2 w-full px-3 py-1.5 rounded-lg border border-white/20 text-white/60 text-xs hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                      >
                        Enter as {adminUser.name}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setAdminOpen(false); setAdminError(""); setAdminPassword(""); }}
                      className="mt-2 text-white/40 text-[11px] hover:text-white/60 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAdminOpen(true); setAdminError(""); setAdminPassword(""); }}
                    className="min-h-[48px] w-full flex items-center px-5 py-4 rounded-xl text-left text-base font-medium text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors touch-manipulation"
                  >
                    Admin Panel
                  </button>
                )}
              </div>
            </nav>
            <div className="mt-auto p-4 border-t border-white/[0.06] bg-white/[0.02] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                {creditsBlockMenu}
              </div>
              <div className="flex items-center gap-3">
                {profileBlockMenu}
                <button
                  onClick={() => { closeMenu(); logout(); }}
                  className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer touch-manipulation"
                  title="Log out"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
