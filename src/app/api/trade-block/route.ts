import { NextResponse } from "next/server";
import {
  getTradeBlock,
  addTradeBlockEntry,
  removeTradeBlockEntry,
  getCardById,
  getListings,
  getUsers,
} from "@/lib/data";

export async function GET() {
  const entries = getTradeBlock();
  const users = getUsers();
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const listings = getListings();
  const listedCardIds = new Set(listings.map((l) => l.cardId));

  const enriched = entries
    .map((entry) => {
      const card = getCardById(entry.cardId);
      if (!card) return null;
      if (card.userId !== entry.userId) return null;
      if (listedCardIds.has(entry.cardId)) return null;
      return {
        ...entry,
        userName: userMap.get(entry.userId) ?? "Unknown",
        card: {
          id: card.id,
          characterId: card.characterId,
          rarity: card.rarity,
          isFoil: card.isFoil,
          finish: card.finish,
          actorName: card.actorName,
          characterName: card.characterName,
          movieTitle: card.movieTitle,
          movieTmdbId: card.movieTmdbId,
          profilePath: card.profilePath,
          cardType: card.cardType ?? "actor",
        },
      };
    })
    .filter(Boolean);

  return NextResponse.json({ entries: enriched });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const cardId = body.cardId as string | undefined;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 100) : "";

  if (!userId || !cardId) {
    return NextResponse.json(
      { error: "userId and cardId required" },
      { status: 400 }
    );
  }

  const card = getCardById(cardId);
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (card.userId !== userId) {
    return NextResponse.json(
      { error: "You don't own this card" },
      { status: 403 }
    );
  }

  const entry = addTradeBlockEntry({ userId, cardId, note });
  return NextResponse.json({ success: true, entry });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const entryId = body.entryId as string | undefined;

  if (!userId || !entryId) {
    return NextResponse.json(
      { error: "userId and entryId required" },
      { status: 400 }
    );
  }

  const removed = removeTradeBlockEntry(userId, entryId);
  if (!removed) {
    return NextResponse.json(
      { error: "Entry not found or not owned by you" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
