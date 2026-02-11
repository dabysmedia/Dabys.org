"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WheelData {
  entries: string[];
  lastResult: string | null;
  lastSpunAt: string | null;
}

interface WheelHistoryEntry {
  theme: string;
  confirmedAt: string;
}

export default function AdminWheelPage() {
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [entries, setEntries] = useState<string[]>([]);
  const [newEntry, setNewEntry] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Manual set state
  const [manualResult, setManualResult] = useState("");
  const [settingResult, setSettingResult] = useState(false);

  // Theme wheel settings: show current wheel or previous wheel winners
  const [showView, setShowView] = useState<"current" | "previous">("current");
  const [wheelHistory, setWheelHistory] = useState<WheelHistoryEntry[]>([]);

  useEffect(() => {
    loadWheel();
  }, []);

  useEffect(() => {
    if (showView === "previous") {
      fetch("/api/wheel/history")
        .then((r) => (r.ok ? r.json() : []))
        .then(setWheelHistory)
        .catch(() => setWheelHistory([]));
    }
  }, [showView]);

  async function loadWheel() {
    try {
      const res = await fetch("/api/wheel");
      if (res.ok) {
        const data: WheelData = await res.json();
        setWheel(data);
        setEntries([...data.entries]);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function saveEntries() {
    setError("");
    setSuccess("");
    if (entries.filter((e) => e.trim()).length < 2) {
      setError("Need at least 2 entries");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/wheel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entries.filter((e) => e.trim()) }),
      });
      if (res.ok) {
        const data = await res.json();
        setWheel(data);
        setEntries([...data.entries]);
        setSuccess("Wheel updated!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addEntry() {
    if (!newEntry.trim()) return;
    setEntries([...entries, newEntry.trim()]);
    setNewEntry("");
  }

  function removeEntry(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
  }

  function moveEntry(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= entries.length) return;
    const copy = [...entries];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setEntries(copy);
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
        <div>
          <h1 className="text-2xl font-bold text-white/90">Theme Wheel</h1>
          <p className="text-sm text-white/40 mt-1">Manage wheel entries and view from the public page</p>
        </div>
        <Link
          href="/wheel"
          target="_blank"
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all"
        >
          Open Wheel Page &rarr;
        </Link>
      </div>

      {/* Theme wheel settings: dropdown to show current vs previous winners */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white/80 mb-2">Theme wheel settings</h2>
        <label className="block text-sm text-white/50 mb-2">Show</label>
        <select
          value={showView}
          onChange={(e) => setShowView(e.target.value as "current" | "previous")}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors cursor-pointer"
        >
          <option value="current" className="bg-[#1a1a2e]">Current wheel</option>
          <option value="previous" className="bg-[#1a1a2e]">Previous wheel winners</option>
        </select>
        {showView === "previous" && (
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

      {/* Last result (when showing current wheel) */}
      {showView === "current" && wheel?.lastResult && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-purple-400/50 mb-1">Current Result</p>
              <p className="text-xl font-bold text-purple-300">{wheel.lastResult}</p>
            </div>
            {wheel.lastSpunAt && (
              <p className="text-xs text-white/20">
                {new Date(wheel.lastSpunAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Manual set result (when showing current wheel) */}
      {showView === "current" && (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white/80 mb-2">Set Result Manually</h2>
        <p className="text-xs text-white/30 mb-4">Override the wheel result without spinning. Pick from the current entries or type a custom theme.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Quick-pick from entries */}
          <select
            value=""
            onChange={(e) => { if (e.target.value) setManualResult(e.target.value); }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 outline-none focus:border-purple-500/40 transition-colors cursor-pointer appearance-none"
          >
            <option value="" disabled>Pick from wheel...</option>
            {entries.map((entry, i) => (
              <option key={i} value={entry} className="bg-[#1a1a2e] text-white">{entry}</option>
            ))}
          </select>
          <span className="text-white/20 text-xs self-center hidden sm:block">or</span>
          <input
            type="text"
            placeholder="Type custom theme..."
            value={manualResult}
            onChange={(e) => setManualResult(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
          />
          <button
            onClick={async () => {
              if (!manualResult.trim()) return;
              setSettingResult(true);
              setError("");
              setSuccess("");
              try {
                const res = await fetch("/api/wheel", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ manualResult: manualResult.trim() }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setWheel(data);
                  setSuccess(`Result set to "${manualResult.trim()}"!`);
                  setManualResult("");
                  setTimeout(() => setSuccess(""), 3000);
                } else {
                  const err = await res.json();
                  setError(err.error || "Failed to set result");
                }
              } catch { setError("Failed to set result"); }
              finally { setSettingResult(false); }
            }}
            disabled={settingResult || !manualResult.trim()}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            {settingResult ? "Setting..." : "Set Result"}
          </button>
        </div>
      </div>
      )}

      {/* Entries management (when showing current wheel) */}
      {showView === "current" && (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold text-white/80 mb-4">Wheel Entries</h2>
        <p className="text-xs text-white/30 mb-6">Add, remove, or reorder themes on the wheel. Changes take effect after saving.</p>

        {/* Entries list */}
        <div className="space-y-2 mb-6">
          {entries.length === 0 ? (
            <p className="text-white/30 text-sm py-4 text-center">No entries yet. Add at least 2 themes below.</p>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 group"
              >
                {/* Index badge */}
                <span className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                  {idx + 1}
                </span>

                {/* Entry text */}
                <span className="flex-1 text-white/80 text-sm font-medium truncate">{entry}</span>

                {/* Move buttons */}
                <button
                  onClick={() => moveEntry(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-white/20 hover:text-white/60 transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveEntry(idx, 1)}
                  disabled={idx === entries.length - 1}
                  className="p-1 text-white/20 hover:text-white/60 transition-colors disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Remove button */}
                <button
                  onClick={() => removeEntry(idx)}
                  className="p-1 text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add new entry */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Add a theme..."
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
          />
          <button
            onClick={addEntry}
            disabled={!newEntry.trim()}
            className="px-5 py-2.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-sm font-medium hover:bg-purple-500/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            + Add
          </button>
        </div>

        {/* Error / Success */}
        {error && <p className="text-red-400/80 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-400/80 text-sm mb-4">{success}</p>}

        {/* Save button */}
        <button
          onClick={saveEntries}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Wheel"}
        </button>
      </div>
      )}
    </div>
  );
}
