import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getDefaultBadgeAppearance,
  saveDefaultBadgeAppearance,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: return default badge appearance (used for all winner badges). */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;
  const appearance = getDefaultBadgeAppearance();
  return NextResponse.json(appearance);
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
