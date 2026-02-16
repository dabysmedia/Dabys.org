import { NextResponse } from "next/server";
import { getPacks, getPackPurchasesInWindow, getPackOldestPurchaseInWindow } from "@/lib/data";

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
        const purchasesToday = getPackPurchasesInWindow(userId, p.id, restockOptions);
        const maxPerWindow = p.maxPurchasesPerDay;
        const atLimit =
          typeof maxPerWindow === "number" &&
          maxPerWindow > 0 &&
          purchasesToday >= maxPerWindow;
        const intervalHours = typeof p.restockIntervalHours === "number" && p.restockIntervalHours > 0 ? p.restockIntervalHours : undefined;
        const oldestAt =
          atLimit && intervalHours != null
            ? getPackOldestPurchaseInWindow(userId, p.id, restockOptions)
            : null;
        const nextRestockAt =
          oldestAt && intervalHours != null
            ? new Date(new Date(oldestAt).getTime() + intervalHours * 60 * 60 * 1000).toISOString()
            : undefined;
        return {
          ...p,
          purchasesToday,
          nextRestockAt,
        };
      })
    : rawPacks;
  return NextResponse.json({ packs });
}

