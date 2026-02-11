"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PAGES_WITH_SCROLL = ["/", "/wheel", "/stats"];

function shouldShowScroll(pathname: string | null): boolean {
  if (!pathname) return false;
  return PAGES_WITH_SCROLL.includes(pathname);
}

export function ScrollingWinnersBg() {
  const pathname = usePathname();
  const [winnerArt, setWinnerArt] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/winners")
      .then((r) => (r.ok ? r.json() : []))
      .then((winners: { backdropUrl?: string; posterUrl?: string }[]) => {
        setWinnerArt(winners.map((w) => w.backdropUrl || w.posterUrl).filter(Boolean));
      })
      .catch(() => setWinnerArt([]));
  }, []);

  if (!shouldShowScroll(pathname) || winnerArt.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0 flex items-center">
        <div
          className="winners-scroll-track flex shrink-0"
          style={{ gap: 0, ["--scroll-duration" as string]: `${55 * Math.max(1, winnerArt.length)}s` }}
        >
          {[...winnerArt, ...winnerArt].map((src, i) => (
            <div
              key={i}
              className="relative shrink-0 h-screen aspect-[16/9] overflow-hidden"
            >
              <img
                src={src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-[0.07]"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-transparent via-15% via-85% to-[var(--background)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--background)]/60 to-[var(--background)]" />
    </div>
  );
}
