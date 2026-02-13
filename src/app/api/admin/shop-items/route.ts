import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getShopItems,
  upsertShopItem,
  deleteShopItem,
  reorderShopItems,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: list all shop items (admin). */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;
  const items = getShopItems();
  return NextResponse.json({ items });
}

/** POST: create or update a shop item. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined;
  const price = typeof body.price === "number" ? body.price : parseInt(String(body.price ?? 0), 10);
  const type = body.type === "skip" ? "skip" : "badge";
  const skipAmount = type === "skip" && typeof body.skipAmount === "number" ? body.skipAmount : 1;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const order = typeof body.order === "number" ? body.order : getShopItems().length;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (price < 0 || !Number.isFinite(price)) {
    return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 });
  }
  if (type === "skip" && (!Number.isInteger(skipAmount) || skipAmount < 1)) {
    return NextResponse.json({ error: "Skip amount must be at least 1" }, { status: 400 });
  }

  const item = upsertShopItem({
    id,
    name,
    description,
    imageUrl,
    price,
    type,
    skipAmount: type === "skip" ? skipAmount : undefined,
    isActive,
    order,
  });
  return NextResponse.json(item);
}

/** DELETE: remove a shop item. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = deleteShopItem(id);
  if (!ok) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

/** PUT: reorder shop items. Body: { itemIds: string[] }. */
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;
  const body = await request.json().catch(() => ({}));
  const itemIds = Array.isArray(body.itemIds) ? (body.itemIds as string[]).filter((x): x is string => typeof x === "string") : [];
  if (itemIds.length === 0) {
    return NextResponse.json({ error: "itemIds array required" }, { status: 400 });
  }
  const ok = reorderShopItems(itemIds);
  if (!ok) {
    return NextResponse.json({ error: "Invalid itemIds" }, { status: 400 });
  }
  return NextResponse.json({ items: getShopItems() });
}
