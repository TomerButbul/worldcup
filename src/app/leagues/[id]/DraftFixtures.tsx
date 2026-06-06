import FixturesList, { type FixtureDay as FixtureDayLite } from "@/components/FixturesList";
import Reveal from "@/components/Reveal";

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

export default function DraftFixtures({
  leagueId,
  days,
}: {
  leagueId: string;
  days: FixtureDay[];
}) {
  if (!days.length) return null;
  // Map the draft-resolved rows onto the shared FixturesList shape — the gold
  // manager names ride along as the optional extra lines under each nation.
  const liteDays: FixtureDayLite[] = days.map((d) => ({
    day: d.day,
    matches: d.matches.map((m) => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeName: m.homeName,
      awayName: m.awayName,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      status: m.status,
      kickoff: m.kickoff,
      homeExtra: m.homeMgr,
      awayExtra: m.awayMgr,
    })),
  }));

  // Renders in full as its own tab (the bottom nav gates visibility), so it's a
  // plain section rather than a collapsible — every fixture is shown at once.
  return (
    <Reveal>
    <section className="glass rounded-3xl p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="font-display text-xl text-chalk">Fixtures</h2>
        <p className="mt-0.5 text-xs text-chalk-dim">
          Every game is manager vs manager — the gold name is who drafted that nation. Tap for the
          match card.
        </p>
      </header>
      <FixturesList leagueId={leagueId} days={liteDays} />
    </section>
    </Reveal>
  );
}
