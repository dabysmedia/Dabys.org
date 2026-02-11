import { NextResponse } from "next/server";
import { getWeeks, saveWeeks } from "@/lib/data";

/** POST /api/weeks/restore — End current week and make the selected (past) week current again. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const weekId = typeof body.weekId === "string" ? body.weekId.trim() : "";
  if (!weekId) {
    return NextResponse.json({ error: "weekId is required" }, { status: 400 });
  }

  const weeks = getWeeks();
  const currentIdx = weeks.findIndex((w) => !w.endedAt);
  const restoreIdx = weeks.findIndex((w) => w.id === weekId);

  if (restoreIdx === -1) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }
  if (!weeks[restoreIdx].endedAt) {
    return NextResponse.json(
      { error: "Selected week is already the current week" },
      { status: 400 }
    );
  }

  if (currentIdx !== -1) {
    weeks[currentIdx].endedAt = new Date().toISOString();
  }

  delete weeks[restoreIdx].endedAt;
  saveWeeks(weeks);

  return NextResponse.json({
    success: true,
    currentWeek: weeks[restoreIdx],
  });
}
