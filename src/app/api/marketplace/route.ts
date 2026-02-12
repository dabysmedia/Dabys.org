import { NextResponse } from "next/server";
import { getListings, getCardById, getUsers } from "@/lib/data";

export async function GET() {
  const listings = getListings();
  const users = getUsers();

  const enriched = listings
    .map((l) => {
      const card = getCardById(l.cardId);
      if (!card) return null;
      const seller = users.find((u) => u.id === l.sellerUserId);
      return {
        ...l,
        card,
        sellerName: seller?.name || "Unknown",
      };
    })
    .filter(Boolean);

  return NextResponse.json(enriched);
}
