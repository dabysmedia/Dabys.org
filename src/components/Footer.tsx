"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_ADMIN_NAMES = ["jerry", "carlos"];

export function Footer() {
  const router = useRouter();
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dabys_user");
      if (raw) {
        const u = JSON.parse(raw) as { id?: string; name?: string };
        if (u?.id && u?.name && DEFAULT_ADMIN_NAMES.includes(u.name.trim().toLowerCase()))
          setCurrentUser({ id: u.id, name: u.name });
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      if (res.ok) router.push("/admin");
      else setAdminError("Could not sign in as admin");
    } catch {
      setAdminError("Something went wrong");
    } finally {
      setAdminLoading(false);
    }
  }

  return (
    <footer className="relative z-10 border-t border-white/[0.04] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-4">
        <div className="max-md:hidden flex flex-col items-center gap-4 w-full">
          <button
            onClick={() => { setAdminOpen(!adminOpen); setAdminError(""); setAdminPassword(""); }}
            className="text-white/10 text-[11px] hover:text-white/30 transition-colors cursor-pointer"
          >
            Admin Panel
          </button>

          <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full max-w-xs ${adminOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
          <form onSubmit={handleAdminLogin} className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-3">
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-purple-500/40 transition-colors"
              />
              <button
                type="submit"
                disabled={adminLoading || !adminPassword}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {adminLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Go"}
              </button>
            </div>
            {adminError && <p className="text-red-400/80 text-xs mt-2">{adminError}</p>}
            {currentUser && (
              <button
                type="button"
                onClick={() => handleAdminLoginAsUser(currentUser.id)}
                disabled={adminLoading}
                className="mt-2 w-full px-3 py-1.5 rounded-lg border border-white/20 text-white/60 text-xs hover:bg-white/10 disabled:opacity-50 cursor-pointer"
              >
                Enter as {currentUser.name}
              </button>
            )}
          </form>
          </div>
        </div>

        <p className="text-white/8 text-[10px] tracking-widest uppercase">Dabys Media Group</p>
      </div>
    </footer>
  );
}
