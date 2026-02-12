"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DabysBetsEvent {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  oddsA: number;
  oddsB: number;
  minBet: number;
  maxBet: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminDabysBetsPage() {
  const [events, setEvents] = useState<DabysBetsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSideA, setNewSideA] = useState("");
  const [newSideB, setNewSideB] = useState("");
  const [newOddsA, setNewOddsA] = useState(1.9);
  const [newOddsB, setNewOddsB] = useState(1.9);
  const [newMinBet, setNewMinBet] = useState(5);
  const [newMaxBet, setNewMaxBet] = useState(500);
  const [newIsActive, setNewIsActive] = useState(true);

  // Edit modal
  const [editEvent, setEditEvent] = useState<DabysBetsEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSideA, setEditSideA] = useState("");
  const [editSideB, setEditSideB] = useState("");
  const [editOddsA, setEditOddsA] = useState(1.9);
  const [editOddsB, setEditOddsB] = useState(1.9);
  const [editMinBet, setEditMinBet] = useState(5);
  const [editMaxBet, setEditMaxBet] = useState(500);
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const res = await fetch("/api/admin/dabys-bets");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    setError("");
    setSuccess("");
    if (!newTitle.trim() || !newSideA.trim() || !newSideB.trim()) {
      setError("Title, side A, and side B are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/dabys-bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          sideA: newSideA.trim(),
          sideB: newSideB.trim(),
          oddsA: newOddsA,
          oddsB: newOddsB,
          minBet: newMinBet,
          maxBet: newMaxBet,
          isActive: newIsActive,
        }),
      });
      if (res.ok) {
        const event = await res.json();
        setEvents([...events, event]);
        setShowAddForm(false);
        setNewTitle("");
        setNewSideA("");
        setNewSideB("");
        setNewOddsA(1.9);
        setNewOddsB(1.9);
        setNewMinBet(5);
        setNewMaxBet(500);
        setNewIsActive(true);
        setSuccess("Event added!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to add");
      }
    } catch {
      setError("Failed to add");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(e: DabysBetsEvent) {
    setEditEvent(e);
    setEditTitle(e.title);
    setEditSideA(e.sideA);
    setEditSideB(e.sideB);
    setEditOddsA(e.oddsA);
    setEditOddsB(e.oddsB);
    setEditMinBet(e.minBet);
    setEditMaxBet(e.maxBet);
    setEditIsActive(e.isActive);
  }

  async function handleUpdate() {
    if (!editEvent) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/dabys-bets/${editEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          sideA: editSideA.trim(),
          sideB: editSideB.trim(),
          oddsA: editOddsA,
          oddsB: editOddsB,
          minBet: editMinBet,
          maxBet: editMaxBet,
          isActive: editIsActive,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEvents(events.map((ev) => (ev.id === editEvent.id ? updated : ev)));
        setEditEvent(null);
        setSuccess("Event updated!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to update");
      }
    } catch {
      setError("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/dabys-bets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents(events.filter((e) => e.id !== id));
        setEditEvent(null);
        setSuccess("Event deleted");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to delete");
      }
    } catch {
      setError("Failed to delete");
    } finally {
      setSaving(false);
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
        <div>
          <h1 className="text-2xl font-bold text-white/90">Dabys Bets</h1>
          <p className="text-sm text-white/40 mt-1">Manage betting events, odds, and bet limits</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/casino?game=dabys-bets"
            target="_blank"
            className="px-4 py-2 rounded-lg border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/10 transition-all"
          >
            Open Casino &rarr;
          </Link>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setError(""); }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer"
          >
            {showAddForm ? "Cancel" : "Add Event"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white/80 mb-4">New Event</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-white/50 mb-1">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Dabys Bowl Finals"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="text-sm text-white/50">Active</label>
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Side A</label>
              <input
                value={newSideA}
                onChange={(e) => setNewSideA(e.target.value)}
                placeholder="Team Alpha"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Odds A</label>
              <input
                type="number"
                step={0.1}
                min={1.01}
                value={newOddsA}
                onChange={(e) => setNewOddsA(parseFloat(e.target.value) || 1.9)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Side B</label>
              <input
                value={newSideB}
                onChange={(e) => setNewSideB(e.target.value)}
                placeholder="Team Beta"
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Odds B</label>
              <input
                type="number"
                step={0.1}
                min={1.01}
                value={newOddsB}
                onChange={(e) => setNewOddsB(parseFloat(e.target.value) || 1.9)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Min Bet</label>
              <input
                type="number"
                min={1}
                value={newMinBet}
                onChange={(e) => setNewMinBet(parseInt(e.target.value, 10) || 5)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Max Bet</label>
              <input
                type="number"
                min={newMinBet}
                value={newMaxBet}
                onChange={(e) => setNewMaxBet(parseInt(e.target.value, 10) || 500)}
                className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? "..." : "Add Event"}
          </button>
        </div>
      )}

      {/* Events table */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            No events yet. Add one above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Side A / Odds</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Side B / Odds</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Min / Max</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Active</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/90 font-medium">{e.title}</td>
                    <td className="px-4 py-3 text-white/70">{e.sideA} <span className="text-white/40">({e.oddsA}x)</span></td>
                    <td className="px-4 py-3 text-white/70">{e.sideB} <span className="text-white/40">({e.oddsB}x)</span></td>
                    <td className="px-4 py-3 text-white/60">{e.minBet} / {e.maxBet}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${e.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                        {e.isActive ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(e)}
                        className="text-purple-400 hover:text-purple-300 text-sm mr-3 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && setEditEvent(null)}
        >
          <div
            className="rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white/90 mb-4">Edit Event</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-white/50 mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/50 mb-1">Side A</label>
                  <input
                    value={editSideA}
                    onChange={(e) => setEditSideA(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Odds A</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editOddsA}
                    onChange={(e) => setEditOddsA(parseFloat(e.target.value) || 1.9)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Side B</label>
                  <input
                    value={editSideB}
                    onChange={(e) => setEditSideB(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Odds B</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editOddsB}
                    onChange={(e) => setEditOddsB(parseFloat(e.target.value) || 1.9)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/50 mb-1">Min Bet</label>
                  <input
                    type="number"
                    min={1}
                    value={editMinBet}
                    onChange={(e) => setEditMinBet(parseInt(e.target.value, 10) || 5)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Max Bet</label>
                  <input
                    type="number"
                    min={editMinBet}
                    value={editMaxBet}
                    onChange={(e) => setEditMaxBet(parseInt(e.target.value, 10) || 500)}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-white/90"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded cursor-pointer"
                />
                <label htmlFor="editActive" className="text-sm text-white/70 cursor-pointer">Active (visible in casino)</label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => !saving && setEditEvent(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
