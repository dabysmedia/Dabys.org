"use client";

import { useEffect, useState, useRef } from "react";

type OnlineStatus = "online" | "away" | "offline";

const POLL_INTERVAL = 30_000; // 30s — matches heartbeat interval

/**
 * Polls /api/presence to get a map of userId → status.
 * Returns a lookup function: getStatus(userId) → "online" | "away" | "offline".
 */
export function usePresenceStatus() {
  const [statuses, setStatuses] = useState<Record<string, OnlineStatus>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchStatuses = () => {
      if (document.hidden) return;
      fetch("/api/presence")
        .then((r) => (r.ok ? r.json() : {}))
        .then((data: Record<string, OnlineStatus>) => setStatuses(data))
        .catch(() => {});
    };

    fetchStatuses();
    if (!document.hidden) intervalRef.current = setInterval(fetchStatuses, POLL_INTERVAL);

    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        fetchStatuses();
        intervalRef.current = setInterval(fetchStatuses, POLL_INTERVAL);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const getStatus = (userId: string): OnlineStatus => statuses[userId] || "offline";

  return { statuses, getStatus };
}
