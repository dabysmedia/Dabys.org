import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getFeedback, deleteFeedback, addCredits, getCreditSettings, addNotification } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** PATCH: accept or deny feedback. Accept awards credits to the user (if logged in). Both remove the feedback. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action === "accept" ? "accept" : body.action === "deny" ? "deny" : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'accept' or 'deny'" }, { status: 400 });
  }
  const entry = getFeedback().find((e) => e.id === id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action === "accept" && entry.userId && entry.userId.trim()) {
    const amount = getCreditSettings().feedbackAccepted;
    if (amount > 0) {
      addCredits(entry.userId, amount, "feedback_accepted", { feedbackId: id });
      addNotification({
        type: "feedback_accepted",
        targetUserId: entry.userId,
        message: `Your feedback was accepted. You received ${amount} credits.`,
        meta: { feedbackId: id, amount },
      });
    }
  }
  const ok = deleteFeedback(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, action });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;
  const { id } = await params;
  const ok = deleteFeedback(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
