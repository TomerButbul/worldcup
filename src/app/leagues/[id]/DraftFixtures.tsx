import Flag from "@/components/Flag";

// One fixture, fully resolved on the server (no Maps cross the client boundary):
// both teams + the manager who drafted each (null if undrafted / TBD knockout).
export type FixtureRow = {
  id: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeMgr: string | null;
  awayMgr: string | null;
  kickoff: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
};
export type FixtureDay = { day: string; matches: FixtureRow[] };

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function MatchRow({ m }: { m: FixtureRow }) {
  const played = (m.status === "finished" || m.status === "live") && m.homeGoals != null;
  return (
    <div className="flex items-center gap-2 border-b border-night/5 py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col items-end">
        <span className="flex max-w-full items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-chalk">{m.homeName}</span>
          <Flag teamId={m.homeTeamId} name={m.homeName} size={18} className="shrink-0" />
        </span>
        <span className="max-w-full truncate text-[11px] font-semibold text-gold">
          {m.homeMgr ?? " "}
        </span>
      </div>

      <div className="shrink-0 px-1 text-center">
        {played ? (
          <span className="net rounded-md bg-night/5 px-2 py-0.5 font-display text-sm text-chalk">
            {m.homeGoals}–{m.awayGoals}
          </span>
        ) : (
          <span className="text-[11px] text-chalk-dim">{timeLabel(m.kickoff)}</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="flex max-w-full items-center gap-1.5">
          <Flag teamId={m.awayTeamId} name={m.awayName} size={18} className="shrink-0" />
          <span className="truncate text-sm font-semibold text-chalk">{m.awayName}</span>
        </span>
        <span className="max-w-full truncate text-[11px] font-semibold text-gold">
          {m.awayMgr ?? " "}
        </span>
      </div>
    </div>
  );
}

export default function DraftFixtures({ days }: { days: FixtureDay[] }) {
  if (!days.length) return null;
  return (
    <details className="group glass rounded-2xl p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="font-display text-chalk">Fixtures &amp; managers</span>
        <span className="transition text-chalk-dim group-open:rotate-180">▾</span>
      </summary>
      <p className="mb-2 mt-3 text-[11px] text-chalk-dim">
        Every game is a manager-vs-manager matchup — the gold name under each nation is who drafted
        it.
      </p>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {days.map((d) => (
          <div key={d.day}>
            <p className="sticky top-0 z-10 bg-white/85 py-1 text-xs font-semibold uppercase tracking-wider text-chalk-dim backdrop-blur-sm">
              {d.day}
            </p>
            <div>
              {d.matches.map((m) => (
                <MatchRow key={m.id} m={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
