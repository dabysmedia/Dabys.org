import { NextResponse } from "next/server";
import {
  getVisibleNotificationsForUser,
  getUnreadNotificationCount,
  getReadUpTo,
} from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const notifications = getVisibleNotificationsForUser(userId);
  const unreadCount = getUnreadNotificationCount(userId);
  const readUpTo = getReadUpTo(userId);

  return NextResponse.json({ notifications, unreadCount, readUpTo });
}
