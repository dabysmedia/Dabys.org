import { NextResponse } from "next/server";
import { getPacks } from "@/lib/data";

export async function GET() {
  const packs = getPacks().filter((p) => p.isActive);
  return NextResponse.json({ packs });
}

