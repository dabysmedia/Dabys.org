import { NextResponse } from "next/server";
import { getRatings, saveRatings, addCredits, getCreditSettings, isWinnerArchived } from "@/lib/data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: winnerId } = await params;

  if (!isWinnerArchived(winnerId)) {
    return NextResponse.json(
      { error: "Reviews are locked until the winner is archived in the winners circle (after the new week starts)" },
      { status: 423 }
    );
  }

  const body = await request.json();

  if (!body.userId || !body.userName) {
    return NextResponse.json({ error: "User info required" }, { status: 400 });
  }

  if (typeof body.thumbsUp !== "boolean") {
    return NextResponse.json({ error: "thumbsUp must be boolean" }, { status: 400 });
  }

  if (!body.stars || body.stars < 0.5 || body.stars > 5 || (body.stars * 2) % 1 !== 0) {
    return NextResponse.json({ error: "stars must be 0.5-5 in 0.5 increments" }, { status: 400 });
  }

  const ratings = getRatings();

  // Upsert: one rating per user per winner
  const existingIdx = ratings.findIndex(
    (r) => r.winnerId === winnerId && r.userId === body.userId
  );

  const rating = {
    id:
      existingIdx >= 0
        ? ratings[existingIdx].id
        : String(Math.max(0, ...ratings.map((r) => parseInt(r.id, 10))) + 1),
    winnerId,
    userId: body.userId,
    userName: body.userName,
    thumbsUp: body.thumbsUp,
    stars: body.stars,
    createdAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    ratings[existingIdx] = rating;
  } else {
    ratings.push(rating);
    const { rating: creditAmount } = getCreditSettings();
    addCredits(body.userId, creditAmount, "rating", { winnerId });
  }

  saveRatings(ratings);
  return NextResponse.json(rating, { status: existingIdx >= 0 ? 200 : 201 });
}
