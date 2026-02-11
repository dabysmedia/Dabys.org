"use client";

import { useEffect, useState, useRef } from "react";

interface Winner {
  id: string;
  weekId: string;
  weekTheme?: string;
  movieTitle: string;
  posterUrl: string;
  letterboxdUrl: string;
  submittedBy: string;
  publishedAt: string;
  year?: string;
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

interface WeekData {
  id: string;
  theme: string;
  startedAt: string;
  endedAt?: string;
}

interface UserData {
  id: string;
  name: string;
}

export default function AdminWinnersPage() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual add form — TMDB autocomplete
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [selectingMovie, setSelectingMovie] = useState(false);
  const [addWeekId, setAddWeekId] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [addWatchedDate, setAddWatchedDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [showCreateWeek, setShowCreateWeek] = useState(false);
  const [newWeekTheme, setNewWeekTheme] = useState("");
  const [newWeekStart, setNewWeekStart] = useState("");
  const [newWeekEnd, setNewWeekEnd] = useState("");
  const [creatingWeek, setCreatingWeek] = useState(false);

  // Edit winner
  const [editingWinner, setEditingWinner] = useState<Winner | null>(null);
  const [editWeekId, setEditWeekId] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editWatchedDate, setEditWatchedDate] = useState("");
  const [editSearchQuery, setEditSearchQuery] = useState("");
  const [editSearchResults, setEditSearchResults] = useState<TmdbSearchResult[]>([]);
  const [editSelectedMovie, setEditSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [editSearchMode, setEditSearchMode] = useState(false);
  const [editShowDropdown, setEditShowDropdown] = useState(false);
  const [editSelectingMovie, setEditSelectingMovie] = useState(false);
  const [editShowCreateWeek, setEditShowCreateWeek] = useState(false);
  const [editNewWeekTheme, setEditNewWeekTheme] = useState("");
  const [editNewWeekStart, setEditNewWeekStart] = useState("");
  const [editNewWeekEnd, setEditNewWeekEnd] = useState("");
  const [editCreatingWeek, setEditCreatingWeek] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editDropdownRef = useRef<HTMLDivElement>(null);
  const editSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const CREATE_WEEK_VALUE = "__new__";

  useEffect(() => {
    loadWinners();
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
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
        setEditShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Edit search debounce
  useEffect(() => {
    if (!editingWinner || !editSearchQuery.trim() || editSearchQuery.trim().length < 2) {
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
      } catch {
        setEditSearchResults([]);
      }
    }, 300);
    return () => { if (editSearchTimeoutRef.current) clearTimeout(editSearchTimeoutRef.current); };
  }, [editingWinner, editSearchQuery]);

  async function loadWinners() {
    try {
      const [winnersRes, weeksRes, usersRes] = await Promise.all([
        fetch("/api/winners"),
        fetch("/api/weeks"),
        fetch("/api/users"),
      ]);
      if (winnersRes.ok) setWinners(await winnersRes.json());
      if (weeksRes.ok) setWeeks(await weeksRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err) {
      console.error("Failed to load winners", err);
    } finally {
      setLoading(false);
    }
  }

  // Build week lookup
  const weekMap: Record<string, WeekData> = {};
  weeks.forEach((w) => { weekMap[w.id] = w; });

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

  async function createPastWeek(isForEdit: boolean) {
    if (!newWeekTheme.trim() && !editNewWeekTheme.trim()) return;
    const theme = isForEdit ? editNewWeekTheme.trim() : newWeekTheme.trim();
    const start = isForEdit ? editNewWeekStart : newWeekStart;
    const end = isForEdit ? editNewWeekEnd : newWeekEnd;

    if (isForEdit) setEditCreatingWeek(true);
    else setCreatingWeek(true);
    try {
      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: true,
          theme,
          phase: "winner_published",
          startedAt: start ? new Date(start).toISOString() : new Date().toISOString(),
          endedAt: end ? new Date(end).toISOString() : new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const newWeek = await res.json();
        await loadWinners();
        if (isForEdit) {
          setEditWeekId(newWeek.id);
          setEditShowCreateWeek(false);
          setEditNewWeekTheme("");
          setEditNewWeekStart("");
          setEditNewWeekEnd("");
        } else {
          setAddWeekId(newWeek.id);
          setShowCreateWeek(false);
          setNewWeekTheme("");
          setNewWeekStart("");
          setNewWeekEnd("");
        }
      }
    } finally {
      if (isForEdit) setEditCreatingWeek(false);
      else setCreatingWeek(false);
    }
  }

  async function handleAddWinner(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMovie) return;
    if (addWeekId === CREATE_WEEK_VALUE) {
      setAddError("Create a new week first, or select an existing week.");
      return;
    }

    setAdding(true);
    setAddError("");
    const chosenUser = users.find((u) => u.id === addUserId);
    try {
      const res = await fetch("/api/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieTitle: selectedMovie.title,
          posterUrl: selectedMovie.posterUrl,
          letterboxdUrl: selectedMovie.letterboxdUrl,
          submittedBy: chosenUser?.name || "",
          weekId: addWeekId || "",
          publishedAt: addWatchedDate ? new Date(addWatchedDate).toISOString() : undefined,
          tmdbId: selectedMovie.tmdbId,
          year: selectedMovie.year,
          overview: selectedMovie.overview,
          trailerUrl: selectedMovie.trailerUrl,
          backdropUrl: selectedMovie.backdropUrl,
          manual: true,
        }),
      });

      if (res.ok) {
        setSelectedMovie(null);
        setSearchQuery("");
        setAddWeekId("");
        setAddUserId("");
        setAddWatchedDate("");
        setShowAddForm(false);
        loadWinners();
      } else {
        const d = await res.json();
        setAddError(d.error || "Failed to add winner");
      }
    } catch {
      setAddError("Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  function openEdit(winner: Winner) {
    setEditingWinner(winner);
    setEditWeekId(winner.weekId || "");
    setEditUserId(users.find((u) => u.name === winner.submittedBy)?.id || "");
    setEditWatchedDate(winner.publishedAt ? winner.publishedAt.slice(0, 10) : "");
    setEditSelectedMovie(null);
    setEditSearchQuery("");
    setEditSearchMode(false);
    setEditShowCreateWeek(false);
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
        setEditSearchMode(false);
      }
    } catch {
      console.error("Failed to fetch movie details");
    } finally {
      setEditSelectingMovie(false);
    }
  }

  async function handleDeleteWinner(winner: Winner) {
    if (!confirm(`Delete winner "${winner.movieTitle}" (${winner.year || ""})? This will also remove all ratings and comments for this winner.`)) return;
    setDeletingId(winner.id);
    try {
      const res = await fetch(`/api/winners/${winner.id}`, { method: "DELETE" });
      if (res.ok) await loadWinners();
    } catch {
      console.error("Failed to delete winner");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEditWinner(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWinner) return;
    if (editWeekId === CREATE_WEEK_VALUE) {
      setEditError("Create a new week first, or select an existing week.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    const chosenUser = users.find((u) => u.id === editUserId);
    try {
      const payload: Record<string, unknown> = {
        weekId: editWeekId || "",
        submittedBy: chosenUser?.name || "",
        publishedAt: editWatchedDate ? new Date(editWatchedDate).toISOString() : editingWinner.publishedAt,
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

      const res = await fetch(`/api/winners/${editingWinner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingWinner(null);
        loadWinners();
      } else {
        const d = await res.json();
        setEditError(d.error || "Failed to update winner");
      }
    } catch {
      setEditError("Something went wrong");
    } finally {
      setSavingEdit(false);
    }
  }

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
        <h1 className="text-2xl font-bold text-white/90">Winners</h1>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setSelectedMovie(null); setSearchQuery(""); }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer"
        >
          {showAddForm ? "Cancel" : "+ Add Movie Manually"}
        </button>
      </div>

      {/* Manual add form — TMDB autocomplete */}
      {showAddForm && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
            Add to Past Winners
          </h2>

          {!selectedMovie ? (
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
            <form onSubmit={handleAddWinner} className="space-y-4">
              {/* Movie preview */}
              <div className="flex gap-4 items-start">
                {selectedMovie.posterUrl && (
                  <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="w-20 h-28 rounded-xl object-cover flex-shrink-0 border border-white/[0.08] shadow-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-white/90 truncate">{selectedMovie.title}</h4>
                  <p className="text-sm text-white/40 mt-0.5">{selectedMovie.year}</p>
                  {selectedMovie.overview && (
                    <p className="text-xs text-white/30 mt-1 line-clamp-2">{selectedMovie.overview}</p>
                  )}
                  <button type="button" onClick={() => setSelectedMovie(null)} className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer mt-2">
                    Change movie
                  </button>
                </div>
              </div>

              {/* Week + User + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
                  <select
                    value={addWeekId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddWeekId(v);
                      setShowCreateWeek(v === CREATE_WEEK_VALUE);
                    }}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#1a1a2e]">Select week...</option>
                    <option value={CREATE_WEEK_VALUE} className="bg-[#1a1a2e]">+ Create new past week...</option>
                    {weeks.map((w) => (
                      <option key={w.id} value={w.id} className="bg-[#1a1a2e]">
                        #{w.id} — {w.theme}
                      </option>
                    ))}
                  </select>
                </div>
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
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Watched Date</label>
                  <input
                    type="date"
                    value={addWatchedDate}
                    onChange={(e) => setAddWatchedDate(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Create new past week — full width so date inputs don't truncate */}
              {showCreateWeek && (
                <div className="mt-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                  <p className="text-xs text-white/50">Create a new past week, then add the winner below.</p>
                  <input
                    type="text"
                    value={newWeekTheme}
                    onChange={(e) => setNewWeekTheme(e.target.value)}
                    placeholder="Theme name"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">Start date</label>
                      <input
                        type="date"
                        value={newWeekStart}
                        onChange={(e) => setNewWeekStart(e.target.value)}
                        className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">End date</label>
                      <input
                        type="date"
                        value={newWeekEnd}
                        onChange={(e) => setNewWeekEnd(e.target.value)}
                        className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => createPastWeek(false)}
                    disabled={!newWeekTheme.trim() || creatingWeek}
                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-40 text-sm font-medium"
                  >
                    {creatingWeek ? "Creating..." : "Create & Select"}
                  </button>
                </div>
              )}

              {/* Skip note */}
              {addUserId && (
                <p className="text-[11px] text-cyan-400/50 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  {users.find((u) => u.id === addUserId)?.name || "User"} will earn a skip for this win
                </p>
              )}

              {addError && <p className="text-red-400/80 text-xs">{addError}</p>}

              <button
                type="submit"
                disabled={adding || !selectedMovie}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {adding ? "Adding..." : "Add Winner"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Edit winner modal */}
      {editingWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingWinner(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white/90">Edit Winner</h2>
              <button onClick={() => setEditingWinner(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditWinner} className="p-6 space-y-4">
              {/* Movie: current or changed */}
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Movie</label>
                {!editSearchMode ? (
                  <div className="flex gap-4 items-start">
                    {(editSelectedMovie ? editSelectedMovie.posterUrl : editingWinner.posterUrl) ? (
                      <img
                        src={editSelectedMovie?.posterUrl || editingWinner.posterUrl}
                        alt={editSelectedMovie?.title ?? editingWinner.movieTitle}
                        className="w-16 h-24 rounded-lg object-cover flex-shrink-0 border border-white/[0.08]"
                      />
                    ) : (
                      <div className="w-16 h-24 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white/20 text-lg font-bold">
                        {(editSelectedMovie?.title || editingWinner.movieTitle).charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80">
                        {editSelectedMovie?.title || editingWinner.movieTitle}
                        {(editSelectedMovie?.year || editingWinner.year) && (
                          <span className="text-white/30 ml-1">({editSelectedMovie?.year || editingWinner.year})</span>
                        )}
                      </p>
                      <button type="button" onClick={() => setEditSearchMode(true)} className="text-xs text-white/30 hover:text-white/60 cursor-pointer mt-1">
                        Change movie
                      </button>
                    </div>
                  </div>
                ) : (
                  <div ref={editDropdownRef} className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        onFocus={() => { if (editSearchResults.length > 0) setEditShowDropdown(true); }}
                        placeholder="Search for a movie to replace..."
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40"
                        autoComplete="off"
                      />
                      <button type="button" onClick={() => { setEditSearchMode(false); setEditSearchQuery(""); }} className="text-xs px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 cursor-pointer shrink-0">
                        Cancel
                      </button>
                    </div>
                    {editSelectingMovie && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                    )}
                    {editShowDropdown && editSearchResults.length > 0 && (
                      <div className="scrollbar-autocomplete absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl">
                        {editSearchResults.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectTmdbMovieForEdit(r.id)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left cursor-pointer"
                          >
                            {r.posterUrl ? (
                              <img src={r.posterUrl} alt={r.title} className="w-8 h-12 rounded object-cover flex-shrink-0 bg-white/5" />
                            ) : (
                              <div className="w-8 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/10 text-sm font-bold">{r.title.charAt(0)}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/80 truncate">{r.title}</p>
                              <p className="text-xs text-white/30">{r.year || "Unknown year"}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Week + User + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
                  <select
                    value={editWeekId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEditWeekId(v);
                      setEditShowCreateWeek(v === CREATE_WEEK_VALUE);
                    }}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#1a1a2e]">Select week...</option>
                    <option value={CREATE_WEEK_VALUE} className="bg-[#1a1a2e]">+ Create new past week...</option>
                    {weeks.map((w) => (
                      <option key={w.id} value={w.id} className="bg-[#1a1a2e]">
                        #{w.id} — {w.theme}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
                  <select
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#1a1a2e]">Select user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Watched Date</label>
                  <input
                    type="date"
                    value={editWatchedDate}
                    onChange={(e) => setEditWatchedDate(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              {editShowCreateWeek && (
                <div className="mt-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                  <p className="text-xs text-white/50">Create a new past week for this winner.</p>
                  <input
                    type="text"
                    value={editNewWeekTheme}
                    onChange={(e) => setEditNewWeekTheme(e.target.value)}
                    placeholder="Theme name"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">Start date</label>
                      <input
                        type="date"
                        value={editNewWeekStart}
                        onChange={(e) => setEditNewWeekStart(e.target.value)}
                        className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">End date</label>
                      <input
                        type="date"
                        value={editNewWeekEnd}
                        onChange={(e) => setEditNewWeekEnd(e.target.value)}
                        className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => createPastWeek(true)}
                    disabled={!editNewWeekTheme.trim() || editCreatingWeek}
                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-40 text-sm font-medium"
                  >
                    {editCreatingWeek ? "Creating..." : "Create & Select"}
                  </button>
                </div>
              )}

              {editError && <p className="text-red-400/80 text-xs">{editError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWinner(null)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Winners list */}
      {winners.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <p className="text-white/40">No winners yet. Publish one from the Week & Phases panel, or add manually above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
              All Winners ({winners.length})
            </h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {winners.map((winner) => {
              const week = winner.weekId ? weekMap[winner.weekId] : null;
              return (
                <div
                  key={winner.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  {winner.posterUrl ? (
                    <img
                      src={winner.posterUrl}
                      alt={winner.movieTitle}
                      className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-white/15 text-lg font-bold">{winner.movieTitle.charAt(0)}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {winner.movieTitle}
                      {winner.year && <span className="text-white/30 ml-1">({winner.year})</span>}
                    </p>
                    <p className="text-[11px] text-white/30">
                      {winner.submittedBy && <>by <span className="text-white/50">{winner.submittedBy}</span> &middot; </>}
                      {week ? (
                        <>
                          Theme: <span className="text-purple-400/70">{week.theme}</span> &middot;{" "}
                        </>
                      ) : winner.weekId ? (
                        <>Week #{winner.weekId} &middot; </>
                      ) : (
                        <>Manual add &middot; </>
                      )}
                      Watched {new Date(winner.publishedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(winner)}
                      disabled={!!deletingId}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteWinner(winner)}
                      disabled={deletingId === winner.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400/70 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete this winner"
                    >
                      {deletingId === winner.id ? "Deleting..." : "Delete"}
                    </button>
                    {winner.letterboxdUrl && (
                      <a
                        href={winner.letterboxdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400/60 hover:text-purple-400 transition-colors cursor-pointer"
                        onClick={(e) => { e.preventDefault(); window.open(winner.letterboxdUrl, "_blank", "noopener,noreferrer"); }}
                      >
                        Letterboxd
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
