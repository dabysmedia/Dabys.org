"use client";

import { useEffect, useState } from "react";

interface FeedbackEntry {
  id: string;
  message: string;
  createdAt: string;
  userId?: string;
  userName?: string;
}

export default function AdminFeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/admin/feedback");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setActioningId(null);
    }
  }

  async function handleDeny(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deny" }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setActioningId(null);
    }
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white/90">Feedback</h1>
        <p className="text-sm text-white/50 mt-1">Messages sent by users via the site Feedback button.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-12 text-center text-white/50 text-sm">
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-white/90 text-sm whitespace-pre-wrap flex-1">{entry.message}</p>
                <div className="shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(entry.id)}
                    disabled={actioningId === entry.id}
                    title={entry.userId?.trim() ? "Accept and award credits to user" : "Accept (anonymous — no credits awarded)"}
                    className="px-3 py-1.5 rounded-lg text-xs text-green-400/90 hover:bg-green-500/10 border border-green-500/20 hover:border-green-500/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {actioningId === entry.id ? "…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeny(entry.id)}
                    disabled={actioningId === entry.id}
                    className="px-3 py-1.5 rounded-lg text-xs text-red-400/90 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {actioningId === entry.id ? "…" : "Deny"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
                <span>{formatDate(entry.createdAt)}</span>
                {entry.userName != null && entry.userName !== "" && (
                  <span>
                    From: {entry.userName}
                    {entry.userId != null && entry.userId !== "" && (
                      <span className="text-white/30"> ({entry.userId})</span>
                    )}
                  </span>
                )}
                {(!entry.userName || entry.userName === "") && (!entry.userId || entry.userId === "") && (
                  <span className="text-white/30">Anonymous</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
