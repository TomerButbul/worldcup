import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import { nowMs } from "@/lib/clock";
import Flag from "@/components/Flag";
import ShareButton from "./ShareButton";

// The signed-in user's OWN predictions recap for one league. Unlike the manager
// profile page (which hides OTHER people's picks until the bracket locks), this
// is the viewer's own bracket — always safe to show, lock or no lock.

export default async function MyPredictionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  // RLS only returns this row if the viewer is a member → membership gate.
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, bracket_lock_at")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");

  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  // ----- our own predictions (no lock gate — these are ours to see) -----------
  const [{ data: prediction }, { data: matchPreds }, { data: groupMatches }] =
    await Promise.all([
      supabase
        .from("bracket_predictions")
        .select("group_scores, knockout, champion_team_id, awards")
        .eq("league_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("match_predictions")
        .select("match_id, home_goals, away_goals, scorer_goals, pen_winner_team_id")
        .eq("league_id", id)
        .eq("user_id", user.id),
      supabase
        .from("matches")
        .select("id, group_label, home_team_id, away_team_id, stage")
        .order("kickoff_at"),
    ]);

  const teams = await getCachedTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamName = (tid: number | null | undefined) =>
    tid != null ? (teamById.get(tid)?.name ?? "—") : "—";

  // ----- Champion -------------------------------------------------------------
  const championId = prediction?.champion_team_id ?? null;
  const champTeam = championId != null ? teamById.get(championId) : null;

  // ----- Awards ---------------------------------------------------------------
  const awards = (prediction?.awards ?? {}) as Record<string, number | null>;
  const awardEntries: { key: string; label: string; id: number | null }[] = [
    { key: "golden_boot", label: "🥇 Golden Boot", id: awards.golden_boot ?? null },
    { key: "golden_ball", label: "🎖️ Golden Ball", id: awards.golden_ball ?? null },
    { key: "golden_glove", label: "🧤 Golden Glove", id: awards.golden_glove ?? null },
    { key: "young_player", label: "⭐ Young Player", id: awards.young_player ?? null },
  ];
  const awardIds = awardEntries.map((a) => a.id).filter((v): v is number => v != null);

  // ----- group scorelines -----------------------------------------------------
  const groupScores = (prediction?.group_scores ?? {}) as Record<
    string,
    { h: number; a: number }
  >;

  type DBMatch = {
    id: number;
    group_label: string | null;
    home_team_id: number | null;
    away_team_id: number | null;
    stage: string | null;
  };
  const allMatches = (groupMatches ?? []) as DBMatch[];

  // Group-stage matches bucketed by label (A..L).
  const byGroup = new Map<string, DBMatch[]>();
  for (const m of allMatches) {
    if (m.stage !== "group") continue;
    const g = m.group_label ?? "—";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }
  const groupBuckets = [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, matches]) => ({ group, matches }));

  // ----- knockout match picks (only rows the user actually filled in) ---------
  type MatchPred = {
    match_id: number;
    home_goals: number | null;
    away_goals: number | null;
    scorer_goals: Record<string, number> | null;
    pen_winner_team_id: number | null;
  };
  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  const knockoutPicks = ((matchPreds ?? []) as MatchPred[]).filter((p) => {
    const sg = p.scorer_goals ?? {};
    return (
      p.home_goals != null ||
      p.pen_winner_team_id != null ||
      Object.keys(sg).length > 0
    );
  });

  // ----- player-name lookup: award ids + every predicted scorer ---------------
  const scorerIds = new Set<number>();
  for (const p of knockoutPicks) {
    for (const pid of Object.keys(p.scorer_goals ?? {})) {
      const n = Number(pid);
      if (Number.isFinite(n)) scorerIds.add(n);
    }
  }
  const playerIds = [...new Set<number>([...awardIds, ...scorerIds])];
  let playerNames = new Map<number, string>();
  if (playerIds.length) {
    const { data: people } = await supabase
      .from("players")
      .select("id, name")
      .in("id", playerIds);
    playerNames = new Map((people ?? []).map((p) => [p.id, p.name]));
  }
  // "Messi ×2, Suárez" — predicted scorers with their goal counts.
  const scorerLabels = (sg: Record<string, number> | null) =>
    Object.entries(sg ?? {})
      .map(([pid, n]) => {
        const name = playerNames.get(Number(pid));
        return name ? `${name}${n > 1 ? ` ×${n}` : ""}` : null;
      })
      .filter((s): s is string => !!s);

  // ----- completeness ---------------------------------------------------------
  const filled = Object.values(groupScores).filter(
    (s) => s && s.h != null && s.a != null,
  ).length;
  const awardsFilled = awardIds.length;
  const hasChampion = championId != null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
        &larr; {league.name}
      </Link>

      {/* Header card */}
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-gradient-gold">Your predictions</h1>
          <ShareButton />
        </div>
        <div className="mt-2">
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-night/10 px-2.5 py-1 text-xs font-semibold text-chalk-dim">
              🔒 Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-grass/15 px-2.5 py-1 text-xs font-semibold text-grass">
              🟢 Open
            </span>
          )}
        </div>
      </div>

      {/* Completeness */}
      <section className="glass rounded-2xl p-5">
        <p className="text-sm text-chalk-dim">
          <span className="font-semibold text-chalk">Group scorelines</span>{" "}
          <span className="font-display tabular-nums text-chalk">{filled}/72</span>
          {" · "}
          <span className="font-semibold text-chalk">Awards</span>{" "}
          <span className="font-display tabular-nums text-chalk">{awardsFilled}/4</span>
          {" · "}
          <span className="font-semibold text-chalk">Champion</span>{" "}
          <span className="font-display text-chalk">{hasChampion ? "✓" : "—"}</span>
        </p>
      </section>

      {/* Champion */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-2 font-display text-lg text-chalk">🏆 Champion</h2>
        {champTeam ? (
          <p className="flex items-center gap-2 text-chalk">
            <Flag
              teamId={champTeam.id}
              logoUrl={champTeam.logo_url}
              code={champTeam.code}
              name={champTeam.name}
              size={22}
            />
            <span className="font-semibold">{champTeam.name}</span>
          </p>
        ) : (
          <p className="text-sm text-chalk-dim">—</p>
        )}
      </section>

      {/* Awards */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-display text-lg text-chalk">🏅 Awards</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {awardEntries.map((a) => (
            <div
              key={a.key}
              className="flex items-center justify-between gap-2 rounded-xl bg-night/5 px-3 py-2"
            >
              <span className="text-xs text-chalk-dim">{a.label}</span>
              <span className="min-w-0 truncate text-right text-sm font-semibold text-chalk">
                {a.id != null ? (playerNames.get(a.id) ?? "—") : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Group predictions */}
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-3 font-display text-lg text-chalk">⚽ Group predictions</h2>
        {groupBuckets.length === 0 ? (
          <p className="text-sm text-chalk-dim">—</p>
        ) : (
          <div className="space-y-2">
            {groupBuckets.map((bucket) => (
              <details key={bucket.group} className="group rounded-xl bg-night/5 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-chalk">
                  Group {bucket.group}
                  <span className="text-chalk-dim transition group-open:rotate-180">▾</span>
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {bucket.matches.map((m) => {
                    const s = groupScores[String(m.id)];
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 text-xs text-chalk-dim"
                      >
                        <span className="min-w-0 flex-1 truncate text-right">
                          {teamName(m.home_team_id)}
                        </span>
                        <span className="shrink-0 font-display tabular-nums text-chalk">
                          {s ? `${s.h}–${s.a}` : "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {teamName(m.away_team_id)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Knockout match picks — usually empty pre-tournament (fixtures TBD). */}
      {knockoutPicks.length > 0 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-display text-lg text-chalk">⚔️ Knockout match picks</h2>
          <ul className="space-y-2">
            {knockoutPicks.map((p) => {
              const m = matchById.get(p.match_id);
              const scorers = scorerLabels(p.scorer_goals);
              const penTeam =
                p.pen_winner_team_id != null ? teamName(p.pen_winner_team_id) : null;
              return (
                <li
                  key={p.match_id}
                  className="rounded-xl bg-night/5 px-3 py-2 text-xs text-chalk-dim"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-right">
                      {teamName(m?.home_team_id)}
                    </span>
                    <span className="shrink-0 font-display tabular-nums text-chalk">
                      {p.home_goals != null ? `${p.home_goals}–${p.away_goals}` : "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {teamName(m?.away_team_id)}
                    </span>
                  </div>
                  {penTeam && (
                    <p className="mt-1 text-[11px] text-chalk-dim">🥅 Shootout: {penTeam}</p>
                  )}
                  {scorers.length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-chalk-dim">
                      ⚽ {scorers.join(", ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
