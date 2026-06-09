import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCachedGlobalRankings, type GlobalRank } from "@/lib/globalRankings";
import { isPrizeEligible } from "@/lib/prizeEligibility";

// Data layer for "The TopCorner Invitational". The contest is a VIRTUAL filter over
// the worldwide rankings — "the highest-scoring ELIGIBLE bracket wins $75" — so we
// reuse getCachedGlobalRankings (already the best-score-per-player board, guests
// excluded) and keep only the eligible players. No separate league, no gated join.
//
// Everything here is defensive: if the referred_by column isn't there yet (the
// 0041 migration not applied) or any read fails, eligibility resolves to empty and
// the page degrades to "no one's qualified yet" rather than erroring. That makes
// the (apply migration) vs (deploy) order safe in either direction.

export type InvitationalRow = GlobalRank & { rank: number };

type Elig = { referredBy: string | null; referralCount: number };

// For a set of user ids, fetch each one's referral facts: who referred them, and
// how many REAL (non-guest) accounts they referred. Returns an empty map on any
// failure (e.g. column missing) so callers treat everyone as not-yet-eligible.
async function eligibilityMap(ids: string[]): Promise<Map<string, Elig>> {
  const map = new Map<string, Elig>();
  if (ids.length === 0) return map;
  try {
    const s = createServiceClient();

    const { data: mine, error: e1 } = await s
      .from("profiles")
      .select("id, referred_by")
      .in("id", ids);
    if (e1) return new Map();

    // Non-guest accounts whose referrer is one of these ids → counts toward that
    // referrer's "I brought in a real player" total.
    const { data: brought, error: e2 } = await s
      .from("profiles")
      .select("referred_by")
      .eq("is_guest", false)
      .in("referred_by", ids);
    if (e2) return new Map();

    for (const r of mine ?? []) {
      map.set(r.id as string, { referredBy: (r.referred_by as string | null) ?? null, referralCount: 0 });
    }
    for (const r of brought ?? []) {
      const ref = r.referred_by as string | null;
      if (!ref) continue;
      const cur = map.get(ref) ?? { referredBy: null, referralCount: 0 };
      cur.referralCount += 1;
      map.set(ref, cur);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function computeStandings(): Promise<InvitationalRow[]> {
  const ranks = await getCachedGlobalRankings(); // non-guest, sorted by best total
  if (ranks.length === 0) return [];
  const elig = await eligibilityMap(ranks.map((r) => r.user_id));

  let rank = 0;
  return ranks
    .filter((r) => {
      const e = elig.get(r.user_id) ?? { referredBy: null, referralCount: 0 };
      // Everyone in `ranks` is already non-guest (globalRankings hides guests).
      return isPrizeEligible({ isGuest: false, referredBy: e.referredBy, referralCount: e.referralCount });
    })
    .map((r) => ({ ...r, rank: ++rank }));
}

// Cached like the rankings (5 min): eligibility changes slowly and hundreds of
// viewers should cost one DB read per window.
export const getInvitationalStandings = unstable_cache(computeStandings, ["invitational-standings"], {
  revalidate: 300,
});

export type ReferralStatus = {
  /** The viewer's public slug, used to build their personal /r/<slug> invite link. */
  slug: string | null;
  /** Who referred the viewer (a profile id), or null. */
  referredBy: string | null;
  /** How many REAL (non-guest) players the viewer has referred. */
  referralCount: number;
  /** Whether the viewer currently qualifies for the prize. */
  eligible: boolean;
  /** True only for anonymous guest accounts (can't win cash; should upgrade). */
  isGuest: boolean;
};

// The signed-in viewer's own referral standing. Not cached — it's per-user, cheap,
// and must reflect a referral the instant it lands. Service client because under
// RLS a user can't count other profiles that point at them.
export async function referralStatusFor(userId: string): Promise<ReferralStatus> {
  const empty: ReferralStatus = {
    slug: null,
    referredBy: null,
    referralCount: 0,
    eligible: false,
    isGuest: false,
  };
  try {
    const s = createServiceClient();
    const { data: me, error } = await s
      .from("profiles")
      .select("share_slug, referred_by, is_guest")
      .eq("id", userId)
      .maybeSingle();
    if (error || !me) return empty;

    const { data: refs } = await s
      .from("profiles")
      .select("id")
      .eq("referred_by", userId)
      .eq("is_guest", false);

    const referralCount = refs?.length ?? 0;
    const referredBy = (me.referred_by as string | null) ?? null;
    const isGuest = Boolean(me.is_guest);
    return {
      slug: (me.share_slug as string | null) ?? null,
      referredBy,
      referralCount,
      isGuest,
      eligible: isPrizeEligible({ isGuest, referredBy, referralCount }),
    };
  } catch {
    return empty;
  }
}

export type AdminRow = {
  rank: number;
  user_id: string;
  name: string;
  total: number;
  /** Display name of whoever referred this player; null if they qualified by referring. */
  referredByName: string | null;
  /** How many real (non-guest) accounts this player referred. */
  referralCount: number;
};

// Provenance for the eligible standings, so the Sponsor can VET how each entrant
// qualified before paying out (catching fake/duplicate-account referral abuse).
// Returns the top `limit` eligible players with who-referred-whom and how many real
// players each brought in. Admin-only — gate the caller.
export async function getAdminProvenance(limit = 50): Promise<AdminRow[]> {
  const standings = await getInvitationalStandings();
  const top = standings.slice(0, limit);
  if (top.length === 0) return [];

  const fallback = (): AdminRow[] =>
    top.map((r) => ({
      rank: r.rank,
      user_id: r.user_id,
      name: r.name,
      total: r.total,
      referredByName: null,
      referralCount: 0,
    }));

  try {
    const s = createServiceClient();
    const ids = top.map((r) => r.user_id);

    const { data: profs } = await s.from("profiles").select("id, referred_by").in("id", ids);
    const referredByById = new Map<string, string | null>(
      (profs ?? []).map((p) => [p.id as string, (p.referred_by as string | null) ?? null]),
    );

    // Resolve referrer display names (referrers may be outside `ids`).
    const referrerIds = [...new Set([...referredByById.values()].filter(Boolean))] as string[];
    const nameByRefId = new Map<string, string>();
    if (referrerIds.length) {
      const { data: refs } = await s
        .from("profiles")
        .select("id, display_name, team_name")
        .in("id", referrerIds);
      for (const r of refs ?? []) {
        nameByRefId.set(
          r.id as string,
          (r.team_name as string) || (r.display_name as string) || "Player",
        );
      }
    }

    // Count real (non-guest) accounts each player referred.
    const { data: brought } = await s
      .from("profiles")
      .select("referred_by")
      .eq("is_guest", false)
      .in("referred_by", ids);
    const countById = new Map<string, number>();
    for (const b of brought ?? []) {
      const ref = b.referred_by as string | null;
      if (ref) countById.set(ref, (countById.get(ref) ?? 0) + 1);
    }

    return top.map((r) => {
      const refBy = referredByById.get(r.user_id) ?? null;
      return {
        rank: r.rank,
        user_id: r.user_id,
        name: r.name,
        total: r.total,
        referredByName: refBy ? nameByRefId.get(refBy) ?? "(unknown)" : null,
        referralCount: countById.get(r.user_id) ?? 0,
      };
    });
  } catch {
    return fallback();
  }
}
