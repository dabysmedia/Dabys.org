import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pushPendingToPool, getWinners, addGlobalNotification } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const winnerId = typeof body.winnerId === "string" ? body.winnerId.trim() : "";
  if (!winnerId) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  const pushed = pushPendingToPool(winnerId);

  // Notify everyone about the new set
  if (pushed > 0) {
    const winners = getWinners();
    const winner = winners.find((w) => w.id === winnerId);
    const movieTitle = winner?.movieTitle || "a movie";
    addGlobalNotification({
      type: "new_set_added",
      message: `New set added to the pool: ${movieTitle} (${pushed} card${pushed !== 1 ? "s" : ""})`,
      meta: { winnerId, movieTitle, count: pushed },
    });
  }

  return NextResponse.json({ success: true, pushed });
}
