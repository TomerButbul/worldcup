"use client";

import { useState } from "react";

export default function Avatar({
  url,
  name,
  size = 36,
  className = "",
}: {
  url?: string | null;
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

  if (!url || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-grass/40 to-gold/40 font-display text-night ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials || "⚽"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`inline-block rounded-full object-cover ring-2 ring-white/15 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
