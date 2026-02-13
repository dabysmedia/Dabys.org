import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getDefaultBadgeAppearance,
  saveDefaultBadgeAppearance,
  getWinners,
  getWinnerBadgeAppearance,
  setWinnerBadgeAppearance,
  getWinnerBadgeAppearanceOverrides,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: default appearance + list of all winner badges with their effective appearance. */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;
  const defaultAppearance = getDefaultBadgeAppearance();
  const overrides = getWinnerBadgeAppearanceOverrides();
  const winners = getWinners();
  const winnerBadges = winners.map((w) => ({
    winnerId: w.id,
    movieTitle: w.movieTitle ?? "Unknown",
    appearance: getWinnerBadgeAppearance(w.id),
    isOverride: w.id in overrides,
  }));
  return NextResponse.json({
    default: defaultAppearance,
    winnerBadges,
  });
}

/** POST: update default badge appearance. Body: { primaryColor?, secondaryColor?, icon?, glow? }. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const raw = {
    primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
    secondaryColor: typeof body.secondaryColor === "string" ? body.secondaryColor : undefined,
    icon: ["star", "trophy", "heart", "medal", "fire"].includes(body.icon) ? body.icon : undefined,
    glow: typeof body.glow === "boolean" ? body.glow : undefined,
  };
  saveDefaultBadgeAppearance(raw);
  return NextResponse.json(getDefaultBadgeAppearance());
}

/** PATCH: set or clear per-winner badge appearance. Body: { winnerId: string, appearance?: BadgeAppearance | null }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const winnerId = typeof body.winnerId === "string" ? body.winnerId.trim() : "";
  if (!winnerId) {
    return NextResponse.json({ error: "winnerId required" }, { status: 400 });
  }
  const winners = getWinners();
  if (!winners.some((w) => w.id === winnerId)) {
    return NextResponse.json({ error: "Winner not found" }, { status: 404 });
  }
  if (body.appearance === null || (body.clear === true)) {
    setWinnerBadgeAppearance(winnerId, null);
    return NextResponse.json({ winnerId, appearance: getWinnerBadgeAppearance(winnerId), isOverride: false });
  }
  const raw = {
    primaryColor: typeof body.appearance?.primaryColor === "string" ? body.appearance.primaryColor : undefined,
    secondaryColor: typeof body.appearance?.secondaryColor === "string" ? body.appearance.secondaryColor : undefined,
    icon: ["star", "trophy", "heart", "medal", "fire"].includes(body.appearance?.icon) ? body.appearance.icon : undefined,
    glow: typeof body.appearance?.glow === "boolean" ? body.appearance.glow : undefined,
  };
  setWinnerBadgeAppearance(winnerId, raw);
  return NextResponse.json({
    winnerId,
    appearance: getWinnerBadgeAppearance(winnerId),
    isOverride: true,
  });
}
