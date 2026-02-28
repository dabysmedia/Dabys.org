import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCommunitySets, getUsers } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET - List all community sets for admin (pending, published, draft, denied) */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const sets = getCommunitySets();
  const users = getUsers();
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const withCreator = sets.map((s) => ({
    ...s,
    creatorName: userMap.get(s.creatorId) ?? s.creatorId,
  }));

  const pending = withCreator.filter((s) => s.status === "pending");
  const published = withCreator.filter((s) => s.status === "published");
  const draft = withCreator.filter((s) => s.status === "draft");
  const denied = withCreator.filter((s) => s.status === "denied");

  return NextResponse.json({
    sets: withCreator,
    pending,
    published,
    draft,
    denied,
  });
}
