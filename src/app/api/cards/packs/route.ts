import { NextResponse } from "next/server";
import { getPacks, getPackPurchasesInWindow, getPackOldestPurchaseInWindow, getUnopenedPacks } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  const rawPacks = getPacks().filter((p) => p.isActive || p.comingSoon);
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

  const unopenedPacks = userId ? getUnopenedPacks(userId) : [];
  const allPacks = getPacks();
  const packIdsInUnopened = [...new Set(unopenedPacks.map((u) => u.packId))];
  const packDefinitionsForUnopened: Record<string, { name: string; imageUrl: string }> = {};
  for (const packId of packIdsInUnopened) {
    const pack = allPacks.find((p) => p.id === packId);
    if (pack) {
      packDefinitionsForUnopened[packId] = { name: pack.name, imageUrl: pack.imageUrl };
    }
  }
  return NextResponse.json({ packs, unopenedPacks, packDefinitionsForUnopened });
}

