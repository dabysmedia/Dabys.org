"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

const MOBILE_BREAKPOINT_PX = 768;
const POLL_INTERVAL_MS = 8000;

function convKey(a: string, b: string) {
  return [a, b].sort().join("_");
}

function getLastRead(userId: string, otherId: string): number {
  try {
    const raw = localStorage.getItem(`dabys_dm_lastRead_${convKey(userId, otherId)}`);
    if (!raw) return 0;
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

function setLastRead(userId: string, otherId: string, ts: number) {
  try {
    localStorage.setItem(`dabys_dm_lastRead_${convKey(userId, otherId)}`, String(ts));
  } catch {
    // ignore
  }
}

interface User {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  message: string;
  createdAt: string;
}

interface Conversation {
  otherUser: { id: string; name: string; avatarUrl?: string };
  lastMessage: DirectMessage;
}

export function MessagesPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedOther, setSelectedOther] = useState<{ id: string; name: string; avatarUrl?: string } | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isNarrow, setIsNarrow] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsNarrow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("dabys_user") : null;
      if (raw) {
        const u = JSON.parse(raw) as User;
        if (u?.id && u?.name) setUser(u);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/users/${user.id}/profile`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.profile?.avatarUrl) setUserAvatarUrl(d.profile.avatarUrl); });
  }, [user?.id]);

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dms?userId=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.conversations ?? [];
      setConversations(list);
      // Update unread count: last message was sent TO me and I haven't read it
      let count = 0;
      for (const c of list) {
        if (c.lastMessage.recipientId === user.id) {
          const lastRead = getLastRead(user.id, c.otherUser.id);
          const lastTime = new Date(c.lastMessage.createdAt).getTime();
          if (lastTime > lastRead) count++;
        }
      }
      setUnreadCount(count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async () => {
    if (!user?.id || !selectedOther?.id) return;
    try {
      const res = await fetch(`/api/dms?userId=${user.id}&otherUserId=${selectedOther.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }, [user?.id, selectedOther?.id]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?includeProfile=1");
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users ?? [];
      setUsers(list.map((u: { id: string; name: string; avatarUrl?: string }) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl })));
      // Update current user avatar when loading users
      if (user?.id) {
        const current = list.find((u: { id: string }) => u.id === user.id);
        if (current?.avatarUrl) setUserAvatarUrl(current.avatarUrl);
      }
    } catch {
      setUsers([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open && user) {
      loadConversations();
      if (showNewChat && users.length === 0) loadUsers();
    }
  }, [open, user, showNewChat, loadConversations, loadUsers, users.length]);

  // Poll for new messages when logged in (live-updating badge)
  useEffect(() => {
    if (!user?.id) return;
    loadConversations();
    const id = setInterval(loadConversations, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user?.id, loadConversations]);

  useEffect(() => {
    if (open && selectedOther) loadMessages();
  }, [open, selectedOther, loadMessages]);

  // Mark conversation as read when viewing it
  useEffect(() => {
    if (!user?.id || !selectedOther?.id || messages.length === 0) return;
    const latest = Math.max(...messages.map((m) => new Date(m.createdAt).getTime()));
    const prevRead = getLastRead(user.id, selectedOther.id);
    setLastRead(user.id, selectedOther.id, latest);
    // Decrement badge if this conversation was unread (last msg was sent to me)
    if (latest > prevRead) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.recipientId === user.id) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    }
  }, [user?.id, selectedOther?.id, messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newMessage.trim() || sending) return;
    if (!selectedOther) return;
    setSending(true);
    try {
      const res = await fetch("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          senderName: user.name,
          recipientId: selectedOther.id,
          recipientName: selectedOther.name,
          message: newMessage.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to send");
        return;
      }
      const sent = await res.json();
      setMessages((prev) => [...prev, sent]);
      setNewMessage("");
      loadConversations();
    } catch {
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleSendNew(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newMessage.trim() || !recipientId || sending) return;
    const recipient = users.find((u) => u.id === recipientId);
    if (!recipient) return;
    setSending(true);
    try {
      const res = await fetch("/api/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: user.id,
          senderName: user.name,
          recipientId: recipient.id,
          recipientName: recipient.name,
          message: newMessage.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to send");
        return;
      }
      const sent = await res.json();
      setShowNewChat(false);
      setSelectedOther({ id: recipient.id, name: recipient.name, avatarUrl: recipient.avatarUrl });
      setMessages([sent]);
      setNewMessage("");
      setRecipientId("");
      loadConversations();
    } catch {
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (pathname?.startsWith("/admin")) return null;
  if (isNarrow) return null;
  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden max-h-[420px]">
          <div className="flex items-center justify-between p-3 border-b border-white/[0.08] shrink-0">
            <span className="text-sm font-medium text-white/80">Messages</span>
            <div className="flex items-center gap-1">
              {!selectedOther && !showNewChat && (
                <button
                  type="button"
                  onClick={() => { setShowNewChat(true); setRecipientId(""); loadUsers(); }}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                  title="New message"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {(selectedOther || showNewChat) && (
                <button
                  type="button"
                  onClick={() => { setSelectedOther(null); setShowNewChat(false); setMessages([]); setNewMessage(""); setRecipientId(""); }}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
                  title="Back"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {showNewChat ? (
              <div className="p-3 flex flex-col gap-3">
                <label className="text-xs text-white/50 uppercase tracking-wider">Send to</label>
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:border-purple-500/40"
                >
                  <option value="">Select player…</option>
                  {users
                    .filter((u) => u.id !== user.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-purple-500/40"
                  disabled={sending}
                />
                <button
                  onClick={handleSendNew}
                  disabled={sending || !recipientId || !newMessage.trim()}
                  className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/90 text-sm font-medium hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {sending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            ) : selectedOther ? (
              <>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[180px]">
                  {messages.length === 0 && loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex gap-2 max-w-[90%] ${
                          m.senderId === user.id ? "self-end flex-row-reverse" : "self-start"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-medium shrink-0 overflow-hidden border border-white/10 mt-0.5">
                          {m.senderId === user.id ? (
                            userAvatarUrl ? (
                              <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.name.charAt(0).toUpperCase()
                            )
                          ) : selectedOther ? (
                            selectedOther.avatarUrl ? (
                              <img src={selectedOther.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              selectedOther.name.charAt(0).toUpperCase()
                            )
                          ) : (
                            m.senderName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className={`flex flex-col ${m.senderId === user.id ? "items-end" : "items-start"}`}>
                          {m.senderId !== user.id && (
                            <span className="text-[10px] text-white/40 mb-0.5">{m.senderName}</span>
                          )}
                          <div
                            className={`rounded-xl px-3 py-2 text-sm ${
                            m.senderId === user.id
                              ? "bg-purple-500/25 text-white/90"
                              : "bg-white/[0.08] text-white/80"
                          }`}
                          >
                            {m.message}
                          </div>
                          <span className="text-[10px] text-white/30 mt-0.5">{timeAgo(m.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSend} className="p-3 border-t border-white/[0.08] shrink-0 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message…"
                    className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none focus:border-purple-500/40"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-3 py-2 rounded-lg bg-purple-500/30 text-purple-200 text-sm font-medium hover:bg-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {sending ? (
                      <span className="w-5 h-5 block border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Send"
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="p-3 flex flex-col gap-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-white/50 py-4 text-center">No conversations yet. Start a new message.</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.otherUser.id}
                      type="button"
                      onClick={() => setSelectedOther(c.otherUser)}
                      className="flex items-center gap-3 p-3 rounded-lg text-left hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 font-medium shrink-0 overflow-hidden border border-white/10">
                        {c.otherUser.avatarUrl ? (
                          <img src={c.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          c.otherUser.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{c.otherUser.name}</p>
                        <p className="text-xs text-white/50 truncate">
                          {c.lastMessage.senderId === user.id ? "You: " : ""}
                          {c.lastMessage.message}
                        </p>
                      </div>
                      <span className="text-[10px] text-white/40 shrink-0">{timeAgo(c.lastMessage.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.2)] px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer flex items-center gap-2 relative"
        aria-label={open ? "Close messages" : "Open messages"}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Messages
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500/90 text-[10px] font-bold text-white ring-1 ring-white/20 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
            aria-label={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
