import { NextResponse } from "next/server";
import { getNotificationsResponse } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const { notifications, unreadCount, readUpTo } = getNotificationsResponse(userId);
  return NextResponse.json({ notifications, unreadCount, readUpTo });
}
