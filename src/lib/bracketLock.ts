import { FREE_EDIT_LOCK_MS } from "@/lib/clock";

// The bracket lock rules — pure + unit-tested so the cash contest never hinges on a
// fuzzy guess about who can edit what.
//
// Re-open model (June 2026): the WHOLE bracket — group order, thirds, knockout,
// champion, awards — is re-editable by EVERYONE until `freeEditLockMs` (a Sunday
// night, before any group finishes), then it locks. Group-winner points do NOT move
// with edits: they're scored from each committed player's kickoff snapshot
// (bracket_predictions.original_bracket.group_order), so re-picking your groups
// reshapes your Round of 32 without gaming the (tiny) group points. The old
// committed/kickoff lock and the second-chance "reset" are retired.

export type BracketLockInput = {
  now: number;
  kickoffMs: number; // tournament kickoff — used only to derive `committed`
  knockoutLockMs: number; // R32 start — kept for callers; no longer gates editing
  freeEditLockMs?: number; // whole-bracket free-edit deadline; defaults to FREE_EDIT_LOCK_MS
  submittedAtMs: number | null; // bracket_predictions.submitted_at
  resetAtMs: number | null; // bracket_predictions.reset_at (legacy; unused going forward)
  hasGroupBracket: boolean; // group_order is non-empty
};

export type BracketLockState = {
  committed: boolean; // had a real group bracket on/before kickoff (drives the snapshot)
  inReset: boolean; // legacy reset flag (informational)
  scoresGroup: boolean; // retired gate — group points now come from the snapshot
  groupEditable: boolean; // can edit group picks right now
  knockoutEditable: boolean; // can edit knockout picks right now
  canReset: boolean; // retired — always false
};

export function bracketLockState(i: BracketLockInput): BracketLockState {
  // `committed` = a real group bracket submitted on/before kickoff. Informational
  // now: it identifies whose group_order was frozen into the scored snapshot.
  const committed =
    i.hasGroupBracket && i.submittedAtMs != null && i.submittedAtMs <= i.kickoffMs;

  // One window for everything: edit the whole bracket until the free-edit lock.
  const editable = i.now < (i.freeEditLockMs ?? FREE_EDIT_LOCK_MS);

  return {
    committed,
    inReset: i.resetAtMs != null,
    scoresGroup: true, // gate retired; scoring reads the frozen snapshot
    groupEditable: editable,
    knockoutEditable: editable,
    canReset: false, // second-chance retired
  };
}
