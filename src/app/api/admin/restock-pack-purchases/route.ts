import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resetUserPackPurchasesToday } from "@/lib/data";

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
  const userId = body.userId as string | undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "userId required" },
      { status: 400 }
    );
  }

  const removed = resetUserPackPurchasesToday(userId);
  return NextResponse.json({ ok: true, removed });
}
