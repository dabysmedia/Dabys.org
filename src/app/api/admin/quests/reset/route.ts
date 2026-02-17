import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resetAllDailyQuests, resetUserDailyQuests } from "@/lib/quests";

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

  let body: { userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body: reset all
  }

  if (typeof body.userId === "string" && body.userId.trim()) {
    resetUserDailyQuests(body.userId.trim());
    return NextResponse.json({ success: true });
  }

  resetAllDailyQuests();
  return NextResponse.json({ success: true });
}
