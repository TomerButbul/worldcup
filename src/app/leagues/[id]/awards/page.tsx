import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/clock";
import AwardsPicker, { type AwardPlayer } from "./AwardsPicker";

export default async function AwardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, bracket_lock_at")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");
  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  const [{ data: players }, { data: teams }, { data: pred }] = await Promise.all([
    supabase.from("players").select("id, name, team_id, position, age, height_cm, weight_kg, number, nationality"),
    supabase.from("teams").select("id, name"),
    supabase
      .from("bracket_predictions")
      .select("awards")
      .eq("league_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const awardPlayers: AwardPlayer[] = (players ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team_id ? (teamName.get(p.team_id) ?? "") : "",
      position: p.position ?? null,
      age: p.age ?? null,
      height: p.height_cm ?? null,
      weight: p.weight_kg ?? null,
      number: p.number ?? null,
      nationality: p.nationality ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const initial = (pred?.awards ?? {}) as Record<string, number>;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Back to league
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Individual awards</h1>
        <p className="text-sm text-chalk-dim">
          Predict the tournament&apos;s individual award winners — they score into your Upfront total.{" "}
          {locked ? "🔒 Locked." : "Locks with your bracket at kickoff."} ⭐
        </p>
      </div>

      {awardPlayers.length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          ⚽ Player list loads once squads are synced.
        </p>
      ) : (
        <AwardsPicker leagueId={id} players={awardPlayers} initial={initial} locked={locked} />
      )}
    </main>
  );
}
