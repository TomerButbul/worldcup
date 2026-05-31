import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Leaderboard from "./Leaderboard";
import { btnClass, GOLD_GRADIENT } from "@/components/buttonStyles";
import Reveal from "@/components/Reveal";
import { nowMs } from "@/lib/clock";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, join_code, owner_id, bracket_lock_at")
    .eq("id", id)
    .maybeSingle();
  if (!league) notFound();

  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  const { data: scores } = await supabase
    .from("scores")
    .select("user_id, upfront_points, live_points, total_points, profiles ( display_name, team_name, avatar_url, favorite_team_id )")
    .eq("league_id", id)
    .order("total_points", { ascending: false });

  const rows = (scores ?? []).map((s) => {
    const p = s.profiles as unknown as {
      display_name: string;
      team_name: string | null;
      avatar_url: string | null;
      favorite_team_id: number | null;
    };
    return {
      user_id: s.user_id,
      name: p?.team_name || p?.display_name || "?",
      avatarUrl: p?.avatar_url ?? null,
      favTeamId: p?.favorite_team_id ?? null,
      upfront: s.upfront_points,
      live: s.live_points,
      total: s.total_points,
    };
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
            &larr; Dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl text-gradient-gold">{league.name}</h1>
              <p className="mt-1 text-sm text-chalk-dim">
                Code <span className="rounded bg-black/30 px-2 py-0.5 font-mono text-gold">{league.join_code}</span>
                {"  ·  "}
                <span className={locked ? "text-red-300" : "text-grass-bright"}>
                  {locked ? "🔒 Bracket locked" : "🟢 Bracket open"}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/leagues/${id}/matches`} className={btnClass("ghost")}>
                ⚽ Matches
              </Link>
              <Link
                href={`/leagues/${id}/bracket`}
                className={btnClass("gold")}
                style={{ background: GOLD_GRADIENT, boxShadow: "var(--shadow-glow-gold)" }}
              >
                {locked ? "View bracket" : "🏆 Make picks"}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal index={1}>
        <section>
          <h2 className="mb-3 font-display text-xl text-chalk">Leaderboard</h2>
          <Leaderboard leagueId={id} initialRows={rows} meId={user.id} />
          <p className="mt-2 text-xs text-chalk-dim">
            Three crowns: top Upfront 🎯, top Live ⚡, top Total 👑. Updates live.
          </p>
        </section>
      </Reveal>
    </main>
  );
}
