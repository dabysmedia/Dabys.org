import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsers } from "@/lib/data";

const DEFAULT_ADMIN_NAMES = ["jerry", "carlos"];

function isDefaultAdmin(userName: string): boolean {
  return DEFAULT_ADMIN_NAMES.includes((userName || "").trim().toLowerCase());
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");

  if (session?.value === "authenticated") {
    return NextResponse.json({ authenticated: true });
  }

  // Allow Jerry and Carlos to bypass password when identified by user id
  const userId = request.headers.get("x-user-id")?.trim();
  if (userId) {
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
      return NextResponse.json({ authenticated: true });
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
