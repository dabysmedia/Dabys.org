import { NextResponse } from "next/server";
import { fulfillBuyOrder } from "@/lib/marketplace";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.userId || !body.cardId) {
    return NextResponse.json(
      { error: "userId and cardId required" },
      { status: 400 }
    );
  }

  const result = fulfillBuyOrder(body.userId, orderId, body.cardId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to fulfill order" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
