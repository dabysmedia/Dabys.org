"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { BadgePill } from "@/components/BadgePill";

interface User { id: string; name: string; }
interface Week { id: string; theme: string; phase: string; startedAt: string; }
interface Submission {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  tmdbId?: number;
  year?: string;
  overview?: string;
  trailerUrl?: string;
  backdropUrl?: string;
  createdAt: string;
  submissionCount?: number;
  pitch?: string;
  avatarUrl?: string;
  displayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
}
interface Vote { id: string; weekId: string; userId: string; userName: string; submissionId: string; }
interface Winner {
  id: string;
  weekId: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  submittedBy: string;
  publishedAt: string;
  year?: string;
  weekTheme?: string;
  submittedByUserId?: string;
  backdropUrl?: string;
  submitterAvatarUrl?: string;
  submitterDisplayedBadge?: { winnerId: string; movieTitle: string; isHolo: boolean } | null;
}
interface TmdbSearchResult { id: number; title: string; year: string; posterUrl: string; overview: string; }
interface TmdbMovieDetail { tmdbId: number; title: string; year: string; overview: string; posterUrl: string; backdropUrl: string; trailerUrl: string; letterboxdUrl: string; }

const PHASE_META: Record<string, { label: string; color: string; desc: string }> = {
  subs_open:        { label: "Submissions Open",   color: "text-green-400 border-green-500/30 bg-green-500/10", desc: "Submit your movie pick below!" },
  subs_closed:      { label: "Submissions Closed",  color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", desc: "Submissions are locked. Voting opens soon." },
  vote_open:        { label: "Voting Open",          color: "text-blue-400 border-blue-500/30 bg-blue-500/10", desc: "Vote for your favourite pick!" },
  vote_closed:      { label: "Voting Closed",        color: "text-orange-400 border-orange-500/30 bg-orange-500/10", desc: "Votes are in. Winner coming soon." },
  winner_published: { label: "Winner Published",     color: "text-purple-400 border-purple-500/30 bg-purple-500/10", desc: "This week\u2019s winner has been crowned!" },
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Data
  const [week, setWeek] = useState<Week | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [thisWeekWinner, setThisWeekWinner] = useState<Winner | null>(null);

  // Submission form — TMDB autocomplete
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [selectingMovie, setSelectingMovie] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subError, setSubError] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Vote phase: which card shows overlay / trailer
  const [voteActiveId, setVoteActiveId] = useState<string | null>(null);
  const [voteTrailerId, setVoteTrailerId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [weekRes, winnersRes] = await Promise.all([
        fetch("/api/weeks/current"),
        fetch("/api/winners"),
      ]);

      const winnersData: Winner[] = winnersRes.ok ? await winnersRes.json() : [];
      setWinners(winnersData);

      if (!weekRes.ok) { setWeek(null); return; }
      const weekData: Week = await weekRes.json();
      setWeek(weekData);

      const [subsRes, votesRes] = await Promise.all([
        fetch(`/api/submissions?weekId=${weekData.id}`),
        fetch(`/api/votes?weekId=${weekData.id}`),
      ]);

      setSubmissions(subsRes.ok ? await subsRes.json() : []);
      setVotes(votesRes.ok ? await votesRes.json() : []);

      // Find this week's winner if published
      if (weekData.phase === "winner_published") {
        const wk = winnersData.find((w) => w.weekId === weekData.id);
        setThisWeekWinner(wk || null);
      } else {
        setThisWeekWinner(null);
      }
    } catch (e) {
      console.error("Failed to load data", e);
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (!cached) { router.replace("/login"); return; }
    let u: User;
    try { u = JSON.parse(cached); setUser(u); } catch { localStorage.removeItem("dabys_user"); router.replace("/login"); return; }
    setChecking(false);
    loadData();
  }, [router, loadData]);

  // ── TMDB search debounce ──────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function selectTmdbMovie(tmdbId: number) {
    setSelectingMovie(true);
    setShowDropdown(false);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (res.ok) {
        const detail: TmdbMovieDetail = await res.json();
        setSelectedMovie(detail);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch {
      console.error("Failed to fetch movie details");
    } finally {
      setSelectingMovie(false);
    }
  }

  // ── actions ───────────────────────────────────────────

  async function submitMovie(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !week || !selectedMovie) return;
    setSubmitting(true); setSubError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          movieTitle: selectedMovie.title,
          posterUrl: selectedMovie.posterUrl,
          letterboxdUrl: selectedMovie.letterboxdUrl,
          tmdbId: selectedMovie.tmdbId,
          year: selectedMovie.year,
          overview: selectedMovie.overview,
          trailerUrl: selectedMovie.trailerUrl,
          backdropUrl: selectedMovie.backdropUrl,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSubError(d.error || "Failed"); }
      else { setSelectedMovie(null); setSearchQuery(""); loadData(); }
    } finally { setSubmitting(false); }
  }

  async function clearMySubmission() {
    if (!user || !week) return;
    await fetch(`/api/submissions?userId=${user.id}&weekId=${week.id}`, { method: "DELETE" });
    loadData();
  }

  async function castVote(submissionId: string) {
    if (!user || !week) return;
    await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, userName: user.name, submissionId }),
    });
    loadData();
  }

  async function clearMyVote() {
    if (!user || !week) return;
    await fetch(`/api/votes?userId=${user.id}&weekId=${week.id}`, { method: "DELETE" });
    loadData();
  }

  function logout() { localStorage.removeItem("dabys_user"); router.replace("/login"); }

  // derived
  const mySub = submissions.find((s) => s.userId === user?.id);
  const myVote = votes.find((v) => v.userId === user?.id);
  const phase = week?.phase || "";
  const phaseMeta = PHASE_META[phase];

  // vote tally: { submissionId: count }
  const voteTally: Record<string, number> = {};
  votes.forEach((v) => { voteTally[v.submissionId] = (voteTally[v.submissionId] || 0) + 1; });

  // Top 3 submissions for the current week (by votes, then createdAt)
  const topThreeSubmissions =
    submissions.length > 0
      ? [...submissions]
          .sort((a, b) => {
            const aVotes = voteTally[a.id] || 0;
            const bVotes = voteTally[b.id] || 0;
            if (bVotes !== aVotes) return bVotes - aVotes;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
          .slice(0, 3)
      : [];

  if (checking || !user) {
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

      <Header />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">

        {/* ═══ THEME + PHASE BANNER ═══ */}
        {!week ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center mb-8">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Current Theme</p>
            <h2 className="text-3xl font-bold text-white/90">Coming Soon</h2>
            <p className="mt-3 text-white/40 text-sm">The admin will set the weekly theme and open submissions.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center mb-6">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">This Week&apos;s Theme</p>
              <h2 className="text-3xl font-bold text-white/90 mb-3">{week.theme}</h2>
              {phaseMeta && (
                <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium border ${phaseMeta.color}`}>
                  {phaseMeta.label}
                </span>
              )}
              {phaseMeta && <p className="mt-3 text-white/40 text-sm">{phaseMeta.desc}</p>}
            </div>

            {/* Winner hero — make it a big deal */}
            {phase === "winner_published" && thisWeekWinner && (
              <Link
                href={`/winners/${thisWeekWinner.id}`}
                className="relative block mb-10 rounded-3xl overflow-hidden border border-white/[0.16] bg-black/40 backdrop-blur-2xl shadow-[0_40px_120px_rgba(0,0,0,0.9)] group hover:border-[#F0F4F8]/80 hover:shadow-[0_0_40px_rgba(240,244,248,0.55)] transition-all duration-300"
              >
                {/* Backdrop art */}
                <div className="absolute inset-0">
                  {(thisWeekWinner.backdropUrl || thisWeekWinner.posterUrl) ? (
                    <img
                      src={thisWeekWinner.backdropUrl || thisWeekWinner.posterUrl!}
                      alt={thisWeekWinner.movieTitle}
                      className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-amber-700/40 via-purple-800/40 to-indigo-900/40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                <div className="relative px-6 py-8 sm:px-10 sm:py-10 flex flex-col md:flex-row items-center gap-8">
                  {/* Trophy + copy on small screens */}
                  <div className="md:hidden w-full flex items-center justify-between mb-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/25">
                      <svg className="w-4 h-4 text-[#F0F4F8]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516" />
                      </svg>
                      <span className="text-[11px] font-semibold tracking-widest text-[#F0F4F8] uppercase">
                        This Week&apos;s Winner
                      </span>
                    </div>
                    <span className="text-[11px] text-white/40">
                      {new Date(thisWeekWinner.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Poster */}
                  {thisWeekWinner.posterUrl && (
                    <div className="relative w-32 sm:w-40 md:w-52 shrink-0">
                      <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-[#B8B8C0]/30 via-[#F0F4F8]/25 to-[#9098A0]/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <img
                        src={thisWeekWinner.posterUrl}
                        alt={thisWeekWinner.movieTitle}
                        className="relative w-full rounded-2xl object-cover border border-white/15 shadow-2xl shadow-black/70"
                      />
                    </div>
                  )}

                  {/* Copy */}
                  <div className="flex-1 min-w-0">
                    <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/25 mb-3">
                      <svg className="w-4 h-4 text-[#F0F4F8]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516" />
                      </svg>
                      <span className="text-[11px] font-semibold tracking-widest text-[#F0F4F8] uppercase">
                        This Week&apos;s Winner
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white/95 mb-2 sm:mb-3 leading-tight line-clamp-2">
                      {thisWeekWinner.movieTitle}
                      {thisWeekWinner.year && (
                        <span className="text-white/60 text-lg sm:text-2xl ml-2">({thisWeekWinner.year})</span>
                      )}
                    </h3>

                    {thisWeekWinner.submittedBy && (
                      thisWeekWinner.submitterDisplayedBadge ? (
                        thisWeekWinner.submittedByUserId ? (
                          <Link
                            href={`/profile/${thisWeekWinner.submittedByUserId}`}
                            className="flex items-center gap-4 p-4 rounded-2xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.09] hover:border-amber-500/30 transition-all duration-200 mb-4 group/card"
                          >
                          <div className="shrink-0">
                            {thisWeekWinner.submitterAvatarUrl ? (
                              <img src={thisWeekWinner.submitterAvatarUrl} alt="" className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white/20 group-hover/card:border-amber-500/40 transition-colors" />
                            ) : (
                              <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold border-2 border-white/20">
                                {thisWeekWinner.submittedBy.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Picked by</p>
                            <p className="text-lg sm:text-xl font-bold text-white/95 truncate">{thisWeekWinner.submittedBy}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm"
                                style={{
                                  background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                                  boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                                }}
                              >
                                Badge holder
                              </span>
                              <BadgePill movieTitle={thisWeekWinner.submitterDisplayedBadge.movieTitle} isHolo={thisWeekWinner.submitterDisplayedBadge.isHolo} />
                            </div>
                          </div>
                          <span className="text-white/20 group-hover/card:text-amber-400/50 transition-colors shrink-0" aria-hidden>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </span>
                        </Link>
                        ) : (
                          <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/15 bg-white/[0.06] mb-4">
                            <div className="shrink-0">
                              {thisWeekWinner.submitterAvatarUrl ? (
                                <img src={thisWeekWinner.submitterAvatarUrl} alt="" className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white/20" />
                              ) : (
                                <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold border-2 border-white/20">
                                  {thisWeekWinner.submittedBy.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Picked by</p>
                              <p className="text-lg sm:text-xl font-bold text-white/95 truncate">{thisWeekWinner.submittedBy}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm"
                                  style={{
                                    background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                                    boxShadow: "0 0 8px rgba(255,255,255,0.4)",
                                  }}
                                >
                                  Badge holder
                                </span>
                                <BadgePill movieTitle={thisWeekWinner.submitterDisplayedBadge.movieTitle} isHolo={thisWeekWinner.submitterDisplayedBadge.isHolo} />
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <p className="text-sm sm:text-base text-white/70 mb-3">
                          Picked by{" "}
                          {thisWeekWinner.submittedByUserId ? (
                            <Link href={`/profile/${thisWeekWinner.submittedByUserId}`} className="inline-flex items-center gap-2 text-white font-semibold hover:text-purple-300 transition-colors">
                              {thisWeekWinner.submitterAvatarUrl ? (
                                <img src={thisWeekWinner.submitterAvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" />
                              ) : (
                                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                  {thisWeekWinner.submittedBy.charAt(0)}
                                </span>
                              )}
                              <span>{thisWeekWinner.submittedBy}</span>
                            </Link>
                          ) : (
                            <span className="text-white/90 font-semibold">{thisWeekWinner.submittedBy}</span>
                          )}
                        </p>
                      )
                    )}

                    <p className="hidden sm:block text-sm text-white/70 max-w-xl mb-4 line-clamp-3">
                      Rate it, drop a comment, and share how it played with the crowd.
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#B8B8C0] via-[#F0F4F8] to-[#9098A0] text-black text-sm font-semibold shadow-lg shadow-[rgba(240,244,248,0.6)] group-hover:shadow-[0_0_32px_rgba(240,244,248,0.8)] transition-shadow">
                        Rate &amp; discuss
                        <span aria-hidden="true">↗</span>
                      </span>
                      <span className="text-xs sm:text-[11px] text-white/60">
                        Published{" "}
                        {new Date(thisWeekWinner.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </>
        )}

        {/* ═══ PHASE-SPECIFIC CONTENT ═══ */}
        {week && (
          <div className="mb-12">

            {/* ── SUBS_OPEN: submit form + submissions grid + clear ── */}
            {phase === "subs_open" && (
              <>
                {/* Submit form — TMDB Autocomplete */}
                {!mySub ? (
                  <div className="relative z-20 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 mb-6">
                    <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Submit Your Pick</h3>

                    {!selectedMovie ? (
                      /* ── Search input with autocomplete dropdown ── */
                      <div ref={dropdownRef} className="relative">
                        <div className="relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                            placeholder="Search for a movie..."
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors pr-10"
                            autoComplete="off"
                          />
                          {(searchLoading || selectingMovie) && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                            </div>
                          )}
                          {!searchLoading && !selectingMovie && searchQuery.trim().length > 0 && (
                            <button
                              onClick={() => { setSearchQuery(""); setSearchResults([]); setShowDropdown(false); }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Autocomplete dropdown */}
                        {showDropdown && searchResults.length > 0 && (
                          <div className="scrollbar-autocomplete absolute z-30 mt-1 w-full max-h-80 overflow-auto rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl">
                            {searchResults.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => selectTmdbMovie(r.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left cursor-pointer"
                              >
                                {r.posterUrl ? (
                                  <img src={r.posterUrl} alt={r.title} className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5" />
                                ) : (
                                  <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/10 text-lg font-bold">{r.title.charAt(0)}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white/80 truncate">{r.title}</p>
                                  <p className="text-xs text-white/30">{r.year || "Unknown year"}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {showDropdown && searchResults.length === 0 && !searchLoading && searchQuery.trim().length >= 2 && (
                          <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl px-4 py-6 text-center">
                            <p className="text-white/30 text-sm">No movies found. Try a different search.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── Selected movie preview card ── */
                      <form onSubmit={submitMovie}>
                        <div className="flex gap-4 items-start">
                          {selectedMovie.posterUrl && (
                            <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-24 h-36 rounded-xl object-cover flex-shrink-0 border border-white/[0.08] shadow-lg" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold text-white/90 truncate">{selectedMovie.title}</h4>
                            <p className="text-sm text-white/40 mt-0.5">{selectedMovie.year}</p>
                            {selectedMovie.overview && (
                              <p className="text-xs text-white/30 mt-2 line-clamp-3">{selectedMovie.overview}</p>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <a href={selectedMovie.letterboxdUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400/60 hover:text-green-400 transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); window.open(selectedMovie.letterboxdUrl, "_blank", "noopener,noreferrer"); }}>Letterboxd</a>
                              {selectedMovie.trailerUrl && <span className="text-white/10">|</span>}
                              {selectedMovie.trailerUrl && <span className="text-xs text-purple-400/60">Trailer available</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4">
                          <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                            {submitting ? "Submitting..." : "Submit Movie"}
                          </button>
                          <button type="button" onClick={() => setSelectedMovie(null)} className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                            Change
                          </button>
                          {subError && <p className="text-red-400/80 text-xs">{subError}</p>}
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-xl p-6 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {mySub.posterUrl && (
                        <img src={mySub.posterUrl} alt={mySub.movieTitle} className="w-10 h-14 rounded object-cover flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-green-400 text-sm font-medium">You submitted: <span className="text-white/80">{mySub.movieTitle}</span></p>
                        {mySub.year && <p className="text-xs text-white/30">{mySub.year}</p>}
                      </div>
                    </div>
                    <button onClick={clearMySubmission} className="text-xs text-white/30 hover:text-red-400 transition-colors cursor-pointer">Clear Submission</button>
                  </div>
                )}

                {/* Submissions grid */}
                {submissions.length > 0 && (
                  <SubmissionsGrid
                    submissions={submissions}
                    currentUserId={user?.id}
                    onPitchSaved={loadData}
                  />
                )}
              </>
            )}

            {/* ── SUBS_CLOSED: read-only submissions ── */}
            {phase === "subs_closed" && (
              <>
                {submissions.length > 0 ? (
                  <SubmissionsGrid
                    submissions={submissions}
                    currentUserId={user?.id}
                    onPitchSaved={loadData}
                  />
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center">
                    <p className="text-white/30 text-sm">No submissions this week.</p>
                  </div>
                )}
              </>
            )}

            {/* ── VOTE_OPEN: click card for Letterboxd/trailer, Cast Vote at bottom ── */}
            {phase === "vote_open" && (
              <>
                {myVote && (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl p-5 mb-6 flex items-center justify-between">
                    <p className="text-blue-400 text-sm font-medium">
                      You voted for: <span className="text-white/80">{submissions.find((s) => s.id === myVote.submissionId)?.movieTitle || "—"}</span>
                    </p>
                    <button onClick={clearMyVote} className="text-xs text-white/30 hover:text-red-400 transition-colors cursor-pointer">Clear Vote</button>
                  </div>
                )}

                {submissions.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {submissions.map((sub) => {
                      const isMyVote = myVote?.submissionId === sub.id;
                      const isActive = voteActiveId === sub.id;
                      const showTrailer = voteTrailerId === sub.id;
                      const hasTrailer = !!sub.trailerUrl;
                      const hasLetterboxd = !!sub.letterboxdUrl;
                      const isOwn = sub.userId === user.id;

                      const voteCardBorderClass = showTrailer
                        ? "col-span-2 sm:col-span-2 md:col-span-3 lg:col-span-3 border-purple-500/30 shadow-lg shadow-purple-500/10"
                        : isOwn
                          ? "border-white/[0.06] opacity-40"
                          : isMyVote
                            ? "border-blue-500/40 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30"
                            : myVote
                              ? "border-white/[0.06] opacity-50"
                              : "border-white/[0.06] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10";

                      return (
                        <div
                          key={sub.id}
                          className={`group relative rounded-xl overflow-hidden border bg-white/[0.02] transition-all duration-300 ${voteCardBorderClass} ${!myVote && !isOwn ? "cursor-pointer" : ""}`}
                        >
                          {showTrailer && sub.trailerUrl ? (
                            <>
                              <div className="aspect-video bg-black rounded-t-xl overflow-hidden">
                                <iframe
                                  src={sub.trailerUrl}
                                  title={`${sub.movieTitle} Trailer`}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="w-full h-full"
                                />
                              </div>
                              <div className="p-4 flex items-center justify-between">
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold text-white/90 truncate">{sub.movieTitle}</h3>
                                  <p className="text-[11px] text-white/30 mt-0.5 truncate">
                                    {sub.year && <span className="text-white/40">{sub.year} &middot; </span>}
                                    by {sub.userName}
                                  </p>
                                </div>
                                <button
                                  onClick={() => { setVoteTrailerId(null); setVoteActiveId(null); }}
                                  className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/20 transition-colors cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30"
                                onClick={() => {
                                  if (myVote || isOwn) return;
                                  setVoteActiveId(isActive ? null : sub.id);
                                  setVoteTrailerId(null);
                                }}
                              >
                                {sub.posterUrl ? (
                                  <img src={sub.posterUrl} alt={sub.movieTitle} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">{sub.movieTitle.charAt(0)}</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                {isMyVote && (
                                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-blue-500/30 backdrop-blur-sm flex items-center justify-center border border-blue-400/40">
                                    <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                                  </div>
                                )}
                                {sub.submissionCount != null && sub.submissionCount > 1 && (
                                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm border bg-white/15 border-white/25 text-white/90">
                                    {sub.submissionCount}×
                                  </div>
                                )}
                                {isOwn && (
                                  <div className="absolute inset-0 z-10 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center gap-1 px-4 text-center">
                                    <span className="text-base text-white/80 font-semibold">
                                      ⛓️ nice try
                                    </span>
                                    <span className="text-[11px] text-white/40">
                                      You can&apos;t vote for your own movie.
                                    </span>
                                  </div>
                                )}
                                {isActive && !isOwn && (
                                  <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4">
                                    {hasLetterboxd && sub.letterboxdUrl && (
                                      <a
                                        href={sub.letterboxdUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors w-full justify-center cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(sub.letterboxdUrl!, "_blank", "noopener,noreferrer"); }}
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                        </svg>
                                        Letterboxd
                                      </a>
                                    )}
                                    {hasTrailer && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setVoteTrailerId(sub.id); }}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors w-full justify-center cursor-pointer"
                                      >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8 5v14l11-7z" />
                                        </svg>
                                        Watch Trailer
                                      </button>
                                    )}
                                    {!myVote && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); castVote(sub.id); setVoteActiveId(null); }}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-colors w-full justify-center cursor-pointer mt-1"
                                      >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                                        Cast Vote
                                      </button>
                                    )}
                                    {!hasLetterboxd && !hasTrailer && !myVote && (
                                      <p className="text-white/30 text-xs">No links — use Cast Vote below</p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="p-3 relative z-0">
                                <h3 className="text-sm font-semibold text-white/90 truncate">{sub.movieTitle}</h3>
                                <p className="text-[11px] text-white/30 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  {sub.year && <span className="text-white/40">{sub.year} &middot; </span>}
                                  <span>by{" "}
                                    <Link
                                      href={`/profile/${sub.userId}`}
                                      className="text-white/40 hover:text-purple-400 transition-colors"
                                    >
                                      {sub.userName}
                                    </Link>
                                  </span>
                                  {sub.displayedBadge && <BadgePill movieTitle={sub.displayedBadge.movieTitle} isHolo={sub.displayedBadge.isHolo} />}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center">
                    <p className="text-white/30 text-sm">No submissions to vote on.</p>
                  </div>
                )}
              </>
            )}

            {/* ── VOTE_CLOSED: submissions with vote tally ── */}
            {phase === "vote_closed" && (
              <>
                {submissions.length > 0 ? (
                  <SubmissionsGrid
                  submissions={submissions}
                  voteTally={voteTally}
                  sorted
                  currentUserId={user?.id}
                  onPitchSaved={loadData}
                />
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 text-center">
                    <p className="text-white/30 text-sm">No submissions this week.</p>
                  </div>
                )}
              </>
            )}

            {/* If winner published, show top 3 pedestal instead of raw submissions grid */}
            {phase === "winner_published" && submissions.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-4">
                  Runners-up this Week
                </h3>
                <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
                  {topThreeSubmissions.slice(1).map((sub, idx) => {
                    const place = idx + 2; // 2nd and 3rd place only
                    const votes = voteTally[sub.id] || 0;
                    const sizeClass =
                      place === 1
                        ? "sm:translate-y-0"
                        : "sm:translate-y-3";
                    const borderClass =
                      place === 1
                        ? "border-amber-500/40 shadow-lg shadow-amber-500/30"
                        : "border-white/[0.06]";

                    const ribbonLabel =
                      place === 1 ? "1st" : place === 2 ? "2nd" : "3rd";
                    const ribbonColor =
                      place === 1
                        ? "bg-amber-500 text-black"
                        : place === 2
                          ? "bg-slate-400 text-black"
                          : "bg-amber-700/80 text-amber-100";

                    return (
                      <div
                        key={sub.id}
                        className={`relative rounded-2xl border bg-white/[0.02] px-3 pt-4 pb-4 flex flex-col items-center ${borderClass} ${sizeClass}`}
                      >
                        {/* Ribbon */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md ${ribbonColor}`}>
                            {ribbonLabel} place
                          </div>
                        </div>

                        {/* Poster */}
                        <div className="mt-3 w-28 sm:w-28 md:w-32 rounded-xl overflow-hidden border border-white/10 shadow-lg shadow-black/40">
                          {sub.posterUrl ? (
                            <img
                              src={sub.posterUrl}
                              alt={sub.movieTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-40 flex items-center justify-center text-white/10 text-3xl font-bold">
                              {sub.movieTitle.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="mt-3 text-center px-1">
                          <p className="text-sm font-semibold text-white/90 truncate max-w-[10rem]">
                            {sub.movieTitle}
                          </p>
                          <p className="text-[11px] text-white/40 mb-1">
                            {sub.year && <span className="text-white/50">{sub.year} &middot; </span>}
                            by{" "}
                            <Link
                              href={`/profile/${sub.userId}`}
                              className="text-white/60 hover:text-purple-300 transition-colors"
                            >
                              {sub.userName}
                            </Link>
                          </p>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/70">
                            <svg
                              className="w-3.5 h-3.5 text-amber-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.287 3.96c.3.92-.755 1.688-1.54 1.118l-3.371-2.449a1 1 0 00-1.175 0l-3.37 2.45c-.785.569-1.84-.198-1.54-1.119l1.287-3.959a1 1 0 00-.364-1.118L2.075 9.386c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.274-3.96z"
                              />
                            </svg>
                            <span className="font-semibold tabular-nums">
                              {votes} vote{votes !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ WINNERS CIRCLE ═══ */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C0C0C0]/20 to-transparent" />
            <h2 className="text-2xl font-bold tracking-wide" style={{ fontFamily: "'Libre Baskerville', serif" }}>
              <span className="winners-circle-glow bg-gradient-to-r from-[#B8B8C0] via-[#F0F4F8] to-[#9098A0] bg-clip-text text-transparent inline-block" style={{ WebkitTextStroke: '0.4px rgba(255,255,255,0.2)' }}>Winners Circle</span>
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C0C0C0]/20 to-transparent" />
          </div>
          <p className="text-center text-white/40 text-xs mb-6 -mt-2">Click any winner to rate, comment, and play trivia</p>

          {winners.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
                </svg>
              </div>
              <p className="text-white/30 text-sm">No winners yet. Check back after the first week completes!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {winners.map((winner) => (
                <div key={winner.id} className="group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10 hover:scale-[1.03]">
                  <Link href={`/winners/${winner.id}`} className="block">
                    <div className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                      {winner.posterUrl ? (
                        <img src={winner.posterUrl} alt={winner.movieTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">{winner.movieTitle.charAt(0)}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {winner.weekTheme && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 border border-purple-500/25 text-purple-300 backdrop-blur-sm">
                          {winner.weekTheme}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-white/90 truncate group-hover:text-amber-200 transition-colors">{winner.movieTitle}</h3>
                    </div>
                  </Link>
                  {(winner.year || winner.submittedBy) && (
                    <div className="px-3 pb-3 -mt-1">
                      <p className="text-[11px] text-white/30 flex items-center gap-1.5 flex-wrap">
                        {winner.year && <span className="text-white/40">{winner.year} &middot; </span>}
                        {winner.submittedBy && (
                          <>
                            <span>by{" "}
                              {winner.submittedByUserId ? (
                                <Link href={`/profile/${winner.submittedByUserId}`} className="text-white/40 hover:text-purple-400 transition-colors">
                                  {winner.submittedBy}
                                </Link>
                              ) : (
                                <span className="text-white/40">{winner.submittedBy}</span>
                              )}
                            </span>
                            {winner.submitterDisplayedBadge && (
                              <BadgePill movieTitle={winner.submitterDisplayedBadge.movieTitle} isHolo={winner.submitterDisplayedBadge.isHolo} />
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

/* ── Site footer with admin access ── */
function Footer() {
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

/* ── Shared interactive submissions grid ── */
function SubmissionsGrid({
  submissions,
  voteTally,
  highlightTitle,
  sorted,
  currentUserId,
  onPitchSaved,
}: {
  submissions: Submission[];
  voteTally?: Record<string, number>;
  highlightTitle?: string;
  sorted?: boolean;
  currentUserId?: string;
  onPitchSaved?: () => void | Promise<void>;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trailerId, setTrailerId] = useState<string | null>(null);
  const [pitchModalSub, setPitchModalSub] = useState<Submission | null>(null);
  const [draftPitch, setDraftPitch] = useState("");
  const [pitchSaving, setPitchSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Scale pitch text to fit its box at any size/zoom
  useEffect(() => {
    const runFit = () => {
      gridRef.current?.querySelectorAll(".pitch-bubble").forEach((bubbleEl) => {
        const bubble = bubbleEl as HTMLElement;
        const textEl = bubble.querySelector(".pitch-text") as HTMLElement | null;
        if (!textEl) return;
        const maxH = bubble.clientHeight;
        const maxW = bubble.clientWidth;
        let size = 13;
        textEl.style.fontSize = `${size}px`;
        while (size > 8 && (textEl.scrollHeight > maxH || textEl.scrollWidth > maxW)) {
          size--;
          textEl.style.fontSize = `${size}px`;
        }
      });
    };
    const el = gridRef.current;
    if (!el) return;
    const runAfterLayout = () => requestAnimationFrame(() => requestAnimationFrame(runFit));
    runAfterLayout();
    const ro = new ResizeObserver(runAfterLayout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [submissions]);

  const items = sorted && voteTally
    ? [...submissions].sort((a, b) => (voteTally[b.id] || 0) - (voteTally[a.id] || 0))
    : submissions;

  async function savePitch() {
    if (!pitchModalSub || !currentUserId) return;
    setPitchSaving(true);
    try {
      const res = await fetch(`/api/submissions/${pitchModalSub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, pitch: draftPitch.trim().slice(0, 100) }),
      });
      if (res.ok) {
        setPitchModalSub(null);
        await onPitchSaved?.();
      }
    } finally {
      setPitchSaving(false);
    }
  }

  return (
    <>
    <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((sub, i) => {
        const isActive = activeId === sub.id;
        const showTrailer = trailerId === sub.id;
        const hasTrailer = !!sub.trailerUrl;
        const hasLetterboxd = !!sub.letterboxdUrl;
        const votes = voteTally?.[sub.id] || 0;
        const isTopVoted = sorted && voteTally && i === 0 && votes > 0;
        const isHighlighted = highlightTitle && sub.movieTitle === highlightTitle;

        const borderClass = showTrailer
          ? "col-span-2 sm:col-span-2 md:col-span-3 lg:col-span-3 border-purple-500/30 shadow-lg shadow-purple-500/10"
          : isHighlighted || isTopVoted
            ? "border-amber-500/30 shadow-lg shadow-amber-500/10"
            : "border-white/[0.06]";

        const isMine = currentUserId && sub.userId === currentUserId;

        return (
          <div
            key={sub.id}
            className={`group relative rounded-xl border bg-white/[0.02] transition-all duration-300 ${borderClass}`}
          >
            <div className="rounded-xl overflow-hidden">
            {/* ── Trailer expanded view ── */}
            {showTrailer && sub.trailerUrl ? (
              <div>
                <div className="aspect-video bg-black rounded-t-xl overflow-hidden">
                  <iframe
                    src={sub.trailerUrl}
                    title={`${sub.movieTitle} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white/90 truncate">{sub.movieTitle}</h3>
                    <p className="text-[11px] text-white/30 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {sub.year && <span className="text-white/40">{sub.year} &middot; </span>}
                      <span>by <Link href={`/profile/${sub.userId}`} className="text-white/40 hover:text-purple-400 transition-colors">{sub.userName}</Link></span>
                      {sub.displayedBadge && <BadgePill movieTitle={sub.displayedBadge.movieTitle} isHolo={sub.displayedBadge.isHolo} />}
                    </p>
                  </div>
                  <button
                    onClick={() => { setTrailerId(null); setActiveId(null); }}
                    className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 border border-white/[0.08] hover:border-white/20 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal poster card ── */
              <>
                <div
                  className="aspect-[2/3] relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30 cursor-pointer"
                  onClick={() => {
                    if (hasLetterboxd || hasTrailer) {
                      setActiveId(isActive ? null : sub.id);
                      setTrailerId(null);
                    }
                  }}
                >
                  {sub.posterUrl ? (
                    <img src={sub.posterUrl} alt={sub.movieTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">{sub.movieTitle.charAt(0)}</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Pitch — Instagram reel style: pfp + bubble at bottom, hover only */}
                  {sub.pitch && (
                    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end gap-2 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none">
                      <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden bg-white/10">
                        {sub.avatarUrl ? (
                          <img src={sub.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/80 text-xs font-semibold">
                            {(sub.userName || "?")[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="pitch-bubble min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-white/90 backdrop-blur-sm border border-white/30 px-3 py-2 shadow-lg max-h-14 overflow-hidden flex items-center">
                        <p className="pitch-text text-neutral-800 leading-snug break-words w-full" style={{ fontSize: 13 }}>{sub.pitch}</p>
                      </div>
                    </div>
                  )}

                  {/* Repeat submission badge */}
                  {sub.submissionCount != null && sub.submissionCount > 1 && (
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm border bg-white/15 border-white/25 text-white/90" title="Submitted before">
                      {sub.submissionCount}×
                    </div>
                  )}

                  {/* Vote badge */}
                  {voteTally && (
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold backdrop-blur-sm border ${
                      isTopVoted
                        ? "bg-amber-500/20 border-amber-400/30 text-amber-300"
                        : "bg-white/10 border-white/20 text-white/60"
                    }`}>
                      {votes}{!highlightTitle && ` vote${votes !== 1 ? "s" : ""}`}
                    </div>
                  )}

                  {/* Action overlay when tapped */}
                  {isActive && (
                    <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      {hasLetterboxd && sub.letterboxdUrl && (
                        <a
                          href={sub.letterboxdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(sub.letterboxdUrl!, "_blank", "noopener,noreferrer"); }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          Letterboxd
                        </a>
                      )}
                      {hasTrailer && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTrailerId(sub.id); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Watch Trailer
                        </button>
                      )}
                      {!hasLetterboxd && !hasTrailer && (
                        <p className="text-white/30 text-xs">No links available</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-3 relative z-0">
                  <h3 className="text-sm font-semibold text-white/90 truncate">{sub.movieTitle}</h3>
                  <p className="text-[11px] text-white/30 mt-0.5 truncate flex items-center gap-1.5 flex-wrap">
                    {sub.year && <span className="text-white/40">{sub.year} &middot; </span>}
                    <span>by <Link href={`/profile/${sub.userId}`} className="text-white/40 hover:text-purple-400 transition-colors relative z-20">{sub.userName}</Link></span>
                    {sub.displayedBadge && <BadgePill movieTitle={sub.displayedBadge.movieTitle} isHolo={sub.displayedBadge.isHolo} />}
                    {isMine && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPitchModalSub(sub);
                          setDraftPitch(sub.pitch ?? "");
                        }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer shrink-0"
                      >
                        {sub.pitch ? "Edit pitch" : "Add pitch"}
                      </button>
                    )}
                  </p>
                </div>
              </>
            )}
            </div>
          </div>
        );
      })}
    </div>

    {/* Pitch editor modal */}
    {pitchModalSub && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPitchModalSub(null)}>
        <div className="rounded-2xl border border-white/[0.12] bg-[#0f0f14] p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-white/80 mb-1">Pitch for {pitchModalSub.movieTitle}</h3>
          <p className="text-[11px] text-white/40 mb-3">Short elevator pitch (max 100 characters), shown on hover.</p>
          <textarea
            value={draftPitch}
            onChange={(e) => setDraftPitch(e.target.value.slice(0, 100))}
            maxLength={100}
            placeholder="Why should we watch this?"
            className="w-full h-24 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 py-2 text-sm text-white/90 placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/40"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-[11px] text-white/30">{draftPitch.length}/100</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPitchModalSub(null)} className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 border border-white/[0.08] cursor-pointer">Cancel</button>
              <button type="button" onClick={savePitch} disabled={pitchSaving} className="px-3 py-1.5 rounded-lg text-xs bg-purple-500/80 text-white hover:bg-purple-500 disabled:opacity-50 cursor-pointer">
                {pitchSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
