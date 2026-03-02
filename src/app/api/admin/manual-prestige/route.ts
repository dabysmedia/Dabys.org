import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  wipeUserInventory,
  clearCodexForUser,
  setPrismaticForgeUnlocked,
  getUsers,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Admin-only. Manual prestige: bypasses 50% holo requirement. Resets user TCG and unlocks Radiant Forge. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  wipeUserInventory(userId);
  clearCodexForUser(userId);
  setPrismaticForgeUnlocked(userId, true);

  return NextResponse.json({
    success: true,
    message: `Manual prestige complete for ${user.name}. TCG account reset; Radiant Forge unlocked.`,
  });
}
