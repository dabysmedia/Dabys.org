import { NextResponse } from "next/server";
import { getVotes, saveVotes, getCurrentWeek, getSubmissions, addCredits, hasReceivedCreditsForWeek, getCreditSettings } from "@/lib/data";
import { recordQuestProgress } from "@/lib/quests";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");

  let votes = getVotes();
  if (weekId) {
    votes = votes.filter((v) => v.weekId === weekId);
  }

  return NextResponse.json(votes);
}

export async function POST(request: Request) {
  const body = await request.json();
  const currentWeek = getCurrentWeek();

  if (!currentWeek || currentWeek.phase !== "vote_open") {
    return NextResponse.json(
      { error: "Voting is not open" },
      { status: 400 }
    );
  }

  if (!body.userId || !body.submissionId) {
    return NextResponse.json(
      { error: "userId and submissionId required" },
      { status: 400 }
    );
  }

  const submissions = getSubmissions();
  const submission = submissions.find((s) => s.id === body.submissionId);
  if (!submission) {
    return NextResponse.json(
      { error: "Unknown submission" },
      { status: 400 }
    );
  }
  if (submission.userId === body.userId) {
    return NextResponse.json(
      { error: "You can't vote for your own submission" },
      { status: 400 }
    );
  }

  const votes = getVotes();

  // One vote per user per week
  const existing = votes.findIndex(
    (v) => v.weekId === currentWeek.id && v.userId === body.userId
  );

  const vote = {
    id:
      existing >= 0
        ? votes[existing].id
        : String(Math.max(0, ...votes.map((v) => parseInt(v.id, 10))) + 1),
    weekId: currentWeek.id,
    userId: body.userId,
    userName: body.userName || "",
    submissionId: body.submissionId,
    createdAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    votes[existing] = vote;
  } else {
    votes.push(vote);
    // Award credits only once per user per week (even if they clear and vote again)
    if (!hasReceivedCreditsForWeek(body.userId, "vote", currentWeek.id)) {
      const { vote: amount } = getCreditSettings();
      addCredits(body.userId, amount, "vote", { weekId: currentWeek.id, submissionId: body.submissionId });
    }
  }

  // Movie night quest: vote for a movie
  recordQuestProgress(body.userId, "vote_movie");

  saveVotes(votes);
  return NextResponse.json(vote, { status: existing >= 0 ? 200 : 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const weekId = searchParams.get("weekId");

  if (!userId || !weekId) {
    return NextResponse.json({ error: "userId and weekId required" }, { status: 400 });
  }

  const votes = getVotes();
  const filtered = votes.filter(
    (v) => !(v.weekId === weekId && v.userId === userId)
  );
  saveVotes(filtered);
  return NextResponse.json({ success: true });
}
