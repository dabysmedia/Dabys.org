"use client";

import { useEffect, useRef, useCallback } from "react";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const IDLE_THRESHOLD = 15 * 60_000; // 15 minutes

/**
 * Sends periodic heartbeats to /api/presence while the user is on the site.
 * Tracks idle state (no mouse/keyboard/touch for 15 min → idle=true).
 * On page unload or explicit goOffline(), removes the presence entry.
 */
export function usePresence(userId: string | null) {
  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isIdleRef = useRef(false);

  const sendHeartbeat = useCallback(
    (idle?: boolean) => {
      if (!userId) return;
      const isIdle = idle ?? Date.now() - lastActivityRef.current > IDLE_THRESHOLD;
      isIdleRef.current = isIdle;
      navigator.sendBeacon?.(
        "/api/presence",
        new Blob(
          [JSON.stringify({ userId, idle: isIdle })],
          { type: "application/json" }
        )
      ) ||
        fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, idle: isIdle }),
          keepalive: true,
        }).catch(() => {});
    },
    [userId]
  );

  const goOffline = useCallback(() => {
    if (!userId) return;
    // sendBeacon can only POST, so we use _delete flag in body
    const sent = navigator.sendBeacon?.(
      "/api/presence",
      new Blob(
        [JSON.stringify({ userId, _delete: true })],
        { type: "application/json" }
      )
    );
    if (!sent) {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, _delete: true }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Record user activity
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      // If they were idle and are now active, send an immediate heartbeat
      if (isIdleRef.current) {
        sendHeartbeat(false);
      }
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    // Initial heartbeat
    sendHeartbeat(false);

    // Periodic heartbeat
    intervalRef.current = setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL);

    // Pause/resume on visibility change
    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        // Coming back — send immediate heartbeat and resume
        lastActivityRef.current = Date.now();
        sendHeartbeat(false);
        intervalRef.current = setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Go offline on page close
    const onBeforeUnload = () => goOffline();
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, sendHeartbeat, goOffline]);

  return { goOffline };
}
