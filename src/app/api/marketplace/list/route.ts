import { NextResponse } from "next/server";
import { listCard } from "@/lib/marketplace";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || !body.cardId || typeof body.askingPrice !== "number") {
    return NextResponse.json(
      { error: "userId, cardId, and askingPrice required" },
      { status: 400 }
    );
  }

  const result = listCard(body.userId, body.cardId, body.askingPrice);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to list" },
      { status: 400 }
    );
  }

  return NextResponse.json({ listing: result.listing });
}
