import { NextResponse } from "next/server";
import { getLegendaryOwnershipBySlotId, setLegendarySlotNote } from "@/lib/data";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const slotId = body.slotId as string | undefined;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 100) : "";

  if (!userId || !slotId) {
    return NextResponse.json(
      { error: "userId and slotId required" },
      { status: 400 }
    );
  }

  const legendaryOwnedBy = getLegendaryOwnershipBySlotId();
  const owner = legendaryOwnedBy[slotId];
  if (!owner || owner.userId !== userId) {
    return NextResponse.json(
      { error: "You don't own a legendary in this slot" },
      { status: 403 }
    );
  }

  setLegendarySlotNote(userId, slotId, note);
  return NextResponse.json({ success: true });
}
