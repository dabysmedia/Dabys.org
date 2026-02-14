import { NextResponse } from "next/server";
import { getUsers } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId;
  const pin = typeof body.pin === "string" ? body.pin : "";

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userPin = user.pin;
  const hasPin = !!userPin;

  if (!hasPin) {
    return NextResponse.json({ success: true });
  }

  if (userPin !== pin) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
