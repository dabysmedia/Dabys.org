"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Submission {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  year?: string;
  createdAt: string;
  tmdbId?: number;
  overview?: string;
  trailerUrl?: string;
  backdropUrl?: string;
}

interface WeekData {
  id: string;
  theme: string;
  phase: string;
  startedAt: string;
  endedAt?: string;
}

interface UserData {
  id: string;
  name: string;
}

interface TmdbSearchResult {
  id: number;
  title: string;
  year: string;
  posterUrl: string;
  overview: string;
}

interface TmdbMovieDetail {
  tmdbId: number;
  title: string;
  year: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl: string;
  letterboxdUrl: string;
}

export default function AdminSubmissionsPage() {
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // Manual add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addWeekId, setAddWeekId] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [selectingMovie, setSelectingMovie] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Edit submission
  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [editWeekId, setEditWeekId] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [editSearchResults, setEditSearchResults] = useState<TmdbSearchResult[]>([]);
  const [editSelectedMovie, setEditSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [editShowDropdown, setEditShowDropdown] = useState(false);
  const [editSelectingMovie, setEditSelectingMovie] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editShowSearch, setEditShowSearch] = useState(false);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const editSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remove submission
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // TMDB search debounce
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
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) setEditShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Edit form: TMDB search debounce
  useEffect(() => {
    if (!editingSub || !editSearchQuery.trim() || editSearchQuery.trim().length < 2) {
      setEditSearchResults([]);
      setEditShowDropdown(false);
      return;
    }
    if (editSearchTimeoutRef.current) clearTimeout(editSearchTimeoutRef.current);
    editSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(editSearchQuery.trim())}`);
        const data = await res.json();
        setEditSearchResults(data.results || []);
        setEditShowDropdown(true);
      } catch { setEditSearchResults([]); }
    }, 300);
    return () => { if (editSearchTimeoutRef.current) clearTimeout(editSearchTimeoutRef.current); };
  }, [editingSub, editSearchQuery]);

  async function loadData() {
    try {
      const [weekRes, allWeeksRes, subsRes, usersRes] = await Promise.all([
        fetch("/api/weeks/current"),
        fetch("/api/weeks"),
        fetch("/api/submissions"),
        fetch("/api/users"),
      ]);

      if (allWeeksRes.ok) {
        const weeksData: WeekData[] = await allWeeksRes.json();
        setWeeks(weeksData);
      }

      if (weekRes.ok) {
        const weekData: WeekData = await weekRes.json();
        setCurrentWeek(weekData);
      }

      if (subsRes.ok) {
        const subsData: Submission[] = await subsRes.json();
        setAllSubmissions(subsData);
      }

      if (usersRes.ok) {
        const usersData: UserData[] = await usersRes.json();
        setUsers(usersData);
      }
    } catch (err) {
      console.error("Failed to load submissions", err);
    } finally {
      setLoading(false);
    }
  }

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
    } catch { /* ignore */ }
    finally { setSelectingMovie(false); }
  }

  async function handleManualAdd() {
    if (!addWeekId || !addUserId || !selectedMovie) return;
    setSubmitting(true);
    setAddError("");
    const chosenUser = users.find((u) => u.id === addUserId);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: true,
          weekId: addWeekId,
          userId: addUserId,
          userName: chosenUser?.name || "Unknown",
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
      if (!res.ok) {
        const d = await res.json();
        setAddError(d.error || "Failed");
      } else {
        setSelectedMovie(null);
        setAddWeekId("");
        setAddUserId("");
        setShowAddForm(false);
        loadData();
      }
    } catch { setAddError("Something went wrong"); }
    finally { setSubmitting(false); }
  }

  function openEdit(sub: Submission) {
    setEditingSub(sub);
    setEditWeekId(sub.weekId);
    setEditUserId(sub.userId);
    setEditSearchQuery("");
    setEditSelectedMovie(null);
    setEditShowSearch(false);
    setEditError("");
  }

  async function selectTmdbMovieForEdit(tmdbId: number) {
    setEditSelectingMovie(true);
    setEditShowDropdown(false);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (res.ok) {
        const detail: TmdbMovieDetail = await res.json();
        setEditSelectedMovie(detail);
        setEditSearchQuery("");
        setEditSearchResults([]);
        setEditShowSearch(false);
      }
    } catch { /* ignore */ }
    finally { setEditSelectingMovie(false); }
  }

  async function handleEditSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSub) return;
    setSavingEdit(true);
    setEditError("");
    const chosenUser = users.find((u) => u.id === editUserId);
    try {
      const payload: Record<string, unknown> = {
        weekId: editWeekId,
        userId: editUserId,
        userName: chosenUser?.name ?? editingSub.userName,
        movieTitle: editingSub.movieTitle,
        posterUrl: editingSub.posterUrl,
        letterboxdUrl: editingSub.letterboxdUrl,
        year: editingSub.year,
        overview: editingSub.overview,
        trailerUrl: editingSub.trailerUrl,
        backdropUrl: editingSub.backdropUrl,
        tmdbId: editingSub.tmdbId,
        createdAt: editingSub.createdAt,
      };
      if (editSelectedMovie) {
        payload.movieTitle = editSelectedMovie.title;
        payload.posterUrl = editSelectedMovie.posterUrl;
        payload.letterboxdUrl = editSelectedMovie.letterboxdUrl;
        payload.year = editSelectedMovie.year;
        payload.overview = editSelectedMovie.overview;
        payload.trailerUrl = editSelectedMovie.trailerUrl;
        payload.backdropUrl = editSelectedMovie.backdropUrl;
        payload.tmdbId = editSelectedMovie.tmdbId;
      }
      const res = await fetch(`/api/submissions/${editingSub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingSub(null);
        loadData();
      } else {
        const d = await res.json();
        setEditError(d.error || "Failed to update");
      }
    } catch { setEditError("Something went wrong"); }
    finally { setSavingEdit(false); }
  }

  async function handleRemoveSubmission(sub: Submission) {
    if (!confirm(`Remove "${sub.movieTitle}" by ${sub.userName}?`)) return;
    setRemovingId(sub.id);
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, { method: "DELETE" });
      if (res.ok) loadData();
    } finally { setRemovingId(null); }
  }

  function toggleWeek(weekId: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  }

  // Build a map of weekId → theme
  const weekMap: Record<string, WeekData> = {};
  weeks.forEach((w) => { weekMap[w.id] = w; });

  // Current week's submissions
  const currentSubs = currentWeek
    ? allSubmissions.filter((s) => s.weekId === currentWeek.id)
    : [];

  // Past weeks (ended, sorted most recent first)
  const pastWeeks = weeks
    .filter((w) => w.endedAt)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white/90">Submissions</h1>
        <div className="flex items-center gap-3">
          {currentWeek && (
            <span className="text-sm text-white/40">
              Theme: <span className="text-white/60">{currentWeek.theme}</span>
            </span>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all cursor-pointer"
          >
            {showAddForm ? "Cancel" : "+ Add Past Submission"}
          </button>
        </div>
      </div>

      {/* ═══ MANUAL ADD FORM ═══ */}
      {showAddForm && (
        <div className="rounded-xl border border-purple-500/15 bg-white/[0.03] p-6 mb-8">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
            Add Past Submission
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Week picker */}
            <div>
              <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
              <select
                value={addWeekId}
                onChange={(e) => setAddWeekId(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
              >
                <option value="" className="bg-[#1a1a2e]">Select week...</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#1a1a2e]">
                    #{w.id} — {w.theme} {w.endedAt ? "(ended)" : "(active)"}
                  </option>
                ))}
              </select>
            </div>
            {/* User picker */}
            <div>
              <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
              >
                <option value="" className="bg-[#1a1a2e]">Select user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#1a1a2e]">
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Movie search */}
          <div className="mb-4">
            <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Movie</label>
            {!selectedMovie ? (
              <div ref={dropdownRef} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a movie..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40 transition-colors"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                )}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl max-h-60 overflow-y-auto scrollbar-autocomplete">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => selectTmdbMovie(r.id)}
                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
                      >
                        {r.posterUrl ? (
                          <img src={r.posterUrl} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-12 rounded bg-white/5 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-white/80 truncate">{r.title}</p>
                          <p className="text-[11px] text-white/30">{r.year}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                {selectedMovie.posterUrl && (
                  <img src={selectedMovie.posterUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{selectedMovie.title}</p>
                  <p className="text-[11px] text-white/30">{selectedMovie.year}</p>
                </div>
                <button
                  onClick={() => setSelectedMovie(null)}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}
            {selectingMovie && <p className="text-xs text-white/30 mt-1">Loading movie details...</p>}
          </div>

          {addError && <p className="text-red-400/80 text-xs mb-3">{addError}</p>}

          <button
            onClick={handleManualAdd}
            disabled={!addWeekId || !addUserId || !selectedMovie || submitting}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Adding..." : "Add Submission"}
          </button>
        </div>
      )}

      {/* ═══ CURRENT WEEK ═══ */}
      {!currentWeek ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <p className="text-white/40">No active week. Start one in Week & Phases.</p>
        </div>
      ) : currentSubs.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <p className="text-white/40">No submissions yet for this week.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
              This Week&apos;s Submissions ({currentSubs.length})
            </h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {currentSubs.map((sub) => (
              <SubmissionRow
                key={sub.id}
                sub={sub}
                onEdit={() => openEdit(sub)}
                onRemove={() => handleRemoveSubmission(sub)}
                removing={removingId === sub.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══ PAST WEEKS ═══ */}
      {pastWeeks.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <h2 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Past Weeks</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="space-y-3">
            {pastWeeks.map((week) => {
              const weekSubs = allSubmissions.filter((s) => s.weekId === week.id);
              const isExpanded = expandedWeeks.has(week.id);
              const startDate = new Date(week.startedAt).toLocaleDateString();
              const endDate = week.endedAt ? new Date(week.endedAt).toLocaleDateString() : "";

              return (
                <div key={week.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                  <button
                    onClick={() => toggleWeek(week.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400/70">#{week.id}</span>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">
                          {week.theme}
                        </p>
                        <p className="text-[11px] text-white/30">
                          {startDate}{endDate && ` — ${endDate}`} &middot; {weekSubs.length} submission{weekSubs.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-white/20 transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.06]">
                      {weekSubs.length === 0 ? (
                        <div className="px-6 py-6 text-center">
                          <p className="text-white/25 text-sm">No submissions this week.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04]">
                          {weekSubs.map((sub) => (
                            <SubmissionRow
                              key={sub.id}
                              sub={sub}
                              onEdit={() => openEdit(sub)}
                              onRemove={() => handleRemoveSubmission(sub)}
                              removing={removingId === sub.id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit submission modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingSub(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white/90">Edit Submission</h2>
              <button onClick={() => setEditingSub(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmission} className="p-6 space-y-4">
              {/* Movie: current or changed via TMDB */}
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Movie</label>
                {!editShowSearch && !editSelectedMovie ? (
                  <div className="flex gap-3 items-start p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    {editingSub.posterUrl ? (
                      <img src={editingSub.posterUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/20 text-lg font-bold">{editingSub.movieTitle.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{editingSub.movieTitle}{editingSub.year && ` (${editingSub.year})`}</p>
                      <button type="button" onClick={() => setEditShowSearch(true)} className="text-xs text-white/30 hover:text-white/60 cursor-pointer mt-1">Change movie</button>
                    </div>
                  </div>
                ) : editSelectedMovie ? (
                  <div className="flex gap-3 items-start p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    {editSelectedMovie.posterUrl ? (
                      <img src={editSelectedMovie.posterUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/20 text-lg font-bold">{editSelectedMovie.title.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{editSelectedMovie.title} ({editSelectedMovie.year})</p>
                      <button type="button" onClick={() => setEditSelectedMovie(null)} className="text-xs text-white/30 hover:text-white/60 cursor-pointer mt-1">Use original</button>
                    </div>
                  </div>
                ) : null}
                {editShowSearch && (
                  <div ref={editDropdownRef} className="relative mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        onFocus={() => { if (editSearchResults.length > 0) setEditShowDropdown(true); }}
                        placeholder="Search to change movie..."
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40"
                      />
                      <button type="button" onClick={() => { setEditShowSearch(false); setEditSearchQuery(""); }} className="text-xs px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 cursor-pointer shrink-0">Cancel</button>
                    </div>
                    {editSelectingMovie && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                    )}
                    {editShowDropdown && editSearchResults.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl max-h-48 overflow-y-auto scrollbar-autocomplete">
                        {editSearchResults.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectTmdbMovieForEdit(r.id)}
                            className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
                          >
                            {r.posterUrl ? <img src={r.posterUrl} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-12 rounded bg-white/5 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm text-white/80 truncate">{r.title}</p>
                              <p className="text-[11px] text-white/30">{r.year}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
                  <select
                    value={editWeekId}
                    onChange={(e) => setEditWeekId(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
                  >
                    {weeks.map((w) => (
                      <option key={w.id} value={w.id} className="bg-[#1a1a2e]">#{w.id} — {w.theme}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
                  <select
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 appearance-none cursor-pointer"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editError && <p className="text-red-400/80 text-xs">{editError}</p>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingSub(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingEdit} className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable submission row ── */
function SubmissionRow({
  sub,
  onEdit,
  onRemove,
  removing,
}: {
  sub: { id: string; movieTitle: string; year?: string; posterUrl: string; userName: string; letterboxdUrl: string; createdAt: string };
  onEdit: () => void;
  onRemove: () => void;
  removing?: boolean;
}) {
  return (
    <div className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
      {sub.posterUrl ? (
        <img
          src={sub.posterUrl}
          alt={sub.movieTitle}
          className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
          <span className="text-white/15 text-lg font-bold">{sub.movieTitle.charAt(0)}</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate">
          {sub.movieTitle}
          {sub.year && <span className="text-white/30 ml-1">({sub.year})</span>}
        </p>
        <p className="text-[11px] text-white/30">
          Submitted by <span className="text-white/50">{sub.userName}</span> &middot;{" "}
          {new Date(sub.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors cursor-pointer"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          {removing ? "…" : "Remove"}
        </button>
        {sub.letterboxdUrl && (
          <a
            href={sub.letterboxdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400/60 hover:text-purple-400 transition-colors cursor-pointer"
            onClick={(e) => { e.preventDefault(); window.open(sub.letterboxdUrl, "_blank", "noopener,noreferrer"); }}
          >
            Letterboxd
          </a>
        )}
      </div>
    </div>
  );
}
