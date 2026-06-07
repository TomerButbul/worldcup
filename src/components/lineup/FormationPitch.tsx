"use client";

import {
  positionXI,
  applySubs,
  aggregatePlayerStats,
  deriveFormation,
  type FormationPlayer,
  type TeamLineup,
  type MatchEvent,
} from "@/lib/formation";
import Ball from "@/components/art/Ball";
import PlayerChip from "./PlayerChip";
import { CardMark } from "./badges";

// The two-team match-centre pitch: both XIs on one vertical pitch, each confined to
// its OWN half (no halfway-line collision), with live goal/card badges, "came on"
// sub markers, and a bench strip. Built on the shared PlayerChip + the unit-tested
// geometry in lib/formation, so the team-profile and predict pitches stay identical.
export function MatchPitch({
  home,
  away,
  homeName,
  awayName,
  events,
}: {
  home: TeamLineup | null;
  away: TeamLineup | null;
  homeName: string;
  awayName: string;
  events: MatchEvent[];
}) {
  if (!home && !away) return null;
  const stat = aggregatePlayerStats(events);

  const h = home ? applySubs(home, events) : null;
  const a = away ? applySubs(away, events) : null;
  const homePos = h ? positionXI(h.onPitch, "home") : [];
  const awayPos = a ? positionXI(a.onPitch, "away") : [];

  // A player on the pitch who was named as a substitute came on mid-match.
  const homeSubIds = new Set((home?.subs ?? []).map((s) => s.player_id));
  const awaySubIds = new Set((away?.subs ?? []).map((s) => s.player_id));

  const benchOf = (side: typeof h) =>
    side
      ? [...side.wentOff.map((p) => ({ p, off: true })), ...side.benchRemaining.map((p) => ({ p, off: false }))]
      : [];

  return (
    <div className="space-y-3">
      {/* Away team (top of the pitch) — centred header */}
      <p className="text-center text-xs font-semibold text-chalk">
        {awayName}
        {away?.formation ? ` · ${away.formation}` : ""}
      </p>

      <div className="relative mx-auto aspect-[1/2] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-grass/70 to-grass/55">
        {/* markings */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/30" />
        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
        <div className="absolute left-1/2 top-0 h-12 w-28 -translate-x-1/2 border-x border-b border-white/25" />
        <div className="absolute bottom-0 left-1/2 h-12 w-28 -translate-x-1/2 border-x border-t border-white/25" />

        {awayPos.map(({ player, x, y, label }) => (
          <div
            key={player.player_id}
            className="absolute w-14 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlayerChip
              playerId={player.player_id}
              name={player.name}
              label={label}
              tone="away"
              size={28}
              stat={stat.get(player.player_id)}
              subOn={awaySubIds.has(player.player_id)}
            />
          </div>
        ))}
        {homePos.map(({ player, x, y, label }) => (
          <div
            key={player.player_id}
            className="absolute w-14 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlayerChip
              playerId={player.player_id}
              name={player.name}
              label={label}
              tone="home"
              size={28}
              stat={stat.get(player.player_id)}
              subOn={homeSubIds.has(player.player_id)}
            />
          </div>
        ))}
      </div>

      {/* Home team (bottom of the pitch) — centred header */}
      <p className="text-center text-xs font-semibold text-chalk">
        {homeName}
        {home?.formation ? ` · ${home.formation}` : ""}
      </p>

      {/* Benches: who went off (struck through, ▼) + the unused subs. */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: homeName, bench: benchOf(h) },
          { name: awayName, bench: benchOf(a) },
        ].map((side) =>
          side.bench.length ? (
            <div key={side.name} className="glass rounded-xl p-2">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-chalk-dim">Bench · {side.name}</p>
              <ul className="space-y-0.5">
                {side.bench.map(({ p, off }) => {
                  const s = stat.get(p.player_id);
                  return (
                    <li
                      key={p.player_id}
                      className={`flex items-center gap-1 text-[11px] ${off ? "text-chalk-dim line-through" : "text-chalk"}`}
                    >
                      <span className="w-4 shrink-0 text-right tabular-nums text-chalk-dim">{p.number ?? ""}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {off && <span className="text-[9px] leading-none text-red-500">▼</span>}
                      {s?.goals ? (
                        <span className="flex">
                          {Array.from({ length: Math.min(s.goals, 3) }).map((_, i) => (
                            <Ball key={i} size={11} />
                          ))}
                        </span>
                      ) : null}
                      {s?.red ? <CardMark color="red" /> : s?.yellow ? <CardMark color="yellow" /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

// A single team on a half-pitch — used by the team profile (static) and the predict
// scorer picker (pass `interaction` to make each chip tap-to-add-a-goal). Shares the
// exact PlayerChip + geometry as the two-team match pitch.
export function TeamPitch({
  lineup,
  teamName,
  interaction,
  emptyHint,
}: {
  lineup: { formation?: string | null; xi: FormationPlayer[] } | null;
  teamName?: string;
  // Predict picker: return the per-player goal state, or undefined for a static pitch.
  interaction?: (playerId: number) => { count: number; atCap: boolean; onAdd: () => void } | undefined;
  emptyHint?: string;
}) {
  if (!lineup || !lineup.xi?.length) {
    return (
      <p className="rounded-xl bg-night/5 p-3 text-center text-xs text-chalk-dim">
        {emptyHint ?? `No recent lineup${teamName ? ` for ${teamName}` : ""} yet — it'll fill in from their next match.`}
      </p>
    );
  }
  const pos = positionXI(lineup.xi, "single");
  const formation = lineup.formation || deriveFormation(lineup.xi);

  return (
    <div className="space-y-2">
      <p className="text-center text-[11px] uppercase tracking-wider text-chalk-dim">
        {teamName ?? "Most recent XI"}
        {formation ? ` · ${formation}` : ""}
      </p>
      <div className="relative mx-auto aspect-[5/6] w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-grass/70 to-grass/55">
        {/* half-pitch markings: this team's goal at the bottom, halfway arc at the top */}
        <div className="absolute bottom-0 left-1/2 h-12 w-28 -translate-x-1/2 border-x border-t border-white/25" />
        <div className="absolute bottom-0 left-1/2 h-5 w-14 -translate-x-1/2 border-x border-t border-white/25" />
        <div className="absolute -top-9 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-white/25" />
        {pos.map(({ player, x, y, label }) => (
          <div
            key={player.player_id}
            className="absolute w-14 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlayerChip
              playerId={player.player_id}
              name={player.name}
              label={label}
              interactive={interaction?.(player.player_id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
