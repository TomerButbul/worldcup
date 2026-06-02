-- Default the per-pick timer ON when a draft opens. The duration (2 minutes) is
-- enforced client-side via TURN_SECONDS; this only flips timer_enabled so the
-- clock is running from pick 1. The owner can still pause/resume anytime via
-- admin_toggle_timer. Idempotent (create or replace + alter ... if needed).

alter table draft_state alter column timer_enabled set default true;

create or replace function admin_open_draft(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not draft_is_owner(p_league) then
    raise exception 'only the league owner can open the draft';
  end if;
  if (select status from draft_state where league_id = p_league) <> 'not_started' then
    raise exception 'draft already started';
  end if;
  if (
    select count(*) from league_members
    where league_id = p_league and draft_seat is not null
  ) <> 16 then
    raise exception 'all 16 seats must be filled before opening the draft';
  end if;

  update draft_state
    set status = 'in_progress',
        current_pick_index = 0,
        timer_enabled = true,     -- 2-min clock on by default; owner can pause
        turn_started_at = now(),
        updated_at = now()
    where league_id = p_league;
end;
$$;
