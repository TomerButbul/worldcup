"use client";

import { motion } from "motion/react";
import { PlayerCardButton } from "@/components/PlayerCard";
import Ball from "@/components/art/Ball";
import { rowLabels } from "@/lib/positions";

export type LineupPlayer = {
  player_id: number;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
};
export type LineupRow = {
  team_id: number;
  formation: string | null;
  xi: LineupPlayer[];
  subs: LineupPlayer[];
};
export type EventRow = {
  team_id: number | null;
  type: string; // goal | card | subst
  detail: string | null;
  player_id: number | null;
  player_name: string | null;
  related_id: number | null; // assist giver, or player coming OFF
  related_name: string | null;
  minute: number | null;
};

type Stat = { goals: number; assists: number; yellow: number; red: number };

function aggregateStats(events: EventRow[]): Map<number, Stat> {
  const m = new Map<number, Stat>();
  const bump = (id: number | null, k: keyof Stat) => {
    if (id == null) return;
    const s = m.get(id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
    s[k] += 1;
    m.set(id, s);
  };
  for (const e of events) {
    if (e.type === "goal") {
      bump(e.player_id, "goals");
      bump(e.related_id, "assists");
    } else if (e.type === "card") {
      const d = (e.detail ?? "").toLowerCase();
      bump(e.player_id, d.includes("red") || d.includes("second yellow") ? "red" : "yellow");
    }
  }
  return m;
}

// Apply substitution events to a starting XI → the 11 currently on the pitch
// (the incoming player inherits the outgoing player's grid spot), plus the set
// of players who have left the pitch.
function currentXI(lineup: LineupRow, events: EventRow[]) {
  const onPitch: LineupPlayer[] = lineup.xi.map((p) => ({ ...p }));
  const cameOn = new Set<number>();
  const wentOff: LineupPlayer[] = [];
  const subPool = new Map(lineup.subs.map((s) => [s.player_id, s]));

  const subs = events
    .filter((e) => e.type === "subst" && e.team_id === lineup.team_id)
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  for (const ev of subs) {
    const offId = ev.related_id; // player coming OFF
    const onId = ev.player_id; // player coming ON
    const idx = onPitch.findIndex((p) => p.player_id === offId);
    if (idx === -1 || onId == null) continue;
    const off = onPitch[idx];
    wentOff.push(off);
    const incoming = subPool.get(onId) ?? {
      player_id: onId,
      name: ev.player_name ?? "?",
      number: null,
      pos: off.pos,
      grid: off.grid,
    };
    onPitch[idx] = { ...incoming, grid: off.grid }; // inherit the spot
    cameOn.add(onId);
  }
  const benchRemaining = lineup.subs.filter((s) => !cameOn.has(s.player_id));
  return { onPitch, wentOff, benchRemaining };
}

// Position a team's XI purely from grid "row:col" — works for any formation.
function positioned(xi: LineupPlayer[], half: "top" | "bottom") {
  const parsed = xi.map((p) => {
    const [r, c] = (p.grid ?? "1:1").split(":").map((n) => parseInt(n, 10) || 1);
    return { p, r, c };
  });
  const maxRow = Math.max(1, ...parsed.map((x) => x.r));
  const byRow = new Map<number, typeof parsed>();
  for (const x of parsed) {
    if (!byRow.has(x.r)) byRow.set(x.r, []);
    byRow.get(x.r)!.push(x);
  }
  const out: { p: LineupPlayer; x: number; y: number; label: string }[] = [];
  const invert = half === "top"; // the top team faces down → mirror left/right labels
  for (const [r, players] of byRow) {
    const sorted = [...players].sort((a, b) => a.c - b.c);
    const frac = maxRow > 1 ? (r - 1) / (maxRow - 1) : 0; // 0 = keeper, 1 = forwards
    const line = sorted.map((x) => x.p.pos).find(Boolean) ?? "M";
    const labels = rowLabels(line, sorted.length, frac);
    if (invert) labels.reverse();
    sorted.forEach((x, i) => {
      out.push({
        p: x.p,
        x: ((i + 0.5) / sorted.length) * 100,
        y: half === "bottom" ? 94 - frac * 42 : 6 + frac * 42,
        label: labels[i] ?? "",
      });
    });
  }
  return out;
}

function Badges({ s }: { s: Stat | undefined }) {
  if (!s) return null;
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 flex flex-col items-end gap-0.5">
      {s.goals > 0 && (
        <span className="rounded-full bg-white px-1 text-[9px] leading-tight shadow">
          {Array.from({ length: Math.min(s.goals, 3) }).map((_, i) => <Ball key={i} size={11} />)}
        </span>
      )}
      {s.assists > 0 && <span className="text-[9px] leading-none">🅰️</span>}
      {s.red > 0 ? <span className="text-[9px] leading-none">🟥</span> : s.yellow > 0 && <span className="text-[9px] leading-none">🟨</span>}
    </span>
  );
}

