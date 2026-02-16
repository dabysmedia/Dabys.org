"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const LAST_LOGIN_KEY = "dabys_last_login";

interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  hasPin?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [pinUser, setPinUser] = useState<User | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [otherUsersOpen, setOtherUsersOpen] = useState(false);

  // Cached last-login user (from localStorage); resolved against current user list
  const lastUser = useMemo(() => {
    if (typeof window === "undefined" || users.length === 0) return null;
    try {
      const raw = localStorage.getItem(LAST_LOGIN_KEY);
      if (!raw) return null;
      const { id } = JSON.parse(raw);
      return users.find((u) => u.id === id) ?? null;
    } catch {
      return null;
    }
  }, [users]);

  const otherUsers = useMemo(
    () => (lastUser ? users.filter((u) => u.id !== lastUser.id) : users),
    [users, lastUser]
  );

  // If already logged in, go straight to home
  useEffect(() => {
    const cached = localStorage.getItem("dabys_user");
    if (cached) {
      router.replace("/");
      return;
    }
    fetchUsers();
  }, [router]);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data: { id: string; name: string; hasPin?: boolean }[] = await res.json();
      const withAvatars = await Promise.all(
        data.map(async (u) => {
          try {
            const pRes = await fetch(`/api/users/${u.id}/profile`);
            if (pRes.ok) {
              const pData = await pRes.json();
              return { ...u, avatarUrl: pData.profile?.avatarUrl || "" };
            }
          } catch { /* ignore */ }
          return { ...u, avatarUrl: "" };
        })
      );
      setUsers(withAvatars);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  }

  function selectUser(user: User) {
    const toStore = { id: user.id, name: user.name };
    localStorage.setItem("dabys_user", JSON.stringify(toStore));
    localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(toStore));
    // Track daily quest: login
    fetch("/api/quests/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, questType: "login" }),
    }).catch(() => {});
    router.replace("/");
  }

  function handleUserClick(user: User) {
    if (user.hasPin) {
      setPinUser(user);
      setPin("");
      setPinError("");
    } else {
      selectUser(user);
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinUser) return;
    setPinError("");
    setPinLoading(true);
    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pinUser.id, pin }),
      });
      if (res.ok) {
        selectUser(pinUser);
      } else {
        const data = await res.json();
        setPinError(data.error || "Wrong PIN");
        setPin("");
      }
    } catch {
      setPinError("Something went wrong");
    } finally {
      setPinLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (res.ok) {
        router.push("/admin");
      } else {
        setAdminError("Wrong password");
        setAdminPassword("");
      }
    } catch {
      setAdminError("Something went wrong");
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAdminLoginAsUser(userId: string) {
    setAdminError("");
    setAdminLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        setAdminError("Could not sign in as admin");
      }
    } catch {
      setAdminError("Something went wrong");
    } finally {
      setAdminLoading(false);
    }
  }

  const defaultAdmins = useMemo(
    () => users.filter((u) => ["jerry", "carlos"].includes(u.name.trim().toLowerCase())),
    [users]
  );

  function renderUserButton(user: User, size: "primary" | "compact") {
    const isPrimary = size === "primary";
    return (
      <button
        key={user.id}
        onClick={() => handleUserClick(user)}
        className={`w-full group relative flex items-center gap-4 rounded-2xl border transition-all duration-200 cursor-pointer
          ${isPrimary
            ? "border-white/20 bg-white/[0.08] hover:bg-white/[0.12] hover:border-purple-400/30 px-6 py-5 shadow-lg shadow-black/20"
            : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/15 px-4 py-3"
          }`}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className={`flex-shrink-0 rounded-full object-cover border-2 border-white/20 transition-colors ${isPrimary ? "w-14 h-14 group-hover:border-purple-400/50" : "w-9 h-9 group-hover:border-white/30"}`}
          />
        ) : (
          <div
            className={`flex-shrink-0 rounded-full bg-gradient-to-br from-purple-500/90 to-indigo-600/90 flex items-center justify-center text-white font-bold border-2 border-white/20 ${isPrimary ? "w-14 h-14 text-xl group-hover:border-purple-400/50" : "w-9 h-9 text-sm group-hover:border-white/30"}`}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          {isPrimary ? (
            <p className="text-white/95 font-semibold text-lg truncate group-hover:text-white">
              {user.name}
            </p>
          ) : (
            <span className="text-white/70 text-sm font-medium truncate block group-hover:text-white/90">
              {user.name}
            </span>
          )}
          {user.hasPin && (
            <span className={`text-white/30 uppercase tracking-wider ${isPrimary ? "text-[10px]" : "text-[9px]"}`}>
              PIN
            </span>
          )}
        </div>
        <svg
          className={`text-white/20 group-hover:text-purple-400 transition-all group-hover:translate-x-0.5 ${isPrimary ? "w-6 h-6" : "w-4 h-4"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/15 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[140px]" />
      </div>

      <div className="relative z-10 min-h-[100vh] h-[100dvh] overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center px-4 py-8">
        {/* Title — same font as main page, outside any container */}
        <h1 className="font-site-title text-4xl sm:text-5xl font-bold text-center mb-1 bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
          dabys.org
        </h1>
        <p className="text-white/40 text-xs tracking-[0.2em] uppercase mb-8">Weekly Movie Club</p>

        {/* Main card — translucent glass */}
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/20">
          {pinUser ? (
            <>
              <h2 className="text-lg font-semibold text-white/90 mb-2 text-center">
                Enter your PIN
              </h2>
              <p className="text-white/50 text-sm text-center mb-6">
                Logging in as {pinUser.name}
              </p>
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-sm px-4 py-3 text-center text-white/90 text-lg tracking-[0.4em] placeholder-white/30 outline-none focus:border-purple-400/50 focus:ring-2 focus:ring-purple-400/20 transition-all"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setPinUser(null); setPin(""); setPinError(""); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white/60 text-sm font-medium hover:bg-white/[0.08] hover:text-white/80 transition-colors backdrop-blur-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={pinLoading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/90 to-indigo-600/90 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 backdrop-blur-sm"
                  >
                    {pinLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Log in"
                    )}
                  </button>
                </div>
                {pinError && (
                  <p className="text-red-400/90 text-sm text-center">{pinError}</p>
                )}
              </form>
            </>
          ) : (
            <>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-center text-white/40 py-8">
                  No users yet. Ask an admin to add you.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Welcome back — recommended user */}
                  {lastUser && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1">
                        Welcome back
                      </p>
                      {renderUserButton(lastUser, "primary")}
                    </div>
                  )}

                  {/* Other users — collapsible, closed by default */}
                  {otherUsers.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOtherUsersOpen(!otherUsersOpen)}
                        className="w-full text-left py-3 px-4 text-white/30 text-[11px] uppercase tracking-wider hover:text-white/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        {lastUser ? "Sign in as someone else" : "Select your name"}
                        <span className="ml-2 inline-block align-middle transition-transform duration-200" style={{ transform: otherUsersOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                          ▼
                        </span>
                      </button>
                      <div
                        className={`transition-all duration-300 ease-in-out ${otherUsersOpen ? "max-h-[320px] opacity-100 overflow-y-auto overflow-x-hidden scrollbar-autocomplete" : "max-h-0 opacity-60 overflow-hidden"}`}
                      >
                        <div className="space-y-2 px-4 pb-4 pt-0">
                          {otherUsers.map((user) => renderUserButton(user, "compact"))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — glass style */}
        <div className="mt-6 text-center">
          <p className="text-white/25 text-xs">
            Don&apos;t see your name? Contact an admin.
          </p>
          <button
            onClick={() => {
              setAdminOpen(!adminOpen);
              setAdminError("");
              setAdminPassword("");
            }}
            className="mt-3 text-white/20 text-[11px] hover:text-white/40 transition-colors cursor-pointer"
          >
            Admin Access
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              adminOpen ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0"
            }`}
          >
            <form
              onSubmit={handleAdminLogin}
              className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-4 shadow-xl shadow-black/10"
            >
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="flex-1 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-400/50 transition-colors"
                  autoFocus={adminOpen}
                />
                <button
                  type="submit"
                  disabled={adminLoading || !adminPassword}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/90 to-indigo-600/90 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {adminLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Go"
                  )}
                </button>
              </div>
              {adminError && (
                <p className="text-red-400/80 text-xs mt-2">{adminError}</p>
              )}
              {defaultAdmins.length > 0 && (
                <p className="text-white/40 text-xs mt-3 mb-1">Or sign in without password:</p>
              )}
              <div className="flex flex-wrap gap-2 mt-1">
                {defaultAdmins.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleAdminLoginAsUser(u.id)}
                    disabled={adminLoading}
                    className="px-3 py-1.5 rounded-lg border border-white/20 text-white/70 text-xs font-medium hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                  >
                    Enter as {u.name}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
