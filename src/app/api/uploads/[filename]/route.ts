import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Mirror the upload directory logic used in /api/upload so that
// files are read from the DATA_DIR-backed volume on Railway.
const DEFAULT_DATA_DIR = path.join(process.cwd(), "src", "data");
const DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Prevent path traversal by stripping any directory components.
  const safeName = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = safeName.split(".").pop()?.toLowerCase() || "jpg";
  let contentType = "application/octet-stream";
  if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
  else if (ext === "png") contentType = "image/png";
  else if (ext === "gif") contentType = "image/gif";
  else if (ext === "webp") contentType = "image/webp";

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

