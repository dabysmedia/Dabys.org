"use client";

import { usePathname } from "next/navigation";
import { useRef, useLayoutEffect, useEffect } from "react";

const SCROLL_KEY_PREFIX = "dabys_scroll_";
const SAVE_THROTTLE_MS = 150;

function getScrollKey(pathname: string): string {
  return `${SCROLL_KEY_PREFIX}${pathname || "/"}`;
}

function getSavedScrollPosition(pathname: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(getScrollKey(pathname));
    if (raw === null) return null;
    const y = parseInt(raw, 10);
    return Number.isFinite(y) && y >= 0 ? y : null;
  } catch {
    return null;
  }
}

const RESTORE_GRACE_MS = 400;

export function ScrollRestoration() {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  const lastScrollByPathRef = useRef<Record<string, number>>({});
  const restoreTimeByPathRef = useRef<Record<string, number>>({});

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  // Restore scroll position when navigating to a page
  useLayoutEffect(() => {
    const current = pathname ?? "/";
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = current;

    if (prev !== null && prev !== current) {
      const y = lastScrollByPathRef.current[prev];
      if (typeof y === "number" && y >= 0) {
        try {
          sessionStorage.setItem(getScrollKey(prev), String(y));
        } catch {
          /* ignore */
        }
      }
    }

    const saved = getSavedScrollPosition(current);
    if (saved !== null) {
      restoreTimeByPathRef.current[current] = Date.now();
      const apply = () => window.scrollTo(0, saved);
      document.body.classList.add("dabys-scroll-restoring");
      apply();
      let raf2: number | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const raf1 = requestAnimationFrame(() => {
        apply();
        raf2 = requestAnimationFrame(() => {
          document.body.classList.remove("dabys-scroll-restoring");
          apply();
          timeoutId = setTimeout(() => {
            apply();
          }, 50);
        });
      });
      return () => {
        document.body.classList.remove("dabys-scroll-restoring");
        cancelAnimationFrame(raf1);
        if (raf2 !== undefined) cancelAnimationFrame(raf2);
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      };
    }
  }, [pathname]);

  // Track scroll per pathname and persist (throttled); skip persisting right after restore so we don't save "bottom"
  useEffect(() => {
    const current = pathname ?? "/";

    let throttleId: ReturnType<typeof setTimeout> | null = null;

    function onScroll() {
      const y = window.scrollY ?? document.documentElement.scrollTop ?? 0;
      lastScrollByPathRef.current[current] = y;
      const lastRestore = restoreTimeByPathRef.current[current];
      if (lastRestore != null && Date.now() - lastRestore < RESTORE_GRACE_MS) return;
      if (throttleId !== null) return;
      throttleId = setTimeout(() => {
        throttleId = null;
        try {
          sessionStorage.setItem(getScrollKey(current), String(lastScrollByPathRef.current[current] ?? 0));
        } catch {
          /* ignore */
        }
      }, SAVE_THROTTLE_MS);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (throttleId !== null) clearTimeout(throttleId);
    };
  }, [pathname]);

  return null;
}
