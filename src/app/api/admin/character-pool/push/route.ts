import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pushPendingToPool, getWinners, getCustomCardTypes, addGlobalNotification } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function getBucketDisplayName(bucketKey: string): string {
  const winners = getWinners();
  const winner = winners.find((w) => w.id === bucketKey);
  if (winner) return winner.movieTitle ?? "a movie";
  if (bucketKey === "character") return "Boys";
  const custom = getCustomCardTypes().find((t) => t.id === bucketKey);
  return custom?.label ?? bucketKey;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const bucketKey = (typeof body.winnerId === "string" ? body.winnerId : body.bucketKey)?.trim() ?? "";
  if (!bucketKey) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  const pushed = pushPendingToPool(bucketKey);

  // Notify everyone about the new set
  if (pushed > 0) {
    const displayName = getBucketDisplayName(bucketKey);
    addGlobalNotification({
      type: "new_set_added",
      message: `New set added to the pool: ${displayName} (${pushed} card${pushed !== 1 ? "s" : ""})`,
      meta: { winnerId: bucketKey, movieTitle: displayName, count: pushed },
    });
  }

  return NextResponse.json({ success: true, pushed });
}
