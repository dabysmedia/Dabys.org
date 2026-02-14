import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsers, saveUsers } from "@/lib/data";

function normalizePin(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return s;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const users = getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const newPin = normalizePin(body.newPin);
  const currentPin = normalizePin(body.currentPin);

  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("dabys_admin")?.value === "authenticated";

  if (isAdmin) {
    user.pin = newPin || undefined;
    saveUsers(users);
    return NextResponse.json({ success: true });
  }

  const userPin = user.pin;
  const hasPin = !!userPin;
  if (hasPin && userPin !== currentPin) {
    return NextResponse.json({ error: "Current PIN is wrong" }, { status: 401 });
  }
  if (!hasPin && currentPin !== "") {
    return NextResponse.json({ error: "Current PIN is wrong" }, { status: 401 });
  }

  user.pin = newPin || undefined;
  saveUsers(users);
  return NextResponse.json({ success: true });
}
