"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserWithAvatar {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface FriendsSidebarProps {
  currentUserId: string;
}

export function FriendsSidebar({ currentUserId }: FriendsSidebarProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserWithAvatar[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <>
      {/* Toggle tab — visible only when sidebar is collapsed */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 w-10 h-24 flex items-center justify-center rounded-l-xl border border-r-0 border-white/20 bg-white/[0.08] backdrop-blur-2xl text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
          aria-label="Open friends list"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225.012.447.037.665A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </button>
      )}

      {/* Overlay when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] border-l border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Friends list"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/20">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">Friends</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors cursor-pointer"
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
                {users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/profile/${u.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors"
                    >
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-white/10 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-white/80 truncate">{u.name}</span>
                    </Link>
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
