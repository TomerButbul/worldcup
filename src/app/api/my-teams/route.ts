import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import { teamAt } from "@/lib/draft";
import { draftTeamIds } from "@/lib/draft-scoring";

export const dynamic = "force-dynamic";

// The signed-in user's DRAFTED national teams (across every draft league they're
// in), resolved to synced team ids. Used app-wide to subtly ring "your teams"
// wherever a crest appears (see MyTeamsProvider + Flag). Empty for anyone who
// isn't in a draft, so the highlight self-gates to draft players.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ teamIds: [] });

  const svc = createServiceClient();
  const [{ data: picks }, teams] = await Promise.all([
    svc.from("draft_picks").select("pot, slot").eq("user_id", user.id),
    getCachedTeams(),
  ]);

  const idByDraftName = draftTeamIds(teams as { id: number; name: string }[]);
  const ids = new Set<number>();
  for (const p of picks ?? []) {
    const t = teamAt(p.pot, p.slot);
    const id = t ? idByDraftName.get(t.name) : undefined;
    if (id != null) ids.add(id);
  }
  return Response.json({ teamIds: [...ids] });
}
