import { NextRequest, NextResponse } from "next/server";
import { getCreditLedgerRaw } from "@/lib/data";
import { getUsers } from "@/lib/data";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const ledger = getCreditLedgerRaw();
  const users = getUsers();

  const transactions = ledger
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((e) => {
      const user = users.find((u) => u.id === e.userId);
      return {
        id: e.id,
        userId: e.userId,
        userName: user?.name ?? `User ${e.userId}`,
        amount: e.amount,
        reason: e.reason,
        createdAt: e.createdAt,
      };
    });

  return NextResponse.json({
    transactions,
    total: ledger.length,
    returned: transactions.length,
  });
}
