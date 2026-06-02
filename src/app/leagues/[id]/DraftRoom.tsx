"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { turnFor, SEATS } from "@/lib/draft";
import { playPop, playDing, playWhistle, playWomp } from "@/lib/sound";
import { celebrate } from "@/lib/confetti";
import SeatGrid from "./SeatGrid";
import DraftBoard from "./DraftBoard";
import DraftResults from "./DraftResults";
import type { StandingRow } from "@/lib/draft-scoring";
import {
  type DraftStateRow,
  type PickRow,
  type DraftMember,
  type MemberQueryRow,
  mapMember,
  TURN_SECONDS,
} from "./draftTypes";

export default function DraftRoom({
  leagueId,
  leagueName,
  meId,
  isOwner,
  initialState,
  initialPicks,
  initialMembers,
  standings,
  tournamentStarted,
}: {
  leagueId: string;
  leagueName: string;
  meId: string;
  isOwner: boolean;
  initialState: DraftStateRow;
  initialPicks: PickRow[];
  initialMembers: DraftMember[];
  standings: { perPot: Record<number, StandingRow[]>; totals: StandingRow[] };
  tournamentStarted: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialState);
  const [picks, setPicks] = useState(initialPicks);
  const [members, setMembers] = useState(initialMembers);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [s, p, m] = await Promise.all([
      supabase
        .from("draft_state")
        .select("status, current_pick_index, timer_enabled, turn_started_at")
        .eq("league_id", leagueId)
        .maybeSingle(),
      supabase
        .from("draft_picks")
        .select("user_id, pot, slot, pick_no")
        .eq("league_id", leagueId)
        .order("pick_no"),
      supabase
        .from("league_members")
        .select("user_id, draft_seat, profiles ( display_name, team_name, avatar_url )")
        .eq("league_id", leagueId),
    ]);
    if (s.data) setState(s.data as DraftStateRow);
    if (p.data) setPicks(p.data as PickRow[]);
    if (m.data) setMembers((m.data as unknown as MemberQueryRow[]).map(mapMember));
  }, [supabase, leagueId]);

  // Live: any change to state, picks, or seats refetches the room.
  useEffect(() => {
    const channel = supabase
      .channel(`draft-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_state", filter: `league_id=eq.${leagueId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_picks", filter: `league_id=eq.${leagueId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` },
        refresh,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, leagueId, refresh]);

  // Call a draft RPC; surface errors and refetch on success.
  const call = useCallback(
    async (fn: string, args: Record<string, unknown>) => {
      setBusy(true);
      setMsg(null);
      const { error } = await supabase.rpc(fn, args);
      setBusy(false);
      if (error) {
        setMsg(error.message);
        playWomp();
        return false;
      }
      await refresh();
      return true;
    },
    [supabase, refresh],
  );

  // --- Derived state -------------------------------------------------------
  const seatToMember = useMemo(() => {
    const map = new Map<number, DraftMember>();
    for (const m of members) if (m.seat != null) map.set(m.seat, m);
    return map;
  }, [members]);

  const me = useMemo(() => members.find((m) => m.userId === meId) ?? null, [members, meId]);
  const mySeat = me?.seat ?? null;
  const filledSeats = seatToMember.size;

  const taken = useMemo(() => {
    const map: Record<number, Set<number>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const p of picks) map[p.pot]?.add(p.slot);
    return map;
  }, [picks]);

  const turn = state.status === "in_progress" ? turnFor(state.current_pick_index) : null;
  const onClock = turn ? seatToMember.get(turn.seat) ?? null : null;
  const isMyTurn = !!onClock && onClock.userId === meId;

  // --- Sound + celebration cues -------------------------------------------
  const prevPicks = useRef(picks.length);
  useEffect(() => {
    if (picks.length > prevPicks.current) playPop();
    prevPicks.current = picks.length;
  }, [picks.length]);

  const prevMyTurn = useRef(false);
  useEffect(() => {
    if (isMyTurn && !prevMyTurn.current) playDing();
    prevMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (prevStatus.current !== "in_progress" && state.status === "in_progress") playWhistle();
    if (prevStatus.current !== "complete" && state.status === "complete") celebrate();
    prevStatus.current = state.status;
  }, [state.status]);

  // --- 30s soft clock: only the on-the-clock client auto-picks at zero -----
  const firedRef = useRef(-1);
  useEffect(() => {
    const active =
      state.status === "in_progress" && state.timer_enabled && !!state.turn_started_at;
    const startedAt = state.turn_started_at ? new Date(state.turn_started_at).getTime() : 0;
    const tick = () => {
      if (!active) {
        setRemaining(null);
        return;
      }
      const rem = Math.max(0, TURN_SECONDS - (Date.now() - startedAt) / 1000);
      setRemaining(rem);
      if (rem <= 0 && isMyTurn && firedRef.current !== state.current_pick_index) {
        firedRef.current = state.current_pick_index;
        const pot = turnFor(state.current_pick_index).pot;
        const avail: number[] = [];
        for (let s = 1; s <= SEATS; s++) if (!taken[pot]?.has(s)) avail.push(s);
        if (avail.length) {
          const slot = avail[Math.floor(Math.random() * avail.length)];
          void supabase.rpc("make_pick", { p_league: leagueId, p_slot: slot }).then(({ error }) => {
            if (!error) void refresh();
          });
        }
      }
    };
    tick();
    if (!active) return;
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [
    state.status,
    state.timer_enabled,
    state.turn_started_at,
    state.current_pick_index,
    isMyTurn,
    taken,
    supabase,
    leagueId,
    refresh,
  ]);

  // --- Callbacks passed to phase views ------------------------------------
  const onClaim = (seat: number) => call("claim_seat", { p_league: leagueId, p_seat: seat });
  const onAssign = (userId: string, seat: number) =>
    call("admin_set_seat", { p_league: leagueId, p_user: userId, p_seat: seat });
  const onOpen = () => call("admin_open_draft", { p_league: leagueId });
  const onPick = (slot: number) => call("make_pick", { p_league: leagueId, p_slot: slot });
  const onForce = (slot: number | null) => call("admin_force_pick", { p_league: leagueId, p_slot: slot });
  const onToggleTimer = (enabled: boolean) =>
    call("admin_toggle_timer", { p_league: leagueId, p_enabled: enabled });

  const statusBadge =
    state.status === "in_progress"
      ? { text: "🔴 LIVE", cls: "text-red-600" }
      : state.status === "complete"
        ? { text: "🏁 Complete", cls: "text-gold" }
        : { text: "🟢 Lobby open", cls: "text-grass" };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-gradient-gold sm:text-4xl">{leagueName}</h1>
            <p className="mt-1 text-sm text-chalk-dim">
              The Draft · 16 managers · 3 pots{"  ·  "}
              <span className={statusBadge.cls}>{statusBadge.text}</span>
            </p>
          </div>
        </div>
      </div>

      {msg && (
        <p className="rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-600" role="alert">
          {msg}
        </p>
      )}

      {state.status === "not_started" && (
        <SeatGrid
          members={members}
          seatToMember={seatToMember}
          mySeat={mySeat}
          isOwner={isOwner}
          busy={busy}
          filledSeats={filledSeats}
          onClaim={onClaim}
          onAssign={onAssign}
          onOpen={onOpen}
        />
      )}

      {state.status === "in_progress" && turn && (
        <DraftBoard
          picks={picks}
          members={members}
          pickIndex={state.current_pick_index}
          pot={turn.pot}
          seat={turn.seat}
          onClock={onClock}
          isMyTurn={isMyTurn}
          isOwner={isOwner}
          timerEnabled={state.timer_enabled}
          remaining={remaining}
          busy={busy}
          onPick={onPick}
          onForce={onForce}
          onToggleTimer={onToggleTimer}
        />
      )}

      {state.status === "complete" && (
        <DraftResults
          picks={picks}
          members={members}
          standings={standings}
          tournamentStarted={tournamentStarted}
        />
      )}
    </main>
  );
}
