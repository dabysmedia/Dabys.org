import { NextResponse } from "next/server";
import { getComments, getCommentLikes, saveCommentLikes, getCommentDislikes, saveCommentDislikes, addCredits, hasReceivedCreditsForCommentLike } from "@/lib/data";

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
  const dislikes = getCommentDislikes();
  const existingLike = likes.findIndex((l) => l.commentId === commentId && l.userId === body.userId);
  const existingDislike = dislikes.findIndex((d) => d.commentId === commentId && d.userId === body.userId);

  if (existingLike >= 0) {
    likes.splice(existingLike, 1);
  } else {
    if (existingDislike >= 0) {
      dislikes.splice(existingDislike, 1);
      saveCommentDislikes(dislikes);
    }
    likes.push({ commentId, userId: body.userId });
    // Only award credits the first time this user ever liked this comment (no like/unlike farming)
    if (!hasReceivedCreditsForCommentLike(body.userId, commentId)) {
      addCredits(body.userId, 1, "comment_like", { commentId, winnerId });
    }
  }
  saveCommentLikes(likes);

  return NextResponse.json({
    liked: existingLike < 0,
    likeCount: likes.filter((l) => l.commentId === commentId).length,
  });
}
