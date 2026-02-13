import { NextResponse } from "next/server";
import {
  getActiveShopItems,
  getCredits,
  deductCredits,
  applyShopItemPurchase,
} from "@/lib/data";

/** POST: purchase a shop item (Others). Body: { userId, itemId }. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const itemId = body.itemId as string | undefined;

  if (!userId || !itemId) {
    return NextResponse.json(
      { error: "userId and itemId required" },
      { status: 400 }
    );
  }

  const items = getActiveShopItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "Item not found or inactive" }, { status: 404 });
  }

  const balance = getCredits(userId);
  if (balance < item.price) {
    return NextResponse.json(
      { error: "Insufficient credits", need: item.price - balance },
      { status: 400 }
    );
  }

  const deducted = deductCredits(userId, item.price, "shop_item", { itemId, itemType: item.type });
  if (!deducted) {
    return NextResponse.json({ error: "Failed to deduct credits" }, { status: 500 });
  }

  const applied = applyShopItemPurchase(userId, item);
  if (!applied) {
    return NextResponse.json({ error: "Failed to grant item" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    balance: getCredits(userId),
    item: { id: item.id, name: item.name, type: item.type },
  });
}
