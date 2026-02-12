import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getDabysBetsEvent,
  updateDabysBetsEvent,
  deleteDabysBetsEvent,
} from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await params;
  const event = getDabysBetsEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = getDabysBetsEvent(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const updates: Partial<{
    title: string;
    sideA: string;
    sideB: string;
    oddsA: number;
    oddsB: number;
    minBet: number;
    maxBet: number;
    isActive: boolean;
  }> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.sideA === "string") updates.sideA = body.sideA.trim();
  if (typeof body.sideB === "string") updates.sideB = body.sideB.trim();
  if (typeof body.oddsA === "number") updates.oddsA = body.oddsA;
  if (typeof body.oddsB === "number") updates.oddsB = body.oddsB;
  if (typeof body.minBet === "number") updates.minBet = Math.max(1, Math.floor(body.minBet));
  if (typeof body.maxBet === "number") {
    const minB = updates.minBet ?? existing.minBet;
    updates.maxBet = Math.max(minB, Math.floor(body.maxBet));
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;

  const event = updateDabysBetsEvent(id, updates);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json(event);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await params;
  const deleted = deleteDabysBetsEvent(id);
  if (!deleted) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
