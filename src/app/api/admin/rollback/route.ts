import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rollbackUser } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST: Roll back selected user to their state at the start of the given date (UTC). */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;
  const date = typeof body.date === "string" ? body.date : null;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const result = rollbackUser(userId, date);

  const parts = [
    `Credits: ${result.newBalance}`,
    `${result.cardsRemoved} card(s) removed`,
    `${result.codexUnlocksRemoved} codex unlock(s) removed`,
    `${result.lotteryTicketsRemoved} lottery ticket(s) removed`,
    `${result.tradesCancelled} trade(s) cancelled`,
    `${result.listingsRemoved} listing(s) removed`,
    `${result.setCompletionQuestsRemoved} set quest(s) removed`,
    `${result.ledgerEntriesRemoved} ledger entries removed`,
  ];

  return NextResponse.json({
    success: true,
    ...result,
    message: `Rolled back to ${date}. ${parts.join(", ")}.`,
  });
}
