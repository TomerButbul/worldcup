"use client";

import { useState } from "react";
import Ball from "@/components/art/Ball";

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
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-grass/40 to-gold/40 font-display text-night ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials || <Ball size={Math.round(size * 0.55)} />}
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
      className={`inline-block shrink-0 rounded-full object-cover ring-2 ring-night/10 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
