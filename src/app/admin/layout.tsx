"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const MOBILE_BREAKPOINT_PX = 768;

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    label: "Movie Night",
    href: "/admin/movie-night",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
      </svg>
    ),
  },
  {
    label: "Cards & Credits",
    href: "/admin/cards-credits",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Dabys Bets",
    href: "/admin/dabys-bets",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  },
  {
    label: "Quests",
    href: "/admin/quests",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Feedback",
    href: "/admin/feedback",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    label: "Vault",
    href: "/admin/vault",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    ),
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => {
      const narrow = mql.matches;
      setIsNarrow(narrow);
      if (!narrow) setMobileMenuOpen(false);
    };
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    async function checkAuth() {
      try {
        let userId: string | null = null;
        try {
          const raw = localStorage.getItem("dabys_user");
          if (raw) {
            const u = JSON.parse(raw) as { id?: string };
            if (u?.id) userId = u.id;
          }
        } catch {
          /* ignore */
        }
        const res = await fetch("/api/admin/check", {
          headers: userId ? { "X-User-Id": userId } : {},
        });
        if (res.ok) {
          setAuthenticated(true);
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) return null;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 touch-manipulation min-h-[44px] md:min-h-0 px-4 py-3 md:px-3 md:py-2.5 ${
      isActive
        ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
        : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 md:px-6 py-5 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-[11px] text-white/30 mt-1 hidden md:block">Dabys.org Management</p>
        </div>
        {isNarrow && (
          <button
            type="button"
            onClick={closeMobileMenu}
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer touch-manipulation"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isNarrow ? closeMobileMenu : undefined}
              className={navLinkClass(isActive)}
            >
              <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center md:w-5 md:h-5 ${isActive ? "text-purple-400" : "text-white/30"}`}>
                {item.icon}
              </span>
              <span className="md:text-sm text-base">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex-shrink-0 px-3 py-4 border-t border-white/[0.06] space-y-2">
        <Link
          href="/"
          onClick={isNarrow ? closeMobileMenu : undefined}
          className="flex items-center gap-3 min-h-[48px] md:min-h-0 px-4 py-3 md:px-3 md:py-2.5 rounded-xl md:rounded-lg text-base md:text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all touch-manipulation"
        >
          <svg className="w-6 h-6 md:w-5 md:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Back to Site
        </Link>
        <button
          onClick={() => { closeMobileMenu(); handleLogout(); }}
          className="w-full flex items-center gap-3 min-h-[48px] md:min-h-0 px-4 py-3 md:px-3 md:py-2.5 rounded-xl md:rounded-lg text-base md:text-sm text-white/40 hover:text-red-400 hover:bg-red-500/[0.06] transition-all cursor-pointer touch-manipulation"
        >
          <svg className="w-6 h-6 md:w-5 md:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col ${isNarrow ? "min-h-[100dvh]" : "min-h-screen"}`}
      style={isNarrow ? { height: "100dvh" } : undefined}
    >
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      {/* Mobile: compact top bar, full width */}
      {isNarrow && (
        <header className="fixed top-0 left-0 right-0 z-30 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 transition-colors cursor-pointer touch-manipulation"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent truncate">
            Admin
          </h1>
        </header>
      )}

      {/* Sidebar: full-screen drawer on mobile, fixed full-height on desktop */}
      {isNarrow && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden
          onClick={closeMobileMenu}
        />
      )}
      <div
        className={
          isNarrow
            ? "flex flex-col flex-1 min-h-0"
            : "flex flex-row flex-1 min-h-0 md:min-h-screen"
        }
      >
        <aside
          className={`z-10 border-r border-white/[0.06] bg-white/[0.02] backdrop-blur-xl transition-transform duration-200 ease-out flex flex-col ${
            isNarrow
              ? `fixed top-0 left-0 bottom-0 z-50 w-[min(100%,20rem)] shadow-xl ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
              : "w-64 flex-shrink-0 sticky top-0 h-screen self-start"
          }`}
        >
          {sidebarContent}
        </aside>

        {/* Main content: fixed fill below header on mobile; flows after sidebar on desktop */}
        <main
          className={
            isNarrow
              ? "fixed left-0 right-0 top-12 bottom-0 z-10 flex flex-col min-h-0 overflow-hidden"
              : "relative z-10 flex-1 min-w-0 min-h-0 md:min-h-screen overflow-auto"
          }
        >
          <div className={isNarrow ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full max-w-5xl mx-auto px-3 py-4 md:px-8 md:py-8" : "w-full max-w-5xl mx-auto px-3 py-4 md:px-8 md:py-8 overflow-x-hidden"}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
