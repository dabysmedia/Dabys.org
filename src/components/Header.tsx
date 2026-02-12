"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: string;
  name: string;
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

  const refreshCredits = () => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) return;
    try {
      const u = JSON.parse(cached) as User;
      fetch(`/api/credits?userId=${encodeURIComponent(u.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (typeof d?.balance === "number") setCreditBalance(d.balance);
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
    const handler = () => refreshCredits();
    window.addEventListener("dabys-credits-refresh", handler);
    return () => window.removeEventListener("dabys-credits-refresh", handler);
  }, []);

  const logout = () => {
    localStorage.removeItem("dabys_user");
    router.replace("/login");
  };

  if (!user) {
    return (
      <header className="relative z-10 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
        </div>
      </header>
    );
  }

  const isWheel = pathname === "/wheel";
  const isStats = pathname === "/stats";
  const isCards = pathname === "/cards";

  return (
    <header className="relative z-10 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            Dabys.org
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <NavLink href="/wheel" label="Theme Wheel" active={isWheel} />
          <NavLink href="/stats" label="Stats" active={isStats} />
          <NavLink href="/cards" label="Cards" active={isCards} />
          <Link
            href="/cards"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              isCards
                ? "bg-sky-400/15 border-sky-400/30 text-sky-300"
                : "bg-sky-400/10 border-sky-400/20 text-sky-300 hover:bg-sky-400/15"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{creditBalance}</span>
            <span className="text-sky-300/60 text-xs">credits</span>
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
