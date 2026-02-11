"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  avatarUrl?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

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
      const data: { id: string; name: string }[] = await res.json();
      // Fetch profiles in parallel to get avatar URLs
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
    localStorage.setItem("dabys_user", JSON.stringify(user));
    router.replace("/");
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[160px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Dabys.org
          </h1>
          <p className="mt-3 text-white/50 text-sm tracking-wide uppercase">
            Weekly Movie Club
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl shadow-purple-500/5">
          <h2 className="text-lg font-semibold text-white/90 mb-6 text-center">
            Select Your Name
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-white/40 py-6">
              No users yet. Ask an admin to add you.
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className="w-full group relative flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-left transition-all duration-200 hover:bg-white/[0.06] hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 cursor-pointer"
                >
                  {/* Avatar */}
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="flex-shrink-0 w-10 h-10 rounded-full object-cover border-2 border-white/[0.08] shadow-lg shadow-purple-500/20 group-hover:border-purple-500/40 transition-colors"
                    />
                  ) : (
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-white/80 font-medium group-hover:text-white transition-colors">
                    {user.name}
                  </span>
                  {/* Arrow */}
                  <svg
                    className="ml-auto w-5 h-5 text-white/20 group-hover:text-purple-400 transition-all group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with admin access */}
        <div className="mt-6 text-center">
          <p className="text-white/20 text-xs">
            Don&apos;t see your name? Contact an admin.
          </p>

          <button
            onClick={() => {
              setAdminOpen(!adminOpen);
              setAdminError("");
              setAdminPassword("");
            }}
            className="mt-3 text-white/15 text-[11px] hover:text-white/40 transition-colors cursor-pointer"
          >
            Admin Access
          </button>

          {/* Expandable admin password box */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              adminOpen ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0"
            }`}
          >
            <form
              onSubmit={handleAdminLogin}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4"
            >
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
                  autoFocus={adminOpen}
                />
                <button
                  type="submit"
                  disabled={adminLoading || !adminPassword}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
