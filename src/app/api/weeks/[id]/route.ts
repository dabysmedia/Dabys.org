import { NextResponse } from "next/server";
import {
  getWeeks,
  saveWeeks,
  getCurrentWeek,
  getSubmissions,
  saveSubmissions,
  getVotes,
  saveVotes,
  getWinners,
  saveWinners,
  getRatings,
  saveRatings,
  getComments,
  saveComments,
  getCommentLikes,
  saveCommentLikes,
} from "@/lib/data";

/** DELETE /api/weeks/[id] — Delete a past week and all its data (submissions, votes, winners, ratings, comments). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: weekId } = await params;

  const weeks = getWeeks();
  const week = weeks.find((w) => w.id === weekId);
  if (!week) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const currentWeek = getCurrentWeek();
  if (currentWeek && currentWeek.id === weekId) {
    return NextResponse.json(
      { error: "Cannot delete the current active week. Archive it first (Reset Week)." },
      { status: 400 }
    );
  }

  // Winners for this week (we'll remove ratings/comments for these)
  const winners = getWinners();
  const winnerIds = new Set(winners.filter((w) => w.weekId === weekId).map((w) => w.id));

  const comments = getComments();
  const commentIdsToRemove = new Set(
    comments.filter((c) => winnerIds.has(c.winnerId)).map((c) => c.id)
  );

  // 1. Remove comment likes for comments we're deleting
  const commentLikes = getCommentLikes();
  const filteredLikes = commentLikes.filter((l) => !commentIdsToRemove.has(l.commentId));
  saveCommentLikes(filteredLikes);

  // 2. Remove comments for winners of this week
  const filteredComments = comments.filter((c) => !winnerIds.has(c.winnerId));
  saveComments(filteredComments);

  // 3. Remove ratings for winners of this week
  const ratings = getRatings();
  const filteredRatings = ratings.filter((r) => !winnerIds.has(r.winnerId));
  saveRatings(filteredRatings);

  // 4. Remove winners for this week
  const filteredWinners = winners.filter((w) => w.weekId !== weekId);
  saveWinners(filteredWinners);

  // 5. Remove submissions for this week
  const submissions = getSubmissions();
  const filteredSubmissions = submissions.filter((s) => s.weekId !== weekId);
  saveSubmissions(filteredSubmissions);

  // 6. Remove votes for this week
  const votes = getVotes();
  const filteredVotes = votes.filter((v) => v.weekId !== weekId);
  saveVotes(filteredVotes);

  // 7. Remove the week
  const filteredWeeks = weeks.filter((w) => w.id !== weekId);
  saveWeeks(filteredWeeks);

  return NextResponse.json({ success: true, deletedWeekId: weekId });
}
