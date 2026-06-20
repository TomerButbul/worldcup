import { describe, it, expect } from "vitest";
import { bracketLockState } from "@/lib/bracketLock";

const KICK = Date.parse("2026-06-11T19:00:00Z");
const FREE = Date.parse("2026-06-22T04:00:00Z"); // free-edit lock — Sunday night
const R32 = Date.parse("2026-06-28T16:00:00Z");
const base = {
  kickoffMs: KICK,
  knockoutLockMs: R32,
  freeEditLockMs: FREE,
  submittedAtMs: null as number | null,
  resetAtMs: null as number | null,
  hasGroupBracket: false,
};

describe("bracketLockState — free-edit re-open window", () => {
  it("before the free-edit lock: everyone can edit the whole bracket", () => {
    const committed = bracketLockState({ ...base, now: FREE - 1000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(committed.groupEditable).toBe(true);
    expect(committed.knockoutEditable).toBe(true);

    const late = bracketLockState({ ...base, now: FREE - 1000, hasGroupBracket: false });
    expect(late.groupEditable).toBe(true);
    expect(late.knockoutEditable).toBe(true);
  });

  it("after kickoff but before the free-edit lock, a committed player STILL edits freely", () => {
    const s = bracketLockState({ ...base, now: KICK + 100000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(s.groupEditable).toBe(true);
    expect(s.knockoutEditable).toBe(true);
  });

  it("after the free-edit lock: the whole bracket is locked for everyone", () => {
    const committed = bracketLockState({ ...base, now: FREE + 1000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(committed.groupEditable).toBe(false);
    expect(committed.knockoutEditable).toBe(false);

    const late = bracketLockState({ ...base, now: FREE + 1000, hasGroupBracket: false });
    expect(late.knockoutEditable).toBe(false);
  });

  it("still derives `committed` — it drives the group snapshot, not the lock", () => {
    const yes = bracketLockState({ ...base, now: FREE - 1000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(yes.committed).toBe(true);
    const no = bracketLockState({ ...base, now: FREE - 1000, hasGroupBracket: true, submittedAtMs: KICK + 50000 });
    expect(no.committed).toBe(false);
  });

  it("the second-chance reset is retired: canReset is always false", () => {
    const s = bracketLockState({ ...base, now: FREE - 1000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(s.canReset).toBe(false);
  });
});
