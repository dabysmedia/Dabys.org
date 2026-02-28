"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { formatUtcTimeInHalifax } from "@/lib/dateUtils";

const TCG_TRACKED_KEY = "tcg-tracked-winner-ids";
const HOVER_SLEEP_KEY = "dabys-sidebar-hover-sleep";

interface PinnedProgressItem {
  winnerId: string;
  movieTitle: string;
  owned: number;
  total: number;
  completed: boolean;
  entries: { characterName: string; actorName: string; owned: boolean }[];
}

interface DailyQuestInstance {
  questType: string;
  rarity?: string;
  completed: boolean;
  claimed: boolean;
  reward: number;
  rewardType: string;
  label: string;
  description: string;
}

interface SetCompletionQuest {
  winnerId: string;
  movieTitle: string;
  reward: number;
  claimed: boolean;
  completedAt: string;
  isHolo?: boolean;
  /** When false, set was already complete before this quest was added; claim awards 0. */
  firstCompletion?: boolean;
}

interface CommunitySetCompletionQuest {
  communitySetId: string;
  creatorId: string;
  reward: number;
  creatorReward: number;
  claimed: boolean;
  completedAt: string;
  setName: string;
}

interface QuestLogSidebarProps {
  currentUserId: string;
}

const RARITY_COLORS: Record<string, string> = {
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-amber-400",
};

const RARITY_BG: Record<string, string> = {
  uncommon: "bg-green-400/10 border-green-400/20",
  rare: "bg-blue-400/10 border-blue-400/20",
  epic: "bg-purple-400/10 border-purple-400/20",
  legendary: "bg-amber-400/10 border-amber-400/20",
};

function readHoverSleep(): boolean {
  try {
    return localStorage.getItem(HOVER_SLEEP_KEY) === "true";
  } catch {
    return false;
  }
}

