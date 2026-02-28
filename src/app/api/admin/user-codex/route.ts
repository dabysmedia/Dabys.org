import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  addCodexUnlock,
  removeCodexUnlock,
  addCodexUnlockHolo,
  removeCodexUnlockHolo,
  addCodexUnlockPrismatic,
  removeCodexUnlockPrismatic,
  addCodexUnlockDarkMatter,
  removeCodexUnlockDarkMatter,
  addCodexUnlockAltArt,
  removeCodexUnlockAltArt,
  addCodexUnlockBoys,
  removeCodexUnlockBoys,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type Variant = "regular" | "holo" | "prismatic" | "darkMatter" | "altart" | "boys";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const characterId = body.characterId as string | undefined;
  const variant = body.variant as Variant | undefined;
  const action = body.action as "add" | "remove" | undefined;
  const isHolo = body.isHolo as boolean | undefined; // for altart: add as holo

  if (!userId || !characterId?.trim() || !variant || !action) {
    return NextResponse.json(
      { error: "userId, characterId, variant, and action (add|remove) required" },
      { status: 400 }
    );
  }

  const validVariants: Variant[] = ["regular", "holo", "prismatic", "darkMatter", "altart", "boys"];
  if (!validVariants.includes(variant)) {
    return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
  }
  if (action !== "add" && action !== "remove") {
    return NextResponse.json({ error: "action must be add or remove" }, { status: 400 });
  }

  const id = characterId.trim();

  switch (variant) {
    case "regular":
      action === "add" ? addCodexUnlock(userId, id) : removeCodexUnlock(userId, id);
      break;
    case "holo":
      action === "add" ? addCodexUnlockHolo(userId, id) : removeCodexUnlockHolo(userId, id);
      break;
    case "prismatic":
      action === "add" ? addCodexUnlockPrismatic(userId, id) : removeCodexUnlockPrismatic(userId, id);
      break;
    case "darkMatter":
      action === "add" ? addCodexUnlockDarkMatter(userId, id) : removeCodexUnlockDarkMatter(userId, id);
      break;
    case "altart":
      action === "add" ? addCodexUnlockAltArt(userId, id, isHolo ? "holo" : undefined) : removeCodexUnlockAltArt(userId, id);
      break;
    case "boys":
      action === "add" ? addCodexUnlockBoys(userId, id) : removeCodexUnlockBoys(userId, id);
      break;
  }

  return NextResponse.json({ ok: true, userId, characterId: id, variant, action });
}
