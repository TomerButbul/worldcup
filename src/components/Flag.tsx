"use client";

import { useState } from "react";

// National-team flag from API-Football's media CDN (by team id), or a stored logo_url.
export default function Flag({
  teamId,
  logoUrl,
  name,
  code,
  size = 22,
  className = "",
}: {
  teamId?: number | null;
  logoUrl?: string | null;
  name?: string;
  code?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src =
    logoUrl ||
    (teamId ? `https://media.api-sports.io/football/teams/${teamId}.png` : null);

  if (!src || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-black/30 text-[9px] font-bold text-chalk-dim ${className}`}
        style={{ width: size, height: size }}
        title={name}
      >
        {code ?? "⚽"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? "flag"}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`inline-block rounded-sm object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
