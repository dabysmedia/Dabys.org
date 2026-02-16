"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import StatusIndicator from "@/components/StatusIndicator";
import { usePresenceStatus } from "@/hooks/usePresenceStatus";
import { CardDisplay } from "@/components/CardDisplay";

const HOVER_SLEEP_KEY = "dabys-sidebar-hover-sleep";
const TCG_TAB_STORAGE_KEY = "dabys_tcg_tab";

function readHoverSleep(): boolean {
  try {
    return localStorage.getItem(HOVER_SLEEP_KEY) === "true";
  } catch {
    return false;
  }
}

interface UserWithAvatar {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** Pool entry shape from /api/cards/character-pool (codex=1). */
interface CodexPoolEntry {
  characterId: string;
  actorName: string;
  characterName: string;
  movieTitle: string;
  movieTmdbId?: number;
  profilePath: string;
  rarity: string;
  cardType?: string;
  altArtOfCharacterId?: string;
}

interface CodexModalData {
  userName: string;
  characterIds: string[];
  holoCharacterIds: string[];
  altArtCharacterIds: string[];
  boysCharacterIds: string[];
  pool: CodexPoolEntry[];
}

interface FriendsSidebarProps {
  currentUserId: string;
}

export function FriendsSidebar({ currentUserId }: FriendsSidebarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hoverMode, setHoverMode] = useState(false);
  const [sleep, setSleep] = useState(readHoverSleep);
  const [users, setUsers] = useState<UserWithAvatar[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [codexModal, setCodexModal] = useState<CodexModalData | null>(null);
  const [codexModalLoading, setCodexModalLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { getStatus } = usePresenceStatus();

  useEffect(() => {
    const onSleepChange = () => setSleep(readHoverSleep);
    window.addEventListener("dabys-sidebar-sleep-change", onSleepChange);
    return () => window.removeEventListener("dabys-sidebar-sleep-change", onSleepChange);
  }, []);

  // Close quick-action menu on click outside
  useEffect(() => {
    if (!activeMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activeMenuId]);

  // Close menu when sidebar closes
  useEffect(() => {
    if (!open) setActiveMenuId(null);
  }, [open]);

  function navigateToTrade(userId: string) {
    try { sessionStorage.setItem(TCG_TAB_STORAGE_KEY, "trade"); } catch {}
    router.push(`/cards?tradeWith=${encodeURIComponent(userId)}`);
    setOpen(false);
  }

  function openCodexPopup(userId: string, userName: string) {
    setActiveMenuId(null);
    setCodexModalLoading(true);
    setCodexModal(null);
    Promise.all([
      fetch(`/api/cards/codex?userId=${encodeURIComponent(userId)}`).then((r) => r.json()),
      fetch("/api/cards/character-pool?codex=1").then((r) => r.json()),
    ])
      .then(([codexData, poolData]) => {
        const characterIds = Array.isArray(codexData.characterIds) ? codexData.characterIds : [];
        const holoCharacterIds = Array.isArray(codexData.holoCharacterIds) ? codexData.holoCharacterIds : [];
        const altArtCharacterIds = Array.isArray(codexData.altArtCharacterIds) ? codexData.altArtCharacterIds : [];
        const boysCharacterIds = Array.isArray(codexData.boysCharacterIds) ? codexData.boysCharacterIds : [];
        const pool: CodexPoolEntry[] = Array.isArray(poolData.pool) ? poolData.pool : [];
        setCodexModal({
          userName,
          characterIds,
          holoCharacterIds,
          altArtCharacterIds,
          boysCharacterIds,
          pool,
        });
      })
      .catch(() => setCodexModal(null))
      .finally(() => setCodexModalLoading(false));
  }

  function navigateToProfile(userId: string) {
    router.push(`/profile/${userId}`);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/users?includeProfile=1")
      .then((r) => r.json())
      .then((data: UserWithAvatar[]) => {
        setUsers(data.filter((u) => u.id !== currentUserId));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [open, currentUserId]);

  const sortedUsers = [...users].sort((a, b) => {
    const sa = getStatus(a.id);
    const sb = getStatus(b.id);
    const order: Record<string, number> = { online: 0, away: 1, offline: 2 };
    return (order[sa] ?? 2) - (order[sb] ?? 2);
  });

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
    if (hoverMode) {
      setOpen(false);
      setHoverMode(false);
    }
  }

  function toggleSleep() {
    const next = !sleep;
    setSleep(next);
    localStorage.setItem(HOVER_SLEEP_KEY, String(next));
    window.dispatchEvent(new CustomEvent("dabys-sidebar-sleep-change"));
  }

  const mainPoolEntries = codexModal
    ? codexModal.pool.filter(
        (e) => !e.altArtOfCharacterId && (e.cardType ?? "actor") !== "character"
      )
    : [];
  const isDiscovered = (entry: CodexPoolEntry) =>
    codexModal &&
    (codexModal.characterIds.includes(entry.characterId) ||
      codexModal.holoCharacterIds.includes(entry.characterId));

  return (
    <>
      {/* Codex viewer popup */}
      {(codexModalLoading || codexModal) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ top: "var(--header-height, 0)" }}
          aria-modal="true"
          role="dialog"
          aria-label={codexModal ? `${codexModal.userName}'s Codex` : "Loading codex"}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !codexModalLoading && setCodexModal(null)}
            aria-hidden
          />
          {codexModalLoading ? (
            <div className="relative z-10 flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl px-8 py-10">
              <div className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              <p className="text-sm text-white/60">Loading codex…</p>
            </div>
          ) : codexModal ? (
            <div
              className="relative z-10 flex flex-col w-full max-w-4xl max-h-[85vh] rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <h3 className="text-base font-semibold text-white/90">
                  {codexModal.userName}&apos;s Codex
                </h3>
                <button
                  type="button"
                  onClick={() => setCodexModal(null)}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {mainPoolEntries.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-8">No cards in the pool.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {mainPoolEntries.map((entry) => {
                      const discovered = isDiscovered(entry);
                      if (!discovered) {
                        return (
                          <div
                            key={entry.characterId}
                            className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] flex items-center justify-center"
                            style={{ aspectRatio: "2 / 3.35" }}
                          >
                            <div className="flex flex-col items-center justify-center gap-2 text-white/25">
                              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span className="text-[10px] font-medium">?</span>
                            </div>
                          </div>
                        );
                      }
                      const codexCard = {
                        id: entry.characterId,
                        rarity: entry.rarity,
                        isFoil: codexModal.holoCharacterIds.includes(entry.characterId),
                        actorName: entry.actorName ?? "",
                        characterName: entry.characterName ?? "",
                        movieTitle: entry.movieTitle ?? "",
                        profilePath: entry.profilePath ?? "",
                        cardType: entry.cardType,
                        isAltArt: !!entry.altArtOfCharacterId,
                      };
                      return (
                        <div key={entry.characterId} className="rounded-xl overflow-hidden">
                          <CardDisplay card={codexCard} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {open && !hoverMode && (
        <div
          className="fixed inset-0 z-[45] bg-black/40 backdrop-blur-[2px] md:bg-transparent md:backdrop-blur-none"
          style={{ top: "var(--header-height)" }}
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className="fixed right-0 z-50 flex flex-col overflow-hidden transition-[width] duration-200 ease-out"
        style={{
          top: "var(--header-height)",
          height: "calc(100vh - var(--header-height))",
          width: open ? "13rem" : "2.5rem",
        }}
        onMouseLeave={handleMouseLeave}
      >
        {!open && (
          <button
            type="button"
            onClick={openByClick}
            onMouseEnter={() => !open && openByHover()}
            className="absolute right-0 top-[22%] -translate-y-1/2 w-10 h-24 flex items-center justify-center rounded-l-xl border border-r-0 border-white/[0.06] bg-white/[0.015] backdrop-blur-md text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-all cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
            aria-label="Open friends list"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225.012.447.037.665A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </button>
        )}

        <aside
          className={`absolute right-0 top-0 bottom-0 z-50 w-52 max-w-[75vw] border-l border-white/[0.06] bg-white/[0.015] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
          aria-label="Friends list"
        >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">Friends</h2>
            <button
              type="button"
              onClick={() => { setOpen(false); setHoverMode(false); }}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-autocomplete py-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="px-4 py-6 text-sm text-white/40 text-center">No other users yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {sortedUsers.map((u) => {
                  const isMenuOpen = activeMenuId === u.id;
                  return (
                    <li key={u.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(isMenuOpen ? null : u.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 transition-colors cursor-pointer text-left ${
                          isMenuOpen ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover border border-white/[0.08]"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <StatusIndicator status={getStatus(u.id)} size="sm" />
                        </div>
                        <span className="text-xs font-medium text-white/80 truncate">{u.name}</span>
                        <svg
                          className={`w-3 h-3 ml-auto text-white/30 transition-transform ${isMenuOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Quick-action menu */}
                      {isMenuOpen && (
                        <div
                          ref={menuRef}
                          className="overflow-hidden border-t border-white/[0.04] bg-white/[0.03] animate-in slide-in-from-top-1 duration-150"
                        >
                          <button
                            type="button"
                            onClick={() => navigateToTrade(u.id)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer group"
                          >
                            <svg className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            <span className="text-[11px] font-medium text-white/60 group-hover:text-white/90 transition-colors">Start Trade</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCodexPopup(u.id, u.name)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer group"
                          >
                            <svg className="w-3.5 h-3.5 text-purple-400/70 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            <span className="text-[11px] font-medium text-white/60 group-hover:text-white/90 transition-colors">View Codex</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToProfile(u.id)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/[0.05] transition-colors cursor-pointer group"
                          >
                            <svg className="w-3.5 h-3.5 text-sky-400/70 group-hover:text-sky-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                            <span className="text-[11px] font-medium text-white/60 group-hover:text-white/90 transition-colors">View Profile</span>
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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
