"use client";

import { useRef, useState, useCallback } from "react";
import { RARITY_TINTS, RARITY_BADGE, RARITY_GLOW } from "@/lib/constants";

type CardType = "actor" | "director" | "character" | "scene";

export interface CardDisplayCard {
  id?: string;
  rarity: string;
  isFoil: boolean;
  actorName: string;
  characterName: string;
  movieTitle: string;
  profilePath: string;
  cardType?: CardType | string;
}

const TILT_MAX = 8;

function cardLabelLines(card: CardDisplayCard): { title: string; subtitle: string } {
  const ct = (card.cardType ?? "actor") as string;
  if (ct === "director") return { title: card.actorName, subtitle: "Director" };
  if (ct === "scene") return { title: "Scene", subtitle: `from ${card.movieTitle}` };
  return { title: card.actorName, subtitle: `as ${card.characterName}` };
}

export function CardDisplay({ card, compact }: { card: CardDisplayCard; compact?: boolean }) {
  const { title, subtitle } = cardLabelLines(card);
  const rarityTint = RARITY_TINTS[card.rarity] || RARITY_TINTS.uncommon;
  const rarityBadgeClass = RARITY_BADGE[card.rarity] || RARITY_BADGE.uncommon;
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    setHovered(true);
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 2 * TILT_MAX;
    const rotateX = (y - 0.5) * -2 * TILT_MAX;
    setTilt({ x: rotateX, y: rotateY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  const rarityGlow = RARITY_GLOW[card.rarity] || RARITY_GLOW.uncommon;
  const boxShadow = hovered
    ? `0 0 0 1px rgba(255,255,255,0.08), 0 0 12px ${rarityGlow}, 0 12px 40px rgba(0,0,0,0.7)`
    : "0 0 0 1px rgba(255,255,255,0.08), 0 0 20px rgba(0,0,0,0.3)";

  return (
    <div
      className="group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className={`card-hover-lift card-premium-glow rounded-xl overflow-hidden backdrop-blur-xl border border-white/10 ${
          card.isFoil ? "ring-2 ring-indigo-400/50" : ""
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.02) 100%)",
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${tilt.x !== 0 || tilt.y !== 0 ? "-2px" : "0"})`,
          transition: "transform 0.15s ease-out, box-shadow 0.2s ease-out",
          boxShadow,
        }}
      >
        {/* Art area with gradient bleed — image scaled to bleed, gradient fades edges */}
        <div className="aspect-[2/3] relative overflow-hidden">
          {/* Inner highlight — top-edge reflection */}
          <div className="absolute inset-0 card-inner-highlight pointer-events-none z-[1]" />
          {card.profilePath ? (
            <img
              src={card.profilePath}
              alt={title}
              className={`absolute inset-[-15%] w-[130%] h-[130%] object-cover object-center ${card.isFoil ? "holo-sheen" : ""}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl font-bold bg-gradient-to-br from-purple-900/20 to-indigo-900/20">
              {title.charAt(0)}
            </div>
          )}
          {/* Gradient art bleed — soft vignette fade from edges */}
          <div className="absolute inset-0 card-art-bleed pointer-events-none" />
          {/* Holo mouseover — rainbow sheen on hover (holo cards only) */}
          {card.isFoil && (
            <div className="absolute inset-0 card-holo-hover pointer-events-none z-[2]" />
          )}
          {/* Rarity-tinted bottom gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${rarityTint} 0%, transparent 40%), linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)`,
            }}
          />
          {card.isFoil && (
            <span
              className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white backdrop-blur-sm z-10"
              style={{
                background: "linear-gradient(90deg, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6)",
                boxShadow: "0 0 8px rgba(255,255,255,0.5)",
              }}
            >
              HOLO
            </span>
          )}
          {/* Premium rarity badge */}
          <span className={`absolute bottom-2 left-2 right-2 flex items-center gap-1 z-10 ${rarityBadgeClass}`}>
            <svg className="w-2.5 h-2.5 shrink-0 opacity-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span
              className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-black/50 backdrop-blur-sm"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
            >
              {card.rarity}
            </span>
          </span>
        </div>
        {!compact && (
          <div className="p-2.5 backdrop-blur-xl bg-white/[0.05] border-t border-white/[0.06]">
            <p className="text-sm font-semibold font-card-title text-white/95 truncate" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              {title}
            </p>
            <p className="text-xs text-white/60 truncate">{subtitle}</p>
            <p className="text-[10px] text-white/40 truncate mt-0.5">{card.movieTitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}
