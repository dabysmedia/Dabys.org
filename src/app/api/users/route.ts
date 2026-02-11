import { NextResponse } from "next/server";
import { getUsers, saveUsers, getProfiles } from "@/lib/data";

export async function GET(request: Request) {
  const users = getUsers();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("includeProfile") === "1") {
    const profiles = getProfiles();
    const withAvatar = users.map((u) => ({
      id: u.id,
      name: u.name,
      avatarUrl: profiles.find((p) => p.userId === u.id)?.avatarUrl || "",
    }));
    return NextResponse.json(withAvatar);
  }
  return NextResponse.json(users);
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
