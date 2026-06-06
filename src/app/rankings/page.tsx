import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedGlobalRankings } from "@/lib/globalRankings";
import { getCachedTeams } from "@/lib/tournamentData";
import Reveal from "@/components/Reveal";
import RankingsBoard from "./RankingsBoard";

export default async function RankingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const [ranks, teams] = await Promise.all([getCachedGlobalRankings(), getCachedTeams()]);
  const slimTeams = teams.map((t) => ({ id: t.id, name: t.name, code: t.code, logo_url: t.logo_url }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:max-w-5xl lg:p-8">
      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>
          <h1 className="mt-1 font-display text-3xl text-gradient-gold">Global rankings</h1>
          <p className="text-sm text-chalk-dim">Every player, ranked by their best score.</p>
        </div>
      </Reveal>

      <Reveal index={1}>
        <RankingsBoard ranks={ranks} teams={slimTeams} meId={user.id} />
      </Reveal>
    </main>
  );
}
