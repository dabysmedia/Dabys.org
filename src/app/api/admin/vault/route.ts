import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getVaultVideos, saveVaultVideos } from "@/lib/data";
import type { VaultVideo } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function extractYoutubeId(input: string): string | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : (trimmed.length === 11 ? trimmed : null);
}

/** GET: list all vault videos. */
export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;
  const videos = getVaultVideos();
  return NextResponse.json(videos);
}

/** POST: add a new vault video. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const title = (body.title as string | undefined)?.trim() || "";
  const description = (body.description as string | undefined)?.trim() || "";
  const youtubeInput = (body.youtubeId as string | undefined)?.trim() || (body.youtubeUrl as string | undefined)?.trim() || "";
  const order = typeof body.order === "number" ? body.order : parseInt(String(body.order ?? 0), 10) || 0;
  const featured = !!body.featured;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const youtubeId = extractYoutubeId(youtubeInput);
  if (!youtubeId) {
    return NextResponse.json({ error: "Valid YouTube video ID or URL is required" }, { status: 400 });
  }

  const videos = getVaultVideos();
  const newId = `v${Date.now()}`;
  const thumbnailUrl = body.thumbnailUrl?.trim() || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

  const newVideo: VaultVideo = {
    id: newId,
    title,
    description,
    youtubeId,
    thumbnailUrl,
    order,
    featured,
  };

  videos.push(newVideo);
  saveVaultVideos(videos);

  return NextResponse.json(newVideo);
}

/** PATCH: update an existing vault video. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const id = (body.id as string)?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const videos = getVaultVideos();
  const idx = videos.findIndex((v) => v.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const current = videos[idx];

  if (body.title !== undefined) {
    const t = (body.title as string)?.trim();
    if (t) current.title = t;
  }
  if (body.description !== undefined) {
    current.description = (body.description as string)?.trim() || "";
  }
  if (body.youtubeId !== undefined || body.youtubeUrl !== undefined) {
    const input = (body.youtubeId as string)?.trim() || (body.youtubeUrl as string)?.trim() || "";
    const youtubeId = extractYoutubeId(input);
    if (youtubeId) {
      current.youtubeId = youtubeId;
      if (!current.thumbnailUrl?.includes(youtubeId)) {
        current.thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
      }
    }
  }
  if (body.thumbnailUrl !== undefined) {
    const t = (body.thumbnailUrl as string)?.trim();
    if (t) current.thumbnailUrl = t;
  }
  if (typeof body.order === "number") {
    current.order = body.order;
  } else if (body.order !== undefined) {
    const o = parseInt(String(body.order), 10);
    if (Number.isFinite(o)) current.order = o;
  }
  if (typeof body.featured === "boolean") {
    current.featured = body.featured;
  }

  saveVaultVideos(videos);
  return NextResponse.json(current);
}

/** DELETE: remove a vault video. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const videos = getVaultVideos();
  const filtered = videos.filter((v) => v.id !== id);
  if (filtered.length === videos.length) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  saveVaultVideos(filtered);
  return NextResponse.json({ success: true });
}
