import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { createLeague, joinLeague } from "./actions";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";
import Flag from "@/components/Flag";
import Avatar from "@/components/Avatar";
import ProfileEditor from "@/components/ProfileEditor";
import FavoriteTeamPicker from "@/components/FavoriteTeamPicker";
import FavoriteTeamStatus from "@/components/FavoriteTeamStatus";
import { computeFavStatus } from "@/lib/favoriteStatus";
import type { Team, Match } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, team_name, avatar_url, favorite_team_id")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? "player";

  const { data: memberships } = await supabase
    .from("league_members")
    .select("role, leagues ( id, name, join_code )")
    .eq("user_id", user.id);

  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, name, code, logo_url, group_label")
    .order("name");
  const teams = (teamsData ?? []) as Team[];

  const favId = profile?.favorite_team_id ?? null;
  let favStatus = null;
  if (favId) {
    const { data: favMatches } = await supabase
      .from("matches")
      .select("id, stage, group_label, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals")
      .or(`home_team_id.eq.${favId},away_team_id.eq.${favId}`);
    favStatus = computeFavStatus(favId, teams, (favMatches ?? []) as Match[]);
  }
  const favTeam = teams.find((t) => t.id === favId) ?? null;

  const leagues = (memberships ?? [])
    .map((m) => ({ role: m.role, ...(m.leagues as unknown as { id: string; name: string; join_code: string }) }))
    .filter((l) => l.id);

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 p-6">
      <Reveal>
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar url={profile?.avatar_url} name={profile?.team_name || displayName} size={52} />
            <div>
              <h1 className="flex items-center gap-2 font-display text-3xl text-gradient-gold">
                {favTeam && (
                  <Flag teamId={favTeam.id} logoUrl={favTeam.logo_url} code={favTeam.code} name={favTeam.name} size={28} />
                )}
                {profile?.team_name || displayName}
              </h1>
              <p className="text-sm text-chalk-dim">
                {profile?.team_name ? `Managed by ${displayName}` : "Welcome back"}
              </p>
            </div>
          </div>
          <form action={logout}>
            <button className="text-sm text-chalk-dim transition hover:text-chalk">Log out</button>
          </form>
        </header>
      </Reveal>

      <Reveal>
        <ProfileEditor
          userId={user.id}
          displayName={displayName}
          teamName={profile?.team_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
      </Reveal>

      {favStatus && (
        <Reveal>
          <FavoriteTeamStatus status={favStatus} />
        </Reveal>
      )}

      <Reveal>
        <FavoriteTeamPicker teams={teams} current={favId} />
      </Reveal>

      {error && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg text-chalk">Your Leagues</h2>
        {leagues.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
            No leagues yet. Create one or join with a code below.
          </p>
        ) : (
          <ul className="space-y-2">
            {leagues.map((l, i) => (
              <Reveal key={l.id} index={i}>
                <Link
                  href={`/leagues/${l.id}`}
                  className="group flex items-center justify-between rounded-2xl glass p-4 transition hover:border-grass/50 hover:bg-white/10"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <span className="font-semibold text-chalk">{l.name}</span>
                  </span>
                  <span className="rounded-lg bg-black/30 px-2 py-1 font-mono text-xs text-gold">
                    {l.join_code}
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Reveal index={1}>
          <form action={createLeague} className="glass-strong space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-chalk">Create a league</h2>
            <input name="name" required placeholder="League name" className={inputClass} />
            <GameButton type="submit" variant="primary" className="w-full">
              Create
            </GameButton>
          </form>
        </Reveal>

        <Reveal index={2}>
          <form action={joinLeague} className="glass-strong space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-chalk">Join a league</h2>
            <input
              name="join_code"
              required
              placeholder="JOIN CODE"
              className={`${inputClass} font-mono uppercase tracking-widest`}
            />
            <GameButton type="submit" variant="gold" className="w-full">
              Join
            </GameButton>
          </form>
        </Reveal>
      </div>
    </main>
  );
}
