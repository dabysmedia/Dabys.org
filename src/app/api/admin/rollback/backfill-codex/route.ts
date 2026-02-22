import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backfillCodexLog } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * POST: Backfill the codex activity log with current codex entries.
 * Body: { date: "YYYY-MM-DD", userId?: string }
 * If userId is provided, only backfills that user. Otherwise backfills all users.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === "string" ? body.date : null;
  const userId = typeof body.userId === "string" ? body.userId : undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const added = backfillCodexLog(date, userId);

  return NextResponse.json({
    success: true,
    entriesAdded: added,
    message: `Backfilled ${added} codex log entries with date ${date}${userId ? ` for user ${userId}` : " for all users"}.`,
  });
}
