import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/clock";
import AwardsPicker, { type AwardPlayer } from "@/app/leagues/[id]/awards/AwardsPicker";
import Ball from "@/components/art/Ball";
import { Star } from "@/components/icons";
import Reveal from "@/components/Reveal";
import { primaryPredictionLeague } from "@/lib/predictionSync";
import NoPredictionLeague from "@/components/NoPredictionLeague";

export const metadata = { title: "Individual awards" };

// Account-level award picks. saveAwards mirrors writes to every prediction
// league; here we resolve the canonical one only to read current picks + lock.
export default async function AwardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const league = await primaryPredictionLeague(supabase, user.id);
  if (!league) return <NoPredictionLeague title="Predict the individual awards" />;
  const leagueId = league.id;
  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  // Paginate the squad — PostgREST caps responses at 1000 rows and there are
  // >1000 WC squad players, so a plain select silently drops some (e.g. Messi).
  async function allSquadPlayers() {
    const cols = "id, name, team_id, position, age, height_cm, weight_kg, number, nationality";
    type Row = {
      id: number;
      name: string;
      team_id: number | null;
      position: string | null;
      age: number | null;
      height_cm: number | null;
      weight_kg: number | null;
      number: number | null;
      nationality: string | null;
    };
    const rows: Row[] = [];
    for (let from = 0; from < 10000; from += 1000) {
      const { data } = await supabase
        .from("players")
        .select(cols)
        .eq("in_squad", true)
        .order("id")
        .range(from, from + 999);
      if (!data?.length) break;
      rows.push(...(data as Row[]));
      if (data.length < 1000) break;
    }
    return rows;
  }

  const [players, { data: teams }, { data: pred }] = await Promise.all([
    allSquadPlayers(),
    supabase.from("teams").select("id, name"),
    supabase
      .from("bracket_predictions")
      .select("awards")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const awardPlayers: AwardPlayer[] = players
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
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:max-w-5xl lg:p-8">
      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>
          <h1 className="mt-1 inline-flex items-center gap-2 font-display text-3xl text-gradient-gold">
            <Star size={22} /> Individual awards
          </h1>
          <p className="text-sm text-chalk-dim">
            {locked
              ? "🔒 Locked. Award picks score into your Upfront total in every league."
              : "Pick the award winners — they score into your Upfront total in every league. Locks at kickoff."}
          </p>
        </div>
      </Reveal>

      {awardPlayers.length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          <Ball size={14} className="mr-1 inline-block align-[-2px]" />Player list loads once squads are synced.
        </p>
      ) : (
        <Reveal index={1}>
          <AwardsPicker leagueId={leagueId} players={awardPlayers} initial={initial} locked={locked} />
        </Reveal>
      )}
    </main>
  );
}
