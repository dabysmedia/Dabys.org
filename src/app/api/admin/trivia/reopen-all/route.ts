import { NextResponse } from "next/server";
import { removeAllTriviaAttempts } from "@/lib/data";

export async function POST() {
  const removed = removeAllTriviaAttempts();
  return NextResponse.json({ success: true, removed });
}
