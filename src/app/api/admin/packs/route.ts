import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPacks, upsertPack, deletePack } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const packs = getPacks();
  return NextResponse.json({ packs });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));

  const name = (body.name as string | undefined)?.trim() || "";
  const imageUrl = (body.imageUrl as string | undefined)?.trim() || "";
  const rawPrice = body.price;
  const rawCardsPerPack = body.cardsPerPack;
  const rawAllowedRarities = Array.isArray(body.allowedRarities) ? body.allowedRarities : [];
  const rawAllowedCardTypes = Array.isArray(body.allowedCardTypes) ? body.allowedCardTypes : [];
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  const price = typeof rawPrice === "number" ? rawPrice : parseInt(String(rawPrice ?? 0), 10);
  if (!Number.isFinite(price) || price < 1) {
    return NextResponse.json({ error: "price must be at least 1" }, { status: 400 });
  }

  const cardsPerPack =
    typeof rawCardsPerPack === "number" ? rawCardsPerPack : parseInt(String(rawCardsPerPack ?? 0), 10);

  const allowedRarities = rawAllowedRarities.filter((r: string) =>
    ["uncommon", "rare", "epic", "legendary"].includes(r)
  );
  const allowedCardTypes = rawAllowedCardTypes.filter((t: string) =>
    ["actor", "director", "character", "scene"].includes(t)
  );

  const pack = upsertPack({
    name,
    imageUrl,
    price,
    cardsPerPack: cardsPerPack > 0 ? cardsPerPack : 5,
    allowedRarities,
    allowedCardTypes,
    isActive,
  });

  return NextResponse.json(pack, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const id = body.id as string | undefined;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existingPacks = getPacks();
  const existing = existingPacks.find((p) => p.id === id);
  if (!existing) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name;
  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : existing.imageUrl;

  const rawPrice = body.price;
  const price =
    rawPrice === undefined
      ? existing.price
      : typeof rawPrice === "number"
      ? rawPrice
      : parseInt(String(rawPrice ?? 0), 10);

  const rawCardsPerPack = body.cardsPerPack;
  const cardsPerPack =
    rawCardsPerPack === undefined
      ? existing.cardsPerPack
      : typeof rawCardsPerPack === "number"
      ? rawCardsPerPack
      : parseInt(String(rawCardsPerPack ?? 0), 10);

  const rawAllowedRarities = Array.isArray(body.allowedRarities)
    ? body.allowedRarities
    : existing.allowedRarities;
  const allowedRarities = rawAllowedRarities.filter((r: string) =>
    ["uncommon", "rare", "epic", "legendary"].includes(r)
  );

  const rawAllowedCardTypes = Array.isArray(body.allowedCardTypes)
    ? body.allowedCardTypes
    : existing.allowedCardTypes;
  const allowedCardTypes = rawAllowedCardTypes.filter((t: string) =>
    ["actor", "director", "character", "scene"].includes(t)
  );

  const isActive =
    typeof body.isActive === "boolean" ? body.isActive : existing.isActive;

  const updated = upsertPack({
    id,
    name,
    imageUrl,
    price,
    cardsPerPack: cardsPerPack > 0 ? cardsPerPack : existing.cardsPerPack,
    allowedRarities,
    allowedCardTypes,
    isActive,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = deletePack(id);
  if (!ok) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

