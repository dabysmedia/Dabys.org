import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getDabysBetsEvents,
  addDabysBetsEvent,
} from "@/lib/data";

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

  const events = getDabysBetsEvents(false);
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const sideA = typeof body.sideA === "string" ? body.sideA.trim() : "";
  const sideB = typeof body.sideB === "string" ? body.sideB.trim() : "";
  const oddsA = typeof body.oddsA === "number" ? body.oddsA : 1.9;
  const oddsB = typeof body.oddsB === "number" ? body.oddsB : 1.9;
  const minBet = typeof body.minBet === "number" ? Math.max(1, Math.floor(body.minBet)) : 5;
  const maxBet = typeof body.maxBet === "number" ? Math.max(minBet, Math.floor(body.maxBet)) : 500;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!title || !sideA || !sideB) {
    return NextResponse.json(
      { error: "title, sideA, and sideB are required" },
      { status: 400 }
    );
  }

  const event = addDabysBetsEvent({
    title,
    sideA,
    sideB,
    oddsA,
    oddsB,
    minBet,
    maxBet,
    isActive,
  });

  return NextResponse.json(event);
}
