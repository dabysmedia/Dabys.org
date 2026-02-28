import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCommunitySetById, saveCommunitySet } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST - Deny a pending community set */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await params;
  const set = getCommunitySetById(id);
  if (!set) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }
  if (set.status !== "pending") {
    return NextResponse.json(
      { error: "Set is not pending approval" },
      { status: 400 }
    );
  }

  set.status = "denied";
  saveCommunitySet(set);

  return NextResponse.json({ success: true, set });
}