function PlayerChip({
  p,
  stat,
  tone,
  label,
  photo,
  ovr,
}: {
  p: LineupPlayer;
  stat: Map<number, Stat>;
  tone: "home" | "away";
  label?: string;
  photo?: string | null;
  ovr?: number | null;
}) {
  const first = p.name.split(" ").slice(-1)[0] ?? p.name;
  const ring = tone === "home" ? "ring-grass" : "ring-white";
  return (
    <motion.div layout layoutId={`pl-${p.player_id}`} className="flex w-12 flex-col items-center gap-0.5 sm:w-[3.75rem]">
      <PlayerCardButton
        playerId={p.player_id}
        name={p.name}
        detailPos={label}
        className="flex w-full flex-col items-center gap-0.5"
      >
        {/* Circular face shot with a jersey-number badge — falls back to a number
            disc when we have no photo. */}
        <span className={`relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-night/25 shadow ring-2 ${ring} sm:h-11 sm:w-11`}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/image not worth it for a tiny avatar
            <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span
              className={`grid h-full w-full place-items-center text-[11px] font-bold tabular-nums ${
                tone === "home" ? "bg-grass text-night" : "bg-white text-night"
              }`}
            >
              {p.number ?? "•"}
            </span>
          )}
          {photo && p.number != null && (
            <span className="absolute -bottom-1 -right-1 grid h-[15px] w-[15px] place-items-center rounded-full bg-night text-[8px] font-bold leading-none tabular-nums text-white ring-1 ring-white/50">
              {p.number}
            </span>
          )}
          <Badges s={stat.get(p.player_id)} />
        </span>
        <span className="max-w-[3.5rem] truncate text-[9px] leading-tight text-chalk sm:max-w-[3.75rem]">{first}</span>
        {(label || ovr != null) && (
          <span className="flex items-center gap-0.5 rounded bg-night/55 px-1 text-[7px] font-bold uppercase leading-none">
            {label && <span className="text-white/90">{label}</span>}
            {label && ovr != null && <span className="text-white/40">·</span>}
            {ovr != null && <span className="text-gold">{ovr}</span>}
          </span>
        )}
      </PlayerCardButton>
    </motion.div>
  );
}

export default function Pitch({
  home,
  away,
  homeName,
  awayName,
  events,
  photoById = {},
  ovrById = {},
}: {
  home: LineupRow | null;
  away: LineupRow | null;
  homeName: string;
  awayName: string;
  events: EventRow[];
  photoById?: Record<number, string | null>;
  ovrById?: Record<number, number | null>;
}) {
  const stat = aggregateStats(events);
  if (!home && !away) return null;

  const h = home ? currentXI(home, events) : null;
  const a = away ? currentXI(away, events) : null;
  const hPos = h ? positioned(h.onPitch, "bottom") : [];
  const aPos = a ? positioned(a.onPitch, "top") : [];

  const benchOf = (side: typeof h) =>
    side ? [...side.wentOff.map((p) => ({ p, off: true })), ...side.benchRemaining.map((p) => ({ p, off: false }))] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-chalk-dim">
        <span className="font-semibold text-chalk">{awayName} {away?.formation ? `· ${away.formation}` : ""}</span>
      </div>

      {/* Vertical pitch */}
      <div className="relative mx-auto aspect-[3/5] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-grass/70 to-grass/55">
        {/* markings */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/30" />
        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
        <div className="absolute left-1/2 top-0 h-12 w-28 -translate-x-1/2 border-x border-b border-white/25" />
        <div className="absolute bottom-0 left-1/2 h-12 w-28 -translate-x-1/2 border-x border-t border-white/25" />

        {aPos.map(({ p, x, y, label }) => (
          <div key={p.player_id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <PlayerChip p={p} stat={stat} tone="away" label={label} photo={photoById[p.player_id]} ovr={ovrById[p.player_id]} />
          </div>
        ))}
        {hPos.map(({ p, x, y, label }) => (
          <div key={p.player_id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <PlayerChip p={p} stat={stat} tone="home" label={label} photo={photoById[p.player_id]} ovr={ovrById[p.player_id]} />
          </div>
        ))}
      </div>
      <p className="text-center text-xs font-semibold text-chalk">
        {homeName} {home?.formation ? `· ${home.formation}` : ""}
      </p>

      {/* Benches */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: homeName, bench: benchOf(h), tone: "home" as const },
          { name: awayName, bench: benchOf(a), tone: "away" as const },
        ].map((side) =>
          side.bench.length ? (
            <div key={side.name} className="glass rounded-xl p-2">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-chalk-dim">Bench · {side.name}</p>
              <ul className="space-y-0.5">
                {side.bench.map(({ p, off }) => {
                  const s = stat.get(p.player_id);
                  return (
                    <li key={p.player_id} className={`flex items-center gap-1 text-[11px] ${off ? "text-chalk-dim line-through" : "text-chalk"}`}>
                      <span className="w-4 shrink-0 text-right tabular-nums text-chalk-dim">{p.number ?? ""}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {!off && <span className="text-[9px] text-grass">↑</span>}
                      {s?.goals ? <span>{Array.from({ length: Math.min(s.goals, 3) }).map((_, i) => <Ball key={i} size={11} />)}</span> : null}
                      {s?.red ? <span>🟥</span> : s?.yellow ? <span>🟨</span> : null}
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
