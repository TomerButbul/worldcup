import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import { nowMs } from "@/lib/clock";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";
import Ball from "@/components/art/Ball";
import Trophy from "@/components/art/Trophy";
import KnockoutBracket from "@/components/KnockoutBracket";
import { predictedBracketRounds } from "@/lib/bracket-core";
import { Upfront, Live, Boot, Glove, Star, Medal } from "@/components/icons";
import type { ComponentType, ReactNode } from "react";

// A "Manager" = a human participant in this league (NOT a football player).
// Their predictions stay hidden until the bracket locks, so peeking can't
// influence anyone's own picks — fair play before kickoff.

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-night/5 px-3 py-2">
      <span className="flex items-center justify-center text-chalk-dim">{icon}</span>
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
          .select("group_order, third_qualifiers, knockout, champion_team_id, awards")
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
  const awardEntries: { key: string; label: string; Icon: ComponentType<{ size?: number; className?: string }>; id: number | null }[] = [
    { key: "golden_boot", label: "Golden Boot", Icon: Boot, id: awards.golden_boot ?? null },
    { key: "golden_ball", label: "Golden Ball", Icon: Medal, id: awards.golden_ball ?? null },
    { key: "golden_glove", label: "Golden Glove", Icon: Glove, id: awards.golden_glove ?? null },
    { key: "young_player", label: "Young Player", Icon: Star, id: awards.young_player ?? null },
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

  // Their predicted group finishing order (table-pick model), by group label.
  const groupOrder = (prediction?.group_order ?? {}) as Record<string, number[]>;
  const orderedGroups = Object.entries(groupOrder)
    .filter(([, ids]) => ids.length === 4)
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Their predicted knockout bracket (same resolution as the editor). favourite
  // is the viewed manager's — its path through the bracket is highlighted gold.
  const favoriteTeamId = profile.favorite_team_id ?? null;
  const { rounds: bracketRounds } = predictedBracketRounds(
    groupOrder,
    (prediction?.third_qualifiers ?? []) as string[],
    (prediction?.knockout ?? {}) as Record<number, number>,
  );
  const bracketTeams: Record<number, { id: number; name: string; code: string | null; logo_url: string | null }> = {};
  for (const t of teams) bracketTeams[t.id] = { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6 lg:max-w-5xl">
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
          <StatChip icon={<Upfront size={20} />} label="Upfront" value={score?.upfront_points ?? 0} />
          <StatChip icon={<Live size={20} />} label="Live" value={score?.live_points ?? 0} />
          <StatChip icon={<Trophy size={20} />} label="Total" value={score?.total_points ?? 0} />
        </div>
      </div>

      {!locked ? (
        <div className="glass rounded-2xl p-4 text-center text-sm text-chalk-dim">
          🔒 {name}&apos;s predictions are hidden until the bracket locks (Jun 11).
        </div>
      ) : !prediction ? (
        <div className="glass rounded-2xl p-4 text-center text-sm text-chalk-dim">
          No predictions submitted.
        </div>
      ) : (
        <>
          {/* Predicted knockout bracket — the headline of their picks. */}
          <section className="glass-strong rounded-3xl p-5">
            <h2 className="mb-1 flex items-center gap-1.5 font-display text-xl text-chalk">
              <Trophy size={20} />Knockout bracket
            </h2>
            <p className="mb-3 text-xs text-chalk-dim">
              {favoriteTeamId != null
                ? `${name}'s full bracket — gold marks their favourite.`
                : `${name}'s full bracket, R32 to the final.`}
            </p>
            <KnockoutBracket
              rounds={bracketRounds}
              teamsById={bracketTeams}
              highlightIds={favoriteTeamId != null ? [favoriteTeamId] : []}
              championNo={104}
              treeOnly
            />
          </section>

          {/* Desktop 2-column: left = champion + awards; right = group order */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
            {/* Left column */}
            <div className="space-y-4">
              {/* Champion */}
              <section className="glass rounded-2xl p-4">
                <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg text-chalk"><Trophy size={18} />Champion</h2>
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
              <section className="glass rounded-2xl p-4">
                <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg text-chalk"><Medal size={18} />Awards</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {awardEntries.map((a) => (
                    <div
                      key={a.key}
                      className="flex items-center justify-between gap-2 rounded-xl bg-night/5 px-3 py-2"
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs text-chalk-dim">
                        <a.Icon size={13} />{a.label}
                      </span>
                      <span className="min-w-0 truncate text-right text-sm font-semibold text-chalk">
                        {a.id != null ? (awardNames.get(a.id) ?? "—") : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column: group order */}
            <div className="mt-4 lg:mt-0">
              <section className="glass rounded-2xl p-4">
                <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg text-chalk"><Ball size={16} />Group order</h2>
                {orderedGroups.length === 0 ? (
                  <p className="text-sm text-chalk-dim">No group order predicted.</p>
                ) : (
                  <div className="space-y-2">
                    {orderedGroups.map(([group, ids]) => (
                      <details key={group} className="group rounded-xl bg-night/5 px-3 py-2">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-chalk">
                          Group {group}
                          <span className="text-chalk-dim transition group-open:rotate-180">▾</span>
                        </summary>
                        <ol className="mt-2 space-y-1">
                          {ids.map((tid, i) => {
                            const t = teamById.get(tid);
                            return (
                              <li
                                key={tid}
                                className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${i < 2 ? "bg-grass/15" : i === 2 ? "bg-gold/10" : ""}`}
                              >
                                <span className="w-3 shrink-0 text-center text-chalk-dim">{i + 1}</span>
                                {t && <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={14} />}
                                <span className="min-w-0 flex-1 truncate text-chalk">{t?.name ?? teamName(tid)}</span>
                                {i < 2 && <span className="shrink-0 text-grass">✓</span>}
                                {i === 2 && <span className="shrink-0 text-[10px] text-gold">3rd</span>}
                              </li>
                            );
                          })}
                        </ol>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
