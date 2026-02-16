"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FriendsSidebar } from "./FriendsSidebar";
import { QuestLogSidebar } from "./QuestLogSidebar";

interface User {
  id: string;
  name: string;
}

export function AppWithFriends({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("dabys_user");
      if (cached) setUser(JSON.parse(cached));
    } catch {
      setUser(null);
    }
  }, []);

  const isAdmin = pathname?.startsWith("/admin");

  return (
    <>
      {children}
      {user && !isAdmin && (
        <>
          <QuestLogSidebar currentUserId={user.id} />
          <FriendsSidebar currentUserId={user.id} />
        </>
      )}
    </>
  );
}
