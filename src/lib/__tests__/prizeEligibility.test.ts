import { describe, it, expect } from "vitest";
import { isPrizeEligible, REFERRAL_GOAL } from "@/lib/prizeEligibility";

// "The TopCorner Invitational" is a free, skill-based contest: the highest-scoring
// ELIGIBLE bracket wins $75. Eligibility is double-sided and free — you qualify by
// bringing in at least one real player OR by being brought in by one. Guests (no
// real account) can never win cash, so they're never eligible.
describe("isPrizeEligible", () => {
  it("qualifies a player who referred at least one real user", () => {
    expect(isPrizeEligible({ isGuest: false, referredBy: null, referralCount: 1 })).toBe(true);
  });

  it("qualifies a player who was referred by someone (invited friend)", () => {
    expect(
      isPrizeEligible({ isGuest: false, referredBy: "referrer-id", referralCount: 0 }),
    ).toBe(true);
  });

  it("qualifies a player who both referred and was referred", () => {
    expect(
      isPrizeEligible({ isGuest: false, referredBy: "referrer-id", referralCount: 3 }),
    ).toBe(true);
  });

  it("excludes an organic player (neither referred nor referring)", () => {
    expect(isPrizeEligible({ isGuest: false, referredBy: null, referralCount: 0 })).toBe(false);
  });

  it("never qualifies a guest, even if they were referred", () => {
    expect(
      isPrizeEligible({ isGuest: true, referredBy: "referrer-id", referralCount: 5 }),
    ).toBe(false);
  });

  it("treats REFERRAL_GOAL as the threshold (exactly at the goal qualifies)", () => {
    expect(REFERRAL_GOAL).toBe(1);
    expect(
      isPrizeEligible({ isGuest: false, referredBy: null, referralCount: REFERRAL_GOAL }),
    ).toBe(true);
    expect(
      isPrizeEligible({ isGuest: false, referredBy: null, referralCount: REFERRAL_GOAL - 1 }),
    ).toBe(false);
  });
});
