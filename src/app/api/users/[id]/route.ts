import { NextResponse } from "next/server";
import { getUsers, saveUsers } from "@/lib/data";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const users = getUsers();
  const filtered = users.filter((u) => u.id !== id);

  if (filtered.length === users.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  saveUsers(filtered);
  return NextResponse.json({ success: true });
}
