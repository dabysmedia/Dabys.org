import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getWeekAttendance,
  toggleWeekAttendance,
  markPackAwardedForWeek,
} from "@/lib/data";
import { awardPack } from "@/lib/cards";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const weekId = searchParams.get("weekId");
  if (!weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  const attendance = getWeekAttendance(weekId);
  return NextResponse.json(attendance);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const weekId = typeof body.weekId === "string" ? body.weekId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "toggle";

  if (!weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  if (action === "toggle") {
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "userId required for toggle" }, { status: 400 });
    }
    toggleWeekAttendance(weekId, userId);
    const attendance = getWeekAttendance(weekId);
    return NextResponse.json(attendance);
  }

  if (action === "award") {
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.filter((id: unknown): id is string => typeof id === "string")
      : userId ? [userId] : [];
    const packId = typeof body.packId === "string" ? body.packId.trim() : "";

    if (!packId) {
      return NextResponse.json({ error: "packId required for award" }, { status: 400 });
    }
    if (userIds.length === 0) {
      return NextResponse.json({ error: "userId or userIds required for award" }, { status: 400 });
    }

    const attendance = getWeekAttendance(weekId);
    const toAward = userIds.filter((id) => attendance.attended.includes(id) && !attendance.packAwarded.includes(id));

    const results: { userId: string; success: boolean; error?: string }[] = [];
    for (const uid of toAward) {
      const result = awardPack(uid, packId, "movie_night_attendance");
      if (result.success) {
        markPackAwardedForWeek(weekId, uid);
        results.push({ userId: uid, success: true });
      } else {
        results.push({ userId: uid, success: false, error: result.error });
      }
    }

    const updated = getWeekAttendance(weekId);
    return NextResponse.json({
      attendance: updated,
      results,
      awardedCount: results.filter((r) => r.success).length,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
