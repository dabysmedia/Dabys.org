import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setCredits, getCredits, addCredits } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** PATCH: add credits to a user's balance. Body: { userId, add: number }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const add = typeof body.add === "number" ? body.add : undefined;

  if (!userId || add === undefined || add < 0) {
    return NextResponse.json(
      { error: "userId and add (non-negative number) required" },
      { status: 400 }
    );
  }

  addCredits(userId, Math.floor(add), "admin_add", {});
  return NextResponse.json({
    userId,
    balance: getCredits(userId),
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  const balance = typeof body.balance === "number" ? body.balance : undefined;

  if (!userId || balance === undefined || balance < 0) {
    return NextResponse.json(
      { error: "userId and balance (non-negative number) required" },
      { status: 400 }
    );
  }

  setCredits(userId, Math.floor(balance));
  return NextResponse.json({
    userId,
    balance: getCredits(userId),
  });
}
