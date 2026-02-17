"use client";

import { useRef, useState, useCallback } from "react";
import {
  RARITY_TINTS,
  RARITY_BADGE,
  RARITY_GLOW,
  CARD_MAX_WIDTH_XS,
  CARD_MAX_WIDTH_SM,
  CARD_MAX_WIDTH_MD,
  CARD_MAX_WIDTH_LG,
  CARD_MAX_WIDTH_XL,
  CARD_ASPECT_RATIO,
} from "@/lib/constants";

type CardType = "actor" | "director" | "character" | "scene";

export type CardDisplaySize = "xs" | "sm" | "md" | "lg" | "xl" | "full";

const CARD_SIZE_MAX_WIDTH: Record<CardDisplaySize, string | null> = {
  xs: `${CARD_MAX_WIDTH_XS}px`,
  sm: `${CARD_MAX_WIDTH_SM}px`,
  md: `${CARD_MAX_WIDTH_MD}px`,
  lg: `${CARD_MAX_WIDTH_LG}px`,
  xl: `${CARD_MAX_WIDTH_XL}px`,
  full: null,
};

export interface CardDisplayCard {
  id?: string;
  rarity: string;
  isFoil: boolean;
  actorName: string;
  characterName: string;
  movieTitle: string;
  profilePath: string;
  cardType?: CardType | string;
  /** When true, shows a red "Alt Art" tag on the top-left (similar to the holo badge). */
  isAltArt?: boolean;
}

const TILT_MAX = 10;

function cardLabelLines(card: CardDisplayCard): { title: string; subtitle: string } {
  const ct = (card.cardType ?? "actor") as string;
  if (ct === "director") return { title: card.actorName, subtitle: "Director" };
  if (ct === "scene") return { title: "Scene", subtitle: `from ${card.movieTitle}` };
  return { title: card.characterName, subtitle: card.actorName };
}

