"use client";

interface BadgePillProps {
  movieTitle: string;
  isHolo?: boolean;
  className?: string;
}

/** Same visual style as the HOLO tag on cards: gradient + glow. Normal badge uses amber/gold gradient. */
export function BadgePill({ movieTitle, isHolo, className = "" }: BadgePillProps) {
  const base = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm truncate max-w-[140px]";
  const starPath = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

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
          <path d={starPath} />
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
        <path d={starPath} />
      </svg>
      <span className="truncate">{movieTitle}</span>
    </span>
  );
}
