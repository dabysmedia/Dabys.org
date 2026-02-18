import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { wipeUserInventoryAndCurrencyOnly, getWipeConfirmWord } from "@/lib/data";

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
  const { userId, confirm } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (confirm !== getWipeConfirmWord()) {
    return NextResponse.json(
      { error: `Type ${getWipeConfirmWord()} to confirm` },
      { status: 400 }
    );
  }

  const result = wipeUserInventoryAndCurrencyOnly(userId);
  return NextResponse.json({ success: true, ...result });
}
