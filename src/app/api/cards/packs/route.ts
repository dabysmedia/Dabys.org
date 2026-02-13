import { NextResponse } from "next/server";
import { getPacks, getPackPurchasesCountToday } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  const rawPacks = getPacks().filter((p) => p.isActive);
  const packs = userId
    ? rawPacks.map((p) => ({
        ...p,
        purchasesToday: getPackPurchasesCountToday(userId, p.id),
      }))
    : rawPacks;
  return NextResponse.json({ packs });
}

