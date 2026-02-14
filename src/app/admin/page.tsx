"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
}

interface WeekData {
  id: string;
  theme: string;
  phase: string;
  startedAt: string;
}

interface VoteData {
  id: string;
  weekId: string;
  userId: string;
  userName: string;
  submissionId: string;
  createdAt: string;
}

interface SubmissionSummary {
  id: string;
  weekId: string;
  movieTitle: string;
  year?: string;
  userName: string;
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  subs_open: { label: "Submissions Open", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  subs_closed: { label: "Submissions Closed", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  vote_open: { label: "Voting Open", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  vote_closed: { label: "Voting Closed", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  winner_published: { label: "Winner Published", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  idle: { label: "Idle", color: "text-white/40 bg-white/5 border-white/10" },
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [currentWeekVotes, setCurrentWeekVotes] = useState<VoteData[]>([]);
  const [currentWeekSubmissions, setCurrentWeekSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, weekRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/weeks/current"),
        ]);
        const usersData = await usersRes.json();
        setUsers(usersData);

        let weekData: WeekData | null = null;
        if (weekRes.ok) {
          weekData = await weekRes.json();
          setCurrentWeek(weekData);
        }

        if (weekData?.id) {
          const [votesRes, subsRes] = await Promise.all([
            fetch(`/api/votes?weekId=${weekData.id}`),
            fetch(`/api/submissions?weekId=${weekData.id}`),
          ]);
          if (votesRes.ok) {
            const votesData: VoteData[] = await votesRes.json();
            setCurrentWeekVotes(votesData);
          }
          if (subsRes.ok) {
            const subsData = await subsRes.json();
            setCurrentWeekSubmissions(
              subsData.map((s: { id: string; weekId: string; movieTitle: string; year?: string; userName: string }) => ({
                id: s.id,
                weekId: s.weekId,
                movieTitle: s.movieTitle,
                year: s.year,
                userName: s.userName,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const phaseInfo = currentWeek
    ? PHASE_LABELS[currentWeek.phase] || PHASE_LABELS.idle
    : PHASE_LABELS.idle;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white/90 mb-8">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Users */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-1">
            Total Users
          </p>
          <p className="text-3xl font-bold text-white/90">{users.length}</p>
        </div>

        {/* Current Theme */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-1">
            Current Theme
          </p>
          <p className="text-xl font-semibold text-white/80">
            {currentWeek?.theme || "No theme set"}
          </p>
        </div>

        {/* Current Phase */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-1">
            Current Phase
          </p>
          <span
            className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium border ${phaseInfo.color}`}
          >
            {phaseInfo.label}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="text-lg font-semibold text-white/80 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/admin/weeks"
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-purple-500/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                Manage Week & Phases
              </p>
              <p className="text-xs text-white/30">Set theme, advance phases, reset week</p>
            </div>
          </div>
        </a>

        <a
          href="/admin/users"
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-purple-500/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                Manage Users
              </p>
              <p className="text-xs text-white/30">Add or remove members</p>
            </div>
          </div>
        </a>

        <a
          href="/admin/submissions"
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-purple-500/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                View Submissions
              </p>
              <p className="text-xs text-white/30">See this week&apos;s movie submissions</p>
            </div>
          </div>
        </a>

        <a
          href="/admin/winners"
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-purple-500/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                Manage Winners
              </p>
              <p className="text-xs text-white/30">Publish winners, add past movies</p>
            </div>
          </div>
        </a>
      </div>

      {/* Who has voted (current week) */}
      {currentWeek && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-white/80 mb-4">Who has voted this week</h2>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {currentWeekVotes.length === 0 ? (
              <p className="px-5 py-6 text-white/50 text-sm">No votes yet for this week.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {currentWeekVotes.map((v) => {
                  const sub = currentWeekSubmissions.find((s) => s.id === v.submissionId);
                  return (
                    <li key={v.id} className="px-5 py-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-white/90">{v.userName || v.userId || "—"}</span>
                      <span className="text-white/40">voted for</span>
                      <span className="text-white/80">
                        {sub ? `${sub.movieTitle}${sub.year ? ` (${sub.year})` : ""}` : "Unknown submission"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
              <a
                href="/admin/votes"
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                View all votes →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
