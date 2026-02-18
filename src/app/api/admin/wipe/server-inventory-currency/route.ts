import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { wipeServerInventoryAndCurrencyOnly, getWipeConfirmWord } from "@/lib/data";

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
  const { confirm } = body;

  if (!confirm || typeof confirm !== "string") {
    return NextResponse.json(
      { error: `Type ${getWipeConfirmWord()} to confirm` },
      { status: 400 }
    );
  }

  const result = wipeServerInventoryAndCurrencyOnly(confirm);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
