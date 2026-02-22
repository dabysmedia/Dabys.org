import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasRollbackUndoAvailable, undoRollbackUser } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: Check if undo is available for the given user. */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const available = hasRollbackUndoAvailable(userId);
  return NextResponse.json({ available });
}

/** POST: Undo the most recent rollback for the given user. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = undoRollbackUser(userId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Rollback undone. Credits, cards, codex, tickets, trades, listings, and quests restored.",
  });
}
