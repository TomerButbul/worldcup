// Shared row shapes for the draft side-game UI (server fetch -> client room).

export type DraftStatus = "not_started" | "in_progress" | "complete";

export interface DraftStateRow {
  status: DraftStatus;
  current_pick_index: number;
  timer_enabled: boolean;
  turn_started_at: string | null;
}

export interface PickRow {
  user_id: string;
  pot: number;
  slot: number;
  pick_no: number;
}

export interface DraftMember {
  userId: string;
  seat: number | null;
  name: string;
  avatarUrl: string | null;
}

// Shape returned by the league_members + profiles join.
export interface MemberQueryRow {
  user_id: string;
  draft_seat: number | null;
  profiles: { display_name: string; team_name: string | null; avatar_url: string | null } | null;
}

export function mapMember(row: MemberQueryRow): DraftMember {
  const p = row.profiles;
  return {
    userId: row.user_id,
    seat: row.draft_seat ?? null,
    name: p?.team_name || p?.display_name || "?",
    avatarUrl: p?.avatar_url ?? null,
  };
}

// Per-pick clock (client-enforced). 2 minutes, default-on when a draft opens;
// the owner can pause/resume anytime via admin_toggle_timer.
export const TURN_SECONDS = 120;
