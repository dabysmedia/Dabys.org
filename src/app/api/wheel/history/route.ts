import { NextResponse } from "next/server";
import { getWheelHistory } from "@/lib/data";

/** GET /api/wheel/history — List of previously confirmed wheel themes (for admin dropdown) */
export async function GET() {
  const history = getWheelHistory();
  return NextResponse.json(history);
}
