import { NextResponse } from "next/server";
import { denyTrade } from "@/lib/trades";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tradeId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = denyTrade(tradeId, body.userId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to deny trade" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
