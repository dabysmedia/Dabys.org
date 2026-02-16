"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface NotificationEntry {
  id: string;
  type: string;
  timestamp: string;
  targetUserId: string;
  message: string;
  actorUserId?: string;
  actorName?: string;
  meta?: Record<string, unknown>;
}

const POLL_INTERVAL = 10_000;

const TYPE_CONFIG: Record<
  string,
  { icon: string; accent: string; label: string }
> = {
  // Global / activity-style
  legendary_pull: { icon: "👑", accent: "#f59e0b", label: "Legendary Pull" },
  set_complete: { icon: "🏆", accent: "#10b981", label: "Set Complete" },
  trade_complete: { icon: "🤝", accent: "#8b5cf6", label: "Trade Complete" },
  market_sale: { icon: "💰", accent: "#3b82f6", label: "Market Sale" },
  market_order_filled: {
    icon: "📦",
    accent: "#6366f1",
    label: "Order Filled",
  },
  // Personal
  marketplace_sold: {
    icon: "💵",
    accent: "#10b981",
    label: "Item Sold",
  },
  buy_order_filled: {
    icon: "📬",
    accent: "#6366f1",
    label: "Order Filled",
  },
  comment_reply: { icon: "💬", accent: "#ec4899", label: "Reply" },
  trade_received: { icon: "📩", accent: "#f59e0b", label: "Trade Offer" },
  trade_accepted: { icon: "✅", accent: "#10b981", label: "Trade Accepted" },
  trade_denied: { icon: "❌", accent: "#ef4444", label: "Trade Denied" },
  new_set_added: { icon: "🃏", accent: "#8b5cf6", label: "New Set" },
  free_packs_restock: {
    icon: "🎁",
    accent: "#f59e0b",
    label: "Free Packs",
  },
};

const PERSONAL_TYPES = new Set([
  "marketplace_sold",
  "buy_order_filled",
  "comment_reply",
  "trade_received",
  "trade_accepted",
  "trade_denied",
  "free_packs_restock",
]);

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type Tab = "all" | "personal" | "activity";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readUpTo, setReadUpTo] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("dabys_user");
      if (cached) {
        const u = JSON.parse(cached);
        setUserId(u.id);
      }
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(
        `/api/notifications?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
      setReadUpTo(data.readUpTo ?? null);
    } catch {}
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    const onVisibility = () => {
      if (!document.hidden) fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = async () => {
    const wasOpen = open;
    setOpen(!open);
    if (!wasOpen && unreadCount > 0 && userId) {
      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        setUnreadCount(0);
        setReadUpTo(new Date().toISOString());
      } catch {}
    }
  };

  const filtered = notifications.filter((n) => {
    if (tab === "personal") return PERSONAL_TYPES.has(n.type);
    if (tab === "activity") return !PERSONAL_TYPES.has(n.type);
    return true;
  });

  const isUnread = (n: NotificationEntry) => {
    if (!readUpTo) return true;
    return new Date(n.timestamp).getTime() > new Date(readUpTo).getTime();
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg text-white/30 hover:text-purple-400 transition-colors cursor-pointer"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none notification-badge-pop">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed right-2 sm:absolute sm:right-0 top-[var(--header-height)] sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[min(520px,70vh)] rounded-xl border border-white/[0.08] bg-[rgba(12,10,24,0.95)] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)] flex flex-col notification-panel-in z-[100]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white/80">
              Notifications
            </h3>
            {notifications.length > 0 && (
              <span className="text-[11px] text-white/30">
                {notifications.length} total
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06]">
            {(
              [
                ["all", "All"],
                ["personal", "Personal"],
                ["activity", "Activity"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  tab === key
                    ? "text-purple-400 border-b-2 border-purple-400 -mb-px"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {label}
                {key === "personal" &&
                  notifications.filter(
                    (n) => PERSONAL_TYPES.has(n.type) && isUnread(n)
                  ).length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded-full bg-red-500/80 text-[9px] text-white font-bold">
                      {
                        notifications.filter(
                          (n) => PERSONAL_TYPES.has(n.type) && isUnread(n)
                        ).length
                      }
                    </span>
                  )}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/20">
                <svg
                  className="w-10 h-10 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <span className="text-xs">No notifications yet</span>
              </div>
            ) : (
              filtered.map((n) => {
                const cfg = TYPE_CONFIG[n.type] || {
                  icon: "📢",
                  accent: "#8b5cf6",
                  label: "Update",
                };
                const unread = isUnread(n);
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.03] ${
                      unread ? "bg-purple-500/[0.04]" : ""
                    }`}
                  >
                    <span
                      className="text-base mt-0.5 shrink-0"
                      style={{ filter: unread ? "none" : "grayscale(0.4)" }}
                    >
                      {cfg.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            color: unread ? cfg.accent : `${cfg.accent}88`,
                          }}
                        >
                          {cfg.label}
                        </span>
                        {unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-xs leading-relaxed ${
                          unread ? "text-white/80" : "text-white/40"
                        }`}
                      >
                        {n.actorName && (
                          <strong
                            className="font-semibold"
                            style={{
                              color: unread
                                ? cfg.accent
                                : `${cfg.accent}88`,
                            }}
                          >
                            {n.actorName}
                          </strong>
                        )}{" "}
                        {n.message}
                      </p>
                      <span
                        className={`text-[10px] mt-1 block ${
                          unread ? "text-white/25" : "text-white/15"
                        }`}
                      >
                        {timeAgo(n.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
