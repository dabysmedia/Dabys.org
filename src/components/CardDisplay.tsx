"use client";

import { RARITY_COLORS, RARITY_TINTS, RARITY_BADGE } from "@/lib/constants";

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

function cardLabelLines(card: CardDisplayCard): { title: string; subtitle: string } {
  const ct = (card.cardType ?? "actor") as string;
  if (ct === "director") return { title: card.actorName, subtitle: "Director" };
  if (ct === "scene") return { title: "Scene", subtitle: `from ${card.movieTitle}` };
  return { title: card.actorName, subtitle: `as ${card.characterName}` };
}

export function CardDisplay({ card, compact }: { card: CardDisplayCard; compact?: boolean }) {
  const { title, subtitle } = cardLabelLines(card);
  const rarityClass = RARITY_COLORS[card.rarity] || RARITY_COLORS.uncommon;
  const rarityTint = RARITY_TINTS[card.rarity] || RARITY_TINTS.uncommon;
  const rarityBadgeClass = RARITY_BADGE[card.rarity] || RARITY_BADGE.uncommon;
  return (
    <div className="group">
      <div
        className={`card-hover-lift card-premium-glow rounded-xl overflow-hidden backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${rarityClass} ${card.isFoil ? "ring-2 ring-amber-400/50" : ""}`}
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.02) 100%)",
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
              className={`absolute inset-[-15%] w-[130%] h-[130%] object-cover object-center ${card.isFoil ? "foil-shimmer" : ""}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl font-bold bg-gradient-to-br from-purple-900/20 to-indigo-900/20">
              {title.charAt(0)}
            </div>
          )}
          {/* Gradient art bleed — soft vignette fade from edges */}
          <div className="absolute inset-0 card-art-bleed pointer-events-none" />
          {/* Rarity-tinted bottom gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${rarityTint} 0%, transparent 40%), linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)`,
            }}
          />
          {card.isFoil && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/90 text-black backdrop-blur-sm z-10">
              FOIL
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
