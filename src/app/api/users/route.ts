import { NextResponse } from "next/server";
import { getUsers, saveUsers } from "@/lib/data";

export async function GET() {
  return NextResponse.json(getUsers());
}

export async function POST(request: Request) {
  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const users = getUsers();
  const trimmed = name.trim();

  if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }

  const newId = String(
    Math.max(0, ...users.map((u) => parseInt(u.id, 10))) + 1
  );
  const newUser = { id: newId, name: trimmed };
  users.push(newUser);
  saveUsers(users);

  return NextResponse.json(newUser, { status: 201 });
}
