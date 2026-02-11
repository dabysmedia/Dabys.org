"use client";

import { useEffect, useState } from "react";

interface WeekData {
  id: string;
  theme: string;
  phase: string;
  startedAt: string;
}

const PHASES = [
  { key: "subs_open", label: "Submissions Open", desc: "Members can submit movies" },
  { key: "subs_closed", label: "Submissions Closed", desc: "No more submissions" },
  { key: "vote_open", label: "Voting Open", desc: "Members can vote" },
  { key: "vote_closed", label: "Voting Closed", desc: "No more votes, pick winner" },
  { key: "winner_published", label: "Winner Published", desc: "Winner shown on main page" },
];

const PHASE_COLORS: Record<string, string> = {
  subs_open: "border-green-500/30 bg-green-500/10 text-green-400",
  subs_closed: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  vote_open: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  vote_closed: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  winner_published: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

export default function AdminWeeksPage() {
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [allWeeks, setAllWeeks] = useState<WeekData[]>([]);
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add past week form
  const [showAddPast, setShowAddPast] = useState(false);
  const [pastTheme, setPastTheme] = useState("");
  const [pastStartDate, setPastStartDate] = useState("");
  const [pastEndDate, setPastEndDate] = useState("");
  const [addingPast, setAddingPast] = useState(false);

  // Restore week
  const [restoringWeekId, setRestoringWeekId] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<{ id: string; theme: string } | null>(null);

  useEffect(() => {
    loadWeeks();
  }, []);

  async function loadWeeks() {
    try {
      const [currentRes, allRes] = await Promise.all([
        fetch("/api/weeks/current"),
        fetch("/api/weeks"),
      ]);

      if (currentRes.ok) {
        const data = await currentRes.json();
        setCurrentWeek(data);
        setTheme(data.theme);
      }

      if (allRes.ok) {
        const data = await allRes.json();
        setAllWeeks(data);
      }
    } catch (err) {
      console.error("Failed to load weeks", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateTheme() {
    if (!theme.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/weeks/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() }),
      });
      loadWeeks();
    } finally {
      setSaving(false);
    }
  }

  async function setPhase(phase: string) {
    setSaving(true);
    try {
      await fetch("/api/weeks/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      loadWeeks();
    } finally {
      setSaving(false);
    }
  }

  async function resetWeek() {
    if (!confirm("Start a new week? Current week data will be archived.")) return;
    setSaving(true);
    try {
      await fetch("/api/weeks/reset", { method: "POST" });
      setTheme("");
      loadWeeks();
    } finally {
      setSaving(false);
    }
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
      loadWeeks();
    } finally {
      setSaving(false);
    }
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
      if (res.ok) {
        setRestoreConfirm(null);
        loadWeeks();
      }
    } catch { /* ignore */ }
    finally { setRestoringWeekId(null); }
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
        setPastTheme("");
        setPastStartDate("");
        setPastEndDate("");
        setShowAddPast(false);
        loadWeeks();
      }
    } catch { /* ignore */ }
    finally { setAddingPast(false); }
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
        <h1 className="text-2xl font-bold text-white/90">Week & Phases</h1>
        <button
          onClick={() => setShowAddPast(!showAddPast)}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20 hover:bg-purple-500/25 transition-all cursor-pointer"
        >
          {showAddPast ? "Cancel" : "+ Add Past Week"}
        </button>
      </div>

      {/* Add past week form */}
      {showAddPast && (
        <div className="rounded-xl border border-purple-500/15 bg-white/[0.03] p-6 mb-8">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
            Add Past Week
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Theme</label>
              <input
                type="text"
                value={pastTheme}
                onChange={(e) => setPastTheme(e.target.value)}
                placeholder="e.g. Horror, Sci-Fi, Crime..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/40 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">Start Date</label>
                <input
                  type="date"
                  value={pastStartDate}
                  onChange={(e) => setPastStartDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[11px] text-white/30 uppercase tracking-widest mb-1.5 block">End Date</label>
                <input
                  type="date"
                  value={pastEndDate}
                  onChange={(e) => setPastEndDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
            <button
              onClick={addPastWeek}
              disabled={!pastTheme.trim() || addingPast}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {addingPast ? "Adding..." : "Add Past Week"}
            </button>
          </div>
        </div>
      )}

      {!currentWeek ? (
        /* No active week — start one */
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <p className="text-white/50 mb-4">No active week. Start a new one:</p>
          <div className="flex gap-3 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Enter theme..."
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
            />
            <button
              onClick={startFirstWeek}
              disabled={saving || !theme.trim()}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Start Week
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Current week card */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
                Current Week
              </h2>
              <span className="text-[11px] text-white/25">
                Started {new Date(currentWeek.startedAt).toLocaleDateString()}
              </span>
            </div>

            {/* Theme editor */}
            <div className="mb-6">
              <label className="text-xs text-white/40 mb-2 block">Theme</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
                />
                <button
                  onClick={updateTheme}
                  disabled={saving || theme === currentWeek.theme}
                  className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-white/60 hover:text-white hover:bg-white/[0.1] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  Update
                </button>
              </div>
            </div>

            {/* Phase selector */}
            <label className="text-xs text-white/40 mb-3 block">Phase</label>
            <div className="space-y-2">
              {PHASES.map((p) => {
                const isActive = currentWeek.phase === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => setPhase(p.key)}
                    disabled={saving}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isActive
                        ? PHASE_COLORS[p.key]
                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className={`text-[11px] ${isActive ? "opacity-70" : "text-white/20"}`}>
                          {p.desc}
                        </p>
                      </div>
                      {isActive && (
                        <span className="text-xs font-medium opacity-80">Active</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Reset week */}
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              <button
                onClick={resetWeek}
                disabled={saving}
                className="w-full px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/80 text-sm font-medium hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer disabled:opacity-30"
              >
                Reset Week (Archive & Start Fresh)
              </button>
            </div>
          </div>

          {/* Past weeks */}
          {allWeeks.length > 1 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
                  Past Weeks
                </h2>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {allWeeks
                  .filter((w) => w.id !== currentWeek.id)
                  .map((week) => (
                    <div
                      key={week.id}
                      className="px-6 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/70">
                          {week.theme}
                        </p>
                        <p className="text-[11px] text-white/25">
                          {new Date(week.startedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[11px] text-white/20 shrink-0">Week #{week.id}</span>
                      <button
                        onClick={() => setRestoreConfirm({ id: week.id, theme: week.theme })}
                        disabled={saving}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400/90 text-xs font-medium hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Restore week
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Restore week confirmation */}
          {restoreConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !restoringWeekId && setRestoreConfirm(null)}>
              <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-white/90 font-medium mb-2">Restore this week?</p>
                <p className="text-sm text-white/50 mb-4">
                  The current week will be ended (archived). Week #{restoreConfirm.id} &quot;{restoreConfirm.theme}&quot; will become the active week again, and its submissions will be current. This cannot be undone for the week being ended.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => !restoringWeekId && setRestoreConfirm(null)}
                    className="flex-1 py-2.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => restoreWeek(restoreConfirm.id)}
                    disabled={restoringWeekId !== null}
                    className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {restoringWeekId ? "Restoring..." : "Restore week"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
