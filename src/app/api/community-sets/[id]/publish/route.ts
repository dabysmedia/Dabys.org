import { NextResponse } from "next/server";
import { getCommunitySetById, saveCommunitySet } from "@/lib/data";

/** POST - Submit a draft community set for admin approval (status → pending) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const userId = body.userId;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const set = getCommunitySetById(id);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  if (set.creatorId !== userId) {
    return NextResponse.json({ error: "Not the creator of this set" }, { status: 403 });
  }
  if (set.status !== "draft") {
    return NextResponse.json({ error: "Set is already submitted or published" }, { status: 400 });
  }

  if (set.cards.length < 6) {
    return NextResponse.json(
      { error: "Set must have at least 6 cards before submitting" },
      { status: 400 }
    );
  }

  // Set to pending for admin approval; pool is updated when admin approves
  set.status = "pending";
  saveCommunitySet(set);

  return NextResponse.json({ success: true, set, message: "Set submitted for admin approval" });
}
