// Eligibility rules for "The TopCorner Invitational" — the free, skill-based $75
// best-bracket contest. Pure + framework-free so it's the single source of truth
// shared by the data layer (server) and any UI badge: change the rule here once.
//
// The rule is double-sided and entirely free:
//   • you brought in at least one REAL player (referralCount counts non-guest
//     accounts you referred), OR
//   • a real player brought you in (referredBy is set).
// Guests can never win cash, so a guest is never eligible regardless of referrals.

export const REFERRAL_GOAL = 1;

export type EligibilityInput = {
  /** True for anonymous "play as guest" accounts — never eligible for a cash prize. */
  isGuest: boolean;
  /** The profile id of whoever referred this user, or null if organic / not yet attributed. */
  referredBy: string | null;
  /** How many REAL (non-guest) users this player has referred. */
  referralCount: number;
};

export function isPrizeEligible({ isGuest, referredBy, referralCount }: EligibilityInput): boolean {
  if (isGuest) return false;
  return referralCount >= REFERRAL_GOAL || referredBy !== null;
}
