import { NextResponse } from "next/server";
import { buyPack } from "@/lib/cards";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = buyPack(body.userId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to buy pack" },
      { status: 400 }
    );
  }

  return NextResponse.json({ cards: result.cards });
}
