"use client";

import { useEffect, useState } from "react";
import { FriendsSidebar } from "./FriendsSidebar";

interface User {
  id: string;
  name: string;
}

export function AppWithFriends({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("dabys_user");
      if (cached) setUser(JSON.parse(cached));
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <>
      {children}
      {user && <FriendsSidebar currentUserId={user.id} />}
    </>
  );
}
