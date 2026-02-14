"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const MOBILE_BREAKPOINT_PX = 768;

export function FeedbackButton({ inline = false }: { inline?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (inline) return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsNarrow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [inline]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("dabys_user") : null;
      if (raw) {
        const u = JSON.parse(raw) as { id: string; name: string };
        if (u?.id && u?.name) setUser(u);
      }
    } catch {
      // ignore
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          userId: user?.id,
          userName: user?.name,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send");
        return;
      }
      setMessage("");
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1500);
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (pathname?.startsWith("/admin")) return null;

  // On mobile, only show floating button when not inline (floating is hidden on narrow)
  if (!inline && isNarrow) return null;

  return (
    <div
      className={
        inline
          ? "flex flex-col gap-2"
          : "fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
      }
    >
      {open && (
        <form
          onSubmit={handleSubmit}
          className={`rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 flex flex-col gap-3 ${inline ? "w-full" : "w-80"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/80">Feedback</span>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(""); setMessage(""); }}
              className="text-white/40 hover:text-white/70 transition-colors cursor-pointer p-1"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-purple-500/40 transition-colors"
            disabled={sending}
          />
          {error && <p className="text-red-400/90 text-xs">{error}</p>}
          {sent && <p className="text-green-400/90 text-xs">Thanks! Sent.</p>}
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="ml-auto px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm font-medium hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {sending ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending…
              </span>
            ) : (
              "Send"
            )}
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          inline
            ? "min-h-[48px] flex items-center px-5 py-4 rounded-xl text-left text-base font-medium transition-colors touch-manipulation text-white/80 hover:bg-white/10 w-full cursor-pointer"
            : "rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.2)] px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
        }
        aria-label={open ? "Close feedback" : "Send feedback"}
      >
        Feedback
      </button>
    </div>
  );
}
