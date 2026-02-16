import { NextResponse } from "next/server";
import { getComments, saveComments, getCommentLikes, saveCommentLikes, addCredits, getCreditSettings } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: winnerId } = await params;
  const body = await request.json();

  if (!body.userId || !body.userName) {
    return NextResponse.json({ error: "User info required" }, { status: 400 });
  }

  if ((!body.text || body.text.trim().length === 0) && !body.mediaUrl) {
    return NextResponse.json(
      { error: "Comment text or media required" },
      { status: 400 }
    );
  }

  const comments = getComments();
  const newId = String(
    Math.max(0, ...comments.map((c) => parseInt(c.id, 10))) + 1
  );

  const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : undefined;

  const newComment = {
    id: newId,
    winnerId,
    userId: body.userId,
    userName: body.userName,
    text: (body.text || "").trim(),
    mediaUrl: body.mediaUrl || "",
    mediaType: body.mediaType || "",
    createdAt: new Date().toISOString(),
    ...(parentId && { parentId }),
  };

  comments.push(newComment);
  saveComments(comments);

  // Credits only for first comment per user per movie
  const existingCount = comments.filter((c) => c.winnerId === winnerId && c.userId === body.userId).length;
  if (existingCount === 1) {
    const { comment: amount } = getCreditSettings();
    if (amount > 0) {
      addCredits(body.userId, amount, "comment", { commentId: newId, winnerId });
    }
  }

  return NextResponse.json(newComment, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: winnerId } = await params;
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");
  const userId = searchParams.get("userId");

  if (!commentId) {
    return NextResponse.json({ error: "commentId required" }, { status: 400 });
  }

  const comments = getComments();
  const idx = comments.findIndex(
    (c) => c.id === commentId && c.winnerId === winnerId && c.userId === userId
  );

  if (idx === -1) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const replyIds = comments.filter((c) => c.parentId === commentId).map((c) => c.id);
  const idsToRemove = new Set([commentId, ...replyIds]);

  const nextComments = comments.filter((c) => c.id !== commentId && c.parentId !== commentId);
  saveComments(nextComments);

  const likes = getCommentLikes().filter((l) => !idsToRemove.has(l.commentId));
  saveCommentLikes(likes);

  return NextResponse.json({ success: true });
}
