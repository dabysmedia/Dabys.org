import { NextResponse } from "next/server";
import { buyListing } from "@/lib/marketplace";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || !body.listingId) {
    return NextResponse.json(
      { error: "userId and listingId required" },
      { status: 400 }
    );
  }

  const result = buyListing(body.userId, body.listingId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to buy" },
      { status: 400 }
    );
  }

  return NextResponse.json({ card: result.card });
}
