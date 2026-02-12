import { NextResponse } from "next/server";
import { tradeUp } from "@/lib/cards";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Array.isArray(body.cardIds)) {
    return NextResponse.json({ error: "cardIds must be an array of 5 card IDs" }, { status: 400 });
  }

  const result = tradeUp(body.userId, body.cardIds);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Trade up failed" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    result.credits != null ? { credits: result.credits } : { card: result.card }
  );
}
