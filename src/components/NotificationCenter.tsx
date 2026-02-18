"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

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

const POLL_INTERVAL = 2_000;

// Brand palette: amber, purple, sky, emerald (success), red (danger)
const TYPE_CONFIG: Record<
  string,
  { icon: string; accent: string; label: string }
> = {
  // Global / activity-style
  legendary_pull: { icon: "👑", accent: "#f59e0b", label: "Legendary Pull" },
  set_complete: { icon: "🏆", accent: "#10b981", label: "Set Complete" },
  trade_complete: { icon: "🤝", accent: "#8b5cf6", label: "Trade Complete" },
  market_sale: { icon: "💰", accent: "#38bdf8", label: "Market Sale" },
  market_order_filled: {
    icon: "📦",
    accent: "#8b5cf6",
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
    accent: "#8b5cf6",
    label: "Order Filled",
  },
  comment_reply: { icon: "💬", accent: "#8b5cf6", label: "Reply" },
  trade_received: { icon: "📩", accent: "#f59e0b", label: "Trade Offer" },
  trade_accepted: { icon: "✅", accent: "#10b981", label: "Trade Accepted" },
  trade_denied: { icon: "❌", accent: "#ef4444", label: "Trade Denied" },
  feedback_accepted: {
    icon: "✨",
    accent: "#10b981",
    label: "Feedback Accepted",
  },
  credits_awarded: {
    icon: "💰",
    accent: "#38bdf8",
    label: "Credits Awarded",
  },
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
  "feedback_accepted",
  "credits_awarded",
  "free_packs_restock",
]);

const TRADE_NOTIFICATION_TYPES = new Set([
  "trade_received",
  "trade_accepted",
  "trade_denied",
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
  const router = useRouter();
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
    const onRefresh = () => fetchNotifications();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("dabys-notifications-refresh", onRefresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("dabys-notifications-refresh", onRefresh);
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

  const handleClearAll = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/notifications/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) return;
      setNotifications([]);
      setUnreadCount(0);
      setReadUpTo(new Date().toISOString());
    } catch {}
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg text-white/40 hover:text-amber-400 transition-colors cursor-pointer"
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
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold leading-none notification-badge-pop">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed right-2 sm:absolute sm:right-0 top-[var(--header-height)] sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[min(520px,70vh)] rounded-xl border border-white/20 bg-[#0a0a0f]/95 backdrop-blur-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col notification-panel-in z-[100]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <h3 className="text-sm font-semibold text-white/90">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <span className="text-[11px] text-white/35">
                  {notifications.length} total
                </span>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                  title="Mark all as read"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.08]">
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
                className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${
                  tab === key
                    ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {label}
                {key === "personal" &&
                  notifications.filter(
                    (n) => PERSONAL_TYPES.has(n.type) && isUnread(n)
                  ).length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 rounded-full bg-amber-500/80 text-[9px] text-black font-bold">
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
              <div className="flex flex-col items-center justify-center py-12 text-white/40">
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
                  accent: "#f59e0b",
                  label: "Update",
                };
                const unread = isUnread(n);
                const isTradeOffer = TRADE_NOTIFICATION_TYPES.has(n.type);
                const tradeId = isTradeOffer && n.meta && typeof n.meta.tradeId === "string" ? n.meta.tradeId : null;
                const handleClick = tradeId
                  ? () => {
                      setOpen(false);
                      router.push(`/cards?trade=${encodeURIComponent(tradeId)}`);
                    }
                  : undefined;
                return (
                  <div
                    key={n.id}
                    role={handleClick ? "button" : undefined}
                    tabIndex={handleClick ? 0 : undefined}
                    onClick={handleClick}
                    onKeyDown={handleClick ? (e) => e.key === "Enter" && handleClick() : undefined}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.06] transition-colors hover:bg-white/[0.04] ${
                      unread ? "bg-amber-500/[0.06]" : ""
                    } ${handleClick ? "cursor-pointer" : ""}`}
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
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-sm leading-relaxed ${
                          unread ? "text-white/80" : "text-white/60"
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
                          unread ? "text-white/30" : "text-white/25"
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
