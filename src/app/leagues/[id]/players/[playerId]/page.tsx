import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import { nowMs } from "@/lib/clock";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";

// A "Manager" = a human participant in this league (NOT a football player).
// Their predictions stay hidden until the bracket locks, so peeking can't
// influence anyone's own picks — fair play before kickoff.

function StatChip({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-night/5 px-3 py-2">
      <span className="text-base">{icon}</span>
      <span className="font-display text-lg tabular-nums text-chalk">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-chalk-dim">{label}</span>
    </div>
  );
}

export default async function ManagerProfilePage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const { id, playerId } = await params;

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, team_name, avatar_url, favorite_team_id")
    .eq("id", playerId)
    .maybeSingle();
  if (!profile) redirect(`/leagues/${id}`);

  const { data: score } = await supabase
    .from("scores")
    .select("upfront_points, live_points, total_points")
    .eq("league_id", id)
    .eq("user_id", playerId)
    .maybeSingle();

  // SECURITY: only read predictions once the bracket is locked. Before that we
  // never even query them, so they can't leak to the client.
  const prediction = locked
    ? (
        await supabase
          .from("bracket_predictions")
          .select("group_scores, knockout, champion_team_id, awards")
          .eq("league_id", id)
          .eq("user_id", playerId)
          .maybeSingle()
      ).data
    : null;

  const teams = await getCachedTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamName = (tid: number | null | undefined) =>
    tid != null ? (teamById.get(tid)?.name ?? "—") : "—";

  const name = profile.team_name || profile.display_name;
  const favTeam =
    profile.favorite_team_id != null ? teamById.get(profile.favorite_team_id) : null;

  // ----- locked-only prediction data -----------------------------------------
  const championId = prediction?.champion_team_id ?? null;
  const champTeam = championId != null ? teamById.get(championId) : null;

  const awards = (prediction?.awards ?? {}) as Record<string, number | null>;
  const awardEntries: { key: string; label: string; id: number | null }[] = [
    { key: "golden_boot", label: "🥇 Golden Boot", id: awards.golden_boot ?? null },
    { key: "golden_ball", label: "🎖️ Golden Ball", id: awards.golden_ball ?? null },
    { key: "golden_glove", label: "🧤 Golden Glove", id: awards.golden_glove ?? null },
    { key: "young_player", label: "⭐ Young Player", id: awards.young_player ?? null },
  ];
  const awardIds = awardEntries.map((a) => a.id).filter((v): v is number => v != null);
  let awardNames = new Map<number, string>();
  if (prediction && awardIds.length) {
    const { data: awardPlayers } = await supabase
      .from("players")
      .select("id, name")
      .in("id", awardIds);
    awardNames = new Map((awardPlayers ?? []).map((p) => [p.id, p.name]));
  }

  const groupScores = (prediction?.group_scores ?? {}) as Record<
    string,
    { h: number; a: number }
  >;

  // Their group-stage scorelines, grouped by group label (A..L).
  type GMatch = {
    id: number;
    group_label: string | null;
    home_team_id: number | null;
    away_team_id: number | null;
  };
  let groupBuckets: { group: string; matches: GMatch[] }[] = [];
  if (prediction) {
    const { data: groupMatches } = await supabase
      .from("matches")
      .select("id, group_label, home_team_id, away_team_id")
      .eq("stage", "group")
      .order("kickoff_at");
    const byGroup = new Map<string, GMatch[]>();
    for (const m of (groupMatches ?? []) as GMatch[]) {
      const g = m.group_label ?? "—";
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(m);
    }
    groupBuckets = [...byGroup.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, matches]) => ({ group, matches }));
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
        &larr; Leaderboard
      </Link>

      {/* Header card */}
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <Avatar url={profile.avatar_url} name={name} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl text-chalk">{name}</h1>
            {favTeam && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-chalk-dim">
                <Flag
                  teamId={favTeam.id}
                  logoUrl={favTeam.logo_url}
                  code={favTeam.code}
                  name={favTeam.name}
                  size={16}
                />
                <span className="truncate">{favTeam.name}</span>
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatChip icon="🎯" label="Upfront" value={score?.upfront_points ?? 0} />
          <StatChip icon="⚡" label="Live" value={score?.live_points ?? 0} />
          <StatChip icon="👑" label="Total" value={score?.total_points ?? 0} />
        </div>
      </div>

      {!locked ? (
        <div className="glass rounded-2xl p-5 text-center text-sm text-chalk-dim">
          🔒 {name}&apos;s predictions are hidden until the bracket locks (Jun 11).
        </div>
      ) : !prediction ? (
        <div className="glass rounded-2xl p-5 text-center text-sm text-chalk-dim">
          No predictions submitted.
        </div>
      ) : (
        <>
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
                    {a.id != null ? (awardNames.get(a.id) ?? "—") : "—"}
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
        </>
      )}
    </main>
  );
}
