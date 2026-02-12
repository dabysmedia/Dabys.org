import { NextResponse } from "next/server";
import {
  getWheel,
  saveWheel,
  getWeeks,
  saveWeeks,
  getWheelHistory,
  saveWheelHistory,
} from "@/lib/data";

/** POST /api/wheel/confirm — Confirm theme: archive current week, create new week with theme, remove theme from wheel, add to history */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  if (!theme) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 });
  }

  const weeks = getWeeks();
  const currentIdx = weeks.findIndex((w) => !w.endedAt);
  if (currentIdx !== -1) {
    weeks[currentIdx].endedAt = new Date().toISOString();
  }

  const newId = String(
    Math.max(0, ...weeks.map((w) => parseInt(w.id, 10))) + 1
  );
  weeks.push({
    id: newId,
    theme,
    phase: "subs_open",
    startedAt: new Date().toISOString(),
  });
  saveWeeks(weeks);

  const wheel = getWheel();
  // Keep lastResult/winnerIndex/lastSpunAt so the landed position and result stay visible for all
  wheel.lastConfirmedResult = theme;
  wheel.lastConfirmedAt = new Date().toISOString();
  wheel.spinning = false;
  wheel.spinStartedAt = null;
  wheel.fullSpins = null;
  wheel.duration = null;
  // Do not remove theme from entries or clear lastResult/winnerIndex here;
  // theme is removed when the next spin starts (in spin route)
  saveWheel(wheel);

  const history = getWheelHistory();
  history.unshift({
    theme,
    confirmedAt: new Date().toISOString(),
  });
  saveWheelHistory(history);

  return NextResponse.json({ success: true, wheel });
}
