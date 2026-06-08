import Link from "next/link";
import Flag from "@/components/Flag";
import LocalTime from "@/components/LocalTime";

// A single fixture, fully resolved on the server (no Maps cross the client
// boundary). `homeExtra` / `awayExtra` are optional small lines under each team
// — the draft view uses them for the gold manager names.
export type FixtureRowLite = {
  id: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  kickoff: string;
  homeExtra?: string | null;
  awayExtra?: string | null;
};
export type FixtureDay = { day: string; matches: FixtureRowLite[] };

function FixtureRow({ leagueId, m }: { leagueId: string; m: FixtureRowLite }) {
  const live = m.status === "live";
  // Played (or in-play) once a real scoreline exists — show "h–a".
  const played = (m.status === "finished" || live) && m.homeGoals != null;

  return (
    <Link
      href={`/leagues/${leagueId}/matches/${m.id}`}
      className="group flex items-center gap-2 border-b border-night/5 py-2 transition last:border-b-0 hover:bg-night/[0.03]"
    >
      {/* Home — name + flag, right-aligned toward the score */}
      <div className="flex min-w-0 flex-1 flex-col items-end">
        <span className="flex max-w-full items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-chalk">{m.homeName}</span>
          <Flag teamId={m.homeTeamId} name={m.homeName} size={18} className="shrink-0" />
        </span>
        {m.homeExtra != null && (
          <span className="max-w-full truncate text-[11px] font-semibold text-gold">
            {m.homeExtra}
          </span>
        )}
      </div>

      {/* Score · kickoff · LIVE */}
      <div className="flex shrink-0 flex-col items-center px-1 text-center">
        {played ? (
          <span className="net rounded-md bg-night/5 px-2 py-0.5 font-display text-sm text-chalk">
            {m.homeGoals}–{m.awayGoals}
          </span>
        ) : (
          <LocalTime iso={m.kickoff} options={{ hour: "2-digit", minute: "2-digit" }} className="text-[11px] text-chalk-dim" />
        )}
        {live && (
          <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-600">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
        )}
      </div>

      {/* Away — flag + name, left-aligned away from the score */}
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="flex max-w-full items-center gap-1.5">
          <Flag teamId={m.awayTeamId} name={m.awayName} size={18} className="shrink-0" />
          <span className="truncate text-sm font-semibold text-chalk">{m.awayName}</span>
        </span>
        {m.awayExtra != null && (
          <span className="max-w-full truncate text-[11px] font-semibold text-gold">
            {m.awayExtra}
          </span>
        )}
      </div>

      {/* Tappable affordance — a chevron that nudges on hover */}
      <span
        aria-hidden
        className="shrink-0 text-chalk-dim/60 transition group-hover:translate-x-0.5 group-hover:text-gold"
      >
        ›
      </span>
    </Link>
  );
}

// Day-grouped, tappable fixtures. Every row links to that match's detail card.
// Server component (no client state) — shared by draft + regular leagues.
export default function FixturesList({
  leagueId,
  days,
}: {
  leagueId: string;
  days: FixtureDay[];
}) {
  if (!days.length) return null;
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
      {days.map((d) => (
        <div key={d.day}>
          <p className="sticky top-0 z-10 bg-white/85 py-1 text-xs font-semibold uppercase tracking-wider text-chalk-dim backdrop-blur-sm">
            <LocalTime iso={d.matches[0].kickoff} mode="weekday-long" />
          </p>
          <div>
            {d.matches.map((m) => (
              <FixtureRow key={m.id} leagueId={leagueId} m={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
