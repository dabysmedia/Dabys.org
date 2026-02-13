"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AlchemyRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cards?alchemy=1");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
    </div>
  );
}
