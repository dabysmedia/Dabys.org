import { NextResponse } from "next/server";
import { getActiveShopItems } from "@/lib/data";

/** GET: return active shop items for the Others tab (no auth required). */
export async function GET() {
  const items = getActiveShopItems();
  return NextResponse.json({ items });
}
