import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsers, getSetCompletionQuests } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const users = getUsers();
  const setCompletionByUser: { userId: string; userName: string; winnerId: string; movieTitle: string }[] = [];
  for (const u of users) {
    const quests = getSetCompletionQuests(u.id);
    for (const q of quests) {
      setCompletionByUser.push({
        userId: u.id,
        userName: u.name,
        winnerId: q.winnerId,
        movieTitle: q.movieTitle || "Unknown",
      });
    }
  }
  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, name: u.name })),
    setCompletionByUser,
  });
}
