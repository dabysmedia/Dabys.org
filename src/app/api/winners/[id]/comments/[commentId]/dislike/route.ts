import { NextResponse } from "next/server";
import { getComments, getCommentDislikes, saveCommentDislikes, getCommentLikes, saveCommentLikes, isWinnerArchived } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id: winnerId, commentId } = await params;

  if (!isWinnerArchived(winnerId)) {
    return NextResponse.json(
      { error: "Comments are locked until the winner is archived in the winners circle (after the new week starts)" },
      { status: 423 }
    );
  }

  const body = await request.json().catch(() => ({}));

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const comments = getComments();
  const comment = comments.find((c) => c.id === commentId && c.winnerId === winnerId);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const dislikes = getCommentDislikes();
  const likes = getCommentLikes();
  const existingDislike = dislikes.findIndex((d) => d.commentId === commentId && d.userId === body.userId);
  const existingLike = likes.findIndex((l) => l.commentId === commentId && l.userId === body.userId);

  if (existingDislike >= 0) {
    dislikes.splice(existingDislike, 1);
  } else {
    if (existingLike >= 0) {
      likes.splice(existingLike, 1);
      saveCommentLikes(likes);
    }
    dislikes.push({ commentId, userId: body.userId });
  }
  saveCommentDislikes(dislikes);

  return NextResponse.json({
    disliked: existingDislike < 0,
    dislikeCount: dislikes.filter((d) => d.commentId === commentId).length,
  });
}
