"use client";

import { useEffect, useState, useRef, useCallback } from "react";

// Web Audio: play a short "legendary" fanfare when the toast appears
let legendaryAudioContext: AudioContext | null = null;
function getLegendaryAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!legendaryAudioContext) legendaryAudioContext = new AudioContext();
  return legendaryAudioContext;
}
function playLegendaryPullSound() {
  const ctx = getLegendaryAudioContext();
  if (!ctx) return;
  (async () => {
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.setValueAtTime(0.12, t + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      // Triumphant fanfare: C5 -> E5 -> G5 -> C6
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < freqs.length; i++) {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freqs[i], t + i * 0.08);
        osc.start(t + i * 0.08);
        osc.stop(t + 0.5);
      }
    } catch { /* ignore */ }
  })();
}

interface ActivityEntry {
  id: string;
  type: string;
  timestamp: string;
  userId: string;
  userName: string;
  message: string;
  meta?: Record<string, unknown>;
}

interface Toast {
  entry: ActivityEntry;
  exiting: boolean;
}

const POLL_INTERVAL = 2_000;
const TOAST_DISPLAY_MS = 5_000;
const MAX_VISIBLE = 3;

const TYPE_CONFIG: Record<string, { icon: string; accent: string }> = {
  legendary_pull: { icon: "👑", accent: "#f59e0b" },
  set_complete: { icon: "🏆", accent: "#10b981" },
  trade_complete: { icon: "🤝", accent: "#8b5cf6" },
  market_sale: { icon: "💰", accent: "#3b82f6" },
  market_order_filled: { icon: "📦", accent: "#6366f1" },
};

export function ActivityToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastPollRef = useRef<string>(new Date().toISOString());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("dabys_user");
      if (cached) {
        const parsed = JSON.parse(cached);
        setCurrentUserId(parsed.id);
      }
    } catch {}
  }, []);

  const addToast = useCallback((entry: ActivityEntry) => {
    if (seenIdsRef.current.has(entry.id)) return;
    seenIdsRef.current.add(entry.id);

    if (entry.type === "legendary_pull") {
      playLegendaryPullSound();
    }

    setToasts((prev) => {
      const next = [...prev, { entry, exiting: false }];
      return next.slice(-MAX_VISIBLE);
    });

    // Start exit animation
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.entry.id === entry.id ? { ...t, exiting: true } : t))
      );
    }, TOAST_DISPLAY_MS);

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.entry.id !== entry.id));
    }, TOAST_DISPLAY_MS + 400);
  }, []);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        const res = await fetch(`/api/activity?since=${encodeURIComponent(lastPollRef.current)}`);
        if (!res.ok) return;
        const data = await res.json();
        const entries: ActivityEntry[] = data.entries || [];
        if (entries.length > 0) {
          lastPollRef.current = entries[entries.length - 1].timestamp;
          for (const entry of entries) {
            // Don't show own activity
            if (entry.userId === currentUserId) continue;
            addToast(entry);
          }
        }
      } catch {}
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [addToast, currentUserId]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.25rem",
        left: "1.25rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: "none",
        maxWidth: "340px",
      }}
    >
      {toasts.map(({ entry, exiting }) => {
        const cfg = TYPE_CONFIG[entry.type] || { icon: "📢", accent: "#8b5cf6" };
        return (
          <div
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.6rem 0.85rem",
              borderRadius: "0.65rem",
              background: "rgba(15, 15, 25, 0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${cfg.accent}33`,
              boxShadow: `0 0 16px ${cfg.accent}18, 0 2px 8px rgba(0,0,0,0.4)`,
              color: "#e5e5e5",
              fontSize: "0.8rem",
              lineHeight: 1.35,
              animation: exiting
                ? "activityToastOut 0.4s ease-in forwards"
                : "activityToastIn 0.35s ease-out",
              pointerEvents: "auto" as const,
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{cfg.icon}</span>
            <span style={{ opacity: 0.92 }}>
              <strong style={{ color: cfg.accent, fontWeight: 600 }}>{entry.userName}</strong>{" "}
              {entry.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
