import { NextResponse } from "next/server";
import { getActivity, getActivitySince } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const entries = since ? getActivitySince(since) : getActivity().slice(-20);

  return NextResponse.json({ entries });
}
