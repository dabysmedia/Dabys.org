import { NextResponse } from "next/server";
import { getWeeks, saveWeeks, getCurrentWeek } from "@/lib/data";

export async function GET() {
  const current = getCurrentWeek();
  if (!current) {
    return NextResponse.json({ error: "No active week" }, { status: 404 });
  }
  return NextResponse.json(current);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const weeks = getWeeks();
  const idx = weeks.findIndex((w) => !w.endedAt);

  if (idx === -1) {
    return NextResponse.json({ error: "No active week" }, { status: 404 });
  }

  if (body.theme !== undefined) {
    weeks[idx].theme = body.theme;
  }
  if (body.phase !== undefined) {
    weeks[idx].phase = body.phase;
  }

  saveWeeks(weeks);
  return NextResponse.json(weeks[idx]);
}
