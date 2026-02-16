import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCreditSettings, saveCreditSettings } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const settings = getCreditSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const current = getCreditSettings();

  const parse = (v: unknown, fallback: number): number => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
    const n = parseInt(String(v ?? fallback), 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const settings = {
    submission: parse(body.submission, current.submission),
    vote: parse(body.vote, current.vote),
    submissionWin: parse(body.submissionWin, current.submissionWin),
    votesReceivedPerVote: parse(body.votesReceivedPerVote, current.votesReceivedPerVote),
    rating: parse(body.rating, current.rating),
    comment: parse(body.comment, current.comment),
    quicksellUncommon: parse(body.quicksellUncommon, current.quicksellUncommon),
    quicksellRare: parse(body.quicksellRare, current.quicksellRare),
    quicksellEpic: parse(body.quicksellEpic, current.quicksellEpic),
    tradeUpLegendaryFailureCredits: parse(body.tradeUpLegendaryFailureCredits, current.tradeUpLegendaryFailureCredits),
    feedbackAccepted: parse(body.feedbackAccepted, current.feedbackAccepted),
    setCompletionReward: parse(body.setCompletionReward, current.setCompletionReward),
  };

  saveCreditSettings(settings);
  return NextResponse.json(settings);
}
