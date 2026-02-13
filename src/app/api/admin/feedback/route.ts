import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFeedback, deleteFeedback } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: list all feedback entries (newest first). */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;
  const entries = getFeedback();
  return NextResponse.json(entries);
}
