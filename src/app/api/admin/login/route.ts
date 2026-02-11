import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dabysmedia";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!password || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Set an admin session cookie (httpOnly, 24h expiry)
  const cookieStore = await cookies();
  cookieStore.set("dabys_admin", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return NextResponse.json({ success: true });
}
