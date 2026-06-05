import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";

// A league's public, shareable face — everything the /join invite landing page and
// its Open Graph card need, and nothing sensitive. Read with the SERVICE client so
// it works for LOGGED-OUT visitors: RLS would otherwise hide a league the viewer
// hasn't joined yet, and the whole point of an invite is that strangers can see it.
export type InvitePreview = {
  id: string;
  name: string;
  kind: string; // "regular" | "draft"
  isGlobal: boolean;
  lockAt: string | null; // leagues.bracket_lock_at (ISO)
  memberCount: number;
  ownerName: string | null;
};

// Resolve a league by its 6-char join code. Codes are alphanumeric, so we strip
// anything else first (a stray slash, "%", or whitespace from a mangled paste) —
// both to be forgiving and to keep `ilike` from ever seeing a wildcard. Wrapped in
// React `cache` so the landing page renders it once even though generateMetadata
// and the page body both ask for it in the same request. Returns null on no match
// so callers can show a friendly "invalid invite" fallback instead of crashing.
export const getInvitePreview = cache(async (code: string): Promise<InvitePreview | null> => {
  const clean = (code ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return null;

  const db = createServiceClient();
  const { data: league } = await db
    .from("leagues")
    .select("id, name, kind, is_global, bracket_lock_at, owner_id")
    .ilike("join_code", clean)
    .maybeSingle();
  if (!league) return null;

  const { count } = await db
    .from("league_members")
    .select("user_id", { count: "exact", head: true })
    .eq("league_id", league.id);

  let ownerName: string | null = null;
  if (league.owner_id) {
    const { data: owner } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", league.owner_id)
      .maybeSingle();
    ownerName = owner?.display_name ?? null;
  }

  return {
    id: league.id as string,
    name: (league.name as string) ?? "World Cup league",
    kind: (league.kind as string) ?? "regular",
    isGlobal: Boolean(league.is_global),
    lockAt: (league.bracket_lock_at as string) ?? null,
    memberCount: count ?? 0,
    ownerName,
  };
});
