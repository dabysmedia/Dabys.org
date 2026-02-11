import { NextResponse } from "next/server";
import { getWeeks, saveWeeks } from "@/lib/data";

export async function GET() {
  return NextResponse.json(getWeeks());
}

export async function POST(request: Request) {
  const body = await request.json();
  const theme = body.theme;

  if (!theme || typeof theme !== "string" || theme.trim().length === 0) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 });
  }

  const weeks = getWeeks();
  const newId = String(
    Math.max(0, ...weeks.map((w) => parseInt(w.id, 10))) + 1
  );

  // Manual past week — already ended
  if (body.manual) {
    const newWeek = {
      id: newId,
      theme: theme.trim(),
      phase: body.phase || "winner_published",
      startedAt: body.startedAt || new Date().toISOString(),
      endedAt: body.endedAt || new Date().toISOString(),
    };
    weeks.push(newWeek);
    saveWeeks(weeks);
    return NextResponse.json(newWeek, { status: 201 });
  }

  const newWeek = {
    id: newId,
    theme: theme.trim(),
    phase: "subs_open",
    startedAt: new Date().toISOString(),
  };

  weeks.push(newWeek);
  saveWeeks(weeks);

  return NextResponse.json(newWeek, { status: 201 });
}
