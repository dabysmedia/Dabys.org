import { NextResponse } from "next/server";
import { addFeedback } from "@/lib/data";

export async function POST(request: Request) {
  let body: { message?: string; userId?: string; userName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "";
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const userName = typeof body.userName === "string" ? body.userName : undefined;

  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const entry = addFeedback({ message: message.trim(), userId, userName });
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save feedback" },
      { status: 400 }
    );
  }
}
