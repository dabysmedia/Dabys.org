import { NextResponse } from "next/server";
import { removeTriviaAttemptsForUserAndWinner } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const { userId, winnerId } = body;

  if (!userId || !winnerId) {
    return NextResponse.json(
      { error: "userId and winnerId required" },
      { status: 400 }
    );
  }

  const removed = removeTriviaAttemptsForUserAndWinner(userId, winnerId);

  return NextResponse.json({ success: true, removed });
}
