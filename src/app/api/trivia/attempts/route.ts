import { NextResponse } from "next/server";
import { getTriviaAttempts, getTriviaAttemptsForWinner } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const winnerId = searchParams.get("winnerId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const attempts = winnerId
    ? getTriviaAttemptsForWinner(userId, winnerId)
    : getTriviaAttempts(userId);
  return NextResponse.json({ attempts });
}
