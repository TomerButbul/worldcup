import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedGlobalRankings } from "@/lib/globalRankings";
import { getCachedTeams } from "@/lib/tournamentData";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const [ranks, teams] = await Promise.all([
    getCachedGlobalRankings(),
    getCachedTeams(),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <div className="glass-strong rounded-3xl p-5">
        <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Home
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">🌍 Global rankings</h1>
        <p className="mt-1 text-sm text-chalk-dim">
          Every player, ranked by their best league score.
        </p>
      </div>

      {ranks.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          No scores yet — check back once games kick off.
        </div>
      ) : (
        <ul className="glass-strong overflow-hidden rounded-2xl">
          {ranks.map((r, i) => {
            const isMe = r.user_id === user.id;
            const team = r.favTeamId ? teamById.get(r.favTeamId) : null;
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 border-b border-night/5 px-3 py-3 last:border-b-0 sm:px-4 ${
                  isMe ? "bg-gold/15 ring-1 ring-inset ring-gold/50" : ""
                }`}
              >
                <span className="w-7 shrink-0 text-center text-lg tabular-nums">
                  {MEDALS[i] ?? <span className="text-sm text-chalk-dim">#{i + 1}</span>}
                </span>
                <Avatar url={r.avatarUrl} name={r.name} size={40} />
                {r.favTeamId && (
                  <Flag
                    teamId={r.favTeamId}
                    logoUrl={team?.logo_url}
                    code={team?.code}
                    name={team?.name}
                    size={18}
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-semibold text-chalk">
                  {r.name}
                </span>
                {isMe && (
                  <span className="shrink-0 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                    you
                  </span>
                )}
                <span className="shrink-0 font-display text-lg tabular-nums text-gold">
                  {r.best}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
