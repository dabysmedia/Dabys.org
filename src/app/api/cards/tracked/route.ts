import { NextResponse } from "next/server";
import { getTrackedCharacterIds, addTrackedCharacter, removeTrackedCharacter } from "@/lib/data";

/** GET /api/cards/tracked?userId=... — list tracked character IDs for user */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const ids = getTrackedCharacterIds(userId);
  return NextResponse.json({ characterIds: ids });
}

/** POST /api/cards/tracked — add character to tracked list. Body: { userId, characterId } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const characterId = body.characterId as string | undefined;
  if (!userId || !characterId || typeof characterId !== "string") {
    return NextResponse.json(
      { error: "userId and characterId required" },
      { status: 400 }
    );
  }
  const added = addTrackedCharacter(userId, characterId);
  if (!added) {
    return NextResponse.json(
      { error: "Could not add (limit reached or already tracked)" },
      { status: 400 }
    );
  }
  return NextResponse.json({
    characterIds: getTrackedCharacterIds(userId),
  });
}

/** DELETE /api/cards/tracked?userId=...&characterId=... — remove character from tracked list */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const characterId = searchParams.get("characterId");
  if (!userId || !characterId) {
    return NextResponse.json(
      { error: "userId and characterId required" },
      { status: 400 }
    );
  }
  const removed = removeTrackedCharacter(userId, characterId);
  return NextResponse.json({
    removed,
    characterIds: getTrackedCharacterIds(userId),
  });
}
