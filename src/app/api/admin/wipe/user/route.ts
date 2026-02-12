import { NextResponse } from "next/server";
import { wipeUserInventory, getWipeConfirmWord } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { userId, confirm } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (confirm !== getWipeConfirmWord()) {
    return NextResponse.json(
      { error: `Type ${getWipeConfirmWord()} to confirm` },
      { status: 400 }
    );
  }

  const result = wipeUserInventory(userId);
  return NextResponse.json({ success: true, ...result });
}
