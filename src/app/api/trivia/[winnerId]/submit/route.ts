import { NextResponse } from "next/server";
import { submitTriviaAnswers } from "@/lib/trivia";
import { isWinnerArchived } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ winnerId: string }> }
) {
  const { winnerId } = await params;

  if (!isWinnerArchived(winnerId)) {
    return NextResponse.json(
      { error: "Trivia is locked until the winner is archived in the winners circle (after the new week starts)" },
      { status: 423 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (answers.length === 0) {
    return NextResponse.json({ error: "answers required" }, { status: 400 });
  }

  const result = submitTriviaAnswers(winnerId, body.userId, answers);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to submit" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    correctCount: result.correctCount,
    totalCount: result.totalCount,
    creditsEarned: result.creditsEarned,
  });
}
