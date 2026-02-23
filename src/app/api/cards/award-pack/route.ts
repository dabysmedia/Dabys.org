import { NextResponse } from "next/server";
import { awardPack } from "@/lib/cards";

/**
 * Award a pack to a user. Adds the pack to their unopened inventory.
 * For use by the future awarding mechanic (e.g. quest rewards, lottery, etc.).
 */
export async function POST(request: Request) {
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
