"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Vote {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  submissionId: string;
  createdAt: string;
}

interface Submission {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  movieTitle: string;
  year?: string;
}

interface WeekData {
  id: string;
  theme: string;
  phase: string;
}

export default function AdminVotesPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [filterWeekId, setFilterWeekId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [votesRes, subsRes, weeksRes] = await Promise.all([
          fetch("/api/votes"),
          fetch("/api/submissions"),
          fetch("/api/weeks"),
        ]);
        if (votesRes.ok) setVotes(await votesRes.json());
        if (subsRes.ok) setSubmissions(await subsRes.json());
        if (weeksRes.ok) setWeeks(await weeksRes.json());
      } catch (err) {
        console.error("Failed to load votes", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const subById = new Map(submissions.map((s) => [s.id, s]));
  const weekById = new Map(weeks.map((w) => [w.id, w]));

  const filteredVotes = filterWeekId
    ? votes.filter((v) => v.weekId === filterWeekId)
    : votes;

  const sortedVotes = [...filteredVotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-white/90">Votes</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-white/50">Week</label>
          <select
            value={filterWeekId}
            onChange={(e) => setFilterWeekId(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-3 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="">All weeks</option>
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.theme || w.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-white/50 text-sm mb-6">
        {filteredVotes.length} vote{filteredVotes.length !== 1 ? "s" : ""}
        {filterWeekId ? ` for this week` : " across all weeks"}.
      </p>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Voter
                </th>
                <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Voted for
                </th>
                <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Week / Theme
                </th>
                <th className="px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedVotes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/40">
                    No votes yet.
                  </td>
                </tr>
              ) : (
                sortedVotes.map((v) => {
                  const sub = subById.get(v.submissionId);
                  const week = weekById.get(v.weekId);
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="px-4 py-3 text-white/90 font-medium">
                        {v.userName || v.userId || "—"}
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {sub ? (
                          <span>
                            {sub.movieTitle}
                            {sub.year ? ` (${sub.year})` : ""}
                          </span>
                        ) : (
                          <span className="text-white/40">Unknown submission</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {week ? (
                          <span title={week.id}>{week.theme || week.id}</span>
                        ) : (
                          <span className="text-white/40">{v.weekId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-sm">
                        {new Date(v.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/admin/submissions"
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          ← View submissions
        </Link>
      </div>
    </div>
  );
}
