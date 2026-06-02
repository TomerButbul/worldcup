"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import type { Team } from "@/lib/types";
import Flag from "@/components/Flag";
import { saveFavoriteTeam } from "@/app/dashboard/actions";
import { playPop } from "@/lib/sound";

export default function FavoriteTeamPicker({
  teams,
  current,
}: {
  teams: Team[];
  current: number | null;
}) {
  const [selected, setSelected] = useState<number | null>(current);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const currentTeam = teams.find((t) => t.id === selected) ?? null;

  function choose(id: number | null) {
    setSelected(id);
    setOpen(false);
    playPop();
    startTransition(async () => {
      await saveFavoriteTeam(id);
    });
  }

  if (teams.length === 0) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-chalk-dim">
        ⭐ Favorite team picker unlocks once teams are synced.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm text-chalk-dim">My team:</span>
          {currentTeam ? (
            <span className="flex min-w-0 items-center gap-2 font-semibold text-chalk">
              <Flag teamId={currentTeam.id} logoUrl={currentTeam.logo_url} code={currentTeam.code} name={currentTeam.name} size={22} />
              <span className="truncate">{currentTeam.name}</span>
            </span>
          ) : (
            <span className="text-chalk-dim">none yet ⭐</span>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={pending}
          className="shrink-0 rounded-lg border border-night/10 px-3 py-2 text-xs text-chalk transition hover:bg-night/5"
        >
          {open ? "Close" : currentTeam ? "Change" : "Pick team"}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 max-h-64 overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left text-sm transition ${
                  selected === t.id
                    ? "border-grass bg-grass/15 text-chalk"
                    : "border-night/10 text-chalk hover:bg-night/5"
                }`}
              >
                <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
          {selected != null && (
            <button
              onClick={() => choose(null)}
              className="mt-2 text-xs text-chalk-dim hover:text-chalk"
            >
              Clear favorite
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
