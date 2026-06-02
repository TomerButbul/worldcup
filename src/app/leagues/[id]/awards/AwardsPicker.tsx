"use client";

import { useState, useTransition } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { saveAwards } from "./actions";

export interface AwardPlayer {
  id: number;
  name: string;
  team: string;
  position: string | null;
  age: number | null;
}

const AWARDS = [
  { key: "golden_boot", emoji: "🥇", label: "Golden Boot", hint: "Top scorer", gkOnly: false },
  { key: "golden_ball", emoji: "⚽", label: "Golden Ball", hint: "Best player", gkOnly: false },
  { key: "golden_glove", emoji: "🧤", label: "Golden Glove", hint: "Best goalkeeper", gkOnly: true },
  { key: "young_player", emoji: "🌟", label: "Young Player", hint: "Best young player", gkOnly: false },
] as const;

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
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const byId = new Map(players.map((p) => [p.id, p]));

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveAwards(leagueId, picks);
      setMsg(res.ok ? "Saved! 🎉" : res.error ?? "Error");
    });
  }

  const meta = (p: AwardPlayer) =>
    [p.team, p.age ? `${p.age}y` : null, p.position].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      {AWARDS.map((a) => {
        const sel = picks[a.key] ? byId.get(picks[a.key]) : null;
        const q = (query[a.key] ?? "").trim().toLowerCase();
        const pool = a.gkOnly
          ? players.filter((p) => (p.position ?? "").toLowerCase().includes("goalkeeper"))
          : players;
        const results = q.length >= 2 ? pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12) : [];

        return (
          <div key={a.key} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-chalk">
                <span className="mr-1.5">{a.emoji}</span>
                {a.label}
              </p>
              <span className="text-xs text-chalk-dim">{a.hint}</span>
            </div>

            {sel ? (
              <div className="mt-2 flex items-center gap-2">
                <PlayerAvatar playerId={sel.id} name={sel.name} size={28} />
                <span className="text-sm font-semibold text-chalk">{sel.name}</span>
                <span className="truncate text-xs text-chalk-dim">{meta(sel)}</span>
                {!locked && (
                  <button
                    onClick={() => setPicks((p) => { const o = { ...p }; delete o[a.key]; return o; })}
                    className="ml-auto shrink-0 text-xs text-chalk-dim underline hover:text-chalk"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : locked ? (
              <p className="mt-2 text-sm text-chalk-dim">No pick.</p>
            ) : (
              <div className="mt-2">
                <input
                  value={query[a.key] ?? ""}
                  onChange={(e) => setQuery((s) => ({ ...s, [a.key]: e.target.value }))}
                  placeholder={a.gkOnly ? "Search goalkeepers…" : "Search players…"}
                  className="w-full rounded-xl border border-night/10 bg-white px-3 py-2 text-sm text-chalk outline-none focus:border-grass focus:ring-2 focus:ring-grass/30"
                />
                {results.length > 0 && (
                  <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                    {results.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPicks((s) => ({ ...s, [a.key]: p.id }));
                          setQuery((s) => ({ ...s, [a.key]: "" }));
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-night/5"
                      >
                        <PlayerAvatar playerId={p.id} name={p.name} size={24} />
                        <span className="text-sm font-medium text-chalk">{p.name}</span>
                        <span className="truncate text-xs text-chalk-dim">{meta(p)}</span>
                      </button>
                    ))}
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
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-xl bg-grass px-4 py-2 text-sm font-semibold text-night glow-grass transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save awards"}
          </button>
          {msg && <span className="text-xs text-chalk-dim">{msg}</span>}
        </div>
      )}
    </div>
  );
}
