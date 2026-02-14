"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TCG_TRACKED_KEY = "tcg-tracked-winner-ids";

interface PinnedProgressItem {
  winnerId: string;
  movieTitle: string;
  owned: number;
  total: number;
  completed: boolean;
  entries: { characterName: string; actorName: string; owned: boolean }[];
}

interface QuestLogSidebarProps {
  currentUserId: string;
}

export function QuestLogSidebar({ currentUserId }: QuestLogSidebarProps) {
  const [open, setOpen] = useState(false);
  const [trackedWinnerIds, setTrackedWinnerIds] = useState<string[]>([]);
  const [pinnedProgress, setPinnedProgress] = useState<PinnedProgressItem[]>([]);

  // Sync tracked IDs from localStorage (same key as cards page)
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(TCG_TRACKED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setTrackedWinnerIds(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
      } catch {
        setTrackedWinnerIds([]);
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, []);

  // Fetch badge progress for each tracked winner
  useEffect(() => {
    if (!currentUserId || trackedWinnerIds.length === 0) {
      setPinnedProgress([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      trackedWinnerIds.map((winnerId) =>
        fetch(
          `/api/cards/winner-collection?winnerId=${encodeURIComponent(winnerId)}&userId=${encodeURIComponent(currentUserId)}`
        ).then((r) => r.json())
      )
    )
      .then((results) => {
        if (cancelled) return;
        setPinnedProgress(
          results
            .filter((d: { poolEntries?: unknown; error?: unknown }) => d.poolEntries && !d.error)
            .map((d: {
              winnerId: string;
              movieTitle: string;
              poolEntries?: { characterId: string; characterName: string; actorName: string }[];
              ownedCharacterIds?: string[];
              completed?: boolean;
            }) => {
              const ownedSet = new Set(d.ownedCharacterIds ?? []);
              const entries = (d.poolEntries ?? []).map(
                (e: { characterId: string; characterName: string; actorName: string }) => ({
                  characterName: e.characterName ?? "?",
                  actorName: e.actorName ?? "",
                  owned: ownedSet.has(e.characterId),
                })
              );
              return {
                winnerId: d.winnerId ?? "",
                movieTitle: d.movieTitle ?? (d.poolEntries?.[0] as { movieTitle?: string } | undefined)?.movieTitle ?? "",
                owned: (d.ownedCharacterIds ?? []).length,
                total: (d.poolEntries ?? []).length,
                completed: !!d.completed,
                entries,
              };
            })
        );
      })
      .catch(() => {
        if (!cancelled) setPinnedProgress([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, trackedWinnerIds]);

  function unpinWinner(winnerId: string) {
    const next = trackedWinnerIds.filter((id) => id !== winnerId);
    setTrackedWinnerIds(next);
    localStorage.setItem(TCG_TRACKED_KEY, JSON.stringify(next));
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 w-10 h-24 flex items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-white/[0.03] backdrop-blur-xl text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.08)] hidden md:flex"
          aria-label="Open quest log"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </button>
      )}

      <aside
        className={`fixed left-0 z-50 w-72 max-w-[85vw] border-r border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out hidden md:block ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ top: "var(--header-height)", height: "calc(100vh - var(--header-height))" }}
        aria-label="Quest log"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
              Quest log
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Close quest log"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-autocomplete py-2">
            {pinnedProgress.length === 0 ? (
              <p className="px-4 py-6 text-sm text-white/40 text-center">No quests yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {pinnedProgress.map((p) => (
                  <li key={p.winnerId} className="group relative">
                    <Link
                      href={`/winners/${p.winnerId}`}
                      className="flex flex-col gap-0.5 px-4 py-3 hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="text-sm font-medium text-white/80 truncate">
                        {p.movieTitle || "Movie"}
                      </span>
                      <span
                        className={`text-xs ${p.completed ? "text-amber-400" : "text-white/50"}`}
                      >
                        {p.completed ? "✓ Complete" : `${p.owned}/${p.total} cards`}
                      </span>
                    </Link>
                    {p.entries.length > 0 && (
                      <div className="px-4 pb-2 pt-0 max-h-0 overflow-hidden group-hover:max-h-40 group-hover:overflow-y-auto transition-[max-height] duration-200 ease-out">
                        <ul className="space-y-1 border-t border-white/10 pt-2 mt-0">
                          {p.entries.map((e, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-[10px]">
                              <span
                                className={e.owned ? "text-amber-400" : "text-white/30"}
                                aria-hidden
                              >
                                {e.owned ? "✓" : "—"}
                              </span>
                              <span
                                className={`truncate flex-1 ${e.owned ? "text-white/70" : "text-white/40"}`}
                              >
                                {e.characterName}
                                {e.actorName ? ` (${e.actorName})` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        unpinWinner(p.winnerId);
                      }}
                      className="absolute top-2 right-4 w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove from quest log"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
