import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCustomCardTypes, addCustomCardType, removeCustomCardType } from "@/lib/data";

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get("dabys_admin");
  if (session?.value !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth) return auth;

  const types = getCustomCardTypes();
  return NextResponse.json(types);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const id = (body.id as string)?.trim();
  const label = (body.label as string)?.trim();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const added = addCustomCardType(id, label ?? id);
  if (!added) {
    return NextResponse.json(
      { error: "Invalid id (use lowercase letters, numbers, hyphens) or id already exists" },
      { status: 400 }
    );
  }

  return NextResponse.json(added, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const removed = removeCustomCardType(id);
  if (!removed) {
    return NextResponse.json({ error: "Custom card type not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
