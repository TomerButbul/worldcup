"use client";

import { useState } from "react";
import Ball from "@/components/art/Ball";
import { useMyTeams } from "@/components/MyTeams";

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
  highlight,
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
  /** Pass false to suppress the "your drafted team" ring even if it's one of yours. */
  highlight?: boolean;
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

  // Subtly ring a crest that's one of the viewer's drafted teams, so "your teams"
  // stand out wherever they appear. Empty set for non-draft users → no ring.
  const myTeams = useMyTeams();
  const ring =
    teamId != null && highlight !== false && myTeams.has(teamId)
      ? { outline: "2px solid var(--color-gold)", outlineOffset: "1.5px" }
      : undefined;

  if (!src || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${circular ? "rounded-full" : "rounded-sm"} bg-night/10 text-[8px] font-bold text-chalk-dim ${className}`}
        style={{ width, height, ...ring }}
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
        style={{ width, height, ...ring }}
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
      style={{ width, height, ...ring }}
    />
  );
}
