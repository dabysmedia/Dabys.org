import { NextResponse } from "next/server";
import { getPrismsRaw } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const entries = getPrismsRaw();
  const entry = entries.find((e) => e.userId === userId);
  const balance = entry?.balance ?? 0;
  return NextResponse.json({ balance });
}
