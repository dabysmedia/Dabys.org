import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPacks, reorderPacks } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const packIds = Array.isArray(body.packIds) ? (body.packIds as string[]).filter((id: unknown) => typeof id === "string") : undefined;

  if (!packIds || packIds.length === 0) {
    return NextResponse.json({ error: "packIds array required" }, { status: 400 });
  }

  const ok = reorderPacks(packIds);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid packIds: must match existing pack ids exactly" },
      { status: 400 }
    );
  }

  return NextResponse.json({ packs: getPacks() });
}
