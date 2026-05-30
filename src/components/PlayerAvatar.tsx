"use client";

import { useState } from "react";

// Player photo from API-Football's media CDN (by player id), with initials fallback.
export default function PlayerAvatar({
  playerId,
  name,
  size = 20,
  className = "",
}: {
  playerId: number;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-grass/30 text-[8px] font-bold text-chalk ${className}`}
        style={{ width: size, height: size }}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://media.api-sports.io/football/players/${playerId}.png`}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`inline-block rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
