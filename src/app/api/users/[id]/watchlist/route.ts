import { NextResponse } from "next/server";
import { getWatchlist } from "@/lib/data";

// GET /api/users/[id]/watchlist — list watchlist for this user
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const items = getWatchlist(id);
  return NextResponse.json(items);
}
