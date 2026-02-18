import { NextResponse } from "next/server";
import {
  getDirectMessages,
  getConversation,
  addDirectMessage,
  getUsers,
  getProfiles,
} from "@/lib/data";

/** GET: list conversations for current user, or messages in a specific conversation when otherUserId provided */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const otherUserId = searchParams.get("otherUserId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (otherUserId) {
    const messages = getConversation(userId, otherUserId);
    return NextResponse.json({ messages });
  }

  // List conversations: unique other users, with last message
  const all = getDirectMessages(userId);
  const profiles = getProfiles();
  const byOther = new Map<
    string,
    { otherUser: { id: string; name: string; avatarUrl?: string }; lastMessage: (typeof all)[0] }
  >();

  for (const m of all) {
    const otherId = m.senderId === userId ? m.recipientId : m.senderId;
    const otherName = m.senderId === userId ? m.recipientName : m.senderName;
    const existing = byOther.get(otherId);
    const lastTime = new Date(m.createdAt).getTime();
    if (!existing || lastTime > new Date(existing.lastMessage.createdAt).getTime()) {
      const avatarUrl = profiles.find((p) => p.userId === otherId)?.avatarUrl ?? "";
      byOther.set(otherId, {
        otherUser: { id: otherId, name: otherName, avatarUrl: avatarUrl || undefined },
        lastMessage: m,
      });
    }
  }

  const conversations = Array.from(byOther.values())
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    )
    .map((c) => ({
      otherUser: c.otherUser,
      lastMessage: c.lastMessage,
      unreadCount: 0, // optional: could add read receipts later
    }));

  return NextResponse.json({ conversations });
}

/** POST: send a direct message */
export async function POST(request: Request) {
  let body: {
    senderId?: string;
    senderName?: string;
    recipientId?: string;
    recipientName?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const senderId = typeof body.senderId === "string" ? body.senderId : "";
  const senderName = typeof body.senderName === "string" ? body.senderName : "";
  const recipientId = typeof body.recipientId === "string" ? body.recipientId : "";
  const recipientName = typeof body.recipientName === "string" ? body.recipientName : "";
  const message = typeof body.message === "string" ? body.message : "";

  if (!senderId || !recipientId || !message.trim()) {
    return NextResponse.json(
      { error: "senderId, recipientId, and message are required" },
      { status: 400 }
    );
  }

  const users = getUsers();
  const sender = users.find((u) => u.id === senderId);
  const recipient = users.find((u) => u.id === recipientId);
  if (!sender || !recipient) {
    return NextResponse.json({ error: "Sender or recipient not found" }, { status: 404 });
  }

  try {
    const entry = addDirectMessage({
      senderId,
      senderName: senderName || sender.name,
      recipientId,
      recipientName: recipientName || recipient.name,
      message: message.trim(),
    });
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send message" },
      { status: 400 }
    );
  }
}
