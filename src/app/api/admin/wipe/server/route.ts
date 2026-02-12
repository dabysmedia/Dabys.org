import { NextResponse } from "next/server";
import { wipeServer, getWipeConfirmWord } from "@/lib/data";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { confirm } = body;

  if (!confirm || typeof confirm !== "string") {
    return NextResponse.json(
      { error: `Type ${getWipeConfirmWord()} to confirm` },
      { status: 400 }
    );
  }

  const result = wipeServer(confirm);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
