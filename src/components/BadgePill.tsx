"use client";

export interface BadgeAppearance {
  primaryColor?: string;
  secondaryColor?: string;
  icon?: "star" | "trophy" | "heart" | "medal" | "fire";
  glow?: boolean;
}

interface BadgePillProps {
  movieTitle: string;
  isHolo?: boolean;
  /** Custom appearance (for shop badges). When set, overrides default/holo styling. */
  appearance?: BadgeAppearance | null;
  className?: string;
}

const ICON_PATHS: Record<NonNullable<BadgeAppearance["icon"]>, string> = {
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trophy: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  medal: "M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z",
  fire: "M12 23c4.97 0 9-4.03 9-9 0-2.5-1.1-4.76-2.89-6.33C17.08 5.5 15.5 4 12 2 8.5 4 6.92 5.5 5.11 7.67 3.1 9.24 2 11.5 2 14c0 4.97 4.03 9 9 9z",
};

/** Same visual style as the HOLO tag on cards: gradient + glow. Normal badge uses amber/gold. Custom appearance for shop badges. */
export function BadgePill({ movieTitle, isHolo, appearance, className = "" }: BadgePillProps) {
  const base = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm truncate max-w-[140px]";
  const iconKey = appearance?.icon ?? "star";
  const path = ICON_PATHS[iconKey] ?? ICON_PATHS.star;

  // Custom appearance (shop badges)
  if (appearance && (appearance.primaryColor || appearance.secondaryColor)) {
    const start = appearance.primaryColor ?? "#f59e0b";
    const end = appearance.secondaryColor ?? start;
    const glow = appearance.glow !== false;
    return (
      <span
        className={`${base} text-white ${className}`.trim()}
        style={{
          background: `linear-gradient(90deg, ${start}, ${end})`,
          boxShadow: glow ? `0 0 8px ${start}80` : undefined,
        }}
      >
        <svg className="w-2.5 h-2.5 shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d={path} />
        </svg>
        <span className="truncate">{movieTitle}</span>
      </span>
    );
  }

  if (isHolo) {
    return (
      <span
        className={`${base} text-white ${className}`.trim()}
        style={{
          background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
          boxShadow: "0 0 8px rgba(255,255,255,0.5)",
        }}
      >
        <svg className="w-2.5 h-2.5 shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d={path} />
        </svg>
        <span className="truncate">{movieTitle}</span>
      </span>
    );
  }

  return (
    <span
      className={`${base} text-white ${className}`.trim()}
      style={{
        background: "linear-gradient(90deg, #b45309, #d97706, #f59e0b)",
        boxShadow: "0 0 6px rgba(251,191,36,0.5)",
      }}
    >
      <svg className="w-2.5 h-2.5 shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d={path} />
      </svg>
      <span className="truncate">{movieTitle}</span>
    </span>
  );
}
