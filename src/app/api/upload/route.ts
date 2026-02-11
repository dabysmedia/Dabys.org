import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Store uploads on the same DATA_DIR-backed volume as JSON data,
// so they persist on Railway. Falls back to src/data when DATA_DIR
// is not set (local dev).
const DEFAULT_DATA_DIR = path.join(process.cwd(), "src", "data");
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export async function POST(request: Request) {
  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only images and GIFs are allowed" },
      { status: 400 }
    );
  }

  // Limit to 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filepath, buffer);

  const mediaType = file.type === "image/gif" ? "gif" : "image";

  // Files are served via /api/uploads/[filename], which reads from
  // the same UPLOAD_DIR backed by DATA_DIR on Railway.
  return NextResponse.json({
    url: `/api/uploads/${filename}`,
    mediaType,
  });
}
