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
  totalVotes: number;
  totalWinners: number;
  totalRatings: number;
  totalComments: number;
  mostSubmittedMovie: { movieTitle: string; posterUrl: string; year?: string; count: number } | null;
  topSubmitters: { userName: string; count: number }[];
  winLeaders: { userName: string; count: number }[];
  mostActiveVoters: { userName: string; count: number }[];
  bestRatedWinner: { winnerId: string; movieTitle: string; posterUrl: string; avgStars: number; ratingCount: number } | null;
  mostDiscussedWinner: { winnerId: string; movieTitle: string; posterUrl: string; commentCount: number } | null;
  submissionsByTheme: { theme: string; weekId: string; count: number }[];
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

  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  const maxSubmitCount = data?.topSubmitters?.[0]?.count ?? 1;
  const maxWinCount = data?.winLeaders?.[0]?.count ?? 1;
  const maxThemeCount = Math.max(...(data?.submissionsByTheme?.map((t) => t.count) ?? [1]), 1);

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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalWeeks}</p>
                  <p className="text-xs text-white/40 mt-0.5">Weeks</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalSubmissions}</p>
                  <p className="text-xs text-white/40 mt-0.5">Submissions</p>
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-bold text-white/90">{data.totalVotes}</p>
                  <p className="text-xs text-white/40 mt-0.5">Votes</p>
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

            {/* Most submitted movie */}
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

            {/* Leaderboards */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className={cardClass}>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Top submitters</h2>
                {data.topSubmitters.length > 0 ? (
                  <ul className="space-y-3">
                    {data.topSubmitters.map((entry, i) => (
                      <li key={entry.userName} className="flex items-center gap-3">
                        <span className="text-white/30 text-sm w-5">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="h-6 rounded bg-white/[0.06] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500/40 to-violet-500/40 rounded" style={{ width: `${(entry.count / maxSubmitCount) * 100}%` }} />
                          </div>
                          <p className="text-xs text-white/70 mt-1 truncate">{entry.userName} · {entry.count}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/30 text-sm">No submitters yet.</p>
                )}
              </div>
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
            </div>

            {/* Most active voters (optional extra) */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Most active voters</h2>
              {data.mostActiveVoters.length > 0 ? (
                <ul className="flex flex-wrap gap-4">
                  {data.mostActiveVoters.map((entry) => (
                    <li key={entry.userName} className="text-white/80 text-sm">{entry.userName} <span className="text-white/40">({entry.count})</span></li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/30 text-sm">No votes yet.</p>
              )}
            </div>

            {/* Best rated winner */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Best rated winner</h2>
              {data.bestRatedWinner ? (
                <Link href={`/winners/${data.bestRatedWinner.winnerId}`} className="flex items-center gap-4 group">
                  {data.bestRatedWinner.posterUrl ? (
                    <img src={data.bestRatedWinner.posterUrl} alt="" className="w-16 h-24 rounded-lg object-cover border border-white/[0.08] group-hover:border-purple-500/30 transition-colors" />
                  ) : (
                    <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-2xl font-bold">
                      {data.bestRatedWinner.movieTitle.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-white/90 group-hover:text-purple-300 transition-colors">{data.bestRatedWinner.movieTitle}</p>
                    <p className="text-amber-400 text-sm mt-0.5">★ {data.bestRatedWinner.avgStars} · Based on {data.bestRatedWinner.ratingCount} rating{data.bestRatedWinner.ratingCount !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-white/40 mt-1 group-hover:text-purple-400 transition-colors">View winner →</p>
                  </div>
                </Link>
              ) : (
                <p className="text-white/30 text-sm">No ratings yet.</p>
              )}
            </div>

            {/* Most discussed winner */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Most discussed winner</h2>
              {data.mostDiscussedWinner ? (
                <Link href={`/winners/${data.mostDiscussedWinner.winnerId}`} className="flex items-center gap-4 group">
                  {data.mostDiscussedWinner.posterUrl ? (
                    <img src={data.mostDiscussedWinner.posterUrl} alt="" className="w-16 h-24 rounded-lg object-cover border border-white/[0.08] group-hover:border-purple-500/30 transition-colors" />
                  ) : (
                    <div className="w-16 h-24 rounded-lg bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 text-2xl font-bold">
                      {data.mostDiscussedWinner.movieTitle.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-white/90 group-hover:text-purple-300 transition-colors">{data.mostDiscussedWinner.movieTitle}</p>
                    <p className="text-white/50 text-sm mt-0.5">{data.mostDiscussedWinner.commentCount} comment{data.mostDiscussedWinner.commentCount !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-white/40 mt-1 group-hover:text-purple-400 transition-colors">View winner →</p>
                  </div>
                </Link>
              ) : (
                <p className="text-white/30 text-sm">No comments yet.</p>
              )}
            </div>

            {/* Themes */}
            <div className={cardClass}>
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Themes with most submissions</h2>
              {data.submissionsByTheme && data.submissionsByTheme.length > 0 ? (
                <ul className="space-y-3">
                  {data.submissionsByTheme.map((entry) => (
                    <li key={entry.weekId}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-white/80 text-sm truncate">{entry.theme}</span>
                        <span className="text-white/40 text-xs shrink-0">{entry.count}</span>
                      </div>
                      <div className="h-2 rounded bg-white/[0.06] overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500/40 to-indigo-500/40 rounded" style={{ width: `${(entry.count / maxThemeCount) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/30 text-sm">No theme data yet.</p>
              )}
            </div>
          </div>
        )}
      </main>

      <StatsFooter />
    </div>
  );
}
