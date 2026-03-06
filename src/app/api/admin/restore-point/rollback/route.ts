import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "src", "data");
const RESTORE_DIR = path.join(DATA_DIR, ".restore-point");

/** Movie night files — never restored (kept as-is). */
const MOVIE_NIGHT_FILES = new Set([
  "weeks.json",
  "submissions.json",
  "votes.json",
  "winners.json",
  "movieNightAttendance.json",
  "hivemindVideos.json",
  "hivemindVideoVotes.json",
]);

function getAllJsonFilesInRestore(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      files.push(...getAllJsonFilesInRestore(full, baseDir));
    } else if (e.name.endsWith(".json")) {
      const filename = path.basename(rel);
      if (MOVIE_NIGHT_FILES.has(filename)) continue;
      files.push(rel);
    }
  }
  return files;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** POST: Rollback to last restore point. Restores all backed-up files except movie night. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await req.json().catch(() => ({}));
  const confirm = typeof body.confirm === "string" ? body.confirm : "";

  if (confirm.trim().toUpperCase() !== "ROLLBACK") {
    return NextResponse.json(
      { error: "Type ROLLBACK to confirm" },
      { status: 400 }
    );
  }

  try {
    if (!fs.existsSync(RESTORE_DIR)) {
      return NextResponse.json(
        { error: "No restore point exists. Create one first." },
        { status: 400 }
      );
    }

    const files = getAllJsonFilesInRestore(RESTORE_DIR, RESTORE_DIR);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Restore point is empty or invalid" },
        { status: 400 }
      );
    }

    for (const rel of files) {
      const src = path.join(RESTORE_DIR, rel);
      const dest = path.join(DATA_DIR, rel);
      if (!fs.existsSync(src)) continue;
      const destDir = path.dirname(dest);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
    }

    return NextResponse.json({
      success: true,
      message: `Rolled back to last restore point (${files.length} files). Movie night data was not changed.`,
      filesCount: files.length,
    });
  } catch (err) {
    console.error("Restore point rollback error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to rollback" },
      { status: 500 }
    );
  }
}
