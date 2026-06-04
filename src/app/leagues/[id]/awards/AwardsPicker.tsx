"use client";

import { useState, useCallback } from "react";
import type { ComponentType } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { saveAwards } from "./actions";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/SaveStatus";
import { Boot, Medal, Glove, Star } from "@/components/icons";

export interface AwardPlayer {
  id: number;
  name: string;
  team: string;
  position: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  number: number | null;
  nationality: string | null;
}

type IconComponent = ComponentType<{ size?: number; className?: string }>;

const AWARDS: {
  key: string;
  Icon: IconComponent;
  label: string;
  hint: string;
  gkOnly: boolean;
}[] = [
  { key: "golden_boot", Icon: Boot, label: "Golden Boot", hint: "Top scorer", gkOnly: false },
  { key: "golden_ball", Icon: Medal, label: "Golden Ball", hint: "Best player", gkOnly: false },
  { key: "golden_glove", Icon: Glove, label: "Golden Glove", hint: "Best goalkeeper", gkOnly: true },
  { key: "young_player", Icon: Star, label: "Young Player", hint: "Best young player", gkOnly: false },
];

// Accent/diacritic-insensitive fold so "Mbappe" finds "Mbappé", "Muller" → "Müller".
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Position shorthand so it never gets cut off.
function posShort(pos: string | null): string {
  if (!pos) return "";
  const p = pos.toLowerCase();
  if (p.startsWith("goal")) return "GK";
  if (p.startsWith("def")) return "DF";
  if (p.startsWith("mid")) return "MF";
  if (p.startsWith("att") || p.startsWith("for")) return "FW";
  return pos.slice(0, 3).toUpperCase();
}

function statsOf(p: AwardPlayer): [string, string][] {
  const out: [string, string][] = [];
  if (p.position) out.push(["Position", p.position]);
  if (p.number != null) out.push(["Number", `#${p.number}`]);
  if (p.age != null) out.push(["Age", `${p.age}`]);
  if (p.height != null) out.push(["Height", `${p.height} cm`]);
  if (p.weight != null) out.push(["Weight", `${p.weight} kg`]);
  if (p.nationality) out.push(["Nationality", p.nationality]);
  return out;
}

function PlayerDetails({ p }: { p: AwardPlayer }) {
  return (
    <div className="border-t border-night/5 px-2 py-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {statsOf(p).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-chalk-dim">{k}</dt>
            <dd className="truncate text-chalk">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2">
          <dt className="text-chalk-dim">Tournament rating</dt>
          <dd className="text-chalk-dim">— (in-tournament)</dd>
        </div>
      </dl>
    </div>
  );
}

export default function AwardsPicker({
  leagueId,
  players,
  initial,
  locked,
}: {
  leagueId: string;
  players: AwardPlayer[];
  initial: Record<string, number>;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<Record<string, number>>(() => ({ ...initial }));
  const [query, setQuery] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const byId = new Map(players.map((p) => [p.id, p]));

  const saveFn = useCallback(() => saveAwards(leagueId, picks), [leagueId, picks]);
  // Auto-save award picks ~0.8s after a change — no Save button.
  const { state: saveState, error: saveErr } = useAutosave(JSON.stringify(picks), saveFn, {
    enabled: !locked,
  });

  // Inline = country · position (shorthand). Name shows above it.
  const sub = (p: AwardPlayer) => [p.team, posShort(p.position)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      {AWARDS.map((a) => {
        const sel = picks[a.key] ? byId.get(picks[a.key]) ?? null : null;
        const q = fold((query[a.key] ?? "").trim());
        const pool = a.gkOnly
          ? players.filter((p) => (p.position ?? "").toLowerCase().includes("goal"))
          : players;
        const results = q.length >= 2 ? pool.filter((p) => fold(p.name).includes(q)).slice(0, 15) : [];
        const selKey = `${a.key}-sel`;

        return (
          <div key={a.key} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 font-display text-chalk">
                <a.Icon size={16} />
                {a.label}
              </p>
              <span className="text-xs text-chalk-dim">{a.hint}</span>
            </div>

            {sel ? (
              <div className="mt-2 rounded-lg border border-night/5">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <PlayerAvatar playerId={sel.id} name={sel.name} size={28} />
                  <button
                    onClick={() => setExpanded(expanded === selKey ? null : selKey)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold text-chalk">{sel.name}</span>
                    <span className="block truncate text-[11px] text-chalk-dim">{sub(sel)}</span>
                  </button>
                  {!locked && (
                    <button
                      onClick={() => setPicks((p) => { const o = { ...p }; delete o[a.key]; return o; })}
                      className="shrink-0 text-xs text-chalk-dim underline hover:text-chalk"
                    >
                      Change
                    </button>
                  )}
                </div>
                {expanded === selKey && <PlayerDetails p={sel} />}
              </div>
            ) : locked ? (
              <p className="mt-2 text-sm text-chalk-dim">No pick.</p>
            ) : (
              <div className="mt-2">
                <input
                  value={query[a.key] ?? ""}
                  onChange={(e) => setQuery((s) => ({ ...s, [a.key]: e.target.value }))}
                  placeholder={a.gkOnly ? "Search goalkeepers…" : "Search players…"}
                  aria-label={`Search ${a.label} candidates`}
                  className="w-full rounded-xl border border-night/10 bg-white px-3 py-2 text-sm text-chalk outline-none focus:border-grass focus:ring-2 focus:ring-grass/30"
                />
                {results.length > 0 && (
                  <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                    {results.map((p) => {
                      const k = `${a.key}-${p.id}`;
                      const isExp = expanded === k;
                      return (
                        <div key={p.id} className="rounded-lg border border-night/5">
                          <button
                            onClick={() => setExpanded(isExp ? null : k)}
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition hover:bg-night/5"
                          >
                            <PlayerAvatar playerId={p.id} name={p.name} size={24} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-chalk">{p.name}</span>
                              <span className="block truncate text-[11px] text-chalk-dim">{sub(p)}</span>
                            </span>
                            <span className={`shrink-0 text-xs text-chalk-dim transition ${isExp ? "rotate-90" : ""}`}>›</span>
                          </button>
                          {isExp && (
                            <>
                              <PlayerDetails p={p} />
                              <div className="px-2 pb-2">
                                <button
                                  onClick={() => {
                                    setPicks((s) => ({ ...s, [a.key]: p.id }));
                                    setQuery((s) => ({ ...s, [a.key]: "" }));
                                    setExpanded(null);
                                  }}
                                  className="w-full rounded-lg bg-grass px-3 py-1.5 text-xs font-semibold text-night transition hover:brightness-110"
                                >
                                  ✓ Pick for {a.label}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {q.length >= 2 && results.length === 0 && (
                  <p className="mt-1 text-xs text-chalk-dim">
                    No {a.gkOnly ? "goalkeepers" : "players"} match.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!locked && (
        <div className="flex items-center justify-end">
          <SaveStatus state={saveState} error={saveErr} />
        </div>
      )}
    </div>
  );
}
