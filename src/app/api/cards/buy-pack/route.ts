import { NextResponse } from "next/server";
import { buyPack } from "@/lib/cards";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId : undefined;

  const result = buyPack(body.userId, packId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to buy pack" },
      { status: 400 }
    );
  }

  return NextResponse.json({ cards: result.cards });
}
