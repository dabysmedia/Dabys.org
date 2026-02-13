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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
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
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-red-400/90 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deletingId === entry.id ? "…" : "Delete"}
                </button>
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