export function CardDisplay({
  card,
  compact,
  inspect,
  size,
  inCodex,
  selectable,
}: {
  card: CardDisplayCard;
  compact?: boolean;
  inspect?: boolean;
  size?: CardDisplaySize;
  /** When true, shows a thin blue bar at the top edge to indicate this card is already in the user's codex. */
  inCodex?: boolean;
  /** When true, shows a subtle highlight ring on hover to indicate the card is interactive/clickable. */
  selectable?: boolean;
}) {
  const { title, subtitle } = cardLabelLines(card);
  const rarityTint = RARITY_TINTS[card.rarity] || RARITY_TINTS.uncommon;
  const rarityBadgeClass = RARITY_BADGE[card.rarity] || RARITY_BADGE.uncommon;
  const titleClass = inspect ? "text-xl font-semibold sm:text-2xl" : "text-sm font-semibold";
  const subtitleClass = inspect ? "text-base sm:text-lg" : "text-xs";
  const movieClass = inspect ? "text-sm sm:text-base mt-1.5" : "text-[10px] mt-0.5";
  const rarityClass = inspect ? "text-sm px-2.5 py-1.5" : "text-[10px] px-1.5 py-0.5";
  const rarityIconSize = inspect ? "w-4 h-4" : "w-2 h-2";
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const maxWidth = size ? CARD_SIZE_MAX_WIDTH[size] : null;
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 2 * TILT_MAX;
      const rotateX = (y - 0.5) * -2 * TILT_MAX;
      setTilt({ x: rotateX, y: rotateY });
      setHovered(true);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  const rarityGlow = RARITY_GLOW[card.rarity] || RARITY_GLOW.uncommon;
  const isTilted = tilt.x !== 0 || tilt.y !== 0;

  const boxShadow = hovered
    ? [
        `0 0 0 1px rgba(255,255,255,0.12)`,
        `0 0 18px ${rarityGlow}`,
        `0 0 6px ${rarityGlow}`,
        `0 16px 48px rgba(0,0,0,0.7)`,
        selectable ? `0 0 0 2px rgba(255,255,255,0.35)` : "",
      ].filter(Boolean).join(", ")
    : [
        `0 0 0 1px rgba(255,255,255,0.08)`,
        `0 4px 16px rgba(0,0,0,0.3)`,
      ].join(", ");

  return (
    <div
      ref={cardRef}
      className={`group ${maxWidth ? "w-full" : ""}`}
      style={{
        ...(maxWidth ? { maxWidth } : {}),
        perspective: "800px",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`relative rounded-xl overflow-hidden backdrop-blur-xl border border-white/[0.12] ${
          card.isFoil ? "ring-2 ring-indigo-400/50" : ""
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.02) 100%)",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.02 : 1})`,
          transition: hovered
            ? "transform 0.08s ease-out, box-shadow 0.15s ease-out"
            : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease-out",
          boxShadow,
          willChange: hovered ? "transform" : "auto",
          transformOrigin: "center center",
        }}
      >
        {/* Thin blue bar when card is already in codex */}
        {inCodex && (
          <div
            className="absolute top-0 left-0 right-0 z-20 h-[3px] rounded-t-xl bg-cyan-400/95 pointer-events-none"
            aria-hidden
          />
        )}
        {/* Hero-style layout: art fills entire card and bleeds under nameplate */}
        <div className="relative overflow-hidden w-full" style={{ aspectRatio: CARD_ASPECT_RATIO }}>
            {/* Full-bleed art — extends under nameplate */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 card-inner-highlight pointer-events-none z-[1]" />
              {card.profilePath ? (
                <img
                  src={card.profilePath}
                  alt={title}
                  className={`absolute inset-0 w-full h-full object-cover object-center ${card.isFoil ? "holo-sheen" : ""}`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl font-bold bg-gradient-to-br from-purple-900/20 to-indigo-900/20">
                  {title.charAt(0)}
                </div>
              )}
              <div className="absolute inset-0 card-art-bleed pointer-events-none" />
              {card.isFoil && (
                <div className="absolute inset-0 card-holo-hover pointer-events-none z-[2]" />
              )}
              {/* Rarity tint + dark gradient so art fades into nameplate */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to top, ${rarityTint} 0%, transparent 35%), linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,0.15) 55%, transparent 100%)`,
                }}
              />
            </div>
            {card.isAltArt && (
              <span
                className={`absolute top-2 left-2 rounded font-bold text-white/95 backdrop-blur-md z-10 border border-white/20 ${inspect ? "px-4 py-1.5 text-sm sm:text-base" : "px-2 py-0.5 text-[10px]"}`}
                style={{
                  background: "rgba(0,0,0,0.25)",
                  boxShadow: "0 0 12px rgba(0,0,0,0.2)",
                }}
              >
                ALT
              </span>
            )}
            {card.isFoil && (
              <span
                className={`absolute top-2 right-2 rounded font-bold text-white backdrop-blur-sm z-10 ${inspect ? "px-4 py-1.5 text-sm sm:text-base" : "px-2 py-0.5 text-[10px]"}`}
                style={{
                  background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                  boxShadow: "0 0 8px rgba(255,255,255,0.5)",
                }}
              >
                HOLO
              </span>
            )}
            {/* Nameplate overlay — art bleeds underneath, gradient for readability */}
            {!compact && (
              <div className={`absolute inset-x-0 bottom-0 z-10 card-nameplate ${inspect ? "p-4 sm:p-5" : ""}`}>
                {/* Rarity badge — sits just above character name */}
                <span className={`inline-flex items-center gap-0.5 mb-1 ${rarityBadgeClass}`}>
                  <svg className={`${rarityIconSize} shrink-0 opacity-90`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span
                    className={`inline-flex rounded font-medium uppercase bg-black/50 backdrop-blur-sm leading-none ${rarityClass}`}
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                  >
                    {card.rarity}
                  </span>
                </span>
                <p className={`${titleClass} font-card-title text-white/95 truncate`} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                  {title}
                </p>
                <p className={`${subtitleClass} text-white/70 truncate`}>{subtitle}</p>
                <p className={`${movieClass} text-white/50 truncate`}>{card.movieTitle}</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
