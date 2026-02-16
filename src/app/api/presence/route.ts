import { NextRequest, NextResponse } from "next/server";
import {
  upsertPresence,
  removePresence,
  getAllPresenceStatuses,
} from "@/lib/data";

/**
 * GET /api/presence
 * Returns a map of userId → "online" | "away" | "offline" for all tracked users.
 */
export async function GET() {
  const statuses = getAllPresenceStatuses();
  return NextResponse.json(statuses);
}

/**
 * POST /api/presence
 * Body: { userId: string, idle?: boolean, _delete?: boolean }
 * Sends a heartbeat for the given user. Set idle=true when user has been
 * inactive (no mouse/keyboard) for 15+ minutes.
 * Set _delete=true to remove presence (used via sendBeacon on page unload,
 * since sendBeacon can only POST).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body?.userId;
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (body?._delete) {
      removePresence(userId);
      return NextResponse.json({ ok: true });
    }
    const idle = body?.idle === true;
    const entry = upsertPresence(userId, idle);
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}

/**
 * DELETE /api/presence
 * Body: { userId: string }
 * Removes a user's presence entry (used on logout).
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body?.userId;
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    removePresence(userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}
