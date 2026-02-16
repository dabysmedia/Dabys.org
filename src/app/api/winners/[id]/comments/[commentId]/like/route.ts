import { NextResponse } from "next/server";
import { getComments, getCommentLikes, saveCommentLikes, addCredits, hasReceivedCreditsForCommentLike } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id: winnerId, commentId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const comments = getComments();
  const comment = comments.find((c) => c.id === commentId && c.winnerId === winnerId);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const likes = getCommentLikes();
  const existing = likes.findIndex((l) => l.commentId === commentId && l.userId === body.userId);

  if (existing >= 0) {
    likes.splice(existing, 1);
  } else {
    likes.push({ commentId, userId: body.userId });
    // Only award credits the first time this user ever liked this comment (no like/unlike farming)
    if (!hasReceivedCreditsForCommentLike(body.userId, commentId)) {
      addCredits(body.userId, 1, "comment_like", { commentId, winnerId });
    }
  }
  saveCommentLikes(likes);

  return NextResponse.json({
    liked: existing < 0,
    likeCount: likes.filter((l) => l.commentId === commentId).length,
  });
}
