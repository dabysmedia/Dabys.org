import { NextResponse } from "next/server";
import { generateTriviaQuestions } from "@/lib/trivia";
import { getTriviaAttemptsForWinner } from "@/lib/data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ winnerId: string }> }
) {
  const { winnerId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const attempts = getTriviaAttemptsForWinner(userId, winnerId);
  if (attempts.length > 0) {
    return NextResponse.json(
      { error: "You have already completed trivia for this movie" },
      { status: 400 }
    );
  }

  try {
    const questions = await generateTriviaQuestions(winnerId, userId);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No trivia available for this movie" },
        { status: 404 }
      );
    }
    return NextResponse.json({ questions });
  } catch (e) {
    console.error("Trivia generation error", e);
    return NextResponse.json(
      { error: "Failed to generate trivia" },
      { status: 500 }
    );
  }
}
