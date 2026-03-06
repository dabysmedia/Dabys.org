import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "src", "data");
const RESTORE_DIR = path.join(DATA_DIR, ".restore-point");

/** Movie night files — excluded from restore point and rollback. */
const MOVIE_NIGHT_FILES = new Set([
  "weeks.json",
  "submissions.json",
  "votes.json",
  "winners.json",
  "movieNightAttendance.json",
  "hivemindVideos.json",
  "hivemindVideoVotes.json",
]);

function getAllJsonFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      if (e.name === "uploads" || e.name === ".restore-point") continue;
      files.push(...getAllJsonFiles(full, baseDir));
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

/** POST: Create a restore point (all /data except movie night stuff). */
export async function POST() {
  const auth = await requireAdmin();
  if (auth) return auth;

  try {
    const files = getAllJsonFiles(DATA_DIR, DATA_DIR);
    if (files.length === 0) {
      return NextResponse.json({ error: "No JSON files to backup" }, { status: 400 });
    }

    fs.mkdirSync(RESTORE_DIR, { recursive: true });

    for (const rel of files) {
      const src = path.join(DATA_DIR, rel);
      const dest = path.join(RESTORE_DIR, rel);
      if (!fs.existsSync(src)) continue;
      const destDir = path.dirname(dest);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
    }

    return NextResponse.json({
      success: true,
      message: `Restore point created (${files.length} files). Movie night data (weeks, submissions, votes, winners, attendance, hivemind) was excluded.`,
      filesCount: files.length,
    });
  } catch (err) {
    console.error("Restore point create error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create restore point" },
      { status: 500 }
    );
  }
}
