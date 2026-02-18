import { NextResponse } from "next/server";
import { getCreditLedgerRaw } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const ledger = getCreditLedgerRaw();
  const claimedVideoIds = ledger
    .filter(
      (e) =>
        e.userId === userId &&
        e.reason === "vault_watch" &&
        e.amount > 0 &&
        e.metadata &&
        typeof e.metadata.videoId === "string"
    )
    .map((e) => e.metadata!.videoId as string);

  return NextResponse.json({ claimedVideoIds: [...new Set(claimedVideoIds)] });
}
