"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Periodically re-fetches the server components on the current route (fresh DB
// data) without a full reload or losing client state. Used on match and
// leaderboard pages so scores tick on screen while the sync job runs. Pauses
// while the tab is hidden to avoid pointless background work.
export default function AutoRefresh({ seconds = 60, enabled = true }: { seconds?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, Math.max(15, seconds) * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds, enabled]);

  return null;
}
