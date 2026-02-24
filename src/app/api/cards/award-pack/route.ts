import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { awardPack } from "@/lib/cards";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Award a pack to a user. Adds the pack to their unopened inventory.
 * Admin-only. Used by admin panel "Send to player" and other admin flows.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId : undefined;
  if (!packId) {
    return NextResponse.json({ error: "packId is required" }, { status: 400 });
  }

  const source = typeof body.source === "string" ? body.source : "award";

  const result = awardPack(body.userId, packId, source);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to award pack" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    unopenedPack: result.unopenedPack,
  });
}
