import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsers, addCredits } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST: add the same amount of credits to every user. Body: { amount: number }. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const amount = typeof body.amount === "number" ? body.amount : parseInt(String(body.amount), 10);
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json(
      { error: "amount must be a non-negative number" },
      { status: 400 }
    );
  }

  const users = getUsers();
  const safeAmount = Math.floor(amount);
  for (const user of users) {
    addCredits(user.id, safeAmount, "admin_add_all", {});
  }
  return NextResponse.json({
    added: safeAmount,
    userCount: users.length,
  });
}
