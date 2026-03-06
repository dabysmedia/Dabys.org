import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "src", "data");
const RESTORE_DIR = path.join(DATA_DIR, ".restore-point");

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET: Check if a restore point exists and when it was created. */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    if (!fs.existsSync(RESTORE_DIR)) {
      return NextResponse.json({ hasRestorePoint: false });
    }

    const stat = fs.statSync(RESTORE_DIR);
    return NextResponse.json({
      hasRestorePoint: true,
      createdAt: stat.mtime.toISOString(),
    });
  } catch {
    return NextResponse.json({ hasRestorePoint: false });
  }
}
