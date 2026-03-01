import { NextResponse } from "next/server";
import { getCredits, getCreditLedgerRaw } from "@/lib/data";

/** GET /api/wallet?userId=... — Returns user balance and ledger entries (read-only, no data modification). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const balance = getCredits(userId);
  const ledger = getCreditLedgerRaw();
  const entries = ledger
    .filter((e) => e.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ userId, balance, entries });
}
