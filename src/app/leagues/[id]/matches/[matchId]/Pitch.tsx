"use client";

import { MatchPitch } from "@/components/lineup/FormationPitch";
import type { FormationPlayer, MatchEvent } from "@/lib/formation";

// Thin adapter over the shared <MatchPitch>. Kept so its importers — the match
// page and MatchCard's lazy-loaded preview — don't change, and so the public
// LineupRow / EventRow / LineupPlayer types live in one place.
export type LineupPlayer = FormationPlayer;
export type LineupRow = { team_id: number; formation: string | null; xi: LineupPlayer[]; subs: LineupPlayer[] };
export type EventRow = MatchEvent;

export default function Pitch({
  home,
  away,
  homeName,
  awayName,
  events,
  // photoById / ovrById are no longer used — photos resolve by id via PlayerAvatar,
  // and OVR now lives on the player card (tap a chip). Both are still accepted (and
  // ignored) so existing callers don't have to change.
  photoById: _photoById,
  ovrById: _ovrById,
}: {
  home: LineupRow | null;
  away: LineupRow | null;
  homeName: string;
  awayName: string;
  events: EventRow[];
  photoById?: Record<number, string | null>;
  ovrById?: Record<number, number | null>;
}) {
  return (
    <MatchPitch home={home} away={away} homeName={homeName} awayName={awayName} events={events} />
  );
}
