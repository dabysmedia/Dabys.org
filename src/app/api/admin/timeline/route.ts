import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEpicLegendaryTimeline } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: Epic/legendary timeline. Query: ?userId=... to filter by user. */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || undefined;

  const entries = getEpicLegendaryTimeline(userId);

  return NextResponse.json({ entries });
}
