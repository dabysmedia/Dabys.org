import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pushPendingToPool } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const winnerId = typeof body.winnerId === "string" ? body.winnerId.trim() : "";
  if (!winnerId) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  const pushed = pushPendingToPool(winnerId);
  return NextResponse.json({ success: true, pushed });
}
