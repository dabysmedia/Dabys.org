import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsers } from "@/lib/data";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dabysmedia";

const DEFAULT_ADMIN_NAMES = ["jerry", "carlos"];

function isDefaultAdmin(userName: string): boolean {
  return DEFAULT_ADMIN_NAMES.includes((userName || "").trim().toLowerCase());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { password, userId } = body;

  const cookieStore = await cookies();

  // Jerry and Carlos can bypass password when identified by user id
  if (userId && typeof userId === "string") {
    const users = getUsers();
    const user = users.find((u) => u.id === userId);
    if (user && isDefaultAdmin(user.name)) {
      cookieStore.set("dabys_admin", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      return NextResponse.json({ success: true });
    }
  }

  if (!password || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  cookieStore.set("dabys_admin", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
