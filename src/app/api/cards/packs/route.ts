import { NextResponse } from "next/server";
import { getPacks, getPackPurchasesInWindow } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  const rawPacks = getPacks().filter((p) => p.isActive);
  const packs = userId
    ? rawPacks.map((p) => {
        const restockOptions = {
          restockIntervalHours: p.restockIntervalHours,
          restockHourUtc: p.restockHourUtc,
          restockMinuteUtc: p.restockMinuteUtc,
        };
        return {
          ...p,
          purchasesToday: getPackPurchasesInWindow(userId, p.id, restockOptions),
        };
      })
    : rawPacks;
  return NextResponse.json({ packs });
}

