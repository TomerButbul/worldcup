import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import type { Team } from "@/lib/types";
import { predictedBracketView, type ViewBracket } from "@/lib/bracket-core";
import type { BracketTeam } from "@/components/KnockoutBracket";

// Everything the public /b/<slug> bracket page + its OG card need, loaded once per
// request (React cache dedupes the page body + generateMetadata). Read with the
// SERVICE client so it works for logged-out visitors — the whole point of a share
// link is that strangers can see it. Per the owner's choice, this intentionally
// exposes their full predicted bracket; nothing here is private beyond that.
export type SharedBracket = {
  name: string;
  favoriteTeamId: number | null;
  view: ViewBracket;
  teamsById: Record<number, BracketTeam>;
  fifaRank: Record<number, number>;
  hasPicks: boolean;
};

export const getSharedBracket = cache(async (slug: string): Promise<SharedBracket | null> => {
  const clean = (slug ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return null;

  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, display_name, favorite_team_id")
    .eq("share_slug", clean)
    .maybeSingle();
  if (!profile) return null;

  // The bracket is account-level (mirrored across every league the user is in), so
  // any one row is the canonical picks — take the most recently updated.
  const { data: pred } = await db
    .from("bracket_predictions")
    .select("group_order, third_qualifiers, knockout, champion_team_id, updated_at")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const teams = (await getCachedTeams()) as (Team & { fifa_rank: number | null })[];
  const teamsById: Record<number, BracketTeam> = {};
  const fifaRank: Record<number, number> = {};
  for (const t of teams) {
    teamsById[t.id] = { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url };
    if (t.fifa_rank != null) fifaRank[t.id] = t.fifa_rank;
  }

  const order = (pred?.group_order ?? {}) as Record<string, number[]>;
  const thirds = (pred?.third_qualifiers ?? []) as string[];
  const knockout = (pred?.knockout ?? {}) as Record<number, number>;
  const view = predictedBracketView(order, thirds, knockout);

  const hasPicks =
    view.champion != null || Object.keys(knockout).length > 0 || Object.keys(order).length > 0;

  return {
    name: profile.display_name ?? "A manager",
    favoriteTeamId: profile.favorite_team_id ?? null,
    view,
    teamsById,
    fifaRank,
    hasPicks,
  };
});
