// The two-phase / second-chance lock rules — pure + unit-tested so the cash contest
// never hinges on a fuzzy guess about who can edit what.
//
//   • Group bracket locks at KICKOFF and is scored — unless the player has reset.
//   • Knockout bracket stays editable until the ROUND OF 32 for late joiners and for
//     players who RESET (forfeiting their group-table points). A "committed" player
//     (had a real group bracket at kickoff) who hasn't reset is locked at kickoff and
//     must reset to touch their knockout.
//
// reset_at is the single stored flag. "committed" is derived: a non-empty group
// bracket submitted on/before kickoff. So a late joiner (submitted after kickoff, or
// never) is naturally in the open-knockout / no-group-points state without any flag.

export type BracketLockInput = {
  now: number;
  kickoffMs: number; // group bracket lock = tournament kickoff
  knockoutLockMs: number; // knockout bracket lock = Round of 32 start
  submittedAtMs: number | null; // bracket_predictions.submitted_at
  resetAtMs: number | null; // bracket_predictions.reset_at
  hasGroupBracket: boolean; // group_order is non-empty
};

export type BracketLockState = {
  committed: boolean; // locked in a real group bracket at kickoff
  inReset: boolean; // forfeited group-table points for a fresh knockout
  scoresGroup: boolean; // group-table points count toward the total
  groupEditable: boolean; // can still edit group picks
  knockoutEditable: boolean; // can still edit knockout picks
  canReset: boolean; // the "reset / second chance" action is available right now
};

export function bracketLockState(i: BracketLockInput): BracketLockState {
  const beforeKickoff = i.now < i.kickoffMs;
  const committed =
    i.hasGroupBracket && i.submittedAtMs != null && i.submittedAtMs <= i.kickoffMs;
  const inReset = i.resetAtMs != null;

  // Group picks: pre-kickoff for everyone; late joiners (not committed) also get
  // a window until R32 so they can seed their knockout bracket with real teams.
  // No group points are at stake — committed is false, so scoresGroup stays false.
  const groupEditable = beforeKickoff || (!committed && i.now < i.knockoutLockMs);

  // Knockout: open pre-kickoff for all; after kickoff only late joiners + reset
  // players keep editing (until R32); a committed, non-reset player is locked.
  const knockoutEditable =
    i.now < i.knockoutLockMs && (beforeKickoff || !committed || inReset);

  // Group-table points count only for a committed player who hasn't reset.
  const scoresGroup = committed && !inReset;

  // Reset is offered to a committed, not-yet-reset player after kickoff, while the
  // knockout is still open.
  const canReset = committed && !inReset && !beforeKickoff && i.now < i.knockoutLockMs;

  return { committed, inReset, scoresGroup, groupEditable, knockoutEditable, canReset };
}
