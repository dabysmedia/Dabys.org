"use client";

import { usePathname } from "next/navigation";
import { useRef, useLayoutEffect, useEffect } from "react";

const SCROLL_KEY_PREFIX = "dabys_scroll_";
const SAVE_THROTTLE_MS = 150;

function getScrollKey(pathname: string): string {
  return `${SCROLL_KEY_PREFIX}${pathname || "/"}`;
}

function saveScrollPosition(pathname: string): void {
  if (typeof window === "undefined") return;
  const y = window.scrollY ?? document.documentElement.scrollTop ?? 0;
  try {
    sessionStorage.setItem(getScrollKey(pathname), String(y));
  } catch {
    /* ignore */
  }
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

export function ScrollRestoration() {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);

  // Restore scroll position when navigating to a page
  useLayoutEffect(() => {
    const current = pathname ?? "/";
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = current;

    if (prev !== null && prev !== current) {
      saveScrollPosition(prev);
    }

    const saved = getSavedScrollPosition(current);
    if (saved !== null) {
      const id = requestAnimationFrame(() => {
        window.scrollTo(0, saved);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [pathname]);

  // Save scroll position while scrolling (throttled)
  useEffect(() => {
    const current = pathname ?? "/";

    let throttleId: ReturnType<typeof setTimeout> | null = null;

    function onScroll() {
      if (throttleId !== null) return;
      throttleId = setTimeout(() => {
        throttleId = null;
        saveScrollPosition(current);
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
