import { NextResponse } from "next/server";
import { cancelBuyOrder } from "@/lib/marketplace";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const { searchParams } = new URL(_request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = cancelBuyOrder(userId, orderId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to cancel order" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
