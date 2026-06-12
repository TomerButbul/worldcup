import { describe, it, expect } from "vitest";
import { bracketLockState } from "@/lib/bracketLock";

const KICK = Date.parse("2026-06-11T19:00:00Z");
const R32 = Date.parse("2026-06-28T16:00:00Z");
const base = {
  kickoffMs: KICK,
  knockoutLockMs: R32,
  submittedAtMs: null as number | null,
  resetAtMs: null as number | null,
  hasGroupBracket: false,
};

describe("bracketLockState — the two-phase / second-chance rules", () => {
  it("before kickoff: everything is editable", () => {
    const s = bracketLockState({ ...base, now: KICK - 1000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(s.groupEditable).toBe(true);
    expect(s.knockoutEditable).toBe(true);
  });

  it("committed player after kickoff: locked, scores group, can reset", () => {
    const s = bracketLockState({ ...base, now: KICK + 1000, hasGroupBracket: true, submittedAtMs: KICK - 5000 });
    expect(s.committed).toBe(true);
    expect(s.groupEditable).toBe(false);
    expect(s.knockoutEditable).toBe(false); // must reset to touch the knockout
    expect(s.canReset).toBe(true);
    expect(s.scoresGroup).toBe(true);
  });

  it("after reset: knockout reopens until R32, group points forfeited, can't reset twice", () => {
    const s = bracketLockState({
      ...base,
      now: KICK + 1000,
      hasGroupBracket: true,
      submittedAtMs: KICK - 5000,
      resetAtMs: KICK + 500,
    });
    expect(s.inReset).toBe(true);
    expect(s.knockoutEditable).toBe(true);
    expect(s.scoresGroup).toBe(false);
    expect(s.canReset).toBe(false);
  });

  it("late joiner (no committed bracket): group + knockout both open until R32, no group points, no reset prompt", () => {
    const s = bracketLockState({ ...base, now: KICK + 100000, hasGroupBracket: false, submittedAtMs: null });
    expect(s.committed).toBe(false);
    expect(s.groupEditable).toBe(true);   // can fill in group section to seed knockout bracket
    expect(s.knockoutEditable).toBe(true);
    expect(s.scoresGroup).toBe(false);    // but earns no group points
    expect(s.canReset).toBe(false);
  });

  it("late joiner who submitted after kickoff: group still editable, no group points", () => {
    const s = bracketLockState({ ...base, now: KICK + 100000, hasGroupBracket: true, submittedAtMs: KICK + 50000 });
    expect(s.committed).toBe(false);
    expect(s.groupEditable).toBe(true);
    expect(s.scoresGroup).toBe(false);
  });

  it("after R32: knockout locked for everyone (reset + late alike)", () => {
    const reset = bracketLockState({
      ...base,
      now: R32 + 1000,
      hasGroupBracket: true,
      submittedAtMs: KICK - 5000,
      resetAtMs: KICK + 500,
    });
    expect(reset.knockoutEditable).toBe(false);
    expect(reset.canReset).toBe(false);
    const late = bracketLockState({ ...base, now: R32 + 1000, hasGroupBracket: false });
    expect(late.knockoutEditable).toBe(false);
  });

  it("a bracket first submitted AFTER kickoff is not 'committed' (no group points, knockout open)", () => {
    const s = bracketLockState({ ...base, now: KICK + 100000, hasGroupBracket: true, submittedAtMs: KICK + 50000 });
    expect(s.committed).toBe(false);
    expect(s.scoresGroup).toBe(false);
    expect(s.knockoutEditable).toBe(true);
  });
});
