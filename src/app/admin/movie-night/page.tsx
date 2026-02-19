"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";

/* ─── Consolidated interfaces ─────────────────────────────────────── */

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

interface VoteData {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  submissionId: string;
  createdAt: string;
}

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
  screeningAt?: string;
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
  runtime?: number;
}

interface WheelData {
  entries: string[];
  lastResult: string | null;
  lastSpunAt: string | null;
  lastConfirmedResult?: string | null;
  lastConfirmedAt?: string | null;
}

interface WheelHistoryEntry {
  theme: string;
  confirmedAt: string;
}

/* ─── Constants ───────────────────────────────────────────────────── */

const PHASES = [
  { key: "subs_open", label: "Submissions Open", desc: "Members can submit movies", color: "border-green-500/30 bg-green-500/10 text-green-400", dot: "bg-green-400" },
  { key: "subs_closed", label: "Submissions Closed", desc: "No more submissions", color: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400" },
  { key: "vote_open", label: "Voting Open", desc: "Members can vote", color: "border-blue-500/30 bg-blue-500/10 text-blue-400", dot: "bg-blue-400" },
  { key: "vote_closed", label: "Voting Closed", desc: "No more votes, pick winner", color: "border-orange-500/30 bg-orange-500/10 text-orange-400", dot: "bg-orange-400" },
  { key: "winner_published", label: "Winner Published", desc: "Winner shown on main page", color: "border-purple-500/30 bg-purple-500/10 text-purple-400", dot: "bg-purple-400" },
];

const TABS = [
  { key: "weeks", label: "Weeks & Phases", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  { key: "submissions", label: "Submissions", icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125M3.375 19.5c-.621 0-1.125-.504-1.125-1.125M13.5 3.375c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-5.25z" },
  { key: "votes", label: "Votes", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "winners", label: "Winners", icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172" },
  { key: "wheel", label: "Theme Wheel", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CREATE_WEEK_VALUE = "__new__";

/* ─── Main component ──────────────────────────────────────────────── */

export default function MovieNightPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("weeks");

  /* ── Shared data ── */
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [allWeeks, setAllWeeks] = useState<WeekData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [allVotes, setAllVotes] = useState<VoteData[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Weeks state ── */
  const [theme, setTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddPast, setShowAddPast] = useState(false);
  const [pastTheme, setPastTheme] = useState("");
  const [pastStartDate, setPastStartDate] = useState("");
  const [pastEndDate, setPastEndDate] = useState("");
  const [addingPast, setAddingPast] = useState(false);
  const [restoringWeekId, setRestoringWeekId] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<{ id: string; theme: string } | null>(null);
  const [deletingWeekId, setDeletingWeekId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; theme: string } | null>(null);
  const [tiedSubmissions, setTiedSubmissions] = useState<
    { id: string; movieTitle: string; userName: string; posterUrl: string }[] | null
  >(null);
  const [resolvingTie, setResolvingTie] = useState(false);

  /* ── Submissions state ── */
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [showSubAddForm, setShowSubAddForm] = useState(false);
  const [subAddWeekId, setSubAddWeekId] = useState("");
  const [subAddUserId, setSubAddUserId] = useState("");
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subSearchResults, setSubSearchResults] = useState<TmdbSearchResult[]>([]);
  const [subSearchLoading, setSubSearchLoading] = useState(false);
  const [subShowDropdown, setSubShowDropdown] = useState(false);
  const [subSelectedMovie, setSubSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [subSelectingMovie, setSubSelectingMovie] = useState(false);
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subAddError, setSubAddError] = useState("");
  const subSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subDropdownRef = useRef<HTMLDivElement>(null);
  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [editSubWeekId, setEditSubWeekId] = useState("");
  const [editSubUserId, setEditSubUserId] = useState("");
  const [editSubSearchQuery, setEditSubSearchQuery] = useState("");
  const [editSubSearchResults, setEditSubSearchResults] = useState<TmdbSearchResult[]>([]);
  const [editSubSelectedMovie, setEditSubSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [editSubShowDropdown, setEditSubShowDropdown] = useState(false);
  const [editSubSelectingMovie, setEditSubSelectingMovie] = useState(false);
  const [savingSubEdit, setSavingSubEdit] = useState(false);
  const [editSubError, setEditSubError] = useState("");
  const [editSubShowSearch, setEditSubShowSearch] = useState(false);
  const editSubDropdownRef = useRef<HTMLDivElement>(null);
  const editSubSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [removingSubId, setRemovingSubId] = useState<string | null>(null);

  /* ── Votes state ── */
  const [voteFilterWeekId, setVoteFilterWeekId] = useState<string>("");

  /* ── Winners state ── */
  const [showWinnerAddForm, setShowWinnerAddForm] = useState(false);
  const [winnerSearchQuery, setWinnerSearchQuery] = useState("");
  const [winnerSearchResults, setWinnerSearchResults] = useState<TmdbSearchResult[]>([]);
  const [winnerSearchLoading, setWinnerSearchLoading] = useState(false);
  const [winnerShowDropdown, setWinnerShowDropdown] = useState(false);
  const [winnerSelectedMovie, setWinnerSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [winnerSelectingMovie, setWinnerSelectingMovie] = useState(false);
  const [winnerAddWeekId, setWinnerAddWeekId] = useState("");
  const [winnerAddUserId, setWinnerAddUserId] = useState("");
  const [winnerAddWatchedDate, setWinnerAddWatchedDate] = useState("");
  const [winnerAddScreeningAt, setWinnerAddScreeningAt] = useState("");
  const [addingWinner, setAddingWinner] = useState(false);
  const [winnerAddError, setWinnerAddError] = useState("");
  const [showWinnerCreateWeek, setShowWinnerCreateWeek] = useState(false);
  const [winnerNewWeekTheme, setWinnerNewWeekTheme] = useState("");
  const [winnerNewWeekStart, setWinnerNewWeekStart] = useState("");
  const [winnerNewWeekEnd, setWinnerNewWeekEnd] = useState("");
  const [winnerCreatingWeek, setWinnerCreatingWeek] = useState(false);
  const [editingWinner, setEditingWinner] = useState<Winner | null>(null);
  const [editWinnerWeekId, setEditWinnerWeekId] = useState("");
  const [editWinnerUserId, setEditWinnerUserId] = useState("");
  const [editWinnerWatchedDate, setEditWinnerWatchedDate] = useState("");
  const [editWinnerScreeningAt, setEditWinnerScreeningAt] = useState("");
  const [editWinnerSearchQuery, setEditWinnerSearchQuery] = useState("");
  const [editWinnerSearchResults, setEditWinnerSearchResults] = useState<TmdbSearchResult[]>([]);
  const [editWinnerSelectedMovie, setEditWinnerSelectedMovie] = useState<TmdbMovieDetail | null>(null);
  const [editWinnerSearchMode, setEditWinnerSearchMode] = useState(false);
  const [editWinnerShowDropdown, setEditWinnerShowDropdown] = useState(false);
  const [editWinnerSelectingMovie, setEditWinnerSelectingMovie] = useState(false);
  const [editWinnerShowCreateWeek, setEditWinnerShowCreateWeek] = useState(false);
  const [editWinnerNewWeekTheme, setEditWinnerNewWeekTheme] = useState("");
  const [editWinnerNewWeekStart, setEditWinnerNewWeekStart] = useState("");
  const [editWinnerNewWeekEnd, setEditWinnerNewWeekEnd] = useState("");
  const [editWinnerCreatingWeek, setEditWinnerCreatingWeek] = useState(false);
  const [savingWinnerEdit, setSavingWinnerEdit] = useState(false);
  const [editWinnerError, setEditWinnerError] = useState("");
  const [deletingWinnerId, setDeletingWinnerId] = useState<string | null>(null);
  const [draggingWinnerId, setDraggingWinnerId] = useState<string | null>(null);
  const [reorderingWinners, setReorderingWinners] = useState(false);
  const [weeksTabScreeningAt, setWeeksTabScreeningAt] = useState("");
  const [weeksTabScreeningSaving, setWeeksTabScreeningSaving] = useState(false);
  const winnerSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winnerDropdownRef = useRef<HTMLDivElement>(null);
  const editWinnerDropdownRef = useRef<HTMLDivElement>(null);
  const editWinnerSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Wheel state ── */
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [wheelEntries, setWheelEntries] = useState<string[]>([]);
  const [wheelNewEntry, setWheelNewEntry] = useState("");
  const [wheelSaving, setWheelSaving] = useState(false);
  const [wheelError, setWheelError] = useState("");
  const [wheelSuccess, setWheelSuccess] = useState("");
  const [manualResult, setManualResult] = useState("");
  const [settingResult, setSettingResult] = useState(false);
  const [wheelShowView, setWheelShowView] = useState<"current" | "previous">("current");
  const [wheelHistory, setWheelHistory] = useState<WheelHistoryEntry[]>([]);

  /* ─── Data loading ──────────────────────────────────────────────── */

  const loadAllData = useCallback(async () => {
    try {
      const [currentRes, allRes, usersRes, subsRes, votesRes, winnersRes, wheelRes] = await Promise.all([
        fetch("/api/weeks/current"),
        fetch("/api/weeks"),
        fetch("/api/users"),
        fetch("/api/submissions"),
        fetch("/api/votes"),
        fetch("/api/winners"),
        fetch("/api/wheel"),
      ]);

      if (currentRes.ok) {
        const data = await currentRes.json();
        setCurrentWeek(data);
        setTheme(data.theme);
      } else {
        setCurrentWeek(null);
      }

      if (allRes.ok) setAllWeeks(await allRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (subsRes.ok) setAllSubmissions(await subsRes.json());
      if (votesRes.ok) setAllVotes(await votesRes.json());
      if (winnersRes.ok) setWinners(await winnersRes.json());
      if (wheelRes.ok) {
        const wData: WheelData = await wheelRes.json();
        setWheel(wData);
        setWheelEntries([...wData.entries]);
      }
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  /* ── Sync Weeks tab screening from current week winner ── */
  const currentWeekWinner = useMemo(
    () => (currentWeek && currentWeek.phase === "winner_published" ? winners.find((w) => w.weekId === currentWeek.id) : null),
    [currentWeek, winners]
  );
  useEffect(() => {
    if (currentWeekWinner) {
      const val = currentWeekWinner.screeningAt
        ? (() => {
            const d = new Date(currentWeekWinner.screeningAt!);
            const pad = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          })()
        : "";
      setWeeksTabScreeningAt(val);
    } else {
      setWeeksTabScreeningAt("");
    }
  }, [currentWeekWinner?.id, currentWeekWinner?.screeningAt]);

  /* ── TMDB search: submissions add ── */
  useEffect(() => {
    if (!subSearchQuery.trim() || subSearchQuery.trim().length < 2) {
      setSubSearchResults([]);
      setSubShowDropdown(false);
      return;
    }
    if (subSearchTimeoutRef.current) clearTimeout(subSearchTimeoutRef.current);
    subSearchTimeoutRef.current = setTimeout(async () => {
      setSubSearchLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(subSearchQuery.trim())}`);
        const data = await res.json();
        setSubSearchResults(data.results || []);
        setSubShowDropdown(true);
      } catch { setSubSearchResults([]); }
      finally { setSubSearchLoading(false); }
    }, 300);
    return () => { if (subSearchTimeoutRef.current) clearTimeout(subSearchTimeoutRef.current); };
  }, [subSearchQuery]);

  /* ── TMDB search: submissions edit ── */
  useEffect(() => {
    if (!editingSub || !editSubSearchQuery.trim() || editSubSearchQuery.trim().length < 2) {
      setEditSubSearchResults([]);
      setEditSubShowDropdown(false);
      return;
    }
    if (editSubSearchTimeoutRef.current) clearTimeout(editSubSearchTimeoutRef.current);
    editSubSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(editSubSearchQuery.trim())}`);
        const data = await res.json();
        setEditSubSearchResults(data.results || []);
        setEditSubShowDropdown(true);
      } catch { setEditSubSearchResults([]); }
    }, 300);
    return () => { if (editSubSearchTimeoutRef.current) clearTimeout(editSubSearchTimeoutRef.current); };
  }, [editingSub, editSubSearchQuery]);

  /* ── TMDB search: winners add ── */
  useEffect(() => {
    if (!winnerSearchQuery.trim() || winnerSearchQuery.trim().length < 2) {
      setWinnerSearchResults([]);
      setWinnerShowDropdown(false);
      return;
    }
    if (winnerSearchTimeoutRef.current) clearTimeout(winnerSearchTimeoutRef.current);
    winnerSearchTimeoutRef.current = setTimeout(async () => {
      setWinnerSearchLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(winnerSearchQuery.trim())}`);
        const data = await res.json();
        setWinnerSearchResults(data.results || []);
        setWinnerShowDropdown(true);
      } catch { setWinnerSearchResults([]); }
      finally { setWinnerSearchLoading(false); }
    }, 300);
    return () => { if (winnerSearchTimeoutRef.current) clearTimeout(winnerSearchTimeoutRef.current); };
  }, [winnerSearchQuery]);

  /* ── TMDB search: winners edit ── */
  useEffect(() => {
    if (!editingWinner || !editWinnerSearchQuery.trim() || editWinnerSearchQuery.trim().length < 2) {
      setEditWinnerSearchResults([]);
      setEditWinnerShowDropdown(false);
      return;
    }
    if (editWinnerSearchTimeoutRef.current) clearTimeout(editWinnerSearchTimeoutRef.current);
    editWinnerSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(editWinnerSearchQuery.trim())}`);
        const data = await res.json();
        setEditWinnerSearchResults(data.results || []);
        setEditWinnerShowDropdown(true);
      } catch { setEditWinnerSearchResults([]); }
    }, 300);
    return () => { if (editWinnerSearchTimeoutRef.current) clearTimeout(editWinnerSearchTimeoutRef.current); };
  }, [editingWinner, editWinnerSearchQuery]);

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (subDropdownRef.current && !subDropdownRef.current.contains(e.target as Node)) setSubShowDropdown(false);
      if (editSubDropdownRef.current && !editSubDropdownRef.current.contains(e.target as Node)) setEditSubShowDropdown(false);
      if (winnerDropdownRef.current && !winnerDropdownRef.current.contains(e.target as Node)) setWinnerShowDropdown(false);
      if (editWinnerDropdownRef.current && !editWinnerDropdownRef.current.contains(e.target as Node)) setEditWinnerShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Wheel history ── */
  useEffect(() => {
    if (wheelShowView === "previous") {
      fetch("/api/wheel/history")
        .then((r) => (r.ok ? r.json() : []))
        .then(setWheelHistory)
        .catch(() => setWheelHistory([]));
    }
  }, [wheelShowView]);

  /* ─── Weeks actions ─────────────────────────────────────────────── */

  async function updateTheme() {
    if (!theme.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/weeks/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() }),
      });
      loadAllData();
    } finally { setSaving(false); }
  }

  async function setPhase(phase: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/weeks/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.tie === true && Array.isArray(data.tiedSubmissions) && data.tiedSubmissions.length > 0) {
        setTiedSubmissions(data.tiedSubmissions);
        setSaving(false);
        return;
      }
      if (!res.ok) {
        alert(data.error || "Failed to update phase");
        return;
      }
      loadAllData();
    } finally { setSaving(false); }
  }

  async function resolveTie(submissionId: string) {
    if (!tiedSubmissions?.length) return;
    setResolvingTie(true);
    try {
      const res = await fetch("/api/weeks/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "winner_published", submissionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to set winner");
        return;
      }
      setTiedSubmissions(null);
      loadAllData();
    } finally { setResolvingTie(false); }
  }

  async function saveWeeksTabScreening() {
    if (!currentWeekWinner) return;
    setWeeksTabScreeningSaving(true);
    try {
      const res = await fetch(`/api/winners/${currentWeekWinner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screeningAt: weeksTabScreeningAt ? new Date(weeksTabScreeningAt).toISOString() : null }),
      });
      if (res.ok) loadAllData();
    } finally { setWeeksTabScreeningSaving(false); }
  }

  function handleRandomPick() {
    if (!tiedSubmissions?.length) return;
    const random = tiedSubmissions[Math.floor(Math.random() * tiedSubmissions.length)];
    resolveTie(random.id);
  }

  async function resetWeek() {
    if (!confirm("Start a new week? Current week data will be archived.")) return;
    setSaving(true);
    try {
      await fetch("/api/weeks/reset", { method: "POST" });
      setTheme("");
      loadAllData();
    } finally { setSaving(false); }
  }

  async function startFirstWeek() {
    if (!theme.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() }),
      });
      loadAllData();
    } finally { setSaving(false); }
  }

  async function restoreWeek(weekId: string) {
    if (!restoreConfirm || restoreConfirm.id !== weekId) return;
    setRestoringWeekId(weekId);
    try {
      const res = await fetch("/api/weeks/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId }),
      });
      if (res.ok) { setRestoreConfirm(null); loadAllData(); }
    } catch { /* ignore */ }
    finally { setRestoringWeekId(null); }
  }

  async function deleteWeek(weekId: string) {
    if (!deleteConfirm || deleteConfirm.id !== weekId) return;
    setDeletingWeekId(weekId);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, { method: "DELETE" });
      if (res.ok) { setDeleteConfirm(null); loadAllData(); }
      else { const data = await res.json(); alert(data.error || "Failed to delete week"); }
    } catch { alert("Failed to delete week"); }
    finally { setDeletingWeekId(null); }
  }

  async function addPastWeek() {
    if (!pastTheme.trim()) return;
    setAddingPast(true);
    try {
      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: true,
          theme: pastTheme.trim(),
          phase: "winner_published",
          startedAt: pastStartDate ? new Date(pastStartDate).toISOString() : new Date().toISOString(),
          endedAt: pastEndDate ? new Date(pastEndDate).toISOString() : new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setPastTheme(""); setPastStartDate(""); setPastEndDate(""); setShowAddPast(false);
        loadAllData();
      }
    } catch { /* ignore */ }
    finally { setAddingPast(false); }
  }

  /* ─── Submissions actions ───────────────────────────────────────── */

  async function selectSubTmdbMovie(tmdbId: number) {
    setSubSelectingMovie(true);
    setSubShowDropdown(false);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (res.ok) {
        const detail: TmdbMovieDetail = await res.json();
        setSubSelectedMovie(detail);
        setSubSearchQuery("");
        setSubSearchResults([]);
      }
    } catch { /* ignore */ }
    finally { setSubSelectingMovie(false); }
  }

  async function handleSubManualAdd() {
    if (!subAddWeekId || !subAddUserId || !subSelectedMovie) return;
    setSubSubmitting(true);
    setSubAddError("");
    const chosenUser = users.find((u) => u.id === subAddUserId);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: true,
          weekId: subAddWeekId,
          userId: subAddUserId,
          userName: chosenUser?.name || "Unknown",
          movieTitle: subSelectedMovie.title,
          posterUrl: subSelectedMovie.posterUrl,
          letterboxdUrl: subSelectedMovie.letterboxdUrl,
          tmdbId: subSelectedMovie.tmdbId,
          year: subSelectedMovie.year,
          overview: subSelectedMovie.overview,
          trailerUrl: subSelectedMovie.trailerUrl,
          backdropUrl: subSelectedMovie.backdropUrl,
        }),
      });
      if (!res.ok) { const d = await res.json(); setSubAddError(d.error || "Failed"); }
      else { setSubSelectedMovie(null); setSubAddWeekId(""); setSubAddUserId(""); setShowSubAddForm(false); loadAllData(); }
    } catch { setSubAddError("Something went wrong"); }
    finally { setSubSubmitting(false); }
  }

  function openSubEdit(sub: Submission) {
    setEditingSub(sub);
    setEditSubWeekId(sub.weekId);
    setEditSubUserId(sub.userId);
    setEditSubSearchQuery("");
    setEditSubSelectedMovie(null);
    setEditSubShowSearch(false);
    setEditSubError("");
  }

  async function selectSubTmdbMovieForEdit(tmdbId: number) {
    setEditSubSelectingMovie(true);
    setEditSubShowDropdown(false);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (res.ok) {
        const detail: TmdbMovieDetail = await res.json();
        setEditSubSelectedMovie(detail);
        setEditSubSearchQuery("");
        setEditSubSearchResults([]);
        setEditSubShowSearch(false);
      }
    } catch { /* ignore */ }
    finally { setEditSubSelectingMovie(false); }
  }

  async function handleSubEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSub) return;
    setSavingSubEdit(true);
    setEditSubError("");
    const chosenUser = users.find((u) => u.id === editSubUserId);
    try {
      const payload: Record<string, unknown> = {
        weekId: editSubWeekId,
        userId: editSubUserId,
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
      if (editSubSelectedMovie) {
        payload.movieTitle = editSubSelectedMovie.title;
        payload.posterUrl = editSubSelectedMovie.posterUrl;
        payload.letterboxdUrl = editSubSelectedMovie.letterboxdUrl;
        payload.year = editSubSelectedMovie.year;
        payload.overview = editSubSelectedMovie.overview;
        payload.trailerUrl = editSubSelectedMovie.trailerUrl;
        payload.backdropUrl = editSubSelectedMovie.backdropUrl;
        payload.tmdbId = editSubSelectedMovie.tmdbId;
      }
      const res = await fetch(`/api/submissions/${editingSub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setEditingSub(null); loadAllData(); }
      else { const d = await res.json(); setEditSubError(d.error || "Failed to update"); }
    } catch { setEditSubError("Something went wrong"); }
    finally { setSavingSubEdit(false); }
  }

  async function handleRemoveSubmission(sub: Submission) {
    if (!confirm(`Remove "${sub.movieTitle}" by ${sub.userName}?`)) return;
    setRemovingSubId(sub.id);
    try {
      const res = await fetch(`/api/submissions/${sub.id}`, { method: "DELETE" });
      if (res.ok) loadAllData();
    } finally { setRemovingSubId(null); }
  }

  function toggleWeek(weekId: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  }

  /* ─── Winners actions ───────────────────────────────────────────── */

  async function selectWinnerTmdbMovie(tmdbId: number) {
    setWinnerSelectingMovie(true);
    setWinnerShowDropdown(false);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (res.ok) {
        const detail: TmdbMovieDetail = await res.json();
        setWinnerSelectedMovie(detail);
        setWinnerSearchQuery("");
        setWinnerSearchResults([]);
      }
    } catch { /* ignore */ }
    finally { setWinnerSelectingMovie(false); }
  }

  async function createPastWeekForWinner(isForEdit: boolean) {
    const themeVal = isForEdit ? editWinnerNewWeekTheme.trim() : winnerNewWeekTheme.trim();
    const start = isForEdit ? editWinnerNewWeekStart : winnerNewWeekStart;
    const end = isForEdit ? editWinnerNewWeekEnd : winnerNewWeekEnd;
    if (!themeVal) return;

    if (isForEdit) setEditWinnerCreatingWeek(true);
    else setWinnerCreatingWeek(true);
    try {
      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: true,
          theme: themeVal,
          phase: "winner_published",
          startedAt: start ? new Date(start).toISOString() : new Date().toISOString(),
          endedAt: end ? new Date(end).toISOString() : new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const newWeek = await res.json();
        await loadAllData();
        if (isForEdit) {
          setEditWinnerWeekId(newWeek.id);
          setEditWinnerShowCreateWeek(false);
          setEditWinnerNewWeekTheme(""); setEditWinnerNewWeekStart(""); setEditWinnerNewWeekEnd("");
        } else {
          setWinnerAddWeekId(newWeek.id);
          setShowWinnerCreateWeek(false);
          setWinnerNewWeekTheme(""); setWinnerNewWeekStart(""); setWinnerNewWeekEnd("");
        }
      }
    } finally {
      if (isForEdit) setEditWinnerCreatingWeek(false);
      else setWinnerCreatingWeek(false);
    }
  }

  async function handleAddWinner(e: React.FormEvent) {
    e.preventDefault();
    if (!winnerSelectedMovie) return;
    if (winnerAddWeekId === CREATE_WEEK_VALUE) { setWinnerAddError("Create a new week first, or select an existing week."); return; }
    setAddingWinner(true);
    setWinnerAddError("");
    const chosenUser = users.find((u) => u.id === winnerAddUserId);
    try {
      const res = await fetch("/api/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieTitle: winnerSelectedMovie.title,
          posterUrl: winnerSelectedMovie.posterUrl,
          letterboxdUrl: winnerSelectedMovie.letterboxdUrl,
          submittedBy: chosenUser?.name || "",
          weekId: winnerAddWeekId || "",
          publishedAt: winnerAddWatchedDate ? new Date(winnerAddWatchedDate).toISOString() : undefined,
          screeningAt: winnerAddScreeningAt ? new Date(winnerAddScreeningAt).toISOString() : undefined,
          tmdbId: winnerSelectedMovie.tmdbId,
          year: winnerSelectedMovie.year,
          overview: winnerSelectedMovie.overview,
          trailerUrl: winnerSelectedMovie.trailerUrl,
          backdropUrl: winnerSelectedMovie.backdropUrl,
          runtime: winnerSelectedMovie.runtime,
          manual: true,
        }),
      });
      if (res.ok) {
        setWinnerSelectedMovie(null); setWinnerSearchQuery(""); setWinnerAddWeekId(""); setWinnerAddUserId(""); setWinnerAddWatchedDate(""); setWinnerAddScreeningAt("");
        setShowWinnerAddForm(false);
        loadAllData();
      } else { const d = await res.json(); setWinnerAddError(d.error || "Failed to add winner"); }
    } catch { setWinnerAddError("Something went wrong"); }
    finally { setAddingWinner(false); }
  }

  function openWinnerEdit(winner: Winner) {
    setEditingWinner(winner);
    setEditWinnerWeekId(winner.weekId || "");
    setEditWinnerUserId(users.find((u) => u.name === winner.submittedBy)?.id || "");
    setEditWinnerWatchedDate(winner.publishedAt ? winner.publishedAt.slice(0, 10) : "");
    setEditWinnerScreeningAt(winner.screeningAt ? (() => { const d = new Date(winner.screeningAt!); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })() : "");
    setEditWinnerSelectedMovie(null);
    setEditWinnerSearchQuery("");
    setEditWinnerSearchMode(false);
    setEditWinnerShowCreateWeek(false);
    setEditWinnerError("");
  }

  async function selectWinnerTmdbMovieForEdit(tmdbId: number) {
    setEditWinnerSelectingMovie(true);
    setEditWinnerShowDropdown(false);
    try {
      const res = await fetch(`/api/tmdb/movie/${tmdbId}`);
      if (res.ok) {
        const detail: TmdbMovieDetail = await res.json();
        setEditWinnerSelectedMovie(detail);
        setEditWinnerSearchQuery("");
        setEditWinnerSearchResults([]);
        setEditWinnerSearchMode(false);
      }
    } catch { /* ignore */ }
    finally { setEditWinnerSelectingMovie(false); }
  }

  async function handleDeleteWinner(winner: Winner) {
    if (!confirm(`Delete winner "${winner.movieTitle}" (${winner.year || ""})? This will also remove all ratings and comments.`)) return;
    setDeletingWinnerId(winner.id);
    try {
      const res = await fetch(`/api/winners/${winner.id}`, { method: "DELETE" });
      if (res.ok) await loadAllData();
    } catch { /* ignore */ }
    finally { setDeletingWinnerId(null); }
  }

  function handleWinnerDragStart(e: React.DragEvent, winner: Winner) {
    setDraggingWinnerId(winner.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", winner.id);
  }

  function handleWinnerDragEnd() { setDraggingWinnerId(null); }

  function handleWinnerDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleWinnerDrop(e: React.DragEvent, targetWinner: Winner) {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetWinner.id) { setDraggingWinnerId(null); return; }
    const fromIndex = winners.findIndex((w) => w.id === draggedId);
    const toIndex = winners.findIndex((w) => w.id === targetWinner.id);
    if (fromIndex === -1 || toIndex === -1) { setDraggingWinnerId(null); return; }
    const next = [...winners];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setWinners(next);
    setDraggingWinnerId(null);
    setReorderingWinners(true);
    try {
      const res = await fetch("/api/winners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((w) => w.id) }),
      });
      if (!res.ok) await loadAllData();
    } catch { await loadAllData(); }
    finally { setReorderingWinners(false); }
  }

  async function handleEditWinner(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWinner) return;
    if (editWinnerWeekId === CREATE_WEEK_VALUE) { setEditWinnerError("Create a new week first, or select an existing week."); return; }
    setSavingWinnerEdit(true);
    setEditWinnerError("");
    const chosenUser = users.find((u) => u.id === editWinnerUserId);
    try {
      const payload: Record<string, unknown> = {
        weekId: editWinnerWeekId || "",
        submittedBy: chosenUser?.name || "",
        publishedAt: editWinnerWatchedDate ? new Date(editWinnerWatchedDate).toISOString() : editingWinner.publishedAt,
        screeningAt: editWinnerScreeningAt ? new Date(editWinnerScreeningAt).toISOString() : null,
      };
      if (editWinnerSelectedMovie) {
        payload.movieTitle = editWinnerSelectedMovie.title;
        payload.posterUrl = editWinnerSelectedMovie.posterUrl;
        payload.letterboxdUrl = editWinnerSelectedMovie.letterboxdUrl;
        payload.year = editWinnerSelectedMovie.year;
        payload.overview = editWinnerSelectedMovie.overview;
        payload.trailerUrl = editWinnerSelectedMovie.trailerUrl;
        payload.backdropUrl = editWinnerSelectedMovie.backdropUrl;
        payload.tmdbId = editWinnerSelectedMovie.tmdbId;
        if (editWinnerSelectedMovie.runtime != null) payload.runtime = editWinnerSelectedMovie.runtime;
      }
      const res = await fetch(`/api/winners/${editingWinner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setEditingWinner(null); loadAllData(); }
      else { const d = await res.json(); setEditWinnerError(d.error || "Failed to update winner"); }
    } catch { setEditWinnerError("Something went wrong"); }
    finally { setSavingWinnerEdit(false); }
  }

  /* ─── Wheel actions ─────────────────────────────────────────────── */

  async function saveWheelEntries() {
    setWheelError(""); setWheelSuccess("");
    if (wheelEntries.filter((e) => e.trim()).length < 2) { setWheelError("Need at least 2 entries"); return; }
    setWheelSaving(true);
    try {
      const res = await fetch("/api/wheel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: wheelEntries.filter((e) => e.trim()) }),
      });
      if (res.ok) {
        const data = await res.json();
        setWheel(data); setWheelEntries([...data.entries]);
        setWheelSuccess("Wheel updated!");
        setTimeout(() => setWheelSuccess(""), 3000);
      } else { const err = await res.json(); setWheelError(err.error || "Failed to save"); }
    } catch { setWheelError("Failed to save"); }
    finally { setWheelSaving(false); }
  }

  function addWheelEntry() {
    if (!wheelNewEntry.trim()) return;
    setWheelEntries([...wheelEntries, wheelNewEntry.trim()]);
    setWheelNewEntry("");
  }

  function removeWheelEntry(idx: number) { setWheelEntries(wheelEntries.filter((_, i) => i !== idx)); }

  function moveWheelEntry(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= wheelEntries.length) return;
    const copy = [...wheelEntries];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setWheelEntries(copy);
  }

  async function setManualWheelResult() {
    if (!manualResult.trim()) return;
    setSettingResult(true);
    setWheelError(""); setWheelSuccess("");
    try {
      const res = await fetch("/api/wheel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualResult: manualResult.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWheel(data);
        setWheelSuccess(`Result set to "${manualResult.trim()}"!`);
        setManualResult("");
        setTimeout(() => setWheelSuccess(""), 3000);
      } else { const err = await res.json(); setWheelError(err.error || "Failed to set result"); }
    } catch { setWheelError("Failed to set result"); }
    finally { setSettingResult(false); }
  }

  /* ─── Derived data ──────────────────────────────────────────────── */

  const weekMap = useMemo(() => {
    const m: Record<string, WeekData> = {};
    allWeeks.forEach((w) => { m[w.id] = w; });
    return m;
  }, [allWeeks]);

  const currentSubs = useMemo(
    () => currentWeek ? allSubmissions.filter((s) => s.weekId === currentWeek.id) : [],
    [currentWeek, allSubmissions]
  );

  const currentWeekVotes = useMemo(
    () => currentWeek ? allVotes.filter((v) => v.weekId === currentWeek.id) : [],
    [currentWeek, allVotes]
  );

  const showVotesOnSubs = currentWeek && (currentWeek.phase === "vote_open" || currentWeek.phase === "vote_closed");
  const subVoteTally: Record<string, number> = {};
  if (showVotesOnSubs) {
    currentWeekVotes.forEach((v) => { subVoteTally[v.submissionId] = (subVoteTally[v.submissionId] || 0) + 1; });
  }

  const subById = useMemo(() => new Map(allSubmissions.map((s) => [s.id, s])), [allSubmissions]);
  const voteWeekById = useMemo(() => new Map(allWeeks.map((w) => [w.id, w])), [allWeeks]);

  const filteredVotes = voteFilterWeekId
    ? allVotes.filter((v) => v.weekId === voteFilterWeekId)
    : allVotes;
  const sortedVotes = useMemo(
    () => [...filteredVotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredVotes]
  );

  const pastWeeks = useMemo(
    () => allWeeks.filter((w) => w.endedAt).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [allWeeks]
  );

  const currentPhase = PHASES.find((p) => p.key === currentWeek?.phase);

  /* ─── Render ────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white/90">Movie Night</h1>
          <p className="text-sm text-white/40 mt-0.5">Weeks, submissions, votes, winners &amp; theme wheel</p>
        </div>
      </div>

      {/* ═══ CURRENT WEEK STATUS BAR ═══ */}
      <div className="rounded-xl border border-white/[0.06] bg-gradient-to-r from-purple-500/[0.04] via-white/[0.02] to-indigo-500/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-4">
          {currentWeek ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${currentPhase?.dot || "bg-white/30"}`} />
                <span className="text-sm font-medium text-white/80">{currentPhase?.label || currentWeek.phase}</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Theme</span>
                <span className="text-sm font-semibold text-white/90">{currentWeek.theme}</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/50">
                  <span className="text-white/80 font-medium tabular-nums">{currentSubs.length}</span> subs
                </span>
                <span className="text-xs text-white/50">
                  <span className="text-white/80 font-medium tabular-nums">{currentWeekVotes.length}</span> votes
                </span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-[11px] text-white/25">Week #{currentWeek.id} &middot; Started {new Date(currentWeek.startedAt).toLocaleDateString()}</span>
            </>
          ) : (
            <span className="text-sm text-white/40">No active week</span>
          )}
        </div>
      </div>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <svg className={`w-4 h-4 ${isActive ? "text-purple-400" : "text-white/30"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB CONTENT ═══ */}

      {/* ── WEEKS & PHASES TAB ── */}
      {activeTab === "weeks" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white/80">Week & Phases</h2>
            <button
              onClick={() => setShowAddPast(!showAddPast)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all cursor-pointer"
            >
              {showAddPast ? "Cancel" : "+ Add Past Week"}
            </button>
          </div>

          {showAddPast && (
            <div className="rounded-xl border border-purple-500/15 bg-white/[0.03] p-6">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Add Past Week</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Theme</label>
                  <input type="text" value={pastTheme} onChange={(e) => setPastTheme(e.target.value)} placeholder="e.g. Horror, Sci-Fi, Crime..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Start Date</label>
                    <input type="date" value={pastStartDate} onChange={(e) => setPastStartDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">End Date</label>
                    <input type="date" value={pastEndDate} onChange={(e) => setPastEndDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                  </div>
                </div>
                <button onClick={addPastWeek} disabled={!pastTheme.trim() || addingPast} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                  {addingPast ? "Adding..." : "Add Past Week"}
                </button>
              </div>
            </div>
          )}

          {!currentWeek ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <p className="text-white/50 mb-4">No active week. Start a new one:</p>
              <div className="flex gap-3 max-w-md mx-auto">
                <input type="text" placeholder="Enter theme..." value={theme} onChange={(e) => setTheme(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors" />
                <button onClick={startFirstWeek} disabled={saving || !theme.trim()} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Start Week</button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Theme editor */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Current Theme</h3>
                  <div className="flex gap-3">
                    <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors" />
                    <button onClick={updateTheme} disabled={saving || theme === currentWeek.theme} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white/60 hover:text-white hover:bg-white/[0.1] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Update</button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    <button onClick={resetWeek} disabled={saving} className="w-full px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/80 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer disabled:opacity-30">Reset Week (Archive & Start Fresh)</button>
                  </div>
                </div>

                {/* Phase selector */}
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Phase</h3>
                  <div className="space-y-2">
                    {PHASES.map((p) => {
                      const isActive = currentWeek.phase === p.key;
                      return (
                        <button key={p.key} onClick={() => setPhase(p.key)} disabled={saving} className={`w-full text-left px-4 py-3 rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed ${isActive ? p.color : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/60"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{p.label}</p>
                              <p className={`text-[11px] ${isActive ? "opacity-70" : "text-white/20"}`}>{p.desc}</p>
                            </div>
                            {isActive && <span className="text-xs font-medium opacity-80">Active</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Screening date/time — when winner is published */}
              {currentWeek?.phase === "winner_published" && currentWeekWinner && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Screening Date & Time</h3>
                  <p className="text-[11px] text-white/40 mb-3">When the movie will be screened — shown on the main page for &quot;{currentWeekWinner.movieTitle}&quot;</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex gap-2 flex-1 min-w-0">
                      <input
                        type="date"
                        value={weeksTabScreeningAt ? weeksTabScreeningAt.slice(0, 10) : ""}
                        onChange={(e) => setWeeksTabScreeningAt(e.target.value + "T" + (weeksTabScreeningAt?.slice(11, 16) || "00:00"))}
                        className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]"
                      />
                      <input
                        type="time"
                        value={weeksTabScreeningAt ? weeksTabScreeningAt.slice(11, 16) : ""}
                        onChange={(e) => setWeeksTabScreeningAt((weeksTabScreeningAt?.slice(0, 10) || "2026-01-01") + "T" + e.target.value)}
                        className="w-28 shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]"
                      />
                    </div>
                    <button
                      onClick={saveWeeksTabScreening}
                      disabled={weeksTabScreeningSaving}
                      className="px-4 py-2.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-40 text-sm font-medium"
                    >
                      {weeksTabScreeningSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}

              {/* Past weeks */}
              {allWeeks.length > 1 && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.06]">
                    <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Past Weeks</h3>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {allWeeks.filter((w) => w.id !== currentWeek.id).map((week) => (
                      <div key={week.id} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/70">{week.theme}</p>
                          <p className="text-[11px] text-white/25">{new Date(week.startedAt).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[11px] text-white/20 shrink-0">Week #{week.id}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setRestoreConfirm({ id: week.id, theme: week.theme })} disabled={saving} className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400/90 text-xs font-medium hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">Restore</button>
                          <button onClick={() => setDeleteConfirm({ id: week.id, theme: week.theme })} disabled={saving} className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400/90 text-xs font-medium hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SUBMISSIONS TAB ── */}
      {activeTab === "submissions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white/80">
              Submissions
              {currentWeek && <span className="text-sm text-white/40 font-normal ml-2">Theme: {currentWeek.theme}</span>}
            </h2>
            <button onClick={() => setShowSubAddForm(!showSubAddForm)} className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all cursor-pointer">
              {showSubAddForm ? "Cancel" : "+ Add Past Submission"}
            </button>
          </div>

          {showSubAddForm && (
            <div className="rounded-xl border border-purple-500/15 bg-white/[0.03] p-6">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Add Past Submission</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
                  <select value={subAddWeekId} onChange={(e) => setSubAddWeekId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer">
                    <option value="" className="bg-[#1a1a2e]">Select week...</option>
                    {allWeeks.map((w) => (<option key={w.id} value={w.id} className="bg-[#1a1a2e]">#{w.id} — {w.theme} {w.endedAt ? "(ended)" : "(active)"}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
                  <select value={subAddUserId} onChange={(e) => setSubAddUserId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer">
                    <option value="" className="bg-[#1a1a2e]">Select user...</option>
                    {users.map((u) => (<option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Movie</label>
                {!subSelectedMovie ? (
                  <div ref={subDropdownRef} className="relative">
                    <input type="text" value={subSearchQuery} onChange={(e) => setSubSearchQuery(e.target.value)} placeholder="Search for a movie..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40 transition-colors" />
                    {subSearchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /></div>}
                    {subShowDropdown && subSearchResults.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl max-h-60 overflow-y-auto scrollbar-autocomplete">
                        {subSearchResults.map((r) => (
                          <button key={r.id} onClick={() => selectSubTmdbMovie(r.id)} className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer text-left">
                            {r.posterUrl ? <img src={r.posterUrl} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-12 rounded bg-white/5 flex-shrink-0" />}
                            <div className="min-w-0"><p className="text-sm text-white/80 truncate">{r.title}</p><p className="text-[11px] text-white/30">{r.year}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    {subSelectedMovie.posterUrl && <img src={subSelectedMovie.posterUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white/80 truncate">{subSelectedMovie.title}</p><p className="text-[11px] text-white/30">{subSelectedMovie.year}</p></div>
                    <button onClick={() => setSubSelectedMovie(null)} className="text-xs text-white/25 hover:text-white/50 transition-colors cursor-pointer">Change</button>
                  </div>
                )}
                {subSelectingMovie && <p className="text-xs text-white/30 mt-1">Loading movie details...</p>}
              </div>
              {subAddError && <p className="text-red-400/80 text-xs mb-3">{subAddError}</p>}
              <button onClick={handleSubManualAdd} disabled={!subAddWeekId || !subAddUserId || !subSelectedMovie || subSubmitting} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                {subSubmitting ? "Adding..." : "Add Submission"}
              </button>
            </div>
          )}

          {/* Current week submissions */}
          {!currentWeek ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center"><p className="text-white/40">No active week.</p></div>
          ) : currentSubs.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center"><p className="text-white/40">No submissions yet for this week.</p></div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4 flex-wrap">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">This Week&apos;s Submissions ({currentSubs.length})</h3>
                {showVotesOnSubs && <span className="text-[11px] text-white/40 uppercase tracking-widest">{currentWeek.phase === "vote_open" ? "Voting open" : "Voting closed"} — showing votes</span>}
              </div>
              <div className="divide-y divide-white/[0.04]">
                {currentSubs.map((sub) => (
                  <SubmissionRow key={sub.id} sub={sub} onEdit={() => openSubEdit(sub)} onRemove={() => handleRemoveSubmission(sub)} removing={removingSubId === sub.id} voteCount={showVotesOnSubs ? subVoteTally[sub.id] : undefined} />
                ))}
              </div>
            </div>
          )}

          {/* Past weeks submissions */}
          {pastWeeks.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest">Past Weeks</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
              <div className="space-y-3">
                {pastWeeks.map((week) => {
                  const weekSubs = allSubmissions.filter((s) => s.weekId === week.id);
                  const isExpanded = expandedWeeks.has(week.id);
                  return (
                    <div key={week.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                      <button onClick={() => toggleWeek(week.id)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"><span className="text-xs font-bold text-purple-400/70">#{week.id}</span></div>
                          <div className="text-left min-w-0">
                            <p className="text-sm font-medium text-white/80 truncate">{week.theme}</p>
                            <p className="text-[11px] text-white/30">{new Date(week.startedAt).toLocaleDateString()}{week.endedAt && ` — ${new Date(week.endedAt).toLocaleDateString()}`} &middot; {weekSubs.length} submission{weekSubs.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <svg className={`w-5 h-5 text-white/20 transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-white/[0.06]">
                          {weekSubs.length === 0 ? (
                            <div className="px-6 py-6 text-center"><p className="text-white/25 text-sm">No submissions this week.</p></div>
                          ) : (
                            <div className="divide-y divide-white/[0.04]">
                              {weekSubs.map((sub) => (<SubmissionRow key={sub.id} sub={sub} onEdit={() => openSubEdit(sub)} onRemove={() => handleRemoveSubmission(sub)} removing={removingSubId === sub.id} />))}
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
        </div>
      )}

      {/* ── VOTES TAB ── */}
      {activeTab === "votes" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-white/80">Votes</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-white/50">Week</label>
              <select value={voteFilterWeekId} onChange={(e) => setVoteFilterWeekId(e.target.value)} className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                <option value="">All weeks</option>
                {allWeeks.map((w) => (<option key={w.id} value={w.id}>{w.theme || w.id}</option>))}
              </select>
            </div>
          </div>
          <p className="text-white/50 text-sm">{filteredVotes.length} vote{filteredVotes.length !== 1 ? "s" : ""} {voteFilterWeekId ? "for this week" : "across all weeks"}.</p>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Voter</th>
                    <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Voted for</th>
                    <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Week / Theme</th>
                    <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVotes.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-white/40">No votes yet.</td></tr>
                  ) : (
                    sortedVotes.map((v) => {
                      const sub = subById.get(v.submissionId);
                      const week = voteWeekById.get(v.weekId);
                      return (
                        <tr key={v.id} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                          <td className="px-4 py-3 text-white/90 font-medium">{v.userName || v.userId || "—"}</td>
                          <td className="px-4 py-3 text-white/80">{sub ? <span>{sub.movieTitle}{sub.year ? ` (${sub.year})` : ""}</span> : <span className="text-white/40">Unknown submission</span>}</td>
                          <td className="px-4 py-3 text-white/70">{week ? <span title={week.id}>{week.theme || week.id}</span> : <span className="text-white/40">{v.weekId}</span>}</td>
                          <td className="px-4 py-3 text-white/50 text-sm">{new Date(v.createdAt).toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── WINNERS TAB ── */}
      {activeTab === "winners" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white/80">Winners</h2>
            <button onClick={() => { setShowWinnerAddForm(!showWinnerAddForm); setWinnerSelectedMovie(null); setWinnerSearchQuery(""); }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer">
              {showWinnerAddForm ? "Cancel" : "+ Add Movie Manually"}
            </button>
          </div>

          {showWinnerAddForm && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Add to Past Winners</h3>
              {!winnerSelectedMovie ? (
                <div ref={winnerDropdownRef} className="relative">
                  <div className="relative">
                    <input type="text" value={winnerSearchQuery} onChange={(e) => setWinnerSearchQuery(e.target.value)} onFocus={() => { if (winnerSearchResults.length > 0) setWinnerShowDropdown(true); }} placeholder="Search for a movie..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors pr-10" autoComplete="off" />
                    {(winnerSearchLoading || winnerSelectingMovie) && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /></div>}
                  </div>
                  {winnerShowDropdown && winnerSearchResults.length > 0 && (
                    <div className="scrollbar-autocomplete absolute z-30 mt-1 w-full max-h-80 overflow-auto rounded-xl border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl">
                      {winnerSearchResults.map((r) => (
                        <button key={r.id} type="button" onClick={() => selectWinnerTmdbMovie(r.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left cursor-pointer">
                          {r.posterUrl ? <img src={r.posterUrl} alt={r.title} className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5" /> : <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/10 text-lg font-bold">{r.title.charAt(0)}</div>}
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white/80 truncate">{r.title}</p><p className="text-xs text-white/30">{r.year || "Unknown year"}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAddWinner} className="space-y-4">
                  <div className="flex gap-4 items-start">
                    {winnerSelectedMovie.posterUrl && <img src={winnerSelectedMovie.posterUrl} alt={winnerSelectedMovie.title} className="w-20 h-28 rounded-xl object-cover flex-shrink-0 border border-white/[0.08] shadow-lg" />}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-bold text-white/90 truncate">{winnerSelectedMovie.title}</h4>
                      <p className="text-sm text-white/40 mt-0.5">{winnerSelectedMovie.year}</p>
                      {winnerSelectedMovie.overview && <p className="text-xs text-white/30 mt-1 line-clamp-2">{winnerSelectedMovie.overview}</p>}
                      <button type="button" onClick={() => setWinnerSelectedMovie(null)} className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer mt-2">Change movie</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
                      <select value={winnerAddWeekId} onChange={(e) => { setWinnerAddWeekId(e.target.value); setShowWinnerCreateWeek(e.target.value === CREATE_WEEK_VALUE); }} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer">
                        <option value="" className="bg-[#1a1a2e]">Select week...</option>
                        <option value={CREATE_WEEK_VALUE} className="bg-[#1a1a2e]">+ Create new past week...</option>
                        {allWeeks.map((w) => (<option key={w.id} value={w.id} className="bg-[#1a1a2e]">#{w.id} — {w.theme}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
                      <select value={winnerAddUserId} onChange={(e) => setWinnerAddUserId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer">
                        <option value="" className="bg-[#1a1a2e]">Select user...</option>
                        {users.map((u) => (<option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Watched Date</label>
                      <input type="date" value={winnerAddWatchedDate} onChange={(e) => setWinnerAddWatchedDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Screening Date & Time</label>
                    <div className="flex gap-2">
                      <input type="date" value={winnerAddScreeningAt ? winnerAddScreeningAt.slice(0, 10) : ""} onChange={(e) => setWinnerAddScreeningAt(e.target.value + "T" + (winnerAddScreeningAt?.slice(11, 16) || "00:00"))} className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                      <input type="time" value={winnerAddScreeningAt ? winnerAddScreeningAt.slice(11, 16) : ""} onChange={(e) => setWinnerAddScreeningAt((winnerAddScreeningAt?.slice(0, 10) || "2026-01-01") + "T" + e.target.value)} className="w-28 shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                    </div>
                    <p className="text-[10px] text-white/30 mt-1">When the movie will be screened (shown on main page when winner is published)</p>
                  </div>
                  {showWinnerCreateWeek && (
                    <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                      <p className="text-xs text-white/50">Create a new past week, then add the winner below.</p>
                      <input type="text" value={winnerNewWeekTheme} onChange={(e) => setWinnerNewWeekTheme(e.target.value)} placeholder="Theme name" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">Start date</label><input type="date" value={winnerNewWeekStart} onChange={(e) => setWinnerNewWeekStart(e.target.value)} className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]" /></div>
                        <div><label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">End date</label><input type="date" value={winnerNewWeekEnd} onChange={(e) => setWinnerNewWeekEnd(e.target.value)} className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]" /></div>
                      </div>
                      <button type="button" onClick={() => createPastWeekForWinner(false)} disabled={!winnerNewWeekTheme.trim() || winnerCreatingWeek} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-40 text-sm font-medium">{winnerCreatingWeek ? "Creating..." : "Create & Select"}</button>
                    </div>
                  )}
                  {winnerAddUserId && (
                    <p className="text-[11px] text-cyan-400/50 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                      {users.find((u) => u.id === winnerAddUserId)?.name || "User"} will earn a skip for this win
                    </p>
                  )}
                  {winnerAddError && <p className="text-red-400/80 text-xs">{winnerAddError}</p>}
                  <button type="submit" disabled={addingWinner || !winnerSelectedMovie} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">{addingWinner ? "Adding..." : "Add Winner"}</button>
                </form>
              )}
            </div>
          )}

          {/* Winners list */}
          {winners.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center"><p className="text-white/40">No winners yet.</p></div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">All Winners ({winners.length})</h3>
                <div className="flex items-center gap-3">
                  {reorderingWinners && <span className="text-xs text-white/40">Saving order...</span>}
                  <p className="text-[11px] text-white/30 shrink-0">Drag to reorder</p>
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {winners.map((winner) => {
                  const week = winner.weekId ? weekMap[winner.weekId] : null;
                  const isDragging = draggingWinnerId === winner.id;
                  return (
                    <div key={winner.id} className={`px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors ${isDragging ? "opacity-50" : ""}`} onDragOver={handleWinnerDragOver} onDrop={(e) => handleWinnerDrop(e, winner)}>
                      <div draggable onDragStart={(e) => handleWinnerDragStart(e, winner)} onDragEnd={handleWinnerDragEnd} className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 rounded text-white/30 hover:text-white/50 hover:bg-white/[0.04]" title="Drag to reorder">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M8 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm6-12a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0zm0 6a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      {winner.posterUrl ? <img src={winner.posterUrl} alt={winner.movieTitle} className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5" /> : <div className="w-10 h-14 rounded bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0"><span className="text-white/15 text-lg font-bold">{winner.movieTitle.charAt(0)}</span></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{winner.movieTitle}{winner.year && <span className="text-white/30 ml-1">({winner.year})</span>}</p>
                        <p className="text-[11px] text-white/30">
                          {winner.submittedBy && <>by <span className="text-white/50">{winner.submittedBy}</span> &middot; </>}
                          {week ? <>Theme: <span className="text-purple-400/70">{week.theme}</span> &middot; </> : winner.weekId ? <>Week #{winner.weekId} &middot; </> : <>Manual add &middot; </>}
                          Watched {new Date(winner.publishedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => openWinnerEdit(winner)} disabled={!!deletingWinnerId} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors cursor-pointer disabled:opacity-50">Edit</button>
                        <button onClick={() => handleDeleteWinner(winner)} disabled={deletingWinnerId === winner.id} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400/70 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer disabled:opacity-50">{deletingWinnerId === winner.id ? "Deleting..." : "Delete"}</button>
                        {winner.letterboxdUrl && <a href={winner.letterboxdUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400/60 hover:text-purple-400 transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); window.open(winner.letterboxdUrl, "_blank", "noopener,noreferrer"); }}>Letterboxd</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── THEME WHEEL TAB ── */}
      {activeTab === "wheel" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white/80">Theme Wheel</h2>
              <p className="text-sm text-white/40 mt-1">Manage wheel entries and view from the public page</p>
            </div>
            <Link href="/wheel" target="_blank" className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all">Open Wheel Page &rarr;</Link>
          </div>

          {/* View switcher */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
            <label className="block text-sm text-white/50 mb-2">Show</label>
            <select value={wheelShowView} onChange={(e) => setWheelShowView(e.target.value as "current" | "previous")} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors cursor-pointer">
              <option value="current" className="bg-[#1a1a2e]">Current wheel</option>
              <option value="previous" className="bg-[#1a1a2e]">Previous wheel winners</option>
            </select>
            {wheelShowView === "previous" && (
              <div className="mt-4">
                <p className="text-xs text-white/40 mb-2">Themes confirmed from the wheel (newest first)</p>
                {wheelHistory.length === 0 ? (
                  <p className="text-white/30 text-sm py-2">No previous wheel winners yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {wheelHistory.map((entry, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2">
                        <span className="text-white/80 font-medium">{entry.theme}</span>
                        <span className="text-[11px] text-white/30">{new Date(entry.confirmedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {wheelShowView === "current" && (
            <>
              {/* Last result */}
              {(wheel?.lastResult || wheel?.lastConfirmedResult) && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-purple-400/50 mb-1">{wheel?.lastConfirmedResult ? "Confirmed theme" : "Current Result"}</p>
                      <p className="text-xl font-bold text-purple-300">{wheel?.lastResult || wheel?.lastConfirmedResult}</p>
                    </div>
                    {(wheel?.lastSpunAt || wheel?.lastConfirmedAt) && <p className="text-xs text-white/20">{new Date(wheel?.lastSpunAt || wheel?.lastConfirmedAt || "").toLocaleString()}</p>}
                  </div>
                </div>
              )}

              {/* Manual set result */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-2">Set Result Manually</h3>
                <p className="text-xs text-white/30 mb-4">Override the wheel result without spinning.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select value="" onChange={(e) => { if (e.target.value) setManualResult(e.target.value); }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors cursor-pointer appearance-none">
                    <option value="" disabled>Pick from wheel...</option>
                    {wheelEntries.map((entry, i) => (<option key={i} value={entry} className="bg-[#1a1a2e] text-white">{entry}</option>))}
                  </select>
                  <span className="text-white/20 text-xs self-center hidden sm:block">or</span>
                  <input type="text" placeholder="Type custom theme..." value={manualResult} onChange={(e) => setManualResult(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors" />
                  <button onClick={setManualWheelResult} disabled={settingResult || !manualResult.trim()} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">{settingResult ? "Setting..." : "Set Result"}</button>
                </div>
              </div>

              {/* Entries management */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-2">Wheel Entries</h3>
                <p className="text-xs text-white/30 mb-4">Add, remove, or reorder themes. Changes take effect after saving.</p>
                <div className="space-y-2 mb-6">
                  {wheelEntries.length === 0 ? (
                    <p className="text-white/30 text-sm py-4 text-center">No entries yet. Add at least 2 themes below.</p>
                  ) : (
                    wheelEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 group">
                        <span className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">{idx + 1}</span>
                        <span className="flex-1 text-white/80 text-sm font-medium truncate">{entry}</span>
                        <button onClick={() => moveWheelEntry(idx, -1)} disabled={idx === 0} className="p-1 text-white/20 hover:text-white/60 transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed" title="Move up"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg></button>
                        <button onClick={() => moveWheelEntry(idx, 1)} disabled={idx === wheelEntries.length - 1} className="p-1 text-white/20 hover:text-white/60 transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed" title="Move down"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg></button>
                        <button onClick={() => removeWheelEntry(idx)} className="p-1 text-white/20 hover:text-red-400 transition-colors cursor-pointer" title="Remove"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 mb-6">
                  <input type="text" placeholder="Add a theme..." value={wheelNewEntry} onChange={(e) => setWheelNewEntry(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWheelEntry(); } }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors" />
                  <button onClick={addWheelEntry} disabled={!wheelNewEntry.trim()} className="px-5 py-2.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-sm font-medium hover:bg-purple-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">+ Add</button>
                </div>
                {wheelError && <p className="text-red-400/80 text-sm mb-4">{wheelError}</p>}
                {wheelSuccess && <p className="text-green-400/80 text-sm mb-4">{wheelSuccess}</p>}
                <button onClick={saveWheelEntries} disabled={wheelSaving} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">{wheelSaving ? "Saving..." : "Save Wheel"}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Restore week confirmation */}
      {restoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !restoringWeekId && setRestoreConfirm(null)}>
          <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/90 font-medium mb-2">Restore this week?</p>
            <p className="text-sm text-white/50 mb-4">The current week will be ended (archived). Week #{restoreConfirm.id} &quot;{restoreConfirm.theme}&quot; will become the active week again.</p>
            <div className="flex gap-3">
              <button onClick={() => !restoringWeekId && setRestoreConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={() => restoreWeek(restoreConfirm.id)} disabled={restoringWeekId !== null} className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{restoringWeekId ? "Restoring..." : "Restore week"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete week confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !deletingWeekId && setDeleteConfirm(null)}>
          <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/90 font-medium mb-2">Delete this week permanently?</p>
            <p className="text-sm text-white/50 mb-4">Week #{deleteConfirm.id} &quot;{deleteConfirm.theme}&quot; and all its submissions, votes, winner(s), ratings, and comments will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => !deletingWeekId && setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={() => deleteWeek(deleteConfirm.id)} disabled={deletingWeekId !== null} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{deletingWeekId ? "Deleting..." : "Delete week"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tie resolution modal */}
      {tiedSubmissions && tiedSubmissions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <p className="text-white/90 font-medium mb-1">Voting tie</p>
            <p className="text-sm text-white/50 mb-4">Multiple movies have the same number of votes. Random pick or Manual pick?</p>
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <button type="button" onClick={handleRandomPick} disabled={resolvingTie} className="flex-1 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{resolvingTie ? "Picking..." : "Random pick"}</button>
                <span className="text-white/30 self-center text-sm">or</span>
                <span className="text-white/50 text-sm self-center">choose below</span>
              </div>
              <div className="border-t border-white/10 pt-4 space-y-2">
                {tiedSubmissions.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    {sub.posterUrl ? <img src={sub.posterUrl} alt="" className="w-12 h-[4.5rem] object-cover rounded shrink-0" /> : <div className="w-12 h-[4.5rem] rounded bg-white/10 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white/90 truncate">{sub.movieTitle}</p>
                      <p className="text-[11px] text-white/40">{sub.userName}</p>
                    </div>
                    <button type="button" onClick={() => resolveTie(sub.id)} disabled={resolvingTie} className="shrink-0 px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/20 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Select winner</button>
                  </div>
                ))}
              </div>
            </div>
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
              <button onClick={() => setEditingSub(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubEdit} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Movie</label>
                {!editSubShowSearch && !editSubSelectedMovie ? (
                  <div className="flex gap-3 items-start p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    {editingSub.posterUrl ? <img src={editingSub.posterUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" /> : <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/20 text-lg font-bold">{editingSub.movieTitle.charAt(0)}</div>}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white/80 truncate">{editingSub.movieTitle}{editingSub.year && ` (${editingSub.year})`}</p><button type="button" onClick={() => setEditSubShowSearch(true)} className="text-xs text-white/30 hover:text-white/60 cursor-pointer mt-1">Change movie</button></div>
                  </div>
                ) : editSubSelectedMovie ? (
                  <div className="flex gap-3 items-start p-3 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                    {editSubSelectedMovie.posterUrl ? <img src={editSubSelectedMovie.posterUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" /> : <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/20 text-lg font-bold">{editSubSelectedMovie.title.charAt(0)}</div>}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white/80 truncate">{editSubSelectedMovie.title} ({editSubSelectedMovie.year})</p><button type="button" onClick={() => setEditSubSelectedMovie(null)} className="text-xs text-white/30 hover:text-white/60 cursor-pointer mt-1">Use original</button></div>
                  </div>
                ) : null}
                {editSubShowSearch && (
                  <div ref={editSubDropdownRef} className="relative mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input type="text" value={editSubSearchQuery} onChange={(e) => setEditSubSearchQuery(e.target.value)} onFocus={() => { if (editSubSearchResults.length > 0) setEditSubShowDropdown(true); }} placeholder="Search to change movie..." className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40" />
                      <button type="button" onClick={() => { setEditSubShowSearch(false); setEditSubSearchQuery(""); }} className="text-xs px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 cursor-pointer shrink-0">Cancel</button>
                    </div>
                    {editSubSelectingMovie && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /></div>}
                    {editSubShowDropdown && editSubSearchResults.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border border-white/[0.08] bg-[#1a1a2e] shadow-xl max-h-48 overflow-y-auto scrollbar-autocomplete">
                        {editSubSearchResults.map((r) => (
                          <button key={r.id} type="button" onClick={() => selectSubTmdbMovieForEdit(r.id)} className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer text-left">
                            {r.posterUrl ? <img src={r.posterUrl} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" /> : <div className="w-8 h-12 rounded bg-white/5 flex-shrink-0" />}
                            <div className="min-w-0"><p className="text-sm text-white/80 truncate">{r.title}</p><p className="text-[11px] text-white/30">{r.year}</p></div>
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
                  <select value={editSubWeekId} onChange={(e) => setEditSubWeekId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 appearance-none cursor-pointer">
                    {allWeeks.map((w) => (<option key={w.id} value={w.id} className="bg-[#1a1a2e]">#{w.id} — {w.theme}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
                  <select value={editSubUserId} onChange={(e) => setEditSubUserId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 appearance-none cursor-pointer">
                    {users.map((u) => (<option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name}</option>))}
                  </select>
                </div>
              </div>
              {editSubError && <p className="text-red-400/80 text-xs">{editSubError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingSub(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingSubEdit} className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">{savingSubEdit ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit winner modal */}
      {editingWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingWinner(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#12121a] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-base font-semibold text-white/90">Edit Winner</h2>
              <button onClick={() => setEditingWinner(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleEditWinner} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Movie</label>
                {!editWinnerSearchMode ? (
                  <div className="flex gap-4 items-start">
                    {(editWinnerSelectedMovie ? editWinnerSelectedMovie.posterUrl : editingWinner.posterUrl) ? <img src={editWinnerSelectedMovie?.posterUrl || editingWinner.posterUrl} alt={editWinnerSelectedMovie?.title ?? editingWinner.movieTitle} className="w-16 h-24 rounded-lg object-cover flex-shrink-0 border border-white/[0.08]" /> : <div className="w-16 h-24 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white/20 text-lg font-bold">{(editWinnerSelectedMovie?.title || editingWinner.movieTitle).charAt(0)}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80">{editWinnerSelectedMovie?.title || editingWinner.movieTitle}{(editWinnerSelectedMovie?.year || editingWinner.year) && <span className="text-white/30 ml-1">({editWinnerSelectedMovie?.year || editingWinner.year})</span>}</p>
                      <button type="button" onClick={() => setEditWinnerSearchMode(true)} className="text-xs text-white/30 hover:text-white/60 cursor-pointer mt-1">Change movie</button>
                    </div>
                  </div>
                ) : (
                  <div ref={editWinnerDropdownRef} className="relative">
                    <div className="flex gap-2">
                      <input type="text" value={editWinnerSearchQuery} onChange={(e) => setEditWinnerSearchQuery(e.target.value)} onFocus={() => { if (editWinnerSearchResults.length > 0) setEditWinnerShowDropdown(true); }} placeholder="Search for a movie to replace..." className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40" autoComplete="off" />
                      <button type="button" onClick={() => { setEditWinnerSearchMode(false); setEditWinnerSearchQuery(""); }} className="text-xs px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 cursor-pointer shrink-0">Cancel</button>
                    </div>
                    {editWinnerSelectingMovie && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /></div>}
                    {editWinnerShowDropdown && editWinnerSearchResults.length > 0 && (
                      <div className="scrollbar-autocomplete absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-white/[0.1] bg-[#1a1a2e]/95 backdrop-blur-xl">
                        {editWinnerSearchResults.map((r) => (
                          <button key={r.id} type="button" onClick={() => selectWinnerTmdbMovieForEdit(r.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left cursor-pointer">
                            {r.posterUrl ? <img src={r.posterUrl} alt={r.title} className="w-8 h-12 rounded object-cover flex-shrink-0 bg-white/5" /> : <div className="w-8 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-white/10 text-sm font-bold">{r.title.charAt(0)}</div>}
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white/80 truncate">{r.title}</p><p className="text-xs text-white/30">{r.year || "Unknown year"}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Week</label>
                  <select value={editWinnerWeekId} onChange={(e) => { setEditWinnerWeekId(e.target.value); setEditWinnerShowCreateWeek(e.target.value === CREATE_WEEK_VALUE); }} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer">
                    <option value="" className="bg-[#1a1a2e]">Select week...</option>
                    <option value={CREATE_WEEK_VALUE} className="bg-[#1a1a2e]">+ Create new past week...</option>
                    {allWeeks.map((w) => (<option key={w.id} value={w.id} className="bg-[#1a1a2e]">#{w.id} — {w.theme}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Submitted By</label>
                  <select value={editWinnerUserId} onChange={(e) => setEditWinnerUserId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer">
                    <option value="" className="bg-[#1a1a2e]">Select user...</option>
                    {users.map((u) => (<option key={u.id} value={u.id} className="bg-[#1a1a2e]">{u.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Watched Date</label>
                  <input type="date" value={editWinnerWatchedDate} onChange={(e) => setEditWinnerWatchedDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Screening Date & Time</label>
                <div className="flex gap-2">
                  <input type="date" value={editWinnerScreeningAt ? editWinnerScreeningAt.slice(0, 10) : ""} onChange={(e) => setEditWinnerScreeningAt(e.target.value + "T" + (editWinnerScreeningAt?.slice(11, 16) || "00:00"))} className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                  <input type="time" value={editWinnerScreeningAt ? editWinnerScreeningAt.slice(11, 16) : ""} onChange={(e) => setEditWinnerScreeningAt((editWinnerScreeningAt?.slice(0, 10) || "2026-01-01") + "T" + e.target.value)} className="w-28 shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]" />
                </div>
                <p className="text-[10px] text-white/30 mt-1">When the movie will be screened (shown on main page when winner is published)</p>
              </div>
              {editWinnerShowCreateWeek && (
                <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
                  <p className="text-xs text-white/50">Create a new past week for this winner.</p>
                  <input type="text" value={editWinnerNewWeekTheme} onChange={(e) => setEditWinnerNewWeekTheme(e.target.value)} placeholder="Theme name" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">Start date</label><input type="date" value={editWinnerNewWeekStart} onChange={(e) => setEditWinnerNewWeekStart(e.target.value)} className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]" /></div>
                    <div><label className="text-[11px] text-white/30 uppercase tracking-widest mb-1 block">End date</label><input type="date" value={editWinnerNewWeekEnd} onChange={(e) => setEditWinnerNewWeekEnd(e.target.value)} className="w-full min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 [color-scheme:dark]" /></div>
                  </div>
                  <button type="button" onClick={() => createPastWeekForWinner(true)} disabled={!editWinnerNewWeekTheme.trim() || editWinnerCreatingWeek} className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-40 text-sm font-medium">{editWinnerCreatingWeek ? "Creating..." : "Create & Select"}</button>
                </div>
              )}
              {editWinnerError && <p className="text-red-400/80 text-xs">{editWinnerError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingWinner(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white/70 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingWinnerEdit} className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">{savingWinnerEdit ? "Saving..." : "Save Changes"}</button>
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
  voteCount,
}: {
  sub: { id: string; movieTitle: string; year?: string; posterUrl: string; userName: string; letterboxdUrl: string; createdAt: string };
  onEdit: () => void;
  onRemove: () => void;
  removing?: boolean;
  voteCount?: number;
}) {
  return (
    <div className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
      {sub.posterUrl ? (
        <img src={sub.posterUrl} alt={sub.movieTitle} className="w-10 h-14 rounded object-cover flex-shrink-0 bg-white/5" />
      ) : (
        <div className="w-10 h-14 rounded bg-white/5 flex items-center justify-center flex-shrink-0"><span className="text-white/15 text-lg font-bold">{sub.movieTitle.charAt(0)}</span></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80 truncate">{sub.movieTitle}{sub.year && <span className="text-white/30 ml-1">({sub.year})</span>}</p>
        <p className="text-[11px] text-white/30">Submitted by <span className="text-white/50">{sub.userName}</span> &middot; {new Date(sub.createdAt).toLocaleString()}</p>
      </div>
      {voteCount !== undefined && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.959a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.287 3.96c.3.92-.755 1.688-1.54 1.118l-3.371-2.449a1 1 0 00-1.175 0l-3.37 2.45c-.785.569-1.84-.198-1.54-1.119l1.287-3.959a1 1 0 00-.364-1.118L2.075 9.386c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.274-3.96z" /></svg>
          <span className="text-xs font-semibold text-amber-300/90 tabular-nums">{voteCount} vote{voteCount !== 1 ? "s" : ""}</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button type="button" onClick={onEdit} className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors cursor-pointer">Edit</button>
        <button type="button" onClick={onRemove} disabled={removing} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50">{removing ? "..." : "Remove"}</button>
        {sub.letterboxdUrl && <a href={sub.letterboxdUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400/60 hover:text-purple-400 transition-colors cursor-pointer" onClick={(e) => { e.preventDefault(); window.open(sub.letterboxdUrl, "_blank", "noopener,noreferrer"); }}>Letterboxd</a>}
      </div>
    </div>
  );
}
