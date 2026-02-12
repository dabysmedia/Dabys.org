import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCharacterPool } from "@/lib/data";

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

  const pool = getCharacterPool();
  return NextResponse.json({ pool });
}
