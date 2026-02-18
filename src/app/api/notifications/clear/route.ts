import { NextResponse } from "next/server";
import { clearNotificationsForUser } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  clearNotificationsForUser(body.userId);

  return NextResponse.json({ success: true });
}
