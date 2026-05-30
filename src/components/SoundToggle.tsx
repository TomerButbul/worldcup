"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, playPop } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playPop();
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Sounds off" : "Sounds on"}
      className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full glass-strong text-lg shadow-lg transition hover:scale-110"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
