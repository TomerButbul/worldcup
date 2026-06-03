import FixturesList, { type FixtureDay as FixtureDayLite } from "@/components/FixturesList";

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
    <section className="glass rounded-2xl p-4">
      <h2 className="font-display text-chalk">Fixtures &amp; managers</h2>
      <p className="mb-2 mt-1 text-[11px] text-chalk-dim">
        Every game is a manager-vs-manager matchup — the gold name under each nation is who drafted
        it. Tap any fixture for the match card.
      </p>
      <FixturesList leagueId={leagueId} days={liteDays} />
    </section>
  );
}
