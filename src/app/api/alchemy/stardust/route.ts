import { NextResponse } from "next/server";
import { getStardust } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const balance = getStardust(userId);
  return NextResponse.json({ balance });
}
