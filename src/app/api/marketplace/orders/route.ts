import { NextResponse } from "next/server";
import { getBuyOrders, getCharacterPool, getUsers } from "@/lib/data";
import { getDisplayedBadgeForUser } from "@/lib/cards";
import { createBuyOrder } from "@/lib/marketplace";

export async function GET() {
  const orders = getBuyOrders();
  const users = getUsers();
  const pool = getCharacterPool();

  const enriched = orders.map((o) => {
    const entry = pool.find((p) => p.characterId === o.characterId);
    const requester = users.find((u) => u.id === o.requesterUserId);
    const requesterDisplayedBadge = getDisplayedBadgeForUser(o.requesterUserId);
    return {
      ...o,
      poolEntry: entry
        ? {
            characterId: entry.characterId,
            actorName: entry.actorName,
            characterName: entry.characterName,
            movieTitle: entry.movieTitle,
            profilePath: entry.profilePath,
            rarity: entry.rarity,
          }
        : null,
      requesterName: requester?.name || "Unknown",
      requesterDisplayedBadge,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || !body.characterId) {
    return NextResponse.json(
      { error: "userId and characterId required" },
      { status: 400 }
    );
  }

  const offerPrice = typeof body.offerPrice === "number" ? body.offerPrice : 0;

  const result = createBuyOrder(body.userId, body.characterId, offerPrice);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to create order" },
      { status: 400 }
    );
  }

  return NextResponse.json({ order: result.order });
}
