import { NextResponse } from "next/server";
import { getWeeks, saveWeeks } from "@/lib/data";

export async function POST() {
  const weeks = getWeeks();
  const idx = weeks.findIndex((w) => !w.endedAt);

  if (idx !== -1) {
    weeks[idx].endedAt = new Date().toISOString();
  }

  saveWeeks(weeks);
  return NextResponse.json({ success: true });
}
