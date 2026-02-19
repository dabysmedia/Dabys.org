import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { wipeSetCompletionQuestForUser, wipeAllSetCompletionQuestsForUser } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const winnerId = typeof body.winnerId === "string" ? body.winnerId.trim() : "";
  const wipeAll = body.wipeAll === true;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (wipeAll) {
    const wiped = wipeAllSetCompletionQuestsForUser(userId);
    return NextResponse.json({ success: true, wiped });
  }

  if (!winnerId) {
    return NextResponse.json({ error: "winnerId required when not wipeAll" }, { status: 400 });
  }

  const wiped = wipeSetCompletionQuestForUser(userId, winnerId);
  return NextResponse.json({ success: true, wiped });
}