export function QuestLogSidebar({ currentUserId }: QuestLogSidebarProps) {
  const [open, setOpen] = useState(false);
  const [hoverMode, setHoverMode] = useState(false);
  const [sleep, setSleep] = useState(readHoverSleep);
  const [trackedWinnerIds, setTrackedWinnerIds] = useState<string[]>([]);
  const [pinnedProgress, setPinnedProgress] = useState<PinnedProgressItem[]>([]);
  const [dailyQuests, setDailyQuests] = useState<DailyQuestInstance[]>([]);
  const [weeklyQuests, setWeeklyQuests] = useState<DailyQuestInstance[]>([]);
  const [setCompletionQuests, setSetCompletionQuests] = useState<SetCompletionQuest[]>([]);
  const [communitySetCompletionQuests, setCommunitySetCompletionQuests] = useState<CommunitySetCompletionQuest[]>([]);
  const [questDate, setQuestDate] = useState<string>("");
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [claimingSetCompletionWinnerId, setClaimingSetCompletionWinnerId] = useState<string | null>(null);
  const [claimingHoloSetCompletionWinnerId, setClaimingHoloSetCompletionWinnerId] = useState<string | null>(null);
  const [claimingCommunitySetCompletionId, setClaimingCommunitySetCompletionId] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [resetHourUTC, setResetHourUTC] = useState<number>(0);
  const [rerollsUsed, setRerollsUsed] = useState<number>(0);
  const [countdown, setCountdown] = useState<string>("");
  const [rerollingIndex, setRerollingIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"quests" | "collection">("quests");
  const [dailySectionCollapsed, setDailySectionCollapsed] = useState(false);
  const [weeklySectionCollapsed, setWeeklySectionCollapsed] = useState(false);
  const [setCompletionSectionCollapsed, setSetCompletionSectionCollapsed] = useState(true);
  const [mainQuestSectionCollapsed, setMainQuestSectionCollapsed] = useState(false);
  const [mainQuestProgress, setMainQuestProgress] = useState<Array<{ definition: { id: string; label: string; description: string; targetCount: number; reward: number; rewardType: string }; current: number; target: number; completed: boolean; claimed: boolean }>>([]);
  const [claimingMainQuestId, setClaimingMainQuestId] = useState<string | null>(null);
  const [claimingWeeklyQuestType, setClaimingWeeklyQuestType] = useState<string | null>(null);

  // Sync sleep preference from other sidebar (or same) when toggled
  useEffect(() => {
    const onSleepChange = () => setSleep(readHoverSleep);
    window.addEventListener("dabys-sidebar-sleep-change", onSleepChange);
    return () => window.removeEventListener("dabys-sidebar-sleep-change", onSleepChange);
  }, []);

  // Sync tracked IDs from localStorage (same key as winners page)
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
    window.addEventListener("dabys-quest-collection-update", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
      window.removeEventListener("dabys-quest-collection-update", read);
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

  // Fetch daily quests
  const fetchQuests = useCallback(() => {
    if (!currentUserId) return;
    fetch(`/api/quests?userId=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.quests) setDailyQuests(data.quests);
        if (Array.isArray(data.weeklyQuests)) setWeeklyQuests(data.weeklyQuests);
        if (data.date) setQuestDate(data.date);
        if (typeof data.resetHourUTC === "number") setResetHourUTC(data.resetHourUTC);
        setRerollsUsed(typeof data.rerollsUsed === "number" ? data.rerollsUsed : 0);
        setSetCompletionQuests(Array.isArray(data.setCompletionQuests) ? data.setCompletionQuests : []);
        setCommunitySetCompletionQuests(Array.isArray(data.communitySetCompletionQuests) ? data.communitySetCompletionQuests : []);
      })
      .catch(() => {});
    fetch(`/api/main-quests?userId=${encodeURIComponent(currentUserId)}`)
      .then((r) => r.json())
      .then((data) => setMainQuestProgress(Array.isArray(data.progress) ? data.progress : []))
      .catch(() => setMainQuestProgress([]));
  }, [currentUserId]);

  // Refetch when a set is completed (e.g. from codex upload)
  useEffect(() => {
    const onQuestsRefresh = () => fetchQuests();
    window.addEventListener("dabys-quests-refresh", onQuestsRefresh);
    return () => window.removeEventListener("dabys-quests-refresh", onQuestsRefresh);
  }, [fetchQuests]);

  // When quest log is first opened, complete the daily login quest (server no-ops if already completed)
  useEffect(() => {
    if (!open || !currentUserId) return;
    fetch("/api/quests/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, questType: "login" }),
    })
      .then(() => fetchQuests())
      .catch(() => {});
  }, [open, currentUserId, fetchQuests]);

  useEffect(() => {
    fetchQuests();
    let interval = setInterval(fetchQuests, 30000);
    const onFocus = () => fetchQuests();
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchQuests();
        interval = setInterval(fetchQuests, 30000);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchQuests]);

  // Countdown until quest reset (next occurrence of resetHourUTC UTC)
  // Refetch when we cross the reset boundary so quests always reset at the timer
  const prevCountdownSecsRef = useRef<number | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = resetHourUTC;
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, 0, 0, 0));
      if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
      const ms = next.getTime() - now.getTime();
      const secs = Math.max(0, Math.floor(ms / 1000));
      const m = Math.floor(secs / 60) % 60;
      const hh = Math.floor(secs / 3600);
      if (hh > 0) setCountdown(`${hh}h ${m}m`);
      else if (m > 0) setCountdown(`${m}m ${secs % 60}s`);
      else setCountdown(`${secs}s`);
      // When we cross from last few seconds to next day (secs jumps from small to large), refetch for new quests
      const prev = prevCountdownSecsRef.current;
      prevCountdownSecsRef.current = secs;
      if (prev !== null && prev <= 2 && secs > 3600) {
        fetchQuests();
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [resetHourUTC, fetchQuests]);

  function unpinWinner(winnerId: string) {
    const next = trackedWinnerIds.filter((id) => id !== winnerId);
    setTrackedWinnerIds(next);
    localStorage.setItem(TCG_TRACKED_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("dabys-quest-collection-update"));
  }

  async function claimReward(questIndex: number) {
    setClaimingIndex(questIndex);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, questIndex }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchQuests();
        const delta = (data.reward ?? 0) + (data.allCompleteBonus ?? 0);
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        if (data.rewardType === "pack") {
          window.dispatchEvent(new CustomEvent("dabys-packs-refresh"));
        }
        window.dispatchEvent(new CustomEvent("dabys-notifications-refresh"));
      }
    } catch {
      // silently fail
    } finally {
      setClaimingIndex(null);
    }
  }

  async function claimSetCompletion(winnerId: string) {
    setClaimingSetCompletionWinnerId(winnerId);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, claimSetCompletion: true, winnerId }),
      });
      if (res.ok) {
        fetchQuests();
        const data = await res.json();
        const delta = data.reward ?? 0;
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        window.dispatchEvent(new CustomEvent("dabys-notifications-refresh"));
      }
    } catch {
      // silently fail
    } finally {
      setClaimingSetCompletionWinnerId(null);
    }
  }

  async function claimHoloSetCompletion(winnerId: string) {
    setClaimingHoloSetCompletionWinnerId(winnerId);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, claimHoloSetCompletion: true, winnerId }),
      });
      if (res.ok) {
        fetchQuests();
        const data = await res.json();
        const delta = data.reward ?? 0;
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        window.dispatchEvent(new CustomEvent("dabys-notifications-refresh"));
      }
    } catch {
      // silently fail
    } finally {
      setClaimingHoloSetCompletionWinnerId(null);
    }
  }

  async function claimCommunitySetCompletion(communitySetId: string) {
    setClaimingCommunitySetCompletionId(communitySetId);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, claimCommunitySetCompletion: true, communitySetId }),
      });
      if (res.ok) {
        fetchQuests();
        const data = await res.json();
        const delta = (data.reward ?? 0) + (data.creatorReward ?? 0);
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        window.dispatchEvent(new CustomEvent("dabys-notifications-refresh"));
      }
    } catch {
      // silently fail
    } finally {
      setClaimingCommunitySetCompletionId(null);
    }
  }

  async function claimWeeklyQuest(questType: string) {
    setClaimingWeeklyQuestType(questType);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, claimWeeklyQuest: true, weeklyQuestType: questType }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchQuests();
        const delta = data.reward ?? 0;
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        if (data.rewardType === "pack") {
          window.dispatchEvent(new CustomEvent("dabys-packs-refresh"));
        }
        window.dispatchEvent(new CustomEvent("dabys-notifications-refresh"));
      }
    } catch {
      // silently fail
    } finally {
      setClaimingWeeklyQuestType(null);
    }
  }

  async function claimAllRewards() {
    setClaimingAll(true);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, claimAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchQuests();
        const delta = (data.totalReward ?? 0) + (data.allCompleteBonus ?? 0);
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        if (data.packIds?.length) {
          window.dispatchEvent(new CustomEvent("dabys-packs-refresh"));
        }
        window.dispatchEvent(new CustomEvent("dabys-notifications-refresh"));
      }
    } catch {
      // silently fail
    } finally {
      setClaimingAll(false);
    }
  }

  const completedCount = dailyQuests.filter((q) => q.completed).length;
  const totalCount = dailyQuests.length;
  const dailyClaimable = dailyQuests.filter((q) => q.completed && !q.claimed).length;
  const weeklyClaimable = weeklyQuests.filter((q) => q.completed && !q.claimed).length;
  const setCompletionClaimable = setCompletionQuests.filter((q) => !q.claimed).length;
  const communitySetClaimable = communitySetCompletionQuests.filter((q) => !q.claimed).length;
  const mainQuestClaimable = mainQuestProgress.filter((q) => q.completed && !q.claimed).length;
  const claimableCount = dailyClaimable + weeklyClaimable + setCompletionClaimable + communitySetClaimable + mainQuestClaimable;
  const allClaimed = dailyQuests.length > 0 && dailyQuests.every((q) => q.claimed);

  // Auto-expand sections when there are claimable quests
  useEffect(() => {
    if (dailyClaimable > 0) setDailySectionCollapsed(false);
    if (weeklyClaimable > 0) setWeeklySectionCollapsed(false);
    if (setCompletionClaimable > 0) setSetCompletionSectionCollapsed(false);
    if (mainQuestClaimable > 0) setMainQuestSectionCollapsed(false);
  }, [dailyClaimable, weeklyClaimable, setCompletionClaimable, mainQuestClaimable]);
  const rerollsRemaining = Math.max(0, 1 - rerollsUsed);

  async function claimMainQuest(questId: string) {
    setClaimingMainQuestId(questId);
    try {
      const res = await fetch("/api/main-quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, questId }),
      });
      if (res.ok) {
        fetchQuests();
        const data = await res.json();
        const delta = data.reward ?? 0;
        if (delta > 0) {
          window.dispatchEvent(new CustomEvent("dabys-credits-refresh", { detail: { delta } }));
        }
        if (data.rewardType === "pack") {
          window.dispatchEvent(new CustomEvent("dabys-packs-refresh"));
        }
      }
    } catch {
      // silently fail
    } finally {
      setClaimingMainQuestId(null);
    }
  }

  async function handleReroll(questIndex: number) {
    setRerollingIndex(questIndex);
    try {
      const res = await fetch("/api/quests/reroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, questIndex }),
      });
      if (res.ok) fetchQuests();
    } catch {
      // silently fail
    } finally {
      setRerollingIndex(null);
    }
  }

  function openByHover() {
    if (!sleep) {
      setOpen(true);
      setHoverMode(true);
    }
  }

  function openByClick() {
    setOpen(true);
    setHoverMode(false);
  }

  function handleMouseLeave() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7f2eb56-19f7-42ad-9389-2b8c37b5549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuestLogSidebar.tsx:handleMouseLeave',message:'handleMouseLeave fired',data:{hoverMode,willClose:hoverMode},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (hoverMode) {
      setOpen(false);
      setHoverMode(false);
    }
  }

  function toggleSleep() {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f7f2eb56-19f7-42ad-9389-2b8c37b5549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuestLogSidebar.tsx:toggleSleep',message:'toggleSleep called',data:{sleep,next:!sleep},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const next = !sleep;
    setSleep(next);
    localStorage.setItem(HOVER_SLEEP_KEY, String(next));
    window.dispatchEvent(new CustomEvent("dabys-sidebar-sleep-change"));
  }

  return (
    <>
      {/* Overlay — only when opened by click, not hover */}
      {open && !hoverMode && (
        <div
          className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
          style={{ top: "var(--header-height)" }}
          aria-hidden
          onClick={() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f7f2eb56-19f7-42ad-9389-2b8c37b5549',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuestLogSidebar.tsx:overlay-click',message:'Overlay clicked (closing sidebar)',data:{open,hoverMode},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            setOpen(false);
          }}
        />
      )}

      {/* Hover zone — tab + sidebar; z-50 so it sits above overlay (z-45) and receives clicks */}
      <div
        className="fixed left-0 z-50 flex flex-col overflow-hidden transition-[width] duration-200 ease-out"
        style={{
          top: "var(--header-height)",
          height: "calc(100vh - var(--header-height))",
          width: open ? "20rem" : "2.5rem",
        }}
        onMouseLeave={handleMouseLeave}
      >
        {!open && (
          <button
            type="button"
            onClick={openByClick}
            onMouseEnter={() => !open && openByHover()}
            className="absolute left-0 top-[22%] -translate-y-1/2 w-10 h-24 flex items-center justify-center rounded-r-xl border border-l-0 border-white/10 bg-white/[0.03] backdrop-blur-xl text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
            aria-label="Open quest log"
          >
            <div className="relative">
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
              {claimableCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center animate-pulse">
                  {claimableCount}
                </span>
              )}
            </div>
          </button>
        )}

        <aside
          className={`absolute left-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] border-r border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Quest log"
        >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
              Quest Log
            </h2>
            <button
              type="button"
              onClick={() => { setOpen(false); setHoverMode(false); }}
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

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveTab("quests")}
              className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "quests"
                  ? "text-amber-400 border-b-2 border-amber-400/60"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Quests
              {claimableCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                  {claimableCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("collection")}
              className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                activeTab === "collection"
                  ? "text-purple-400 border-b-2 border-purple-400/60"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Collection
              {setCompletionClaimable > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-bold">
                  {setCompletionClaimable}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-autocomplete">
            {/* ─── QUESTS TAB (unified: Weekly, Daily, Set completion, Main) ─── */}
            {activeTab === "quests" && (
              <div className="py-3 space-y-4">
                {/* ─── Weekly quests (submit/vote) — shown first when present ─── */}
                {weeklyQuests.length > 0 && (
                  <div className="px-4">
                    <button
                      type="button"
                      onClick={() => setWeeklySectionCollapsed((c) => !c)}
                      className="flex items-center gap-2 w-full text-left group cursor-pointer"
                      aria-expanded={!weeklySectionCollapsed}
                    >
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">This week</span>
                      {weeklyClaimable > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                          {weeklyClaimable}
                        </span>
                      )}
                      <span
                        className={`ml-auto text-white/30 transition-transform ${weeklySectionCollapsed ? "" : "rotate-180"}`}
                        aria-hidden
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>
                    {!weeklySectionCollapsed && (
                      <div className="mt-2">
                        <ul className="space-y-1">
                          {weeklyQuests.map((quest) => {
                            const isClaimable = quest.completed && !quest.claimed;
                            const isClaiming = claimingWeeklyQuestType === quest.questType;
                            return (
                              <li
                                key={quest.questType}
                                className={`rounded-xl border transition-all ${
                                  quest.claimed
                                    ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                                    : quest.completed
                                      ? "border-amber-500/20 bg-amber-500/5"
                                      : "border-white/[0.06] bg-white/[0.02]"
                                } p-2.5`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {quest.claimed ? (
                                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    ) : quest.completed ? (
                                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                                        <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-full border border-white/10 bg-white/[0.03]" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-medium truncate block ${quest.claimed ? "text-white/40 line-through" : quest.completed ? "text-white/90" : "text-white/70"}`}>
                                      {quest.label}
                                    </span>
                                    <p className="text-[10px] text-white/35 mt-0.5 truncate">{quest.description}</p>
                                  </div>
                                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    <span className="text-[10px] text-amber-400/80 font-medium whitespace-nowrap">
                                      {quest.rewardType === "pack" ? "1 pack" : `+${quest.reward} ${quest.rewardType === "stardust" ? "SD" : "cr"}`}
                                    </span>
                                    {isClaimable && (
                                      <button
                                        type="button"
                                        onClick={() => claimWeeklyQuest(quest.questType)}
                                        disabled={isClaiming}
                                        className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-400 text-[10px] font-semibold hover:bg-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                                      >
                                        {isClaiming ? (
                                          <span className="inline-block w-2.5 h-2.5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                        ) : (
                                          "Claim"
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Daily section ─── */}
                <div className="px-4">
                  <button
                    type="button"
                    onClick={() => setDailySectionCollapsed((c) => !c)}
                    className="flex items-center gap-2 w-full text-left group cursor-pointer"
                    aria-expanded={!dailySectionCollapsed}
                  >
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Daily</span>
                    {dailyClaimable > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                        {dailyClaimable}
                      </span>
                    )}
                    <span className="text-[10px] text-white/35 ml-1">
                      {completedCount}/{totalCount}
                    </span>
                    <span
                      className={`ml-auto text-white/30 transition-transform ${dailySectionCollapsed ? "" : "rotate-180"}`}
                      aria-hidden
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {!dailySectionCollapsed && (
                    <div className="mt-2">
                      {/* Progress summary + countdown */}
                      {dailyQuests.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-white/40 uppercase tracking-wider">
                              {questDate ? `${questDate}` : "Today"}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                            />
                          </div>
                          {countdown && (
                            <p className="text-[10px] text-white/35 mt-1.5">
                              Resets in {countdown} · {formatUtcTimeInHalifax(resetHourUTC)} (Halifax)
                              {rerollsRemaining > 0 && (
                                <span className="text-purple-400/70 ml-1">· 1 reroll left</span>
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Claim All button (daily quests only) */}
                      {dailyClaimable > 1 && (
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={claimAllRewards}
                            disabled={claimingAll}
                            className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-400/20 border border-amber-400/30 text-amber-400 text-xs font-medium hover:from-amber-500/30 hover:to-amber-400/30 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {claimingAll ? (
                              <span className="inline-block w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                            ) : (
                              `Claim All (${dailyClaimable} rewards)`
                            )}
                          </button>
                        </div>
                      )}

                      {dailyQuests.length === 0 ? (
                        <p className="py-6 text-sm text-white/40 text-center">
                          Loading quests...
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {dailyQuests.map((quest, idx) => {
                            const isClaimable = quest.completed && !quest.claimed;
                            const isClaiming = claimingIndex === idx;
                            const canReroll = !quest.completed && !quest.claimed && rerollsRemaining > 0;
                            const isRerolling = rerollingIndex === idx;

                            return (
                              <li
                                key={idx}
                                className={`relative rounded-xl border transition-all duration-200 ${
                                  quest.claimed
                                    ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                                    : isClaimable
                                      ? "border-amber-400/20 bg-amber-400/[0.04]"
                                      : "border-white/[0.06] bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                  {/* Status icon */}
                                  <div className="flex-shrink-0 mt-0.5">
                              {quest.claimed ? (
                                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              ) : quest.completed ? (
                                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                                  <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-white/10 bg-white/[0.03]" />
                              )}
                            </div>

                            {/* Quest info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-medium truncate ${quest.claimed ? "text-white/40 line-through" : quest.completed ? "text-white/90" : "text-white/70"}`}>
                                  {quest.label}
                                </span>
                              </div>
                              {quest.rarity && (
                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border mt-1 inline-block ${RARITY_BG[quest.rarity] || ""} ${RARITY_COLORS[quest.rarity] || "text-white/50"}`}>
                                  {quest.rarity.charAt(0).toUpperCase() + quest.rarity.slice(1)}
                                </span>
                              )}
                              <p className="text-[10px] text-white/35 mt-0.5 truncate">{quest.description}</p>
                              {canReroll && (
                                <button
                                  type="button"
                                  onClick={() => handleReroll(idx)}
                                  disabled={isRerolling}
                                  className="mt-1.5 text-[10px] text-purple-400/80 hover:text-purple-400 font-medium cursor-pointer disabled:opacity-50"
                                >
                                  {isRerolling ? "Rerolling…" : "Reroll quest"}
                                </button>
                              )}
                            </div>

                            {/* Reward / Claim button */}
                            <div className="flex-shrink-0 flex flex-col items-end gap-1">
                              <span className="text-[10px] text-amber-400/80 font-medium whitespace-nowrap">
                                {quest.rewardType === "pack" ? "1 pack" : `+${quest.reward} ${quest.rewardType === "stardust" ? "SD" : "cr"}`}
                              </span>
                              {isClaimable && (
                                <button
                                  type="button"
                                  onClick={() => claimReward(idx)}
                                  disabled={isClaiming}
                                  className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-400 text-[10px] font-semibold hover:bg-amber-500/30 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {isClaiming ? (
                                    <span className="inline-block w-2.5 h-2.5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                  ) : (
                                    "Claim"
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                        </ul>
                      )}

                      {/* All quests done message */}
                      {allClaimed && dailyQuests.length > 0 && (
                        <div className="py-4 text-center">
                          <p className="text-xs text-green-400/70">All daily quests completed!</p>
                          <p className="text-[10px] text-amber-400/60 mt-1">Completion bonus awarded</p>
                          <p className="text-[10px] text-white/30 mt-0.5">New quests at {formatUtcTimeInHalifax(resetHourUTC)} (Halifax)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── Main quests section ─── */}
                <div className="px-4">
                  <button
                    type="button"
                    onClick={() => setMainQuestSectionCollapsed((c) => !c)}
                    className="flex items-center gap-2 w-full text-left group cursor-pointer"
                    aria-expanded={!mainQuestSectionCollapsed}
                  >
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Main quests</span>
                    {mainQuestClaimable > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-cyan-500/20 text-cyan-400 text-[9px] font-bold">
                        {mainQuestClaimable}
                      </span>
                    )}
                    <span
                      className={`ml-auto text-white/30 transition-transform ${mainQuestSectionCollapsed ? "" : "rotate-180"}`}
                      aria-hidden
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {!mainQuestSectionCollapsed && (
                    <div className="mt-2">
                      {mainQuestProgress.length === 0 ? (
                        <p className="text-[10px] text-white/30 py-2">No main quests yet. Admin can add them.</p>
                      ) : (
                        <ul className="space-y-1">
                          {mainQuestProgress.map((q) => {
                            const isClaimable = q.completed && !q.claimed;
                            const isClaiming = claimingMainQuestId === q.definition.id;
                            const pct = q.target > 0 ? Math.min(100, (q.current / q.target) * 100) : 0;
                            return (
                              <li
                                key={q.definition.id}
                                className={`rounded-xl border transition-all ${
                                  q.claimed
                                    ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                                    : isClaimable
                                      ? "border-cyan-400/20 bg-cyan-400/[0.04]"
                                      : "border-white/[0.06] bg-white/[0.02]"
                                }`}
                              >
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-medium truncate block ${q.claimed ? "text-white/40 line-through" : "text-white/90"}`}>
                                      {q.definition.label}
                                    </span>
                                    <p className="text-[10px] text-white/35 mt-0.5">{q.definition.description}</p>
                                    <div className="mt-1.5 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-white/40 mt-0.5">
                                      {q.current}/{q.target}
                                    </span>
                                  </div>
                                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    <span className="text-[10px] font-medium text-cyan-300/80">
                                      {q.definition.rewardType === "pack" ? "1 pack" : `+${q.definition.reward} ${q.definition.rewardType === "stardust" ? "★" : "cr"}`}
                                    </span>
                                    {isClaimable ? (
                                      <button
                                        type="button"
                                        onClick={() => claimMainQuest(q.definition.id)}
                                        disabled={isClaiming}
                                        className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                                      >
                                        {isClaiming ? (
                                          <span className="inline-block w-2.5 h-2.5 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                                        ) : (
                                          "Claim"
                                        )}
                                      </button>
                                    ) : q.claimed ? (
                                      <span className="text-[10px] font-medium text-cyan-300/60">✓</span>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── COLLECTION TAB ─── */}
            {activeTab === "collection" && (
              <div className="py-2">
                {/* Set completion — collapsible */}
                <div className="px-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setSetCompletionSectionCollapsed((c) => !c)}
                    className="flex items-center gap-2 w-full text-left group cursor-pointer"
                    aria-expanded={!setCompletionSectionCollapsed}
                  >
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Set complete</span>
                    {setCompletionClaimable > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-bold">
                        {setCompletionClaimable}
                      </span>
                    )}
                    <span
                      className={`ml-auto text-white/30 transition-transform ${setCompletionSectionCollapsed ? "" : "rotate-180"}`}
                      aria-hidden
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {!setCompletionSectionCollapsed && (
                    <div className="mt-2">
                      {setCompletionQuests.length === 0 ? (
                        <p className="text-[10px] text-white/30 py-2">No set completions yet. Complete a movie set and claim here.</p>
                      ) : (
                        <ul className="space-y-1">
                          {setCompletionQuests.map((q) => {
                            const isHolo = q.isHolo === true;
                            const isClaimable = !q.claimed;
                            const isClaiming = isHolo
                              ? claimingHoloSetCompletionWinnerId === q.winnerId
                              : claimingSetCompletionWinnerId === q.winnerId;
                            const effectiveReward = q.firstCompletion !== false ? q.reward : 0;
                            return (
                              <li
                                key={`${q.winnerId}-${isHolo ? "holo" : "reg"}`}
                                className={`rounded-xl border transition-all ${
                                  q.claimed
                                    ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                                    : isHolo
                                      ? "border-indigo-400/30 bg-indigo-500/[0.06]"
                                      : "border-emerald-500/20 bg-emerald-500/[0.04]"
                                }`}
                              >
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-medium truncate block ${q.claimed ? "text-white/40 line-through" : "text-white/90"}`}>
                                      {isHolo ? "Holo Complete" : "Complete"}: {q.movieTitle}
                                    </span>
                                    <p className="text-[10px] text-white/35 mt-0.5">
                                      {isHolo ? "Upgraded all codex slots to holo" : "Collected all cards for this movie"}
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    {effectiveReward > 0 && (
                                      <span className={`text-[10px] font-medium whitespace-nowrap ${isHolo ? "text-indigo-300/80" : "text-amber-400/80"}`}>
                                        +{effectiveReward} cr
                                      </span>
                                    )}
                                    {isClaimable ? (
                                      <button
                                        type="button"
                                        onClick={() => isHolo ? claimHoloSetCompletion(q.winnerId) : claimSetCompletion(q.winnerId)}
                                        disabled={isClaiming}
                                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                                          isHolo
                                            ? "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/30"
                                            : "bg-amber-500/20 border border-amber-400/30 text-amber-400 hover:bg-amber-500/30"
                                        }`}
                                      >
                                        {isClaiming ? (
                                          <span className={`inline-block w-2.5 h-2.5 border rounded-full animate-spin ${isHolo ? "border-indigo-400/30 border-t-indigo-400" : "border-amber-400/30 border-t-amber-400"}`} />
                                        ) : (
                                          "Claim"
                                        )}
                                      </button>
                                    ) : (
                                      <span className={`text-[10px] font-medium ${isHolo ? "text-indigo-300/60" : "text-emerald-400/60"}`}>
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {communitySetCompletionQuests.length > 0 && (
                        <ul className="space-y-1 mt-2">
                          {communitySetCompletionQuests.map((q) => {
                            const isClaimable = !q.claimed;
                            const isClaiming = claimingCommunitySetCompletionId === q.communitySetId;
                            return (
                              <li
                                key={q.communitySetId}
                                className={`rounded-xl border transition-all ${
                                  q.claimed
                                    ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                                    : "border-teal-500/20 bg-teal-500/[0.04]"
                                }`}
                              >
                                <div className="flex items-start gap-3 px-3 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-medium truncate block ${q.claimed ? "text-white/40 line-through" : "text-white/90"}`}>
                                      Community: {q.setName}
                                    </span>
                                    <p className="text-[10px] text-white/35 mt-0.5">
                                      {q.reward} cr (+{q.creatorReward} to creator)
                                    </p>
                                  </div>
                                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                    {q.reward > 0 && (
                                      <span className="text-[10px] font-medium whitespace-nowrap text-teal-300/80">
                                        +{q.reward} cr
                                      </span>
                                    )}
                                    {isClaimable ? (
                                      <button
                                        type="button"
                                        onClick={() => claimCommunitySetCompletion(q.communitySetId)}
                                        disabled={isClaiming}
                                        className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer disabled:opacity-50 bg-teal-500/20 border border-teal-400/30 text-teal-300 hover:bg-teal-500/30"
                                      >
                                        {isClaiming ? (
                                          <span className="inline-block w-2.5 h-2.5 border border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                                        ) : (
                                          "Claim"
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-medium text-teal-400/60">✓</span>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Pinned movie progress */}
                {pinnedProgress.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-white/40 text-center">
                    No collection quests pinned.
                    <br />
                    <span className="text-[10px] text-white/25">Pin movies from the winners page to track here.</span>
                  </p>
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
                            {p.completed ? "Complete" : `${p.owned}/${p.total} cards`}
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
                                    {e.owned ? "+" : "-"}
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
            )}
          </div>

          {/* Toggle mouseover — disable hover-to-expand when checked */}
          <div
            className="flex-shrink-0 px-3 py-2 border-t border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="switch"
              aria-checked={sleep}
              onClick={toggleSleep}
              className="flex items-center gap-2 cursor-pointer text-white/40 hover:text-white/60 transition-colors select-none text-[10px] uppercase tracking-wider bg-transparent border-0 p-0"
            >
              <span
                className={`inline-block h-3 w-5 shrink-0 rounded-full border transition-colors ${
                  sleep
                    ? "border-purple-500/40 bg-purple-500/30"
                    : "border-white/20 bg-white/5"
                }`}
              />
              Toggle mouseover
            </button>
          </div>
        </div>
      </aside>
      </div>
    </>
  );
}
