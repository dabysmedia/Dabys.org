import { NextResponse } from "next/server";
import { getWheel, saveWheel } from "@/lib/data";

// GET /api/wheel — get current wheel state
export async function GET() {
  const wheel = getWheel();
  return NextResponse.json(wheel);
}

// PUT /api/wheel — update entries OR manually set result
export async function PUT(request: Request) {
  const body = await request.json();
  const wheel = getWheel();

  // Manual result override — skip entries validation entirely
  if (typeof body.manualResult === "string" && body.manualResult.trim()) {
    const result = body.manualResult.trim();
    wheel.lastResult = result;
    wheel.lastSpunAt = new Date().toISOString();
    wheel.spinning = false;
    // Store the winnerIndex so the wheel page can rotate to the correct segment
    const idx = wheel.entries.findIndex((e) => e === result);
    wheel.winnerIndex = idx >= 0 ? idx : null;
    saveWheel(wheel);
    return NextResponse.json(wheel);
  }

  // Otherwise, update entries
  if (!Array.isArray(body.entries) || body.entries.length < 2) {
    return NextResponse.json(
      { error: "At least 2 entries required" },
      { status: 400 }
    );
  }

  wheel.entries = body.entries
    .map((e: string) => (typeof e === "string" ? e.trim() : ""))
    .filter((e: string) => e.length > 0);

  if (wheel.entries.length < 2) {
    return NextResponse.json(
      { error: "At least 2 non-empty entries required" },
      { status: 400 }
    );
  }

  saveWheel(wheel);
  return NextResponse.json(wheel);
}
