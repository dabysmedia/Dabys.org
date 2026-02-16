"use client";

type OnlineStatus = "online" | "away" | "offline";

const statusConfig: Record<OnlineStatus, { color: string; ring: string; label: string }> = {
  online: {
    color: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    label: "Online",
  },
  away: {
    color: "bg-amber-400",
    ring: "ring-amber-400/30",
    label: "Away",
  },
  offline: {
    color: "bg-red-500",
    ring: "ring-red-500/30",
    label: "Offline",
  },
};

/**
 * Status dot indicator, positioned absolutely in bottom-right of a relative parent.
 * Wraps the avatar in a relative container to position the dot.
 *
 * @param status – "online" | "away" | "offline"
 * @param size   – "sm" (header, 8×8 / 10×10 avatars) or "lg" (profile page, 28×28 / 32×32 avatars)
 */
export default function StatusIndicator({
  status,
  size = "sm",
}: {
  status: OnlineStatus;
  size?: "sm" | "lg";
}) {
  const cfg = statusConfig[status];
  const dotSize = size === "lg" ? "w-4 h-4" : "w-2.5 h-2.5";
  const borderSize = size === "lg" ? "ring-[3px]" : "ring-2";
  const position = size === "lg" ? "-bottom-0.5 -right-0.5" : "-bottom-px -right-px";

  return (
    <span
      className={`absolute ${position} ${dotSize} rounded-full ${cfg.color} ${borderSize} ring-[#0a0a0f] ${status === "online" ? "status-pulse" : ""}`}
      title={cfg.label}
      aria-label={cfg.label}
    />
  );
}
