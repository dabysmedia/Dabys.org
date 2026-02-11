"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
}

interface UserSkipInfo {
  skipsEarned: number;
  skipsUsed: number;
  skipsAvailable: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [skipInfo, setSkipInfo] = useState<Record<string, UserSkipInfo>>({});
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data: User[] = await res.json();
      setUsers(data);
      // Fetch skip info for each user
      const infos: Record<string, UserSkipInfo> = {};
      await Promise.all(
        data.map(async (u: User) => {
          try {
            const r = await fetch(`/api/users/${u.id}/profile`);
            if (r.ok) {
              const p = await r.json();
              infos[u.id] = {
                skipsEarned: p.stats.skipsEarned ?? 0,
                skipsUsed: p.stats.skipsUsed ?? 0,
                skipsAvailable: p.stats.skipsAvailable ?? 0,
              };
            }
          } catch { /* ignore */ }
        })
      );
      setSkipInfo(infos);
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  async function adjustSkips(userId: string, delta: number) {
    const current = skipInfo[userId];
    if (!current) return;
    const newUsed = Math.max(0, Math.min(current.skipsEarned, current.skipsUsed + delta));
    if (newUsed === current.skipsUsed) return;
    try {
      await fetch(`/api/users/${userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipsUsed: newUsed }),
      });
      setSkipInfo((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          skipsUsed: newUsed,
          skipsAvailable: Math.max(0, current.skipsEarned - newUsed),
        },
      }));
    } catch { /* ignore */ }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    setError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (res.ok) {
        setNewName("");
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add user");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function deleteUser(id: string) {
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      console.error("Failed to delete user");
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
      <h1 className="text-2xl font-bold text-white/90 mb-8">Manage Users</h1>

      {/* Add user form */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-8">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
          Add New User
        </h2>
        <form onSubmit={addUser} className="flex gap-3">
          <input
            type="text"
            placeholder="Enter name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {adding ? "Adding..." : "Add User"}
          </button>
        </form>
        {error && <p className="text-red-400/80 text-xs mt-2">{error}</p>}
      </div>

      {/* Users list */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">
            All Users ({users.length})
          </h2>
        </div>
        {users.length === 0 ? (
          <p className="px-6 py-8 text-center text-white/30 text-sm">
            No users yet.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {users.map((user) => {
              const info = skipInfo[user.id];
              return (
                <div
                  key={user.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-white/25">ID: {user.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Skips */}
                    {info && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/25 mr-1">Skips</span>
                        <button
                          onClick={() => adjustSkips(user.id, 1)}
                          disabled={info.skipsAvailable <= 0}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-xs font-mono"
                          title="Use a skip"
                        >
                          &minus;
                        </button>
                        <span className={`text-sm font-bold min-w-[2ch] text-center ${info.skipsAvailable > 0 ? "text-cyan-400" : "text-white/20"}`}>
                          {info.skipsAvailable}
                        </span>
                        <button
                          onClick={() => adjustSkips(user.id, -1)}
                          disabled={info.skipsUsed <= 0}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-green-400 hover:border-green-500/30 transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed text-xs font-mono"
                          title="Restore a skip"
                        >
                          +
                        </button>
                        {info.skipsEarned > 0 && (
                          <span className="text-[10px] text-white/15 ml-1">
                            ({info.skipsEarned} earned, {info.skipsUsed} used)
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => deleteUser(user.id)}
                      className="text-xs text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
