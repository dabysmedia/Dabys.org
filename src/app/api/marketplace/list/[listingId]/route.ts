import { NextResponse } from "next/server";
import { delistCard } from "@/lib/marketplace";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = delistCard(userId, listingId);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to delist" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
