"use client";

import { useState } from "react";
import Ball from "@/components/art/Ball";

// National-team flag from API-Football's media CDN (by team id), or a stored logo_url.
export default function Flag({
  teamId,
  logoUrl,
  name,
  code,
  size = 22,
  w,
  h,
  fit = "contain",
  className = "",
}: {
  teamId?: number | null;
  logoUrl?: string | null;
  name?: string;
  code?: string | null;
  size?: number;
  /** Explicit width/height for a non-square (e.g. 3:2 flag) render. */
  w?: number;
  h?: number;
  /** `cover` fills the box (good when w/h match the flag's ~3:2 ratio). */
  fit?: "contain" | "cover";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const width = w ?? size;
  const height = h ?? size;
  const src =
    logoUrl ||
    (teamId ? `https://media.api-sports.io/football/teams/${teamId}.png` : null);

  // Size-only flags render as a uniform circular crest: object-cover fills the
  // circle so a 3:2 country flag and a square federation badge end up the SAME
  // on-screen size (contain used to letterbox the wide ones, making them look
  // smaller). Callers that pass explicit w/h (the team-card hero) keep a
  // rectangular render with their own framing.
  const circular = w == null && h == null;

  if (!src || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${circular ? "rounded-full" : "rounded-sm"} bg-night/10 text-[8px] font-bold text-chalk-dim ${className}`}
        style={{ width, height }}
        title={name}
      >
        {code ?? <Ball size={Math.max(10, Math.round(Math.min(width, height) * 0.6))} />}
      </span>
    );
  }

  if (circular) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
        style={{ width, height }}
        title={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? "flag"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? "flag"}
      width={width}
      height={height}
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 rounded-sm ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`}
      style={{ width, height }}
    />
  );
}
