"use client";

import { useSyncExternalStore } from "react";
import {
  setMuted,
  playPop,
  subscribeMuted,
  getMutedSnapshot,
  getMutedServerSnapshot,
} from "@/lib/sound";

export default function SoundToggle() {
  const muted = useSyncExternalStore(
    subscribeMuted,
    getMutedSnapshot,
    getMutedServerSnapshot,
  );

  function toggle() {
    const next = !muted;
    setMuted(next);
    if (!next) playPop();
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Sounds off" : "Sounds on"}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full glass-strong text-lg shadow-lg transition hover:scale-110"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
