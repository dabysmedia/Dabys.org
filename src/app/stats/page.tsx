"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  name: string;
}

interface StatsData {
  totalWeeks: number;
  totalSubmissions: number;
  totalWinners: number;
  totalRatings: number;
  totalComments: number;
  mostSubmittedMovie: { movieTitle: string; posterUrl: string; year?: string; count: number } | null;
  topSubmitters: { userName: string; count: number }[];
  winLeaders: { userName: string; count: number }[];
  biggestSkippers: { userName: string; skipsUsed: number }[];
  bestRatedWinner: { winnerId: string; movieTitle: string; posterUrl: string; avgStars: number; ratingCount: number; dabysScorePct: number } | null;
  longestWinner: { winnerId: string; movieTitle: string; posterUrl: string; runtimeMinutes: number } | null;
  winnersByDecade: { decade: string; count: number }[];
}

interface FavoriteSlice {
  name: string;
  count: number;
}

interface FavoritesData {
  favoriteActors: FavoriteSlice[];
  favoriteDirectors: FavoriteSlice[];
  favoriteGenres: FavoriteSlice[];
}

function FavoriteBarList({ data, accent = "purple" }: { data: FavoriteSlice[]; accent?: "purple" | "violet" | "indigo" }) {
  if (data.length === 0) return <p className="text-white/30 text-sm">No data</p>;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const gradientClass =
    accent === "purple" ? "bg-gradient-to-r from-purple-500/50 to-violet-500/50" :
    accent === "violet" ? "bg-gradient-to-r from-violet-500/50 to-indigo-500/50" :
    "bg-gradient-to-r from-indigo-500/50 to-purple-500/50";

  const borderAccent =
    accent === "purple" ? "border-purple-500/30 bg-purple-500/5" :
    accent === "violet" ? "border-violet-500/30 bg-violet-500/5" :
    "border-indigo-500/30 bg-indigo-500/5";

  const winner = data[0];
  const rest = data.slice(1);

  return (
    <div className="flex flex-col gap-4">
      {/* Winner — separate highlighted area */}
      <div className={`rounded-xl border ${borderAccent} p-4 shrink-0`}>
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Winner</p>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white/90">1</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">{winner.name}</p>
            <p className="text-xs text-white/50 mt-0.5">{winner.count} appearance{winner.count !== 1 ? "s" : ""} in winning films</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${gradientClass}`}
            style={{ width: `${(winner.count / maxCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Rest of list */}
      {rest.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Also featured</p>
          <ul className="space-y-2 max-h-48 overflow-y-auto scrollbar-autocomplete pr-1">
            {rest.map((entry, i) => (
              <li key={`${entry.name}-${i}`} className="flex items-center gap-3">
                <span className="text-white/25 text-xs tabular-nums w-5 shrink-0">#{i + 2}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-4 rounded bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded transition-[width] duration-500 ease-out ${gradientClass}`}
                      style={{ width: `${(entry.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60 mt-0.5 truncate">{entry.name} <span className="text-white/35">· {entry.count}</span></p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const cardClass = "rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6";

function StatsFooter() {
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
      if (res.ok) {
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

  return (
    <footer className="relative z-10 border-t border-white/[0.04] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-4">
        <button
          onClick={() => { setAdminOpen(!adminOpen); setAdminError(""); setAdminPassword(""); }}
          className="text-white/10 text-[11px] hover:text-white/30 transition-colors cursor-pointer"
        >
          Admin Panel
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full max-w-xs ${adminOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
          <form onSubmit={handleAdminLogin} className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-3">
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
              />
              <button
                type="submit"
                disabled={adminLoading || !adminPassword}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
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

export default function StatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState<StatsData | null>(null);
  const [favorites, setFavorites] = useState<FavoritesData | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) {
      router.replace("/login");
      return;
    }
    try {
      const u = JSON.parse(cached) as User;
      setUser(u);
      setChecking(false);
      fetch(`/api/users/${u.id}/profile`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.profile?.avatarUrl) setUserAvatarUrl(d.profile.avatarUrl); })
        .catch(() => {});
    } catch {
      localStorage.removeItem("dabys_user");
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/stats/favorites")
      .then((r) => (r.ok ? r.json() : null))
      .then(setFavorites)
      .catch(() => setFavorites(null));
  }, [user]);

  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const maxWinCount = data?.winLeaders?.[0]?.count ?? 1;
  const maxSkipCount = data?.biggestSkippers?.[0]?.skipsUsed ?? 1;
  const maxDecadeCount = Math.max(...(data?.winnersByDecade?.map((d) => d.count) ?? [1]), 1);

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <header className="relative z-10 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
              Dabys.org
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/wheel" className="text-xs text-white/30 hover:text-purple-400 transition-colors font-medium">Theme Wheel</Link>
            <Link href="/stats" className="text-xs text-purple-400 font-medium">Stats</Link>
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
            <button onClick={() => { localStorage.removeItem("dabys_user"); router.replace("/login"); }} className="text-white/20 hover:text-white/50 transition-colors cursor-pointer" title="Log out">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {!data ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Hero */}
            <div className={cardClass}>
              <h1 className="text-3xl sm:text-4xl font-bold text-white/90 mb-2">Dabys Stats</h1>
              <p className="text-white/40 text-sm mb-4">Your year in Dabys</p>
              <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                {data.totalWinners} <span className="text-2xl sm:text-3xl text-white/50 font-normal">winners</span>
              </div>
              <p className="text-white/30 text-xs mt-2">across {data.totalWeeks} weeks</p>
            </div>

            {/* Totals */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Totals</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalWeeks}</p>
                  <p className="text-xs text-white/40 mt-0.5">Weeks</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalSubmissions}</p>
                  <p className="text-xs text-white/40 mt-0.5">Submissions</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalWinners}</p>
                  <p className="text-xs text-white/40 mt-0.5">Winners</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalRatings}</p>
                  <p className="text-xs text-white/40 mt-0.5">Ratings</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalComments}</p>
                  <p className="text-xs text-white/40 mt-0.5">Comments</p>
                </div>
              </div>
            </div>

            {/* Best Dabys score — prominent full-width, DABYS SCORE format */}
            <div className={`${cardClass} border-amber-500/15 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent`}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Best Dabys score</h2>
              {data.bestRatedWinner ? (
                <Link href={`/winners/${data.bestRatedWinner.winnerId}`} className="flex flex-col sm:flex-row items-start sm:items-center gap-6 group block">
                  {data.bestRatedWinner.posterUrl ? (
                    <img src={data.bestRatedWinner.posterUrl} alt="" className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl object-cover border border-white/[0.08] group-hover:border-amber-500/30 transition-colors shadow-lg shrink-0" />
                  ) : (
                    <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-3xl font-bold shrink-0">
                      {data.bestRatedWinner.movieTitle.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 w-full">
                    <p className="text-xl sm:text-2xl font-bold text-white/95 group-hover:text-amber-200 transition-colors mb-4">{data.bestRatedWinner.movieTitle}</p>
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Dabys score</h4>
                      {(() => {
                        const pct = data.bestRatedWinner.dabysScorePct ?? Math.round((data.bestRatedWinner.avgStars / 5) * 100);
                        const isFresh = pct >= 60;
                        return (
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${isFresh ? "text-green-400" : "text-red-400"}`}>
                                {pct}%
                              </span>
                              <span className={`text-sm font-semibold uppercase tracking-wide ${isFresh ? "text-green-400/80" : "text-red-400/80"}`}>
                                {isFresh ? "Fresh" : "Rotten"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-[160px] max-w-xs">
                              <div className="h-2.5 rounded-full overflow-hidden flex bg-white/10">
                                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                                <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${100 - pct}%` }} />
                              </div>
                              <p className="text-[11px] text-white/40 mt-1.5">
                                Thumbs + stars · Based on {data.bestRatedWinner.ratingCount} rating{data.bestRatedWinner.ratingCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-amber-400/90 text-sm font-medium group-hover:text-amber-300 transition-colors">View winner →</p>
                  </div>
                </Link>
              ) : (
                <p className="text-white/30 text-sm">No ratings yet.</p>
              )}
            </div>

            {/* Win leaders + Biggest skippers */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Win leaders</h2>
                {data.winLeaders.length > 0 ? (
                  <ul className="space-y-3">
                    {data.winLeaders.map((entry, i) => (
                      <li key={entry.userName} className="flex items-center gap-3">
                        <span className="text-white/30 text-sm w-5">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="h-6 rounded bg-white/[0.06] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-500/40 to-orange-500/40 rounded" style={{ width: `${(entry.count / maxWinCount) * 100}%` }} />
                          </div>
                          <p className="text-xs text-white/70 mt-1 truncate">{entry.userName} · {entry.count}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/30 text-sm">No winners yet.</p>
                )}
              </div>
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Biggest skippers</h2>
                {data.biggestSkippers && data.biggestSkippers.length > 0 ? (
                  <ul className="space-y-3">
                    {data.biggestSkippers.map((entry, i) => (
                      <li key={entry.userName} className="flex items-center gap-3">
                        <span className="text-white/30 text-sm w-5">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="h-6 rounded bg-white/[0.06] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500/40 to-indigo-500/40 rounded" style={{ width: `${(entry.skipsUsed / maxSkipCount) * 100}%` }} />
                          </div>
                          <p className="text-xs text-white/70 mt-1 truncate">{entry.userName} · {entry.skipsUsed} skip{entry.skipsUsed !== 1 ? "s" : ""}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/30 text-sm">No skips used yet.</p>
                )}
              </div>
            </div>

            {/* Dabys favorites (from winning films) */}
            <div className="grid sm:grid-cols-3 gap-6">
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Dabys favorite actor</h2>
                {favorites?.favoriteActors && favorites.favoriteActors.length > 0 ? (
                  <FavoriteBarList data={favorites.favoriteActors} accent="purple" />
                ) : favorites ? (
                  <p className="text-white/30 text-sm">No winner data yet (TMDB needed).</p>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Dabys favorite director</h2>
                {favorites?.favoriteDirectors && favorites.favoriteDirectors.length > 0 ? (
                  <FavoriteBarList data={favorites.favoriteDirectors} accent="violet" />
                ) : favorites ? (
                  <p className="text-white/30 text-sm">No winner data yet (TMDB needed).</p>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Dabys favorite genre</h2>
                {favorites?.favoriteGenres && favorites.favoriteGenres.length > 0 ? (
                  <FavoriteBarList data={favorites.favoriteGenres} accent="indigo" />
                ) : favorites ? (
                  <p className="text-white/30 text-sm">No winner data yet (TMDB needed).</p>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Most submitted + Longest movie (under favorites, side by side) */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Most submitted movie</h2>
                {data.mostSubmittedMovie ? (
                  <div className="flex items-center gap-4">
                    {data.mostSubmittedMovie.posterUrl ? (
                      <img src={data.mostSubmittedMovie.posterUrl} alt="" className="w-16 h-24 rounded-lg object-cover border border-white/[0.08]" />
                    ) : (
                      <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-2xl font-bold">
                        {data.mostSubmittedMovie.movieTitle.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold text-white/90">{data.mostSubmittedMovie.movieTitle}</p>
                      {data.mostSubmittedMovie.year && <p className="text-sm text-white/40">{data.mostSubmittedMovie.year}</p>}
                      <p className="text-sm text-purple-400 mt-1">Submitted {data.mostSubmittedMovie.count} time{data.mostSubmittedMovie.count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/30 text-sm">No submissions yet.</p>
                )}
              </div>
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Longest movie</h2>
                {data.longestWinner ? (
                  <Link href={`/winners/${data.longestWinner.winnerId}`} className="flex items-center gap-4 group">
                    {data.longestWinner.posterUrl ? (
                      <img src={data.longestWinner.posterUrl} alt="" className="w-16 h-24 rounded-lg object-cover border border-white/[0.08] group-hover:border-purple-500/30 transition-colors" />
                    ) : (
                      <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-2xl font-bold">
                        {data.longestWinner.movieTitle.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-semibold text-white/90 group-hover:text-purple-300 transition-colors">{data.longestWinner.movieTitle}</p>
                      <p className="text-white/50 text-sm mt-0.5">
                        {data.longestWinner.runtimeMinutes >= 60
                          ? `${Math.floor(data.longestWinner.runtimeMinutes / 60)}h${data.longestWinner.runtimeMinutes % 60 ? ` ${data.longestWinner.runtimeMinutes % 60}m` : ""}`
                          : `${data.longestWinner.runtimeMinutes}m`}
                      </p>
                      <p className="text-xs text-white/40 mt-1 group-hover:text-purple-400 transition-colors">View winner →</p>
                    </div>
                  </Link>
                ) : (
                  <p className="text-white/30 text-sm">No runtime data yet. Add or edit winners with TMDB to set runtime.</p>
                )}
              </div>
            </div>

            {/* Most popular decade (from winning films) */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Most popular decade</h2>
              {data.winnersByDecade && data.winnersByDecade.length > 0 ? (
                <ul className="space-y-3">
                  {data.winnersByDecade.map((entry) => (
                    <li key={entry.decade}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-white/80 text-sm truncate">{entry.decade}</span>
                        <span className="text-white/40 text-xs shrink-0">{entry.count} winner{entry.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-2 rounded bg-white/[0.06] overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500/40 to-indigo-500/40 rounded" style={{ width: `${(entry.count / maxDecadeCount) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/30 text-sm">No winner data yet.</p>
              )}
            </div>
          </div>
        )}
      </main>

      <StatsFooter />
    </div>
  );
}
