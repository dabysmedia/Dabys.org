import { NextResponse } from "next/server";
import { getPacks, getPackPurchasesCountToday } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  const rawPacks = getPacks().filter((p) => p.isActive);
  const packs = userId
    ? rawPacks.map((p) => {
        const restock =
          p.restockHourUtc != null || p.restockMinuteUtc != null
            ? { restockHourUtc: p.restockHourUtc, restockMinuteUtc: p.restockMinuteUtc }
            : undefined;
        return {
          ...p,
          purchasesToday: getPackPurchasesCountToday(userId, p.id, restock),
        };
      })
    : rawPacks;
  return NextResponse.json({ packs });
}

